# KorenKrita Skills

个人 Agent Skills 订阅仓库，同时支持 Claude Code Marketplace 和 Pi Package。

## 订阅

### Claude Code

```bash
/plugin marketplace add KorenKrita/skills
```

按需安装三个 plugin：

```bash
/plugin install base@korenkrita-skills
/plugin install plus@korenkrita-skills
/plugin install creative@korenkrita-skills
```

常用组合：

```text
base                  Matt Pocock active 主体
base + plus           编码、审计、决策和读取
base + creative       编码、界面、写作和架构图
base + plus + creative  全部 34 个 Skill
```

### Pi

全局安装仓库中的全部 Skill：

```bash
pi install git:github.com/KorenKrita/skills
```

Pi 根据 Skill 的 `description` 自动按需加载，也可以手动调用：

```text
/skill:tdd
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
| **base** | Matt Pocock active 工程与生产力主体 | 22 |
| **plus** | 工程审计、决策方法与读取工具 | 9 |
| **creative** | UI 设计、中文写作优化与架构图 | 3 |

`plus` 还附带：

- `agents/nuclear-review.md`：`nuclear-review` Skill 的 Claude Code subagent。

Pi 只加载三个 plugin 的 `skills/`；plugin-level Agent 仅对 Claude Code 生效。

## 上游同步

`overrides.yaml` 记录每个外部 Skill 的来源、改名和兼容 patch。GitHub Actions 每天按上游文件内容审计，并通过 PR 提交更新。

主要来源：

- [mattpocock/skills](https://github.com/mattpocock/skills)
- [tw93/Waza](https://github.com/tw93/Waza)
- [hylarucoder/hai-stack](https://github.com/hylarucoder/hai-stack)
- [shadcn/improve](https://github.com/shadcn/improve)
- [cursor/plugins](https://github.com/cursor/plugins)
- [op7418/Humanizer-zh](https://github.com/op7418/Humanizer-zh)
- [tanweai/pua](https://github.com/tanweai/pua)
- [tt-a1i/archify](https://github.com/tt-a1i/archify)

## 许可证

各 Skill 保留原始许可证。仓库同步与生成工具代码为个人使用。
