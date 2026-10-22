# ADR-0010: plus 精简为 3 个 Skill

## Status: Accepted

## Context

`plus` 有 10 个 Skill。其中 7 个已被其他手段覆盖，近 60 天几乎没有调用：

- `archify`、`show-me`：宿主自带可视化讲解（answer-me-with-html、T3 `html_render`）。
- `read`：宿主的网页与 PDF 读取工具。
- `improve`、`nuclear-review`：base 的 `improve-codebase-architecture` 与多模型评审脚本。
- `bro`：base 的 `wait-what`。
- `humanizer-zh`：用户决定不再保留。

## Decision

`plus` 只保留 `i-have-adhd`、`razor`、`sec-router`。删除上述 7 个 Skill 的目录、overrides 条目、同步状态，以及只服务于它们的 `plugins/plus/agents/nuclear-review.md` 和 archify 同步测试。

## Consequences

- 常驻上下文少 7 条 Skill 描述。
- `plus` 不再带 plugin-level Agent，`plugins/plus/agents/` 不存在。
- 本地自有 Skill 只剩 `sec-router`。
- 需要恢复某个 Skill 时，从本 PR 之前的提交还原目录与 overrides 条目，再跑一次同步。
