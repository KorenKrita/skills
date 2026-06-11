# ADR-0004: 复杂 plugin 用外部引用而非拆散收录

## Status: Accepted

## Context

某些上游 plugin（ui-ux-pro-max、原本的 kami）包含 7+ skill、CLI 工具、共享资源等，内部 skill 之间有依赖关系。

备选方案：
- A) 拆散——只提取我们需要的 skill 放进本地 plugin
- B) 外部引用——在 marketplace.json 中用 GitHub source 指向原仓库

## Decision

当 plugin 满足以下任一条件时用外部引用（B）：
- 有自己的 plugin.json 且声明了 components
- skill 之间共享 CLI/scripts/资源且无法独立运行
- 维护成本高于收益

当 skill 可独立运行且只有 SKILL.md + 资源文件时，拆散收录（A）。

## Consequences

- 外部引用的 plugin 更新由原作者推送，我们不维护
- 用户从我们的 marketplace 安装时自动从原仓库拉取
- 无法对外部引用的 plugin 做 patch
