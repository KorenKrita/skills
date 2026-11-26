# AGENTS.md

本仓库是 `KorenKrita/skills`，以单一插件 `plugins/core/skills/` 维护精选通用 AI Agent 技能，并面向 Claude Code、Cursor、Codex、Pi 四个宿主发布。

## 核心规则

1. **单一真相来源**：
   - 市场与插件元数据只改 `marketplace.yaml`，改完必须运行 `npm run build:marketplace`，不要手改 `.claude-plugin/`、`.cursor-plugin/`、`.agents/plugins/` 或 `plugins/core/.{cursor,codex}-plugin/` 下的生成 JSON。
   - 每个磁盘技能目录必须与 `overrides.yaml` 的 `skills` 键 1:1 对应，且 `SKILL.md` 的 frontmatter `name` 必须与目录名完全一致。
   - 上游同步技能由 `sources.yaml` + `overrides.yaml` + `.sync-state.json` 驱动；本地/vendored 技能在 `overrides.yaml` 标记 `ownership: local`，不进 `.sync-state.json`。
2. **四宿主同步保障**：
   - Claude Code：`.claude-plugin/marketplace.json`
   - Cursor：`.cursor-plugin/marketplace.json` + `plugins/core/.cursor-plugin/plugin.json`
   - Codex：`.agents/plugins/marketplace.json` + `plugins/core/.codex-plugin/plugin.json`
   - Pi：`package.json` 的 `pi.skills: ["./plugins/core/skills"]`（无自定义扩展或开关）
3. **验证命令**：
   改动配置、脚本或技能目录后必须运行：
   ```bash
   npm run build:marketplace
   npm test
   npx tsc --noEmit
   ```
