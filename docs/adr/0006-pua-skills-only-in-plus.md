# ADR-0006: PUA Skills-only suite 保留在 plus

## Status: Superseded by ADR-0007

## Context

`tanweai/pua` 的核心 `skills/pua` 会路由到同仓库的 `pro`、`p7`、`p9`、`p10` 等兄弟 Skill。此前本仓库只把 `skills/pua` 同步到 `plus`，并排除了多份 shared reference，导致这些路由没有对应的已发布 Skill。

上游完整 Claude plugin 还包含 commands、hooks、plugin-level Agents 和 scripts。用户要补齐独立 Skills，但要求它们继续归入既有 `plus` plugin，不新增安装分类。Claude Code 中这些 Skill 的显式 namespace 因而是 `/plus:<skill>`；Pi 仍按各自 frontmatter `name` 发现 Skill。

最初实现误将完整 PUA suite 发布为独立 `pua` plugin。该分类改变没有获得用户授权，本修订撤销它。

## Decision

在 `plus` 中发布上游 `skills/` 下全部 12 个独立 Skill：

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

其中 11 个 Skill 继续跟随上游同步。`pua-loop` 的上游实现硬依赖未发布的 setup script 与 Stop hook，因此保留为 `ownership: local` 的单 Agent 显式迭代版本，并记录上游 provenance 与 MIT license。

不发布上游 `commands/`、`hooks/`、plugin-level `agents/` 或 `scripts/`。`pua` Skill 的 shared references 随 payload 发布，兄弟 Skill 通过相对路径读取它们。

对上游文本应用 Skills-only 兼容 patch：

- 修正硬编码的上游仓库路径为 `plus` 内相对路径；
- 移除对未发布 plugin-level Agent 文件的引用；
- 将 hook 自动行为降级为“宿主提供时自动，否则当前 Agent 主动执行”；
- 将 Claude Code 显式调用从上游 `/pua:<skill>` 改为本仓库的 `/plus:<skill>`；
- 保留真实验证、状态持久化和安全清理约束。

## Consequences

- 用户只需安装原有 `plus` plugin，不增加独立 PUA 安装项。
- Claude Code 使用 `/plus:<skill>` 调用这些 Skill；Pi 仍发现 `pua`、`pro`、`p7` 等独立 Skill 名称。
- PUA payload 不执行 hook，不注册 command，也不加载 PUA plugin-level Agent。
- 上游新增独立 Skill 时不会自动进入 inventory；需要显式增加 overrides entry。
- 上游依赖 hook 的能力在没有宿主 hook 时退化为 Skill 内显式步骤，不再声称自动执行。
