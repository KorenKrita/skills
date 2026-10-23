---
name: award-tier-web-design
description: Build or polish a web page to award-tier visual quality (Awwwards / Webby / FWA level) with a screenshot-driven self-review loop over typography, whitespace, hierarchy, color, motion, micro-interaction, responsive layout and originality. Use when the user asks for a landing page, marketing or product site, portfolio, showcase page, or visual polish of an existing page — 做落地页、官网、作品集、展示页、页面视觉打磨、做得高级一点、拿奖级别的设计. Not for internal admin forms or backend work unless the user asks for visual polish.
---

# Award-tier web design

## 开工前：问清楚

1. 已有项目时，先读代码确定技术栈、组件库、品牌色和字体；能从代码查到的不问。
2. 用一次 `ask_user_question` 问清下面几项，用户已经说过的跳过：
   - 页面类型和用途：落地页、官网、作品集、展示页、活动页，还是给已有页面做视觉打磨。
   - 给谁看，看完要做什么（注册、下载、联系、只是留下印象）。
   - 内容素材：文案、图片、logo 是否已有；没有时用什么占位。
   - 风格方向：喜欢的参考站点或关键词，以及明确不要的风格。
3. 根据回答写一句设计概念（例如"像一本印刷精良的建筑杂志"），后面所有取舍都服务于它。

## 目标与自查循环（原文）

```
::OBJECTIVE{site_design|pri:OVERRIDE_ALL}
  target: build page to award-tier visual standard
  ACCEPT: no visible improvement remaining across all CHECK dimensions
  BENCHMARK: Awwwards | Webby Awards | FWA winning entries

::CHECK{typography|standard:award_tier}
::CHECK{whitespace|standard:award_tier}
::CHECK{visual_hierarchy|standard:award_tier}
::CHECK{color|standard:award_tier}
::CHECK{motion|standard:award_tier}
::CHECK{micro_interaction|standard:award_tier}
::CHECK{responsive|standard:award_tier}
::CHECK{originality|standard:award_tier}

::LOOP{self_review|trigger:on_completion}
  [READ] current page against CHECK list
  [COMPARE] each dimension to BENCHMARK entries
  [IF] gap found => [PATCH] then re-enter LOOP
  [IF] no gap => [Ω]
```

## 怎么理解原文

- **`pri:OVERRIDE_ALL`**：指这个页面的视觉质量按最高标准做。它不压过用户的指令、AGENTS.md 的授权和安全规则，也不压过下面的无障碍和性能底线。
- **`BENCHMARK`**：你看不到获奖作品，不要凭印象模仿"获奖感"。从设计概念推导每个决定。避开模板套路：默认紫蓝渐变、居中大标题配三栏卡片、无意义的满屏视差、每个元素都在动。
- **`CHECK` 每个维度的底线**（全部满足后才谈口味）：

| 维度 | 底线 |
|---|---|
| typography | 最多两个字体家族；字号按固定比例分级；正文 16–20px，英文行长 45–75 字符，中文约 30–40 字；中文配合适的字体栈 |
| whitespace | 间距用一套刻度（以 4 或 8 为基数），同类元素间距一致 |
| visual_hierarchy | 每一屏只有一个主焦点；截图缩小看时，阅读顺序仍然清楚 |
| color | 有限的调色板加一个强调色；正文对比度达到 WCAG AA（4.5:1），大字 3:1 |
| motion | 每个动效都有目的；只动 `transform` 和 `opacity`；交互反馈 150–400ms，入场不超过 800ms；尊重 `prefers-reduced-motion` |
| micro_interaction | 可交互元素都有 hover、focus、active、disabled 状态；键盘焦点清晰可见 |
| responsive | 360、768、1280、1920 四个宽度都成立；没有横向滚动；触控目标至少 44px |
| originality | 至少有一个和设计概念直接相关、让页面区别于模板的元素 |

另有两条不属于 CHECK、但不能破的底线：
- **性能**：图片给尺寸并懒加载，字体用 `font-display: swap`，没有布局跳动（CLS）。
- **无障碍**：语义化标签，图片有 `alt`，只靠颜色区分的信息另配文字或图标。

## 怎么执行 LOOP

1. **[READ] 要看渲染结果，不是读代码**：在本地启动页面，加载 `ego-browser` skill，截 1280 宽和 390 宽两张整页图；有动效或交互状态时，另截关键状态。
2. **[COMPARE]**：对着截图逐个维度列问题，具体到元素（"Hero 标题和副标题间距比卡片间距还小"），按对观感的影响排序。
3. **[PATCH]**：每轮修影响最大的 3–5 个问题，然后重新截图。
4. **[Ω] 什么时候停**：底线全部满足，且新一轮复查只剩口味层面的取舍时停。最多 3 轮；到第 3 轮还有问题，停下列给用户。
5. 循环里只打磨现有内容，不加新板块、新功能或新页面。

## 交付

- 设计概念（一句话）。
- 最终截图的路径（桌面和手机各一张）。
- 每个维度一行结论；还留着的取舍和原因。
- 本地运行的命令。
