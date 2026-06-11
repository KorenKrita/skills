# ADR-0002: 单分支策略（main 同时存放源和产物）

## Status: Accepted

## Context

最初考虑双分支：src 放源文件、main 放生成的 plugin 结构。原因是不想产物污染源文件。

备选方案：
- A) 双分支（src + main）——源和产物分离
- B) 单分支（main）——源和产物共存

## Decision

选 B。原因：
- Claude Code marketplace 订阅默认用仓库默认分支，不支持指定分支
- 双分支需要两套 PR 流程，增加复杂度
- 使用 strict: false 后产物很轻（只有一个生成的 marketplace.json）

## Consequences

- CI 同步后的 PR 直接合到 main
- 用户订阅时无需特殊配置
- overrides.yaml、marketplace.yaml 等管理文件对订阅者可见（无害）
