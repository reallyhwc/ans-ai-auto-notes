---
name: feedback-spawn-kb-auditor
description: long-form kb 笔记写完 / 大幅扩展后主动 spawn kb-auditor，不等用户提醒
metadata:
  type: feedback
  lastUpdated: 2026-06-03
---

完成以下情况后必须 spawn kb-auditor subagent：

- 本轮对某个 kb/*.md 改动 **≥300 行**（写完深度新笔记 / 大幅扩展）
- 某个 kb/*.md 总行数 **≥800**（long-form 量级，每次实质修订后审）
- 用户说 "audit X" / "review X"

**为什么**：写笔记是创造，审笔记是反思。同一 AI 边写边审容易盲区。subagent 隔离 context 能给出独立视角。kb-auditor 也是这套日志系统的 dogfood。

**怎么 spawn**：用 Task tool。如果 `.claude/agents/kb-auditor.md` 已注册且 Claude Code Task tool 支持自定义 subagent_type，subagent_type 选 `kb-auditor`；否则 fallback 用 `general-purpose` 但把 kb-auditor 的 prompt 复制进 task prompt。

Prompt 示例：

> 审计文件: kb/技术/AI/大模型/Transformer.md（本轮新写 500 行）。按 kb-auditor 标准 4 维度走完，写 report 落 logs/audits/，return VERDICT 行。

**拿到结果后**：
1. 立即 `node scripts/agent-log.js patch --id last --title "kb-auditor 审 X" --summary "<VERDICT 行>" --outcome success|partial|blocked`（按 [[feedback-agent-log-patch]] 纪律）
2. 重要建议立即 Edit kb 文件；Minor 建议视情况
3. 不要把 audit 报告内容复制进主对话（已在 logs/audits/）

相关：[[feedback-agent-log-patch]]
