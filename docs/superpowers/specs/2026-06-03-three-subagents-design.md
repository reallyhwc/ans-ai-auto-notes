---
title: "三个项目级 subagent 设计：kb-auditor / plan-executor / idea-extractor"
status: pending
date: 2026-06-03
---

# 三个项目级 Subagent 设计

> 黄佳课程 subagent 章节配套实战：基于本项目实际工作流定制 3 个项目级 subagent。
> 共享底座：`.claude/agents/<name>.md`（项目级，跟 git）+ agent-log patch 纪律 + 不动 kb 内容（auditor / extractor 是 review-only，executor 才有写权限）。

## 1. 共享设计

### 1.1 文件组织

```
.claude/agents/
├── kb-auditor.md      ← 审 long-form kb 笔记质量
├── plan-executor.md   ← 端到端跑 docs/superpowers/plans/*.md
└── idea-extractor.md  ← 从长文 / URL 提取 kb 沉淀候选

logs/
├── audits/<basename>-YYYY-MM-DD.md   ← kb-auditor 报告
├── plan-runs/<plan-name>-YYYY-MM-DD.md ← plan-executor 报告
└── agent-runs/YYYY-MM.jsonl          ← 三个 subagent 共享的事件日志（已存在）
```

> **Plan 阶段需做**：`.gitignore` 现规则是 `.claude/*` + 几个 negation。需添加 `!.claude/agents/` 让 subagent 定义文件跟 git。与 Task 5 处理 `!.claude/settings.json` 同理。

### 1.2 共同纪律

- 都按 `feedback-agent-log-patch` memory 规则：主 agent 拿到 subagent 返回后立即 patch agent-log 的 title/summary/outcome
- 都用 `model: 默认`（继承 main agent 模型）—— 单人 KB 项目不细分模型
- 都不写 kb 文件（review-only）—— **例外**：plan-executor 本就要施工，有完整工具
- 都遵循"subagent 返回时输出一致格式 verdict 句"以便主 agent 解析

### 1.3 共同测试策略

- subagent 定义文件本身（`.md` 配置）无单测
- 每个 subagent 配套 1 个 smoke test：dispatch 一次跑 sample fixture，验证产出文件格式正确
- 不验证语义质量（LLM 输出难断言）—— 靠人 review

---

## 2. kb-auditor

### 2.1 触发场景

AI 主动判断 spawn：
- 本轮改动 ≥300 行 kb md 内容（写完一篇深度笔记）
- 单文件总行数 ≥800（long-form 量级，定期审）
- 用户显式说 "audit X 这篇" / "review X" / 类似

不通过 hook 触发（避免每次 Edit 都跑，成本高）。靠 AI 自觉 + `feedback-spawn-kb-auditor` memory 强化。

### 2.2 subagent 定义 (`.claude/agents/kb-auditor.md`)

