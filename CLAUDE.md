# KorenKrita Skills

个人 skill 聚合仓库。通过一个 marketplace 统一管理和分发来自多个上游的 Claude Code skill。

## 项目结构

```
plugins/<plugin>/skills/<skill>/SKILL.md   ← skill 文件
plugins/<plugin>/commands/*.md              ← slash commands
plugins/<plugin>/agents/*.md               ← subagents
plugins/<plugin>/hooks/                    ← lifecycle hooks
overrides.yaml                             ← 上游来源 + patch 规则
marketplace.yaml                           ← plugin 分组配置
.claude-plugin/marketplace.json            ← CI 生成的 marketplace 入口
.sync-state.json                           ← CI 维护的版本追踪
```

## 开发命令

```bash
npm test              # 跑测试
npm run build:marketplace   # 重新生成 marketplace.json
npm run sync          # 手动触发上游同步（本地模拟 CI）
```

## 关键规则

- 上游 skill 的修改全部通过 overrides.yaml 的 patch 规则声明，不手动改上游文件
- 自己写的 skill 直接放对应 plugin 目录下 commit，不需要在 overrides.yaml 声明
- `.claude-plugin/marketplace.json` 是生成产物，不手动编辑——改 marketplace.yaml 后跑 build
- `.sync-state.json` 是 CI 维护的，不手动编辑

## Agent skills

### Issue tracker

Issues live in GitHub Issues (KorenKrita/skills). See `docs/agents/issue-tracker.md`.

### Triage labels

Uses default label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout. See `docs/agents/domain.md`.
