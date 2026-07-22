# ADR-0004: 同步可独立运行的 packaged Skill payload

## Status: Accepted

## Context

部分上游仓库同时包含 Skill 运行资源、网站、showcase、字体全集、CI、发布包和 Marketplace metadata。直接 vendoring 整仓会增加体积、递归发现冲突和无关维护文件。

Kami 是主要案例：上游仓库约 76MB，同时提供约 1.2MB 的 `plugins/kami/skills/kami` packaged payload。

## Decision

优先同步上游明确提供、可独立运行的 packaged Skill payload：

- payload 必须包含 SKILL.md 引用的 scripts、references、templates、assets 和必要 metadata；
- 大型可下载字体、网站、showcase、CI、dist 和嵌套 plugin 外壳不进入本仓库；
- 没有独立 payload、内部资源无法拆分的上游能力，需要单独评估后再引入；
- Marketplace 不使用外部 plugin reference。

Kami 同步路径固定为：

```text
tw93/kami/plugins/kami/skills/kami
→ plugins/creative/skills/kami
```

## Consequences

- Pi 递归扫描只发现一份 Kami。
- Kami 的运行脚本、模板、参考和按需字体下载保持完整。
- 仓库不再携带上游网站、showcase、字体全集和发布产物。
- 上游 payload 路径或引用发生变化时，同步 patch 和文件清单会显式失败或产生差异。
