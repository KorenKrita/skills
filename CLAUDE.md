# KorenKrita Skills

个人 Skill 订阅仓库，通过一个 Marketplace 分发两个 plugin（Claude Code 与 Cursor 各一套清单），并作为一个 Pi Package 加载全部 Skill。

## 项目结构

```text
plugins/base/skills/<skill>/SKILL.md      mattpocock/skills engineering + productivity 完整镜像（27）
plugins/plus/skills/<skill>/SKILL.md      ADHD 输出、需求剃刀与安全/逆向（3）
pi/index.ts                               Pi 扩展：按 pi.config.json 决定注入哪些 Skill 集
pi/settings.ts                            配置解析与 Skill 路径计算（纯函数，tests/ 覆盖）
pi.config.json                            Pi 注入配置：defaults.base / defaults.plus / mattCommand
                                          （用户可用 ~/.pi/agent/skills-injection.json 覆盖，只需写要改的键）
overrides.yaml                            Skill 归属：上游来源、改名、排除、patch，本地自有声明
marketplace.yaml                          两个 plugin 的 Marketplace 元数据
.claude-plugin/marketplace.json           生成产物（Claude Code）
.cursor-plugin/marketplace.json           生成产物（Cursor）
plugins/*/.cursor-plugin/plugin.json      生成产物（Cursor 每 plugin 清单）
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
- 本地自有 Skill：`plus/sec-router`、`plus/award-tier-web-design`；`base` 全部为上游同步。
- Skill 目录名必须等于 `SKILL.md` frontmatter 的 `name`。
- 同一个 Skill name 在整个仓库只出现一次，避免 Pi 递归发现 collision。
- `.claude-plugin/marketplace.json`、`.cursor-plugin/marketplace.json`、`plugins/*/.cursor-plugin/plugin.json` 均由 `marketplace.yaml` 生成，不手改。
- `.sync-state.json` 由同步流程维护，只覆盖上游 Skill；结构迁移时必须与上游 overrides key 和上游文件清单一起迁移。
- `base` 固定 27 个 Skill（随上游 engineering + productivity 目录增减而变，变更时同步 overrides、同步状态、布局测试与文档）、`plus` 固定 3 个；`base` 为 mattpocock/skills 上游纯镜像，本地改动只发生在 `plus`。
- Pi 通过 `pi/index.ts` 按 `pi.config.json` 注入 `plugins/*/skills`；`package.json` 的 `pi` 键只声明扩展，不直接列 Skill。
- 仓库只发布 `base` 和 `plus` 两个 plugin。

## Agent skills

### Issue tracker

Issues live in GitHub Issues (KorenKrita/skills). See `docs/agents/issue-tracker.md`.

### Domain docs

See `docs/agents/domain.md`.
