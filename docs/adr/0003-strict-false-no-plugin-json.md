# ADR-0003: 本地 plugin 使用 strict:false 不创建 plugin.json

## Status: Accepted

## Context

每个本地 plugin 目录（engineering、thinking 等）是否需要自己的 `.claude-plugin/plugin.json`。

备选方案：
- A) 每个 plugin 目录有 plugin.json——标准结构，strict:true
- B) 省略 plugin.json，marketplace 条目设 strict:false 充当完整 manifest

## Decision

选 B。marketplace.json 中设 `strict: false`，plugin 目录不需要 plugin.json。

## Consequences

- 减少维护文件数量
- plugin 元数据集中管理在 marketplace.yaml → CI 生成 marketplace.json
- 外部引用的 plugin（如 ui-ux-pro-max）已有自己的 plugin.json，必须用 strict:true（默认），否则冲突
