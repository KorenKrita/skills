# ADR-0009: base 恢复为 mattpocock/skills 上游纯镜像

## Status: Accepted

## Context

`base` 此前是 mattpocock/skills 的精选子集（9 个 Skill），带有三类本地偏离：`diagnosing-bugs` 的 3 个 patch、`grill-me` 对上游 `productivity/grilling` 的改名同步（上游 `grill-me` wrapper 不导入）、以及 `improve-codebase-architecture` 的 local fork（ADR-0005，起因是上游依赖当时未发布的 sibling Skills）。

用户决定恢复与上游完全一致：官方套件的跨 Skill 调用、`CONTEXT.md`/ADR 约定和 user-invoked/model-invoked 两层设计按原样发布，不再用 patch 抹平差异。

## Decision

`base` 成为 `mattpocock/skills` `skills/engineering`（18）+ `skills/productivity`（7）的完整镜像，共 25 个 Skill：

- `overrides.yaml` 中全部 25 个条目只声明 `source` + `plugin`，`patches: []`，无 `target_patches`、无 `exclude_files`、无改名；
- `grill-me` 与 `grilling` 均为上游原名直连，恢复官方 wrapper + primitive 两层结构；
- `improve-codebase-architecture` 从 `ownership: local` 改回上游同步，删除本地新增的 `DEEPENING.md`；
- 配套的 bro 恢复（dmmulroy 原版）把 wait-what 的能力交还给 `base` 的官方 `wait-what`。

## Consequences

- 上游任何变更（含 GLOSSARY.md 改名、目录扁平化等 breaking change）都会直接进入每日同步；patch 锚点失败类 PR 从此消失，但路径级 breaking change 需要人工迁移 overrides 的 `source.path`。
- 官方 Skill 中的 "Call the Skill tool" 语义面向 Claude Code；Pi 侧这些指令为惰性文本，Pi 用户通过 description 自动加载或 `/skill:<name>` 手动调用。
- base 常驻上下文从 9 个 Skill 描述增长到 25 个，安装 base+plus 的会话多付出约一倍的 skill description 开销。
- ADR-0005 的 local ownership 机制继续服务于 `plus` 的 `bro` 与 `sec-router`。
