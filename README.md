# KorenKrita Skills

精选通用 AI Agent 技能集（单列表 `core` 插件，共 10 个技能），原生支持 **Claude Code**、**Cursor**、**Codex** 和 **Pi** 四个宿主，并保留自动上游同步与补丁引擎。

## 包含技能（10 个）

| 技能 | 来源 | 用途 |
|---|---|---|
| `grill-me` | `mattpocock/skills` (`grilling` 改名) | 沿决策树逐轮深度追问，压测方案与边界 |
| `writing-for-agents` | `mattpocock/skills` | 编写高质量 `AGENTS.md` 与 Skill 的结构化指南 |
| `prototype` | `mattpocock/skills` | 写代码前制作复杂逻辑状态机沙盒或 UI 变体原型 |
| `razor` | `hylarucoder/hai-stack` (去绑定补丁) | 奥卡姆剃刀审计需求、架构、状态机与抽象冗余 |
| `mit-design` | 本仓自研 | MIT 公理设计矩阵（FR × DP）架构体检与可改度分级 |
| `i-have-adhd` | `ayghri/i-have-adhd` | ADHD 友好输出格式：结论先行、分步编号、防跑偏 |
| `award-tier-web-design` | 本仓自研 | 获奖级（Awwwards / FWA）落地页视觉设计与截图自检 |
| `frontend-design` | Anthropic (`Apache-2.0`) | 高辨识度通用前端界面与排版设计规范 |
| `gemini-frontend-design` | Google Gemini (`Apache-2.0`) | 通用网站与 Web 应用的视觉、配色、动效设计指南 |
| `typesafe-ai` | TypeSafe (`MIT`) | TypeSafe System One (Jev) 接入与使用说明（手动调用） |

## 安装与订阅

### Pi

```bash
pi install git:github.com/KorenKrita/skills
```

通过 `package.json` 的 `pi.skills` 直接加载 `./plugins/core/skills` 下的全部技能，无需额外扩展或开关。

### Claude Code

```bash
/plugin marketplace add KorenKrita/skills
/plugin install core@korenkrita-skills
```

### Cursor

在 Cursor 插件市场中订阅仓库 `KorenKrita/skills`（读取 `.cursor-plugin/marketplace.json` 与 `plugins/core/.cursor-plugin/plugin.json`）并安装 `core`。

### Codex

```bash
codex plugin marketplace add https://github.com/KorenKrita/skills.git
```

或在 Codex 插件管理中添加本仓库（读取 `.agents/plugins/marketplace.json` 与 `plugins/core/.codex-plugin/plugin.json`），安装 `core`。

## 开发与维护

```bash
npm install
npm run build:marketplace   # 从 marketplace.yaml 生成 Claude / Cursor / Codex 三端清单
npm test                    # 运行结构、生成器、补丁与同步单元测试
npm run sync                # 手动检查上游变更（日常由 GitHub Actions 定时同步）
```

### 目录结构

- `plugins/core/skills/` — 全部 10 个技能目录
- `marketplace.yaml` — 单一市场元数据真源
- `sources.yaml` / `overrides.yaml` / `.sync-state.json` — 上游同步源、声明式补丁与状态锁定
- `scripts/` — 同步引擎（`sync.ts`、`patch-engine.ts`）与多宿主清单生成器（`build-marketplace.ts`、`marketplace-generator.ts`）
- `.claude-plugin/`、`.cursor-plugin/`、`.agents/plugins/`、`plugins/core/.{cursor,codex}-plugin/` — 自动生成清单（勿手改）
