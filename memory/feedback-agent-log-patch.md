---
name: feedback-agent-log-patch
description: subagent 调用结束 / 主 agent 完成一轮实质工作后，必须立即 patch agent-log 补 title/summary/outcome
metadata:
  type: feedback
  lastUpdated: 2026-06-02
---

完成一轮**实质工作**后（spawn 了 subagent / 改了文件 / 跑了 Bash），在向用户发送响应前必须调用：

```bash
node scripts/agent-log.js patch --id last \
  --title "<本轮一句话标题，<30 字>" \
  --summary "<干了啥的 1-3 句>" \
  --outcome success|partial|blocked
```

**Why**: hook 只能采集机械字段（工具、文件、耗时），title/summary 反映任务的"为什么和结果"——
不补的话日志只能做"工具使用频次"这种浅层分析。

**How to apply**:
- **触发时机**：和 [[feedback-auto-commit]] 同位（每完成一批文件变更立刻提交 + 立刻 patch）
- **偷懒识别**：如果你刚跑了 `git commit` 但没 patch agent-log，那就是漏了
- **跳过条件**：本轮纯聊天 / 纯回答问题（hook 也不会写 start 事件，自然不用 patch）
- **outcome 写法**：
  - `success`：任务完整完成、测试通过
  - `partial`：部分完成（如 4/5 子任务做了），summary 标注剩余
  - `blocked`：被卡住（如环境问题、需要用户决策）

**与 dispatching subagent 的关系**：
派出 subagent 时（用 Agent tool），subagent 自己会触发 SubagentStop hook → start 行已写。
主 agent 拿到 subagent 返回后，**立即** patch subagent 对应的那一行（不是自己 main 的）：

```bash
node scripts/agent-log.js patch --id last --title "kb-auditor 审 Transformer.md" --summary "通过 + 12 处建议" --outcome success
```

注意 `--id last` 拿到的是最近一条 start，而 subagent 的 start 在 SubagentStop 时已写入，
所以"主 agent 拿到返回后第一时间 patch"= 正确锁定。

相关：[[feedback-self-review-before-next-task]]
