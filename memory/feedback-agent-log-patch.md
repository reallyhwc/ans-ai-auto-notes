---
name: feedback-agent-log-patch
description: agent-log 的 title/summary/outcome 由 SubagentStop/Stop hook 自动派生，仅当自动摘要不准时才手动 patch
metadata:
  type: feedback
  lastUpdated: 2026-08-01
---

`agent-log-hook.js` 在 SubagentStop / Stop 时调用 `deriveAutoFields` 自动派生：
- title ← subagent 最后一条文本消息的第一行（截断 60 字）
- summary ← 最后一条文本消息前 200 字
- outcome ← 有错误 `partial`，否则 `success`

**多数情况下不需要手动 patch**——hook 已经做了。

**Why**：旧纪律要求"必须立即手动 patch"，但那时 hook 还没有自动派生能力。2026-06 后 `deriveAutoFields` 上线，手动 patch 变成冗余。继续要求手动 patch 会导致 AI 浪费 token 重复 hook 已做的事。

**How to apply**：
- **默认不 patch**：相信 hook 的自动派生
- **仅在这些情况手动 patch**：
  1. subagent 返回的是**结构化数据**（JSON/表格）而非自然语言总结 → 自动派生的 title/summary 会是原始数据片段，不准
  2. 自动派生的 outcome 不对（如任务其实 blocked 但 subagent 末尾没报错 → hook 误判 success）
- **手动 patch 命令**（仅上述情况）：
  ```bash
  node scripts/agent-log.js patch --id last \
    --title "<一句话标题>" \
    --summary "<1-3 句>" \
    --outcome success|partial|blocked
  ```
- **跳过条件**：本轮纯聊天（hook 也不写 start 事件）

关联 [[project-agents-skills-mirror]]、[[feedback-auto-commit]]、[[feedback-self-review-before-next-task]]。
