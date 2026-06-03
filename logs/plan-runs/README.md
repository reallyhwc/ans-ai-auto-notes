# plan-executor 执行报告

> plan-executor subagent 端到端跑完一个 plan 后写入此目录。设计文档：[3 subagent spec](../../docs/superpowers/specs/2026-06-03-three-subagents-design.md#3-plan-executor)

## 文件命名

`<plan-basename>-<YYYY-MM-DD>.md`

例：跑 `docs/superpowers/plans/2026-06-03-three-subagents-plan.md` 产出
→ `logs/plan-runs/2026-06-03-three-subagents-plan-2026-06-03.md`

## Schema

frontmatter:

```yaml
---
plan: docs/superpowers/plans/X.md
executed_at: YYYY-MM-DD
total_tasks: 10
status: completed | partial | blocked
---
```

Body 含每个 task 的 Status / Commits / Reviewer 结果 / Notes，最后 Summary 行汇总。详见 spec §3.2。

## 与 logs/agent-runs/ 的关系

agent-runs.jsonl 记每个 subagent **调用**事件（含 plan-executor 内部嵌套 spawn 的所有 implementer）。
plan-runs/ 记一个 plan **整体**执行的总结（一个 plan = 一个 .md 报告）。
