# PUA Teardown Protocol — Agent 生命周期释放协议

> **Skills-only boundary:** 本 plugin 不发布上游 hooks、scripts 或 commands。下文保留的是生命周期设计背景；所有自动动作在本发行版中都由当前 Agent 显式执行，除非宿主独立提供对应能力并能给出运行证据。

> **当职业球队里某位球员已经打完自己那场比赛，你必须让他退场。继续让他站在场上只会拖垮全队节奏。**
> — Netflix Keeper Test 推论

PUA v3 之前的协议只覆盖 agent 生命周期的前 4 步（Define → Spawn → Monitor → Accept），缺后 3 步（**Release → Cleanup → Orphan handling**）。这会导致：

- 验收通过的 P8 不被释放 → 上下文堆满已完成的 agent
- TeamCreate 的 tmux pane 无人关闭 → 资源常驻
- worktree 隔离的 agent 完成后留下孤儿代码副本 → 磁盘+context 浪费
- 会话 auto-compact 后 orphan 加倍 → OOM
- 本 Skills-only suite 无自动 subagent 会计层 → 当前 Agent 必须显式记录并报告活跃 agent

**Skills-only 约束**：本 suite 不注册 Stop/SubagentStop hook。当前 Agent 必须维护活跃 agent 清单，并在 `/plus:pua team-status` 时依据实际运行状态报告；只有宿主明确提供且有运行证据时，才能依赖自动生命周期会计。

本文定义缺失的 3 步，并给出可执行的命令/信号/检查清单。

---

## 生命周期 7 阶段对照

| # | 阶段 | 标准协议 | PUA v3 前 | PUA v3 后 |
|---|------|---------|----------|----------|
| 1 | Define | Task Prompt 六要素 | ✅ p9-protocol 阶段二 | 不变 |
| 2 | Spawn | Agent/TeamCreate | ✅ agent-team.md | 不变 |
| 3 | Monitor | 轮询 / SendMessage | ✅ p9-protocol 阶段三 | 不变 |
| 4 | Accept | P8/P9 验收 | ✅ p9-protocol 阶段四 | 不变 |
| **5** | **Release** | 显式释放信号 | ❌ 无 | 本文 §Release |
| **6** | **Cleanup** | 清 worktree / pane | ❌ 无 | 本文 §Cleanup |
| **7** | **Orphan handling** | 孤儿检测 + 回收 | ❌ 无 | 本文 §Orphan |

---

## §Release — 6 条释放规则

### R1. P9 验收通过必须发 `[TEARDOWN]` 信号

**WHY** ：验收通过 ≠ agent 释放。P9 默认会继续分配下一个任务给同一个 P8，但如果没有下一个任务，老 P8 就这样挂在那里。`[TEARDOWN]` 是明确的"释放/退场"指令。

**HOW** ：P9 在验收旁白后，追加一行：

```
[TEARDOWN] p8-backend | reason: all_tasks_completed | release_resources: true
```

若还有下一轮任务：

```
[REASSIGN] p8-backend | next_task: <task_id> | keep_agent: true
```

二选一必须显式，不允许默认静默。

### R2. P10 换届强制 teardown 整个 P9 团队

**WHY**：P9 切换（/plus:p9 → 不同项目）时，旧 P9 管理的 P8 全部成了孤儿——没有老板会来验收它们的交付。

**HOW**：P10 下发换届指令时必须级联：

```
[TEARDOWN-CASCADE] p9-current | descendants: [p8-backend, p8-frontend, p7-*] | reason: p9_rotation
```

### R3. worktree agent 完成后安全回收

**WHY**：`isolation: "worktree"` 创建的 git worktree 不会自动删除，但清理前必须保护未提交或尚未整合的工作。

**HOW**：P8/P9 收到 `[P7-COMPLETION]` 后：

1. 检查 worktree 状态、diff 和目标分支，确认成果已经安全整合。
2. 列出准备清理的 worktree、branch 和理由，取得用户授权。
3. 获得授权后仅使用会安全失败的 `git worktree remove <worktree_path>` 与 `git branch -d <worktree_branch>`。
4. 任何未提交修改、未合并 branch、归属不明或仍活跃的资源都只报告，不强制删除。

### R4. TeamCreate 必须配对 TeamDelete

**WHY**：tmux pane 不会因为 agent 完成而自动关闭。team_name 会一直占用 session 标识符。

**HOW**：P9 在所有 P8 发完 `[P8-COMPLETION]` 后，收尾指令：

```
TeamDelete({team_name: "<project-team>"})
```

若跨 sprint 需要保留团队，显式声明：

```
[TEAM-HIBERNATE] <team_name> | reason: next_sprint_continues | ttl: 24h
```

### R5. background agent 默认 TTL = 30min

**WHY**：`run_in_background: true` 启动的 agent 不会被自动 kill。忘了回收 = 永久后台进程吃 token。

**HOW**：spawn 时记录 spawn_time 到 state；超过 30min 未返回 → 主线程主动 `TaskStop`：

