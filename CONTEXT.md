# Domain Glossary

## Core Concepts

| Term | Definition |
|---|---|
| **skill** | 一个 `SKILL.md` 加可选 scripts、references、assets、Skill metadata 的最小能力单元 |
| **plugin** | Claude Code 的安装单元；本仓库固定为 `base`、`plus`、`creative` 三个 |
| **base** | Matt Pocock active 22 个 Skill 的 canonical mirror |
| **plus** | 工程审计、决策方法和通用工具，共 13 个 Skill；附带 Claude Code Agent 与 Hook |
| **creative** | UI/Web、中文写作优化、文档排版和插画，共 7 个 Skill |
| **marketplace** | `.claude-plugin/marketplace.json` 定义的三个 plugin 聚合入口 |

## Sync System

| Term | Definition |
|---|---|
| **overrides.yaml** | 声明上游 repo/path/ref、目标 plugin、改名、排除文件和 declarative patches |
| **patch** | 上游同步后应用的声明式修改；支持 frontmatter、单次/全量文本替换和追加内容 |
| **target patch** | 对 Skill 内指定文件应用独立 patch，例如双语 SKILL 或 harness metadata |
| **extra mapping** | 把上游 Skill 目录外的 Agent/Hook 文件同步到 plugin-level 路径，并可单独 patch |
| **sync state** | `.sync-state.json` 记录上游 SHA 和受管理文件清单，用于更新与删除检测 |

## Classification

| Term | Definition |
|---|---|
| **upstream skill** | 在 `overrides.yaml` 中声明并由 CI 跟随外部仓库更新的 Skill |
| **local skill** | 仓库内独立维护且不进入 overrides 的 Skill；当前为 `fan-out` |
| **skill payload** | Skill 运行所需的 SKILL、scripts、references、assets 和 metadata |
| **plugin asset** | Claude Code 专用的 plugin-level Agent、Hook 或其他资源 |

## Naming Conventions

- Plugin：`base`、`plus`、`creative`。
- Skill 目录名 = Skill 调用名 = frontmatter `name`。
- 外部 Skill 改名由 overrides key + `set_frontmatter` + 相关 metadata patch 共同完成。
- `nuclear-review` 的 plugin-level Agent 与 Skill 使用同一个最终名称。
- 来源名称与运行名称分离；上游原名只保留在 provenance 配置中。