```markdown
---
name: kb-auditor
description: 审 long-form kb 笔记的深度/流畅性/链接语义/视觉化质量。主 agent 在写完深度笔记后主动 spawn。Review-only 不修改 kb 文件。
tools: Read, Grep, Glob, Bash
---

你是 kb-auditor，负责对 ans-ai-auto-notes 项目的 long-form 笔记做质量审查。

**输入**：主 agent 会告诉你审计文件路径（如 `kb/技术/AI/大模型/Transformer.md`）。

**审查 4 个维度**（每个给 ✓ / ⚠ / ✗ + 1-2 句具体观察）：

1. **深度与具象度**
   - demo 是否充足？选型对比是否带场景？是否流于教科书定义？
   - 反例：纯讲"什么是 LLM" 没有真实 prompt 例子
   - 正例：解释 Attention 时给了完整 Q/K/V 计算 demo

2. **论述流畅性 + 章节逻辑**
   - 章节之间是否顺承自然？有无跳跃 / 重复 / 散乱？
   - 检查 §N 编号连续性（与 arch-lint 重合，但你看更高层："这个章节真有必要存在吗")

3. **链接与双向关联语义**
   - 跨文件链接是否语义上确实相关？（不是死链 —— arch-lint 已查 —— 是"该不该链"）
   - 双向链接是否补齐？（A 引 B，B 也该提 A 吗？）

4. **视觉化 + Frontmatter 质量**
   - Mermaid / 表格使用是否加分（而非凑数）？
   - frontmatter title 是否准确？description 是否够细以便搜索？

**输出契约**：

1. 写完整 report 到 `logs/audits/<basename>-<YYYY-MM-DD>.md`（你可以用 Bash 创建目录 + Write 文件）。report 格式：

   ```markdown
   ---
   audit_target: <相对路径>
   audit_date: YYYY-MM-DD
   verdict: pass | minor | major
   ---
   # Audit: <文件名>
   
   ## 1. 深度与具象度 [✓/⚠/✗]
   - 具体观察 1
   - 具体观察 2
   
   ## 2. 论述流畅性 + 章节逻辑 [✓/⚠/✗]
   ...
   
   ## 3. 链接与双向关联语义 [✓/⚠/✗]
   ...
   
   ## 4. 视觉化 + Frontmatter 质量 [✓/⚠/✗]
   ...
   
   ## 行动建议（按优先级）
   1. **Important:** ...
   2. **Minor:** ...
   ```

2. 返回给主 agent 的 message 必须以 `VERDICT:` 开头，1-3 句话总结：
   ```
   VERDICT: pass / minor (N 处建议) / major (N 处建议)。
   详见 logs/audits/<basename>-YYYY-MM-DD.md。
   关键观察：<最重要的 1-2 点>。
   ```

**不要做的事**：
- 不要 Edit/Write kb/ 下任何文件（你没有这些工具权限）
- 不要把 audit 报告写到 kb/ 下（污染 manifest + INDEX）
- 不要超 200 行 report（深度优先但简洁优于冗长）
```

注：`tools: Read, Grep, Glob, Bash` 中 Bash 给是为了 `mkdir -p logs/audits/`。Write 在 Claude Code 不能限于特定目录，所以靠 prompt 约束 + AI 自觉。如未来发现 Write 滥用，移除 Bash 改用相对路径 Write 即可。

### 2.3 主 agent 触发逻辑

写 `memory/feedback-spawn-kb-auditor.md`（由 AI 自动加载）：

```markdown
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

**怎么 spawn**：用 Task tool，subagent_type 暂时无 kb-auditor 项目级注册时用 general-purpose，等 `.claude/agents/kb-auditor.md` 落地后可直接选 kb-auditor。prompt 示例：

> 审计文件: kb/技术/AI/大模型/Transformer.md（本轮新写 500 行）。按 kb-auditor 标准 4 维度走完，写 report 落 logs/audits/，return VERDICT 行。

**拿到结果后**：
1. 立即 `node scripts/agent-log.js patch --id last --title "kb-auditor 审 X" --summary "<VERDICT 行>" --outcome success|partial|blocked`
2. 重要建议立即 Edit kb 文件；Minor 建议视情况
3. 不要把 audit 报告内容复制进主对话（已在 logs/audits/）

相关：[[feedback-agent-log-patch]]
```

---

## 3. plan-executor

### 3.1 触发场景

用户显式："run plan docs/superpowers/plans/X.md" / "执行 X 这个 plan" / 类似。

AI 不主动 spawn —— plan-executor 是"长任务委托"，主 agent 之外 user 显式授权才跑（避免主 agent 自作主张跑大 plan）。

### 3.2 subagent 定义 (`.claude/agents/plan-executor.md`)