```bash
# 在 state 文件里记 agent_id 和 spawn_time
# 巡检命令（也可用作 /plus:pua reap-orphans 后端）
jq '.agents[] | select(.spawn_time < (now - 1800)) | .id' ~/.claude/pua/active-agents.json
```

### R6. subagent 禁止再 spawn team（禁嵌套孤儿）

**WHY**：subagent 自己创建 team 后，主会话完全看不见这些 agent。一旦 subagent 退出，这个 team 就彻底失联。

**HOW**：P8 被 P9 spawn 后，**只能**用 `Agent tool` spawn P7，**不能**用 `TeamCreate`。P9 级别才允许建 team。检测命令：

```
hook 层读 HOOK_INPUT.parent_session_id，若非空且尝试 TeamCreate → 拒绝
```

---

## §Cleanup — 主动清理 checklist

每次 `[TEARDOWN]` 先生成清理计划，不立即执行破坏性命令：

1. 列出本次流程明确创建的 worktree、branch、state file、进程和 pane。
2. 检查 worktree 是否 clean、branch 是否已整合、进程或 pane 是否仍活跃。
3. 向用户展示计划并取得清理授权。
4. 获得授权后使用会安全失败的清理命令；禁止强制删除 worktree 或未合并 branch。
5. pane/process 归属不明或仍活跃时只报告，不终止。
6. 记录实际清理项、跳过项和验证证据。

---

## §Orphan — 孤儿检测与回收

**什么是孤儿**：
- state 文件 mtime > 30 分钟
- 无对应活跃 session
- 无心跳更新

**三层防御**：

1. **会话结束检查**（手动）：当前 Agent 在 team/loop 结束前扫描状态文件，识别并报告 stale 资源
2. **会话启动检查**（手动）：当前 Agent 加载相关 Skill 时扫描 state 目录，发现 stale 资源后提示用户确认
3. **用户显式**（手动）：`/plus:pua reap-orphans` 一键扫描 + 回收

---

## §Switches — 开关语义映射

PUA 的 14 个 slash 命令在本协议下的生命周期语义：

| 命令 | 原语义 | 扩展后语义 | 映射操作 |
|------|--------|-----------|---------|
| `/plus:pua on` | 打开默认加载 | 不变 | config: always_on=true |
| `/plus:pua off` | 关闭默认加载 | **+ 停 loop + 级联 teardown** | off → cancel-loop → teardown-all |
| `/plus:pua-loop stop` | 停止 loop | 删除 `.pua-loop/state.md`，报告当前资源；只清理本次明确创建且获准清理的 worktree/pane |
| `/plus:pua team-status` 🆕 | — | 列活跃 agent / PID / TTL | 读 state 目录 + jq 汇总 |
| `/plus:pua reap-orphans` 🆕 | — | 扫 stale agent 并 TaskStop | age > 30min 批量回收 |
| `/plus:pua teardown-all` 🆕 | — | 级联释放 P10→P9→P8→P7 | 发 TEARDOWN-CASCADE 到所有层 |

**设计原则**：
- **幂等**：重复执行同一开关不会产生副作用（re-rm 无害、re-kill 先检查）
- **级联**：顶层开关触发底层清理，反向不允许（P7 不能 teardown P8）
- **可观测**：所有 teardown 写 `$HOME/.claude/pua/teardown.jsonl`，便于复盘

---

## §自治 — 插件自动启动场景

本 suite 不自动加载，也不附带 GC hook。当前 Agent 在下列生命周期节点显式执行检查；宿主另有自动化时，只在有运行证据后依赖它：

| Hook 事件 | 自治行为 | 实际落地 |
|----------|---------|---------|
| Session start | 当前 Agent 扫描 stale loop state，提示用户确认回收 | Skills-only 手动步骤 |
| Before compact/handoff | 当前 Agent 显式记录活跃资源与恢复步骤 | Skills-only 手动步骤 |
| Session completion | 当前 Agent 运行验证并检查 stale 资源 | Skills-only 手动步骤 |
| Subagent completion | 编排者记录完成状态并从活跃清单移除 | Skills-only 手动步骤 |
| `PostToolUse:Task`（计划） | spawn 时记录 agent_id 到 active-agents.json | ⏳ 待实现（需 Claude Code 该事件支持） |

**重要**：本 suite 不附带 `pua-loop-hook.sh`，也不要求注册 SubagentStop。编排者必须根据实际 subagent 完成事件显式更新活跃清单；宿主提供等价 hook 时，可将其作为有证据的附加防线。

---

## 验收

本协议落地的判定标准：

- ✅ `TeardownDelete` 在 skill 文档里出现次数 ≥ `TeamCreate` 的一半
- ✅ `teardown` / `释放` / `回收` 在 p9-protocol 阶段四后出现 ≥ 3 次
- Skills-only 发布不附带 hook；当前 Agent 必须区分主会话与 subagent 生命周期
- `/plus:pua team-status`、`reap-orphans`、`teardown-all` 由当前 Agent 按本协议执行并报告证据
- ✅ `$HOME/.claude/pua/teardown.jsonl` 可写且有 schema
