# KorenKrita Skills

个人 Skill 订阅仓库，通过一个 Marketplace 分发两个 Claude Code plugin，并作为一个 Pi Package 加载全部 Skill。

## 项目结构

```text
plugins/base/skills/<skill>/SKILL.md      核心工程与协作流程（7）
plugins/plus/skills/<skill>/SKILL.md      工程、思考、工具与写作增强（8）
plugins/plus/agents/*.md                  plus 的 Claude Code subagents
overrides.yaml                            Skill 归属：上游来源、改名、排除、patch，本地自有声明
marketplace.yaml                          两个 plugin 的 Marketplace 元数据
.claude-plugin/marketplace.json           生成产物
.sync-state.json                          上游 Skill 的 SHA 与文件清单（不含本地自有 Skill）
```

## 开发命令

```bash
npm ci
npm test
npm run build:marketplace
npm run sync
```

## 关键规则

- 所有修改必须遵守根目录 `AGENTS.md` 的 plugin 版本递增规则。
- 上游 Skill 的修改通过 `overrides.yaml` 声明，不直接维护漂移副本。
- 本地自有 Skill 在 `overrides.yaml` 中用 `ownership: local` 声明并记录 fork provenance；同步流程跳过它们，inventory、布局和 Marketplace 校验照常生效。
- 当前唯一的本地自有 Skill 是 `base` 的 `improve-codebase-architecture`。
- Skill 目录名必须等于 `SKILL.md` frontmatter 的 `name`。
- 同一个 Skill name 在整个仓库只出现一次，避免 Pi 递归发现 collision。
- `.claude-plugin/marketplace.json` 由 `marketplace.yaml` 生成。
- `.sync-state.json` 由同步流程维护，只覆盖上游 Skill；结构迁移时必须与上游 overrides key 和上游文件清单一起迁移。
- `base` 固定 7 个 Skill、`plus` 固定 8 个；Skill 正文不得调用仓库不再发布的 Skill。
- `plus/agents` 仅对 Claude Code 生效；Pi 只加载 `plugins/*/skills`；仓库不再附带 plugin-level hooks。
- 仓库只发布 `base` 和 `plus` 两个 plugin。

## Agent skills

### Issue tracker

Issues live in GitHub Issues (KorenKrita/skills). See `docs/agents/issue-tracker.md`.

### Domain docs

See `docs/agents/domain.md`.
