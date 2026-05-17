---
name: Auto Record Notes After Every Q&A
description: 每次QA对话结束后必须自动提取知识追加到kb，不需要用户提醒
type: feedback
lastUpdated: 2026-05-17originSessionId: b4a02ce7-aa53-4e91-9b6b-65df681070f4
---
每次回答完用户的问题后，必须主动提取本次对话中的知识点，追加到对应的 kb 主题文件中，无需等用户提醒。

**Why:** CLAUDE.md 已有此规则（"小知识点自动记录：回答完问题后，自动提取知识点追加到对应主题文件，无需询问"），但在 2026-05-04 的一轮多问题 QA 中被遗漏，需要用户提醒才补上。用户明确表示"下次不要我再提醒你了"。

**How to apply:** 在任何包含技术讨论、知识分享、概念解释的对话结束后，立即执行笔记记录步骤——检查 kb 目录中对应主题文件是否存在，新建或追加，同步更新 INDEX.md、overview.html、timeline，最后 git commit。把这当作对话流程的收尾环节，而非可选项。
