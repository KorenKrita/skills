# Domain Glossary

## Core Concepts

| Term | Definition |
|---|---|
| **skill** | 一个 `SKILL.md` 加可选 scripts、references、assets、Skill metadata 的最小能力单元 |
| **plugin** | Claude Code 的安装单元；本仓库固定为 `base`、`plus` 两个 |
| **base** | 核心工程与协作流程，共 9 个 Skill；除 `improve-codebase-architecture` 外均跟随 mattpocock/skills |
| **plus** | 决策方法、代码质量审查、通用工具、中文写作优化、可视化讲解、架构图、白话重述与安全/逆向技能路由，共 10 个 Skill；附带 Claude Code Agent |
| **marketplace** | `.claude-plugin/marketplace.json` 定义的两个 plugin 聚合入口 |

## Sync System

| Term | Definition |
|---|---|
| **overrides.yaml** | 声明上游 repo/path/ref、目标 plugin、改名、排除文件和 declarative patches |
| **patch** | 上游同步后应用的声明式修改；支持 frontmatter、单次/全量文本替换和追加内容 |
| **target patch** | 对 Skill 内指定文件应用独立 patch，例如双语 SKILL 或 harness metadata |
| **extra mapping** | 把上游 Skill 目录外的 Agent/Hook 文件同步到 plugin-level 路径，并可单独 patch |
| **sync state** | `.sync-state.json` 记录上游 SHA 和受管理文件清单，用于更新与删除检测；只包含上游 Skill |
| **ownership** | overrides 条目的归属声明：缺省或 `upstream` 由同步流程管理，`local` 表示仓库自有、同步跳过 |
| **provenance** | 本地自有 Skill 的来源记录：上游 repo、path、ref、fork 基准 SHA 和许可证归属 |

## Classification

| Term | Definition |
|---|---|
| **upstream skill** | 在 `overrides.yaml` 中声明并由 CI 跟随外部仓库更新的 Skill |
| **local skill** | 在 `overrides.yaml` 中以 `ownership: local` 声明、由仓库自己维护、不被同步覆盖的 Skill |
| **skill payload** | Skill 运行所需的 SKILL、scripts、references、assets 和 metadata |
| **plugin asset** | Claude Code 专用的 plugin-level Agent、Hook 或其他资源 |

## Naming Conventions

- Plugin：`base`、`plus`。
- Skill 目录名 = Skill 调用名 = frontmatter `name`。
- 外部 Skill 改名由 overrides key + `set_frontmatter` + 相关 metadata patch 共同完成。
- `nuclear-review` 的 plugin-level Agent 与 Skill 使用同一个最终名称。
- 来源名称与运行名称分离；上游原名只保留在 overrides 的 source/provenance 配置中。
- `grill-me` 是上游 `productivity/grilling` 的运行名，由 overrides key 加 `set_frontmatter` 完成改名。
