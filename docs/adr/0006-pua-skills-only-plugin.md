# ADR-0006: PUA 作为独立的 Skills-only plugin 发布

## Status: Accepted

## Context

`tanweai/pua` 的核心 `skills/pua` 会路由到同仓库的 `pro`、`p7`、`p9`、`p10` 等兄弟 Skill。此前本仓库只把 `skills/pua` 同步到 `plus`，并排除了多份共享 reference，导致 `/pua:pro`、`/pua:p7`、`/pua:p9`、`/pua:p10` 成为悬空调用。

上游完整 Claude plugin 还包含 commands、hooks、plugin-level Agents 和 scripts。用户只需要独立 Skills，不需要这些运行时资产。若把兄弟 Skill 继续塞入 `plus`，Claude Code 的 namespace 会从上游 `/pua:*` 变成 `/plus:*`，需要持续改写上游路由。

## Decision

新增独立 `pua` plugin，发布上游 `skills/` 下全部 12 个独立 Skill：

- `ding`
- `mama`
- `p10`
- `p7`
- `p9`
- `pro`
- `pua`
- `pua-en`
- `pua-ja`
- `pua-loop`
- `shot`
- `yes`

其中 11 个 Skill 继续跟随上游同步。`pua-loop` 的上游实现硬依赖未发布的 setup script 与 Stop hook，改为 `ownership: local` 的单 Agent 显式迭代版本，并保留上游 provenance 与 MIT license。

不发布上游 `commands/`、`hooks/`、plugin-level `agents/` 或 `scripts/`。`pua` Skill 的全部 shared references 随 payload 发布，兄弟 Skill 通过相对路径读取它们。

对上游文本只应用 Skills-only 兼容 patch：

- 修正硬编码的上游仓库路径为 plugin 内相对路径；
- 移除对未发布 plugin-level Agent 文件的引用；
- 将 hook 自动行为降级为“宿主提供时自动，否则当前 Agent 主动执行”；
- 保持 `/pua:pro`、`/pua:p7`、`/pua:p9`、`/pua:p10` 等 Skill namespace 不变。

## Consequences

- Claude Code 可以用原生 `/pua:<skill>` namespace 调用兄弟 Skill。
- Pi 会从 `plugins/pua/skills/` 发现全部 12 个 Skill。
- PUA payload 不执行 hook，不注册 command，也不加载 plugin-level Agent。
- 上游新增独立 Skill 时不会自动进入 inventory；同步审计需要显式增加 overrides entry，以保持发布范围可审计。
- 上游依赖 hook 的能力在没有宿主 hook 时退化为 Skill 内显式步骤，不再声称自动执行。
