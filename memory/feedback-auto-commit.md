---
name: Auto-Commit After Changes
description: AI必须在每批文件变更后立即git commit，不等用户提醒；退出时只需提醒未push的commit
type: feedback
lastUpdated: 2026-05-17
originSessionId: 83b92715-486d-4fc7-8856-835e51e02a7d
---
AI 每次完成一批文件变更（如一篇笔记沉淀、一个脚本编写）后，必须立即执行 `git add -A && git commit`，不要等用户提醒或等到会话退出。

退出时通过 Stop hook（exit-check.sh）自动检查未 push 的 commit，提醒用户 `git push`。

**Why:** 2026-05-17 用户明确反馈：UserPromptSubmit hook 的 commit 提醒消息用户看不到（在 system-reminder 标签中），且用户期望的流程是 AI 主动 commit 而非被提醒。用户说："我希望的并不是你提醒我去commit，而是你每次根据改动文件后，自己commit，在我退出时提醒我还有未push的。"

**How to apply:** 判断标准：一个逻辑主题的改动完成 → 立刻 git add -A && git commit。不要攒多个主题一起提交。按 CLAUDE.md 的 Conventional Commits 格式写 commit message。
