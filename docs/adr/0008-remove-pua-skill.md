# ADR-0008: 停止发布 PUA Skill

## Status: Accepted

## Context

`plus` 曾保留一个从 `tanweai/pua/skills/pua` 同步的 `pua` Skill。为适配本仓库仅分发 Skills 的边界，它需要维护大量声明式补丁，并持续保留 PUA 专属的同步状态、测试和 Marketplace 元数据。

当前产品范围不再需要该能力，因此继续同步和发布它只会增加维护面，并可能让自动同步重新引入已经决定移除的内容。

## Decision

本仓库不再发布 `pua` Skill：

- 删除 `plugins/plus/skills/pua` 的完整 payload；
- 删除 `overrides.yaml` 中的 `pua` 上游同步声明；
- 删除 `.sync-state.json` 中的 `pua` 状态；
- 从当前库存、文档和 Marketplace 元数据中移除 `pua`；
- 保留 ADR-0006、ADR-0007 和既有实现记录，作为历史决策链。

## Consequences

- `plus` 从 10 个 Skill 减少为 9 个，全仓库共发布 18 个 Skill；
- Claude Code 与 Pi 都不再发现或加载 `pua`；
- 定时同步不会再从 `tanweai/pua` 恢复该 Skill；
- 已有用户若仍需要该能力，必须直接安装其它来源；
- 恢复该 Skill 需要新的显式决策，并同时恢复 payload、同步声明、状态、测试和 Marketplace 元数据。
