# Domain Glossary

## Core Concepts

| Term | Definition |
|------|-----------|
| **skill** | 一个 SKILL.md 文件 + 可选资源文件（scripts/、references/），Claude Code 的最小能力单元 |
| **plugin** | 多个 skill 的打包分组，一个可安装单元。目录下包含 `skills/`、可选 `commands/`、`agents/`、`hooks/` |
| **marketplace** | plugin 的聚合目录，用户订阅一个 marketplace 获取多个 plugin。由 `.claude-plugin/marketplace.json` 定义 |
| **external reference** | marketplace 中指向外部 GitHub 仓库的 plugin 条目，不复制文件，原作者维护 |

## Sync System

| Term | Definition |
|------|-----------|
| **overrides.yaml** | 单一配置文件，声明每个上游 skill 的来源（repo + path）和 patch 规则 |
| **patch** | 声明式修改规则，默认作用于上游根目录的 SKILL.md；可用 `patch_targets` 对生成的嵌套 SKILL.md 应用同一组规则。类型：set_frontmatter、remove_frontmatter、append_to_frontmatter、replace、append_content |
| **sync state** | `.sync-state.json`，记录每个 skill 上次同步时的上游 commit SHA 与上游文件清单；文件清单用于删除上游已删除文件，同时保留 local file |
| **marketplace.yaml** | plugin 分组 + 元数据配置，CI 从中生成 `.claude-plugin/marketplace.json` |

## Classification

| Term | Definition |
|------|-----------|
| **upstream skill** | 来自外部 GitHub 仓库的 skill，由 CI 同步更新，在 overrides.yaml 中声明 |
| **local skill** | 用户自己写的 skill，不在 overrides.yaml 中，CI 不碰 |
| **local file** | 用户在某个 upstream skill 目录里额外添加、且不在上次上游文件清单中的文件（如脚本），同步时保留；若上游后来新增同名文件则生成 Draft PR 提醒处理。同步按上游文件清单强制 stage 被 `.gitignore` 命中的文件，并保留 executable mode |

## Naming Conventions

- Plugin 名称：简短英文，kebab-case（engineering, thinking, writing, design, learning, tools, visual）
- Skill 目录名 = skill 调用名 = SKILL.md frontmatter 中的 `name` 字段
- 改名通过 overrides.yaml 的 key（决定目录名）+ set_frontmatter patch（改 name 字段）实现
