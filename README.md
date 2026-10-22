# KorenKrita Skills

个人 Agent Skills 订阅仓库，同时支持 Claude Code Marketplace、Cursor Marketplace 和 Pi Package。

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
base + plus  全部 37 个 Skill（plus 含安全/逆向技能路由）
```

### Cursor

Cursor → Customize → Plugins → 添加 marketplace，填入仓库地址：

```text
https://github.com/KorenKrita/skills
```

随后按需安装 `base` / `plus`。Cursor 读取 `.cursor-plugin/marketplace.json` 与 `plugins/*/.cursor-plugin/plugin.json`，Skill 目录与 Claude Code 共用。

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
| **base** | [mattpocock/skills](https://github.com/mattpocock/skills) engineering + productivity 完整镜像：工程流程与效率工具 | 27 |
| **plus** | ADHD 友好输出、需求剃刀与安全/逆向技能路由 | 3 |

Pi 加载两个 plugin 的 `skills/`。

## 上游同步

`overrides.yaml` 记录每个 Skill 的归属：上游 Skill 声明来源、改名和兼容 patch，本地自有 Skill 用 `ownership: local` 声明并保留 fork provenance。GitHub Actions 每天按上游文件内容审计上游 Skill 并通过 PR 提交更新，本地自有 Skill 不受同步覆盖。

`base` 是 [mattpocock/skills](https://github.com/mattpocock/skills) `skills/engineering` + `skills/productivity` 的完整镜像：27 个 Skill 零 patch、零 fork，与上游一字不差（决策记录见 `docs/adr/0009-base-matt-upstream-mirror.md`）。

主要来源：

- [mattpocock/skills](https://github.com/mattpocock/skills)
- [hylarucoder/hai-stack](https://github.com/hylarucoder/hai-stack)
- [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd)
- [zhaoxuya520/reverse-skill](https://github.com/zhaoxuya520/reverse-skill)

## 许可证

各 Skill 保留原始许可证。仓库同步与生成工具代码为个人使用。
