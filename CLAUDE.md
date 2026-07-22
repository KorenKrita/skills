# KorenKrita Skills

个人 Skill 订阅仓库，通过一个 Marketplace 分发三个 Claude Code plugin，并作为一个 Pi Package 加载全部 Skill。

## 项目结构

```text
plugins/base/skills/<skill>/SKILL.md      Matt Pocock active 主体（22）
plugins/plus/skills/<skill>/SKILL.md      工程、思考与工具增强（13）
plugins/plus/agents/*.md                  plus 的 Claude Code subagents
plugins/plus/hooks/                       独立 Claude Code hooks
plugins/creative/skills/<skill>/SKILL.md  设计、写作与视觉能力（7）
overrides.yaml                            上游来源、改名、排除和 patch
marketplace.yaml                          三个 plugin 的 Marketplace 元数据
.claude-plugin/marketplace.json           生成产物
.sync-state.json                          上游 SHA 与文件清单
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
- 本地 Skill 直接放入目标 plugin；当前本地 Skill 是 `plus/fan-out`。
- Skill 目录名必须等于 `SKILL.md` frontmatter 的 `name`。
- 同一个 Skill name 在整个仓库只出现一次，避免 Pi 递归发现 collision。
- `.claude-plugin/marketplace.json` 由 `marketplace.yaml` 生成。
- `.sync-state.json` 由同步流程维护；结构迁移时必须与 overrides key 和上游文件清单一起迁移。
- `base` 保持 Matt active 22 的 canonical name 和内部引用。
- `plus/agents`、`plus/hooks` 仅对 Claude Code 生效；Pi 只加载 `plugins/*/skills`。

## Agent skills

### Issue tracker

Issues live in GitHub Issues (KorenKrita/skills). See `docs/agents/issue-tracker.md`.

### Triage labels

See `docs/agents/triage-labels.md`.

### Domain docs

See `docs/agents/domain.md`.
