# ADR-0011: plus 加入 award-tier-web-design

## Status: Accepted

## Context

ADR-0010 把 `plus` 精简为 3 个 Skill。之后用户需要一个前端视觉规范：做落地页、官网、作品集或页面视觉打磨时，按获奖作品的标准自查迭代。这类任务不常有，不适合写进每个会话都加载的全局 AGENTS.md，只适合在任务出现时按需加载。

## Decision

在 `plus` 新增本地自有 Skill `award-tier-web-design`。用户提供的原始提示词逐字保留，前后补充：开工前的提问、每个维度可检查的底线、用截图驱动且最多 3 轮的自查循环，以及交付清单。

## Consequences

- `plus` 回到 4 个 Skill，常驻上下文多 1 条 Skill 描述。
- 本地自有 Skill 变为 `sec-router` 和 `award-tier-web-design`，同步流程跳过它们。