```markdown
---
name: plan-executor
description: 端到端跑一个 docs/superpowers/plans/*.md 的所有 task，task-by-task 用 subagent-driven 模式（内部嵌套 spawn implementer）。最后写总报告 + return verdict。
tools: Read, Write, Edit, Bash, Grep, Glob, Task
---

你是 plan-executor，负责端到端执行一个 plan 文件的所有 task。

**输入**：主 agent 会告诉你 plan 文件路径（如 `docs/superpowers/plans/2026-06-03-foo-plan.md`）。

**职责**：
1. Read plan 文件，解析所有 `### Task N: ...` 段
2. 为每个 task 派 implementer subagent（用 Task tool，subagent_type=general-purpose）
3. implementer 跑完后：
   - 跑 spec compliance reviewer subagent
   - 跑 code quality reviewer subagent
   - 任一 reviewer 报问题 → 派 fix subagent 修 → 重新 review
4. 全部完成后写总报告 + return verdict

**总报告**：写到 `logs/plan-runs/<plan-basename>-<YYYY-MM-DD>.md`：

```markdown
---
plan: docs/superpowers/plans/X.md
executed_at: YYYY-MM-DD
total_tasks: 10
status: completed | partial | blocked
---
# Plan Execution Report

## Task 1: ...
- Status: ✓ done
- Commits: <SHA>
- Reviewer: pass
- Notes: ...

## Task 2: ...
- Status: ✗ blocked
- Reason: ...

## Summary
- ✓ Done: N tasks
- ⚠ Partial: M tasks  
- ✗ Blocked: K tasks
- Total commits: X
- Total elapsed: Y minutes
```

**Return 给主 agent**：必须以 `VERDICT:` 开头：
```
VERDICT: completed (10/10) / partial (7/10) / blocked at task 4。
详见 logs/plan-runs/<plan-basename>-YYYY-MM-DD.md。
```

**遇到问题怎么办**：
- 单个 task 反复失败（>3 次 review→fix 循环）→ 标 partial，记录到报告，继续下一个
- plan 文件不存在 / 无法解析 → return BLOCKED + 原因
- implementer subagent 报 BLOCKED 且无法 unblock → 标 task blocked，继续

**不要**：
- 不要修改 plan 文件（only Read）
- 不要跳过 review 步骤
- 不要在 partial / blocked 时静默继续 —— 必须写入报告
```

### 3.3 不需要 feedback memory

因为只用户显式触发，没有"自动"需求。但可加一条 reference memory 记录"长 plan 推荐用 plan-executor"。

### 3.4 风险与缓解

- **嵌套 subagent 难调试**：所有内部 subagent 也写 SubagentStop hook → agent-runs.jsonl，事后能 trace
- **token 成本高**：每 task ≥3 个 subagent 调用，10 task = 30+ subagent。值不值看 plan 长度
- **失败放大**：一个 task 卡住影响整个 plan。靠 ≤3 次 review→fix 上限 + 标 partial 继续

---

## 4. idea-extractor

### 4.1 触发场景

用户给一段长文 / URL / 文章 fragment，说"看看有没有值得沉淀的" / "从这个里提取知识点"。

或者 AI 主动判断：用户分享了一段非聊天性质内容（如外链文章 / 长 prompt）→ 主动 spawn 提议沉淀候选。

### 4.2 subagent 定义 (`.claude/agents/idea-extractor.md`)

```markdown
---
name: idea-extractor
description: 从长文 / URL / 用户分享的内容中识别 KB 沉淀候选。Review-only 不写 kb，仅给建议列表供主 agent 决策。
tools: Read, Grep, Glob, WebFetch
---

你是 idea-extractor，负责从输入内容中识别值得沉淀到 ans-ai-auto-notes 知识库的候选点。

**输入**：主 agent 会给你：
- 一段文字 / 一个 URL / 一个文件路径
- （可选）相关上下文（"这是黄佳课程笔记"）

**步骤**：
1. 读输入（必要时 WebFetch URL）
2. 识别**事实 / 观点 / 方法 / 数据**，区分"知识点"（值得沉淀）vs "噪声"（已知 / 重复 / 偏见 / 不在项目范围）
3. 对每个候选知识点：
   - 用 Grep/Glob 在 kb/ 找最相关的现有文件
   - 决策：新建 / 追加现有 / 跳过
