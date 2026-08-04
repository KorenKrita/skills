# ADR-0005: 用 ownership: local 声明仓库自有的 fork Skill

## Status: Accepted

## Context

`base` 精简到 7 个 Skill 后，`improve-codebase-architecture` 的上游版本仍然依赖已被移除的 `/codebase-design`、`/grilling`、`/domain-modeling`，并假定 `CONTEXT.md` 与 `docs/adr/` 的固定布局。要让它继续可用，必须重写探索、rubric 和收尾流程，改动幅度远超"上游文本 + 少量 patch"。

`overrides.yaml` 原本只表达一种归属：条目存在即由同步流程拉取并覆盖。可选方案：

- A) 保留上游条目，用覆盖整篇正文的巨型 `replace` patch 表达重写；
- B) 保留上游条目，把除 `SKILL.md` 外的所有文件 `exclude_files` 掉，再本地维护正文；
- C) 从 `overrides.yaml` 删除条目，Skill 变成不在任何清单里的孤儿目录；
- D) 在 `overrides.yaml` 中显式声明归属，同步流程按归属跳过。

## Decision

选 D。overrides 条目新增可选 `ownership` 字段：

- 缺省或 `upstream`——同步流程拉取、patch、记录 `.sync-state.json`；
- `local`——同步流程完全跳过，条目不带 `source`，改用 `provenance` 记录 fork 的上游 repo、path、ref、基准 SHA、fork 日期和许可证归属。

`scripts/sync-utils.ts` 的 `planSync` 把 overrides 拆成 `sync` 与 `skipped` 两组；`.sync-state.json` 的孤儿清理只以 `sync` 组为准，本地条目不进入同步状态也不会被当成孤儿。inventory、目录/frontmatter 一致性和 Marketplace 生成继续覆盖全部条目。

## Consequences

- 本地重写的 Skill 不会被每日同步覆盖，也不需要巨型 patch 或 `exclude_files` 变通。
- 本地 Skill 仍在唯一的 Skill 清单里，`base`/`plus` 的 inventory 校验不留缺口。
- fork 来源与许可证在配置中可审计；`provenance.forked_at_sha` 指明可比对的上游基准。
- 代价：本地 Skill 不再自动获得上游改进，需要人工比对 `provenance` 决定是否回抓。
