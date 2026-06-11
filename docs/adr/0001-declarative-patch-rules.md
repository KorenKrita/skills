# ADR-0001: 使用声明式 patch 规则而非 git 三方合并

## Status: Accepted

## Context

上游 skill 需要本地修改（改 frontmatter、加触发词、内容替换）。需要一种机制在上游更新时保留这些修改。

备选方案：
- A) 隐式 git 三方合并——靠 git diff 推导修改
- B) 显式声明式 patch 规则——在配置文件中声明修改意图

## Decision

选 B。每个修改以结构化规则声明在 overrides.yaml 中。

## Consequences

- 修改意图可读可审计
- 上游大改时不产生含糊的 git conflict marker，而是明确的"规则应用失败"
- 用户可以随时调整规则
- 代价：需要实现 patch engine（已完成，5 种操作类型）