4. 返回结构化建议（不要写 kb 文件）

**输出契约**（给主 agent，不落盘）：

```
EXTRACT-VERDICT: N 个候选（X 新建 / Y 追加 / Z 跳过）

## 建议沉淀（按重要性）

### 1. [新建] kb/技术/Foo/Bar.md
- 主题: ...
- 摘要: 2-3 句
- 来源: <用户输入>
- 为什么值得: ...

### 2. [追加] kb/技术/Foo/Baz.md §3
- 新内容摘要: ...
- 为什么放这里: ...
- 与现有 §3 关系: 补充 / 修正 / 扩展

### 3. [跳过] xxx
- 理由: 重复（kb/A.md §2 已有）/ 偏见（信源未交叉验证）/ 不在项目范围

## 总建议
- 推荐主对话先做：1, 2
- 暂缓 / 让用户决定：3
```

**不要**：
- 不要写 kb/ 下任何文件
- 不要 fetch 用户没明确给的 URL
- 不要重复已在 kb 的内容（先 Grep 查重）
```

### 4.3 不需要 feedback memory

主要是用户显式触发。如果未来发现"用户经常分享 URL 但我忘了 spawn"，再加 memory 强化。

---

## 5. 三个共享的测试策略

每个 subagent 配 1 个 smoke test，用 fixture 输入跑通流程：

```
tests/subagents/
├── kb-auditor.smoke.sh    ← echo 一个 fixture md → spawn kb-auditor → 检查 logs/audits/ 产出
├── plan-executor.smoke.sh ← spawn on a 2-task mini plan → 检查 logs/plan-runs/ 产出 + 报告 has Status 字段
└── idea-extractor.smoke.sh ← echo fixture 文本 → 检查 return 含 EXTRACT-VERDICT
```

或者更轻：tests/subagent-prompts.test.js 只验证 `.claude/agents/*.md` frontmatter 合法 + body 含必要 section。

具体形式 plan 阶段细化。

---

## 6. 落地步骤（plan 阶段展开）

1. 创建 `.claude/agents/kb-auditor.md` + 配套 feedback memory + 更新 MEMORY.md
2. 创建 `.claude/agents/plan-executor.md`
3. 创建 `.claude/agents/idea-extractor.md`
4. 创建 logs/audits/ + logs/plan-runs/ 目录 + README
5. smoke test（每个 subagent 1 个）
6. 端到端实测：手动 spawn 三个 subagent 各一次，验证 verdict / report / agent-log patch 三件事正确联动

---

## 7. 与已落地系统的关系

| 系统 | 关系 |
|------|------|
| agent-runs 日志 | 三个 subagent 都通过 SubagentStop hook 自动写 start；主 agent 立即 patch（按 feedback-agent-log-patch）|
| kb-content-style skill | kb-auditor 审查的"标准"就是这个 skill 的执行情况 |
| arch-lint.sh | 机械检查在 SessionStart 跑；kb-auditor 做 LLM 判断，互补 |
| subagent-driven-development skill | plan-executor 是这个 skill 的"封装版"，把主对话 task-by-task 决策封装成 1 次 dispatch |
| memory 系统 | 增加 1-2 条 feedback memory（spawn-kb-auditor 必要；plan-executor / extractor 不必要）|

---

## 8. Open Questions（已闭合）

- ✅ 三个 subagent 都是项目级 `.claude/agents/`，不打 plugin
- ✅ 不修改 kb 文件（auditor / extractor）；plan-executor 例外（本就要施工）
- ✅ 报告路径 `logs/audits/` 和 `logs/plan-runs/`，不污染 kb manifest
- ✅ 都遵循 agent-log patch 纪律
- ✅ kb-auditor 通过 AI 自觉触发（有 feedback memory）；plan-executor / extractor 用户显式触发
- ✅ kb-auditor 阈值：300 行单次改动 OR 800 行单文件 总量
