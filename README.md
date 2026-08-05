# KorenKrita Skills

个人 Agent Skills 订阅仓库，同时支持 Claude Code Marketplace 和 Pi Package。

## 订阅

### Claude Code

```bash
/plugin marketplace add KorenKrita/skills
```

按需安装两个 plugin：

```bash
/plugin install base@korenkrita-skills
/plugin install plus@korenkrita-skills
```

常用组合：

```text
base               核心工程与协作流程
base + plus  全部 16 个 Skill
```

### Pi

全局安装仓库中的全部 Skill：

```bash
pi install git:github.com/KorenKrita/skills
```

Pi 根据 Skill 的 `description` 自动按需加载，也可以手动调用：

```text
/skill:diagnosing-bugs
```

管理、更新和卸载：

```bash
pi config
pi update --extensions
pi remove git:github.com/KorenKrita/skills
```

仅在当前项目启用：

```bash
pi install -l git:github.com/KorenKrita/skills
```

## Plugin

| Plugin | 内容 | Skill 数量 |
|---|---|---:|
| **base** | 核心工程与协作流程 | 7 |
| **plus** | 决策方法、代码质量审查、读取工具、中文写作优化、架构图、白话重述与单一 PUA Skill | 9 |

`plus` 还附带：

- `agents/nuclear-review.md`：`nuclear-review` Skill 的 Claude Code subagent。

`plus` 只发布一个 `pua` Skill；不附带上游 PUA commands、hooks、scripts、兄弟 Skills 或 plugin-level Agents。

Pi 加载两个 plugin 的 `skills/`；`plus` 的 plugin-level Agent 仅对 Claude Code 生效。

## 上游同步

`overrides.yaml` 记录每个 Skill 的归属：上游 Skill 声明来源、改名和兼容 patch，本地自有 Skill 用 `ownership: local` 声明并保留 fork provenance。GitHub Actions 每天按上游文件内容审计上游 Skill 并通过 PR 提交更新，本地自有 Skill 不受同步覆盖。

`base` 的 `improve-codebase-architecture` 是本地自有 Skill，fork 自 [mattpocock/skills](https://github.com/mattpocock/skills)，因为上游版本依赖本仓库不再发布的 Skill。

主要来源：

- [mattpocock/skills](https://github.com/mattpocock/skills)
- [tw93/Waza](https://github.com/tw93/Waza)
- [hylarucoder/hai-stack](https://github.com/hylarucoder/hai-stack)
- [shadcn/improve](https://github.com/shadcn/improve)
- [cursor/plugins](https://github.com/cursor/plugins)
- [op7418/Humanizer-zh](https://github.com/op7418/Humanizer-zh)
- [tanweai/pua](https://github.com/tanweai/pua)
- [tt-a1i/archify](https://github.com/tt-a1i/archify)
- [dmmulroy/.dotfiles](https://github.com/dmmulroy/.dotfiles)

## 许可证

各 Skill 保留原始许可证。仓库同步与生成工具代码为个人使用。
