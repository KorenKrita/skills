# ADR-0007: plus 只发布一个 PUA Skill

## Status: Superseded by ADR-0008

## Context

`tanweai/pua/skills/pua` 的正文引用了上游兄弟 Skills 和 plugin runtime。为了消除悬空路由，曾将 11 个兄弟 Skills 一并发布；这是对用户意图的错误扩大。用户只要求 `plus` 保留原来的单个 `pua` Skill。

上游完整 plugin 还包含 commands、hooks、scripts、plugin-level Agents、付费平台协议和多层级协作模式。本仓库的目标不是复制整套 PUA plugin，而是保留一个可独立加载的 PUA 行为 Skill。

## Decision

`plus` 只发布 `plugins/plus/skills/pua`：

- 来源继续跟随 `tanweai/pua/skills/pua`；
- 删除 `ding`、`mama`、`p10`、`p7`、`p9`、`pro`、`pua-en`、`pua-ja`、`pua-loop`、`shot`、`yes`；
- 不发布上游 commands、hooks、scripts 或 PUA plugin-level Agents；
- 通过声明式 patch 把 hook 自动行为改成当前 Agent 的显式行为；
- 味道和工作模式通过自然语言选择，不暴露 sibling Skill 路由；
- 排除只服务于团队层级、付费平台、loop/hook、生命周期回收和多 Skill suite 的 references；
- 保留核心方法论、展示协议、味道库、失败换框和各公司方法论 references。

## Consequences

- `plus` 恢复为 8 个 Skill，全仓库共 15 个 Skill；
- `pua` 是唯一的 PUA Skill，Claude Code 与 Pi 都不再发现 PUA 兄弟 Skill；
- 上游主 Skill 更新仍可通过固定声明式 patch 审计；
- 上游新增 sibling 模式不会自动进入本仓库；需要的行为只能在主 `pua` 内以自然语言模式表达；
- 本发行版不保证任何 hook、Oracle、遥测、自动状态恢复或资源清理能力。
