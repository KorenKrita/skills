# KorenKrita Skills

个人 Agent Skills 聚合仓库，同时支持 Claude Code Marketplace 和 Pi Package。

## 安装

### Claude Code

```bash
/plugin marketplace add KorenKrita/skills
```

然后按需安装 plugin：

```bash
/plugin install engineering@korenkrita-skills
/plugin install thinking@korenkrita-skills
/plugin install writing@korenkrita-skills
/plugin install design@korenkrita-skills
/plugin install learning@korenkrita-skills
/plugin install tools@korenkrita-skills
/plugin install visual@korenkrita-skills
/plugin install ui-ux-pro-max@korenkrita-skills
```

### Pi

全局安装仓库中的全部 skill：

```bash
pi install git:github.com/KorenKrita/skills
```

安装后，Pi 会根据 skill 的 `description` 自动按需加载。也可以在 Pi 中手动调用：

```text
/skill:tdd
```

如果 `/skill:<name>` 命令不可用，可以通过 `/settings` 开启 skill commands，或在 `~/.pi/agent/settings.json` 中设置：

```json
{
  "enableSkillCommands": true
}
```

管理、更新和卸载：

```bash
pi config
pi update --extensions
pi remove git:github.com/KorenKrita/skills
```

默认安装到用户级配置；如需仅在当前项目中启用，可添加 `-l`：

```bash
pi install -l git:github.com/KorenKrita/skills
```

> `ui-ux-pro-max` 是 Claude Marketplace 的外部引用，不在本仓库的 Pi Package skill 集合中。

## Plugin 列表

| Plugin | 描述 | Skill 数量 |
|--------|------|-----------|
| **engineering** | 软件开发全流程：TDD、调试、审查、流程管理 | 14 |
| **thinking** | 通用决策与规划：格局判断、可行性验证、压力测试 | 8 |
| **writing** | 写作全流程：润色、去AI味、构思、成文 | 6 |
| **design** | 前端与 UI/UX 设计 | 2 |
| **learning** | 知识获取与理解：研究、学习 | 2 |
| **tools** | 通用工具：交接、URL 读取、skill 开发、图像描述 | 5 |
| **visual** | 视觉创作：文档排版、插画配图 | 2 |
| **ui-ux-pro-max** | UI/UX 设计全套（外部引用） | 7+ |

## 上游同步

仓库通过 GitHub Actions 每天按文件内容审计全部上游（不只比较 commit SHA），以 PR 形式提交变更供审核。同步会保留本地额外文件，并根据同步状态中的文件清单删除上游已删除文件。

上游来源：
- [mattpocock/skills](https://github.com/mattpocock/skills)
- [tw93/Waza](https://github.com/tw93/Waza)
- [hylarucoder/hai-stack](https://github.com/hylarucoder/hai-stack)
- [alibaba/open-code-review](https://github.com/alibaba/open-code-review)
- [KAOPU-XiaoPu/web-design](https://github.com/KAOPU-XiaoPu/web-design)
- [op7418/Humanizer-zh](https://github.com/op7418/Humanizer-zh)
- [wuji-labs/nopua](https://github.com/wuji-labs/nopua)
- [tw93/kami](https://github.com/tw93/kami)
- [obra/double-shot-latte](https://github.com/obra/double-shot-latte)

## 许可证

各 skill 保留原始许可证。仓库工具代码（scripts/、tests/）为个人使用。
