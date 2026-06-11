---
name: vision
description: 为文本模型生成图片描述。仅在确认自己为纯文本模型无读图能力时调用，多模态模型直接使用Read读图。
context: fork
agent: vision
argument-hint: [image or task]
---

## User task: $ARGUMENTS

Use the Read tool to view the image, then describe it in full detail following your system prompt.
