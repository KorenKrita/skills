# Amp 适配层

本分支保留 `plugins/base` / `plugins/plus` 原样，通过白名单生成 Amp 专用副本。
不会修改 Pi 的安装 checkout，不修改本机 Amp 设置，也不安装 MCP/search skills。

## 来源与构建

- 来源仓库：<https://github.com/KorenKrita/skills>
- 本次基准：[bb2fc96a03ace70272fcb97d82df3ee2b1e71f28](https://github.com/KorenKrita/skills/commit/bb2fc96a03ace70272fcb97d82df3ee2b1e71f28)，fetch 后的 `origin/main`。
- 开发分支：`amp-adapter`；worktree：`/Users/korenkrita/Coding/skills-amp`。
- 原 checkout：`/Users/korenkrita/Coding/skills`，保留在 `feat/base-matt-full-mirror`，未切换或修改。
- `source-lock.json` 记录 reviewed source commit 和每个技能完整目录的 SHA-256 指纹。
  更上游的逐技能来源/版本仍以该 commit 的 `overrides.yaml`、`.sync-state.json`、`VENDOR.md` 为准。
- `profiles.mjs` 是唯一白名单；`patches.mjs` 是定向适配；`policy.md` 是生成时内联的公共宿主约束。
- `generated/` 为可重复生成、不提交的产物；只包括 25 个 base 和 9 个 plus 技能及其资源。
  不复制其他宿主的 `agents/` 元数据；不复制 plugin-level agents/hooks 或安全 vendor。

在 worktree 中，使用现有 Node 与仓库已声明的 `yaml` 依赖：

```sh
node amp/build.mjs
node amp/build.mjs --check
node --test amp/build.test.mjs
```

本机复用了 `/Users/korenkrita/Coding/skills/node_modules`（忽略的本地 symlink），没有安装软件。
在新的 checkout 中，需要先按仓库 lockfile 准备依赖；构建器不会自动联网安装。
模板脚本保持源字节，执行时显式使用 `bash` / `node` / 已有 Python 运行环境，不依赖复制后的 executable bit。

构建先验证全部输入和内存产物，再落盘。检测到生成目录中的人工编辑、未知/陈旧文件或 symlink 会拒绝覆盖；不自动删除。
写入中断可能留下不完整产物，`--check` 会失败；保留旧目录、审查并移入 Trash 后重新生成，不使用 force 绕过检查。
测试创建并打印 `.tmp-amp-test-*` 一次性夹具，便于检查拒绝覆盖后的内容；测试本身不删除它们，结束后移入系统 Trash。

## 未来启用：只指向两个确定的根

本次没有写入 `~/.config/amp/settings.json`。启用前先运行上述构建和检查，之后由用户选择是否配置：

```json
{
  "amp.skills.path": "/Users/korenkrita/Coding/skills-amp/amp/generated/base:/Users/korenkrita/Coding/skills-amp/amp/generated/plus",
  "amp.skills.disableClaudeCodeSkills": true
}
```

`amp.skills.path` 是 **冒号分隔的字符串，不是数组**；Windows 使用分号。
依据：本机 `amp --help` 的 settings reference，版本 `0.0.1789257698-g25321c`（2026-09-13）。
Amp 版本变化后应重新检查 `amp --help`，而不是假定字段永久稳定。

**这些是 additional roots，不是排他白名单。** 这套构建保证自己的 roots 不含未适配技能；
它不能屏蔽其他 `.agents/skills`、全局 Personal/Workspace Skills 或其他自定义路径。
`amp.skills.disableClaudeCodeSkills: true` 仅屏蔽 Claude 技能目录及插件缓存，不影响其他来源。
启用前检查其他来源的同名技能并由用户决定去留；不要同时指向本仓库的 `plugins/*/skills`。
不要把仓库根、`amp/`、整个 `generated/` 或 opt-in 的父目录配置成扫描根。
不需要 `amp skill add` 或安装整仓库。配置后在 Amp 中重新加载技能，核对实际来源路径。

## 适配清单

| 类型 | 技能 | 保留与转换 |
| --- | --- | --- |
| 主体保留 | domain-modeling | glossary/ADR 方法与资源保留；附公共执行约束 |
| 主体保留 | wizard | 人工阶段与模板保留；只查环境变量示例/名称，不读 secret 值；不替用户运行 wizard |
| 主体保留 | i-have-adhd | 正文保留，尊重宿主优先级与用户停止指令 |
| 局部 | diagnosing-bugs | 红色反馈循环、最小复现、回归和 HITL 模板保留；附本机安全边界 |
| 局部 | prototype | logic/UI 两路保留；增加最小验证；生产提升和分支操作不再自动发生 |
| 局部 | tdd | 保留 red→green、反例和公共 seam；已有明确契约不重复强制询问 |
| 局部 | archify | renderer/schema/资源保持；准确工作目录；关闭自动更新检查；浏览器/网络行为需按宿主约束 |
| 局部 | razor | 证据/分类/生存理由保留；默认纯文本图，HTML opt-in |
| 局部 | read | 隐私优先读取与输出契约保留；移除 Waza 安装路径和自动安装指令；普通对话/已有工具回退 |
| 局部 | code-review | Standards/Spec 双轴保留；默认自行审查；覆盖 staged/unstaged/untracked，不只 HEAD |
| 局部 | codebase-design | 深模块词汇保留；替代方案比较不固定模型或并发 agent 数量 |
| 局部 | humanizer-zh | 移除宿主专属 allowed-tools；完整中文指南披露到 reference，入口小于 500 行 |
| 流程 | research | 主源引用和 Markdown 结果保留；取消强制后台 agent；Exa/AnySearch/Codex Search 优先 |
| 流程 | resolving-merge-conflicts | 显式请求；保留双方意图；仅暂存目标文件；有无关 staged 改动时停止继续操作 |
| 流程 | writing-for-agents | 写作方法保留；重写 Amp invocation/frontmatter/router 机制说明 |
| 流程 | ask-matt | 推荐适配后的流程；不依赖上下文清空命令或固定 token 数 |
| 流程 | grill-me | 显式、无状态访谈 |
| 流程 | grill-with-docs | 显式、有状态访谈；保留 glossary/ADR |
| 流程 | grilling | 普通对话提问后等待；自行查事实，按依赖推进问题 |
| 流程 | handoff | 可访问的本地文件；准确 checkout、commit、检查和阻塞；不假定传输代码或创建线程 |
| 流程 | implement | 授权 spec/ticket 实现、TDD、自审和 scoped commit；不隐式发布或关闭 issue |
| 流程 | improve-codebase-architecture | 保留候选评估；本地自包含 HTML，无远程 CDN；不强制 subagent |
| 流程 | setup-matt-pocock-skills | tracker/triage/domain 模板保留；Amp 优先 AGENTS.md，编辑前确认 |
| 流程 | teach | 多轮学习、lesson/reference/记录保留；不直接打开桌面 app |
| 流程 | to-questionnaire | 显式请求，保留收件人/知识差距访谈与文档结构 |
| 流程 | to-spec | 本地 spec 草稿优先；外部发布/label 需明确授权 |
| 流程 | to-tickets | tracer-bullet 与依赖边保留；批准内容不等于批准外部发布 |
| 流程 | triage | 状态机/brief 保留；外部写入、关闭与 labels 需授权；不直接运行不可信 PR 代码 |
| 流程 | wait-what | 显式重述，保留上下文与简明技术语言 |
| 流程 | wayfinder | 决策地图与 frontier 保留；本地 draft 回退；取消强制后台分支与固定上下文大小 |
| 流程 | bro | 显式白话重述 |
| 流程 | improve | 严格 advisor/plans；execute 变为 handoff-only，未实现自动隔离执行器 |
| 流程 | nuclear-review | 严格、证据驱动的只读审查；不自动重构、委派或调用 oracle |
| 流程 | show-me | 显式可视化解释；纯文本 diagram/按需 HTML，不使用 Bash(open ...) |
| 隔离 | sec-router | 默认不发现；只提供 opt-in 的只读兼容性评估，不是完整安全适配 |

原先 user-only 的技能，以及访谈/严格审查/副作用流程，均在 description 和正文声明显式请求条件。
不输出 `disable-model-invocation`，不假定它能提供硬门禁；router 推荐本身不算授权。
保留既有 skill name（即使不是 gerund）以避免跨宿主和工作流引用断裂。

## sec-router 的隔离边界

默认路径不含 `sec-router`。如果用户明确要做兼容性评估，可单独读取
`amp/opt-in/security/sec-router/SKILL.md`；或者未来额外配置准确根：

```text
/Users/korenkrita/Coding/skills-amp/amp/opt-in/security
```

该 opt-in **只启用评估，不启用 operational routing**。没有复制 vendor 到扫描路径。
原包来源为 `zhaoxuya520/reverse-skill`，vendor commit
`71acc8e3115f76bad7a914c36466c1086232288c`，详见原 `VENDOR.md`。
未深审：87 个改名模块、authorization/network-profile contract、bootstrap/tool-index、
Frida/IDA/Ghidra/radare2/平台 SDK/付费工具集成、攻击/CTF 链、case-review 和 journal 写入。
没有运行路由、攻击、安装、探测或授权初始化脚本。未来必须先逐模块审查，再单独授权目标和操作。

## 更新与 rebase

1. 在源码仓库检查 `git status` / `git worktree list`，`git fetch origin`，记录新 `origin/main`。
   在 `skills-amp` 检查干净状态；如有工作，先保存并提交本次范围内的改动，勿自动 stash 用户工作。
2. 对本地、未发布的 `amp-adapter` 执行 `git rebase origin/main`。不要在 Pi 的托管安装目录开发。
   若分支已发布，先获得重写历史的授权或改用新的本地集成分支。
3. 比较旧 `source-lock.json` 的 commit 与新主线，对 `plugins/` 中每个变化审查正文、references、scripts、schema、许可。
   新增 skill 不自动适配；显式更新 `profiles.mjs` 才可加入。漂移时构建必须失败，不能盲目重新记锁。
4. 修订 `patches.mjs` 与测试后，记录已审查的完整主线 commit，再构建和检查：

   ```sh
   node amp/build.mjs --record-source <reviewed-full-origin-main-commit>
   node amp/build.mjs
   node amp/build.mjs --check
   node --test amp/build.test.mjs
   ```

5. 若旧生成文件已不属于白名单或被修改，先保留、审查，再把旧生成目录移入 Trash 并重建。
   核对无重复 name、旧宿主语义、断链和 opt-in 泄漏。提交原子变更并核验 identity，不自动 push。

只改 `amp/` 不改变任何已发布 plugin 的文件或行为，因此不增加 marketplace 版本。
将来若修改 `plugins/` 或共享发布/同步逻辑，必须遵守根 AGENTS.md 的 patch version/build 规则。

## 验证边界与风险

本次本机验证（2026-09-13）：

- `node --test amp/build.test.mjs`：11 组测试通过，包括先失败再修复的输出根 symlink 反例。
- `node amp/build.mjs --check`：34 skills、147 files 一致；默认没有安全包。
- 原仓库 `patch-engine`、`marketplace-generator`、`plugin-version`、`repository-layout`：4 个测试文件、41 项通过。
  未运行完整 suite：`sync-utils.test.ts` 使用直接删除临时文件的 cleanup，不符合本次严格 Trash 约束。
- `node --check` 检查 38 个打包 JS 模块；`bash -n` 逐个检查 3 个 shell；Python AST 检查 3 个 Python 文件，通过。
- 用一次性 settings 文件执行 `amp skills list --json --settings-file <temporary-settings>`，未启动模型：
  实际发现 custom-path 34 个（base 25、plus 9），全部来源为本适配生成目录；总计 49 个技能，无重复 name、无 sec-router。
  其余 15 个来自已有宿主/全局来源，进一步证明 custom roots 是追加而非替换。
- `git diff --check` 通过；相对基准的 plugins、marketplace、原 package.json 无差异。

- 验证覆盖 YAML 唯一 key、schema/name/description 长度、重复 name、相对 Markdown 链接和代码 span 资源路径、
  正文与 references 的明确旧工具语义、确定性生成、输入漂移、生成文件保护。
  示例 fenced block 中的项目路径不是 bundled resource；不请求外部 URL，也不验证网络链接是否存活。
- 静态语义扫描不能证明模型每次遵守文字门禁；未做付费模型调用、真实搜索、外部写入或安全场景执行。
- `archify` renderer 与 `read` helper 等原始运行时代码未改；不是完整运行时安全审计。
  例如它们有临时文件直接清理逻辑，本机严格 Trash 规则下应先审查具体命令并选择符合机器规则的路径，
  而不是因为工具被打包就直接执行。缺少浏览器/Python 依赖时报告限制，不自动安装。
- 未运行 HTML 生成或浏览器验证；本次改动是宿主提示/构建层，没有修改 renderer/UI 实现。
  日后技能产生 UI 时仍需实际渲染和截图检查，静态 schema 不能替代视觉验证。
- 不保证 global skill 仓库支持任意二进制资源；此方案是本机 local roots，不是上传全局技能库的方案。
- `bro` 上游在本基准记录为未声明 license；本次只做本地分支，未来公开再分发前需解决许可。

## 回滚

本次没有启用配置，原 checkout 和其他宿主行为未变，直接停止使用该 worktree 即可。
未来启用后，恢复先前设置中的 `amp.skills.path` / Claude discovery 选项，再重新加载技能；
不要清空用户原有路径或删除其他技能。代码回滚优先使用新的 `git revert` commit，避免 reset 用户工作。
需要释放目录时，先确认 worktree 干净且所有需要的内容已提交/另存，使用系统 Trash 移走 worktree；
再从原仓库审查并 prune 已失效的 worktree 元数据，保留分支以便恢复。不要使用强制删除。
