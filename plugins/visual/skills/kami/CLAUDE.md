# Kami

Document-generation skill and template system. Editorial HTML templates + PDF/PPTX/PNG build pipeline.

## 启动前

- 个人/全局规则可放在仓库外；本文件只记录 Kami 项目内的 Claude Code 入口和维护规则。
- 仓库地图、Working Rules、Current Risk Areas、Verification Details、Release Flow、Fonts 全在 `AGENTS.md`。
- 模板设计规范看 `references/design.md`，写作规范看 `references/writing.md`，反模式 checklist 看 `references/anti-patterns.md`。

## 常用命令

```bash
python3 scripts/build.py                   # 构建所有目标
python3 scripts/build.py --check           # 快速校验
python3 scripts/build.py --verify          # 完整验证
python3 scripts/build_metadata.py --check  # Codex 插件镜像和 marketplace 漂移检查
python3 scripts/tests/test_build.py        # 测试套件
bash scripts/ensure-fonts.sh               # 字体恢复（缺字体或字体被截断时）
bash scripts/package-skill.sh              # 构建 release 压缩包
```

## 项目独有硬规则

- 改 style 时同步更新 `references/design.md` 和模板 tokens，不要只改单点。
- 加新模板：从最近的模板复制，对齐 `references/design.md`，加 demo 覆盖。
- 不要在 docs / template 注释 / 脚本输出里用图形 emoji。脚本状态用 `OK:` / `ERROR:`。
- 模板**内联** CSS，不抽公共 partial。修 CSS 漂移时跨模板同步改，不要引入 build-time include。
- `HTML_TEMPLATES` 注册表在 `scripts/shared.py`，加删模板改这一处，不要分别改 build.py。
- 不打包大体积商业字体到 `dist/kami.zip`，但模板要保留稳定的本机预览路径。
- `dist/kami.zip` 是 tracked release 制品。小修通常刷 latest release 资源即可，不必新 tag。
- 改 build / packaging 相关代码后，刷新并检查 `dist/kami.zip`；新增 helper/module/reference JSON 后，确认文件已被 Git 跟踪并进入 package。
- 官网 / AI 可见性改动不只看首页：同步 `index*.html`、README、`llms.txt`、`robots.txt`、`sitemap.xml`、JSON-LD、FAQ、安装 / 版本 / 支持链接，并看 375px / 1280px 真实截图。
- 改 Codex / Claude 插件 marketplace、版本或安装路径后，不只看 metadata；跑 `python3 scripts/build_metadata.py --check`，必要时用隔离 `CODEX_HOME=/tmp/...` 或对应 Claude 插件安装路径做真实冒烟。
- 刷新 release 包或 latest 资源前后，不只看页面大小；下载 `kami.zip`，对比 ZIP entry 列表和每个 entry 的 SHA-256。
- 不提交一次性的 review 报告或诊断快照；只把稳定规则沉淀到 `AGENTS.md`、`SKILL.md` 或 `references/`。
