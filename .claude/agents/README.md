---
title: "项目级 Subagent 使用手册"
description: "ans-ai-auto-notes 三个项目级 subagent（kb-auditor / plan-executor / idea-extractor）何时用、怎么 dispatch、产物在哪、与 agent-log 的联动"
---

# 项目级 Subagent 使用手册

> 设计文档：[3 subagent spec](../../docs/superpowers/specs/2026-06-03-three-subagents-design.md)
> 落地纪律：[[feedback-spawn-kb-auditor]] · [[feedback-agent-log-patch]]
> Smoke 测试：`tests/subagents.test.js`（跑 `bash test.sh`）

## 一句话定位

| Agent | 干什么 | 触发方 | 产物 |
|---|---|---|---|
| **kb-auditor** | 审 long-form kb 笔记的深度/章节/链接/视觉化 | AI 主动 (≥300 行改动 OR ≥800 行单文件) + 用户显式 | `logs/audits/<basename>-YYYY-MM-DD.md` + 结构化 `VERDICT` + issues 列表 + metrics |
| **plan-executor** | 端到端跑 `docs/superpowers/plans/*.md` 全部 task（嵌套 implementer + reviewer） | 用户显式（"run plan X"） | `logs/plan-runs/<plan>-YYYY-MM-DD.md` |
| **idea-extractor** | 从长文/URL 识别 KB 沉淀候选（不写盘） | 用户显式 + AI 看到长文章主动提议 | 结构化 `EXTRACT-VERDICT` + candidates/skipped/existing_overlap |

## 触发决策树

```
用户分享了一段长文/URL/笔记片段?
  └─ idea-extractor

用户说 "run plan X" / "执行 plan X"?
  └─ plan-executor

刚写完一篇深度笔记 (≥300 行新内容) 或单文件 ≥800 行?
  └─ kb-auditor (主动 spawn，不等用户提示)

用户说 "audit X" / "review X" 笔记?
  └─ kb-auditor

其他「干活」类任务（实施/调试/搜索）?
  └─ 普通 Task tool subagent_type: general-purpose / Explore
```

## Dispatch 模板

### kb-auditor（最常用）

```
Task tool:
  subagent_type: kb-auditor
  description: "审 X.md"
  prompt: |
    审计文件: kb/技术/AI/大模型/Agent 与 MCP.md
    上下文: 本轮新写 500 行 / 总量 845 行 long-form
    按 4 维度走完，写 report 落 logs/audits/，return VERDICT 行
```

### plan-executor

```
Task tool:
  subagent_type: plan-executor
  description: "跑 plan X"
  prompt: |
    执行 plan: docs/superpowers/plans/2026-06-03-three-subagents-plan.md
    每 task 跑 implementer + spec/quality reviewer，全跑完写 report return VERDICT
```

### idea-extractor

```
Task tool:
  subagent_type: idea-extractor
  description: "提取 KB 候选"
  prompt: |
    输入: <用户贴的长文 / URL / 文件路径>
    上下文: 这是 <课程笔记/技术博客/...>
    走 4 步（读 → 识别 → kb/ 查重 → 决策），return EXTRACT-VERDICT
```

## 拿到返回后必做的 3 件事

1. **解析 VERDICT 行** (`VERDICT: pass|minor|major (N)` / `EXTRACT-VERDICT: N 个候选 (...)` / `VERDICT: completed|partial|blocked`)
2. **patch agent-log**（[[feedback-agent-log-patch]] 强制）：
   ```bash
   node scripts/agent-log.js patch \
     --id last \
     --title "<10-30 字>" \
     --summary "<VERDICT + 关键发现>" \
     --outcome success|partial|blocked
   ```
3. **消费 Handoff Contract**：
   - `kb-auditor`：遍历 `issues` 列表，`severity: important` 立即按 `suggestion` 逐项 Edit kb 文件；`minor` 视情况。用 `metrics` 判断是否需要补 mermaid/表格
   - `plan-executor`：partial/blocked → 看 `logs/plan-runs/` 里 blocked task 决策
   - `idea-extractor`：按 `candidates` 的 `priority` 顺序处理，用 `depth_hint` 决定写入篇幅，用 `existing_overlap` 避免重复。`action: create` 直接新建；`action: append` 追加到指定 `section`。**不要**跳过 overlap 检查直接写

## 工具白名单（最小权限）

| Agent | tools | 关键设计 |
|---|---|---|
| kb-auditor | `Read, Grep, Glob, Bash` | 无 Write/Edit（review-only），用 Bash heredoc 写 report |
| idea-extractor | `Read, Grep, Glob, WebFetch` | 无 Bash/Write/Edit，最严受限 |
| plan-executor | `Read, Write, Edit, Bash, Grep, Glob, Task` | 唯一允许写代码的 agent；Task 用于嵌套 spawn implementer/reviewer |

> Smoke 测试 `tests/subagents.test.js` 兜底白名单不被无意改动；改 prompt 同时改白名单要先过 smoke。

## 常见坑

- **忘记 patch agent-log** → 月底 `agent-report.js` 报告里 run 记录 `outcome=unknown`，价值归零。每次 dispatch 后立即 patch（[[feedback-agent-log-patch]]）。
- **复制 audit 报告全文进主对话** → 浪费 context。已落 `logs/audits/`，引用路径即可。
- **kb-auditor 同一文件 24h 内重复 spawn** → 没新增内容，跳过。
- **plan-executor 不验证 reviewer 通过就推进** → 违反 spec §3.2 设计；reviewer 报问题 → 派 fix → 重 review，循环 ≤3 次。
- **idea-extractor 自作主张写 kb** → 它的 tools 白名单没有 Write/Edit，写不了；prompt 也禁止。建议必须经主 agent + 用户对齐。

## 验证

```bash
# 三个 agent 是否注册（SessionStart preflight 也会跑）
ls .claude/agents/
# 输出应有 idea-extractor.md / kb-auditor.md / plan-executor.md

# Smoke 测试
bash test.sh   # 包含 tests/subagents.test.js
```
