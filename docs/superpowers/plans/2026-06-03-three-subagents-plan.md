---
title: "三个项目级 subagent 实施计划"
status: completed
date: 2026-06-03
spec: docs/superpowers/specs/2026-06-03-three-subagents-design.md
---

# Three Subagents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地 3 个项目级 subagent（kb-auditor / plan-executor / idea-extractor），共享 agent-log patch 纪律 + tracked `.claude/agents/` 路径，加 review-only 工具白名单防误改 kb，配套 feedback memory 强化 AI 自觉触发。

**Architecture:** 3 个 subagent 走相同模式：`.claude/agents/<name>.md` 项目级注册（含 frontmatter `name/description/tools` + body 系统提示），主 agent 用 Task tool spawn，SubagentStop hook 自动写 agent-runs 日志，主 agent 拿到 verdict 后 patch 日志。kb-auditor 报告落 `logs/audits/`；plan-executor 报告落 `logs/plan-runs/`；idea-extractor inline 不落盘。

**Tech Stack:** Pure markdown 配置（`.claude/agents/*.md`），node --test 单测验证 frontmatter 合法性 + body 必备 section。零 npm 依赖。

---

## File Structure

**Create:**
- `.claude/agents/kb-auditor.md` — subagent definition（含 prompt + 输出契约）
- `.claude/agents/plan-executor.md`
- `.claude/agents/idea-extractor.md`
- `memory/feedback-spawn-kb-auditor.md` — AI 自觉 spawn 纪律
- `logs/audits/README.md` — 说明此目录用途
- `logs/plan-runs/README.md` — 同上
- `tests/subagent-definitions.test.js` — 验证 3 个 agent .md 文件 frontmatter + 必备 section

**Modify:**
- `.gitignore` — 加 `!.claude/agents/` negation
- `memory/MEMORY.md` — 索引新 feedback memory

**Pattern alignment:** subagent 文件结构遵循 Claude Code 官方 `.claude/agents/<name>.md` 约定（frontmatter + body）。测试风格与现有 `tests/*.test.js` 一致（node --test）。

---

## Task 1: gitignore + 目录脚手架

**Files:**
- Modify: `.gitignore`
- Create: `logs/audits/README.md`
- Create: `logs/plan-runs/README.md`

- [ ] **Step 1: 给 .gitignore 加 `.claude/agents/` negation**

Read 当前 `.gitignore`，找到 `# Claude Code` 段（约 line 22-28），在已有 negation 行后追加：

```
# 例外：agents/ 入库以共享项目级 subagent 定义
!.claude/agents/
```

完整目标状态（参考）：

```
# Claude Code（默认全排除，例外子目录见下）
.claude/*
# 例外：skills/ 入库用于跨设备/团队复用 Claude Code skill 定义（G3）
!.claude/skills/
# 例外：memory-snapshot 跟踪入 git 用于跨设备同步（A6）
!.claude/memory-snapshot/
# 例外：settings.json 入库以共享 hook 配置（agent-log-hook 等项目级 hook）；
# 用户私有偏好仍走 settings.local.json（保持 ignored）
!.claude/settings.json
# 例外：agents/ 入库以共享项目级 subagent 定义
!.claude/agents/
```

- [ ] **Step 2: 验证 negation 生效**

```bash
mkdir -p .claude/agents
touch .claude/agents/test.md
git check-ignore .claude/agents/test.md && echo "still ignored" || echo "trackable"
rm .claude/agents/test.md
```

Expected: `trackable`

- [ ] **Step 3: 创建 logs/audits/README.md**

```markdown
# kb-auditor 审计报告

> kb-auditor subagent 跑完后把详细 report 写入此目录。设计文档：[3 subagent spec](../../docs/superpowers/specs/2026-06-03-three-subagents-design.md#2-kb-auditor)

## 文件命名

`<basename>-<YYYY-MM-DD>.md` — basename 是被审计 kb 文件的 basename（无路径、无 .md 后缀）。

例：审计 `kb/技术/AI/大模型/Transformer.md` 在 2026-06-03 产出
→ `logs/audits/Transformer-2026-06-03.md`

## Schema

每个 report 是 markdown 文件，frontmatter：

```yaml
---
audit_target: kb/技术/AI/大模型/Transformer.md
audit_date: 2026-06-03
verdict: pass | minor | major
---
```

Body 含 4 章节（深度 / 流畅性 / 链接 / 视觉化）+ 行动建议。详见 spec §2.2。

## 为什么不放 kb/

避免污染 `build-index.js` 扫描的 manifest + 不干扰 SPA 导航。
```

- [ ] **Step 4: 创建 logs/plan-runs/README.md**

```markdown
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
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore logs/audits/README.md logs/plan-runs/README.md
git commit -m "chore: scaffold .claude/agents/ tracking + logs/{audits,plan-runs}/ READMEs"
```

---

## Task 2: subagent 定义验证测试（先红）

**Files:**
- Create: `tests/subagent-definitions.test.js`

- [ ] **Step 1: 写失败测试**

Create `tests/subagent-definitions.test.js`:

```javascript
/**
 * subagent-definitions.test.js — 验证 .claude/agents/*.md 三个 subagent 定义文件的
 * frontmatter 合法 + body 含必备 section
 *
 * 这是 LLM 配置不是代码，所以测试只验证"结构对、关键约束在"，不验证 prompt 质量。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function readAgent(name) {
  const filePath = path.join(ROOT, '.claude', 'agents', `${name}.md`);
  return fs.readFileSync(filePath, 'utf8');
}

function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('no frontmatter');
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return { frontmatter: fm, body: m[2] };
}

test('kb-auditor: frontmatter 含 name/description/tools', () => {
  const { frontmatter } = parseFrontmatter(readAgent('kb-auditor'));
  assert.equal(frontmatter.name, 'kb-auditor');
  assert.ok(frontmatter.description, 'description required');
  assert.ok(frontmatter.tools, 'tools required');
});

test('kb-auditor: tools 白名单仅含 Read/Grep/Glob/Bash（review-only）', () => {
  const { frontmatter } = parseFrontmatter(readAgent('kb-auditor'));
  const tools = frontmatter.tools.split(',').map(s => s.trim());
  assert.deepEqual(tools.sort(), ['Bash', 'Glob', 'Grep', 'Read']);
  assert.ok(!tools.includes('Edit'), 'Edit must not be in kb-auditor tools (review-only)');
  assert.ok(!tools.includes('Write') || tools.includes('Bash'),
    'Write only OK if Bash absent (we want auditor to write reports via Bash echo redirect, not Write tool)');
});

test('kb-auditor: body 含 4 审查维度章节', () => {
  const { body } = parseFrontmatter(readAgent('kb-auditor'));
  assert.match(body, /深度与具象度/);
  assert.match(body, /论述流畅性/);
  assert.match(body, /链接.*关联/);
  assert.match(body, /视觉化|Mermaid/);
});

test('kb-auditor: body 含 VERDICT 输出契约 + logs/audits/ 路径', () => {
  const { body } = parseFrontmatter(readAgent('kb-auditor'));
  assert.match(body, /VERDICT:/);
  assert.match(body, /logs\/audits\//);
});

test('plan-executor: frontmatter + 全工具白名单', () => {
  const { frontmatter } = parseFrontmatter(readAgent('plan-executor'));
  assert.equal(frontmatter.name, 'plan-executor');
  assert.ok(frontmatter.description);
  const tools = frontmatter.tools.split(',').map(s => s.trim());
  // plan-executor 要施工，需要 Edit/Write/Task
  assert.ok(tools.includes('Edit'));
  assert.ok(tools.includes('Write'));
  assert.ok(tools.includes('Task'));
});

test('plan-executor: body 含 VERDICT + logs/plan-runs/ + 嵌套 spawn 说明', () => {
  const { body } = parseFrontmatter(readAgent('plan-executor'));
  assert.match(body, /VERDICT:/);
  assert.match(body, /logs\/plan-runs\//);
  assert.match(body, /implementer|嵌套|Task tool/);
});

test('idea-extractor: frontmatter + 只读工具白名单（含 WebFetch）', () => {
  const { frontmatter } = parseFrontmatter(readAgent('idea-extractor'));
  assert.equal(frontmatter.name, 'idea-extractor');
  const tools = frontmatter.tools.split(',').map(s => s.trim());
  assert.ok(tools.includes('Read'));
  assert.ok(tools.includes('WebFetch'));
  assert.ok(!tools.includes('Edit'), 'Edit must not be in idea-extractor (only suggests, never writes)');
  assert.ok(!tools.includes('Write'), 'Write must not be in idea-extractor');
});

test('idea-extractor: body 含 EXTRACT-VERDICT 契约 + 新建/追加/跳过 三态', () => {
  const { body } = parseFrontmatter(readAgent('idea-extractor'));
  assert.match(body, /EXTRACT-VERDICT:/);
  assert.match(body, /新建/);
  assert.match(body, /追加/);
  assert.match(body, /跳过/);
});
```

- [ ] **Step 2: 运行测试确认全部失败**

```bash
node --test tests/subagent-definitions.test.js
```

Expected: 8 failures（`ENOENT: no such file or directory` — agent files 不存在）

- [ ] **Step 3: Commit**

```bash
git add tests/subagent-definitions.test.js
git commit -m "test: add subagent-definitions structural validation (red)"
```

---

## Task 3: .claude/agents/kb-auditor.md

**Files:**
- Create: `.claude/agents/kb-auditor.md`

- [ ] **Step 1: 创建 kb-auditor.md**

Create `.claude/agents/kb-auditor.md`:

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
   - 检查 §N 编号连续性（与 arch-lint 重合，但你看更高层："这个章节真有必要存在吗"）

3. **链接与双向关联语义**
   - 跨文件链接是否语义上确实相关？（不是死链 —— arch-lint 已查 —— 是"该不该链"）
   - 双向链接是否补齐？（A 引 B，B 也该提 A 吗？）

4. **视觉化 + Frontmatter 质量**
   - Mermaid / 表格使用是否加分（而非凑数）？
   - frontmatter title 是否准确？description 是否够细以便搜索？

**输出契约**：

1. 写完整 report 到 `logs/audits/<basename>-<YYYY-MM-DD>.md`。用 Bash 创建：

   ```bash
   mkdir -p logs/audits
   cat > logs/audits/<basename>-$(date +%Y-%m-%d).md <<'EOF'
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
   EOF
   ```

   （提示：用 heredoc 是因为你的 tools 白名单只有 Read/Grep/Glob/Bash，没有 Write）

2. 返回给主 agent 的 message 必须以 `VERDICT:` 开头，1-3 句话总结：
   ```
   VERDICT: pass / minor (N 处建议) / major (N 处建议)。
   详见 logs/audits/<basename>-YYYY-MM-DD.md。
   关键观察：<最重要的 1-2 点>。
   ```

**不要做的事**：
- 不要修改 kb/ 下任何文件（你没有 Edit/Write 工具权限）
- 不要把 audit 报告写到 kb/ 下（污染 manifest + INDEX）
- 不要超 200 行 report（深度优先但简洁优于冗长）
```

- [ ] **Step 2: 跑测试确认 kb-auditor 相关 4 个 pass**

```bash
node --test tests/subagent-definitions.test.js 2>&1 | grep -E "ok|not ok" | head -8
```

Expected: 4 个 kb-auditor 测试 pass，其他 4 个还 fail。

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/kb-auditor.md
git commit -m "feat: add kb-auditor subagent (review-only, 4 dimensions, report to logs/audits/)"
```

---

## Task 4: feedback-spawn-kb-auditor memory + MEMORY.md

**Files:**
- Create: `memory/feedback-spawn-kb-auditor.md`
- Modify: `memory/MEMORY.md`

- [ ] **Step 1: 写 feedback memory**

Create `memory/feedback-spawn-kb-auditor.md`:

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

**怎么 spawn**：用 Task tool。如果 `.claude/agents/kb-auditor.md` 已注册且 Claude Code Task tool 支持自定义 subagent_type，subagent_type 选 `kb-auditor`；否则 fallback 用 `general-purpose` 但把 kb-auditor 的 prompt 复制进 task prompt。

Prompt 示例：

> 审计文件: kb/技术/AI/大模型/Transformer.md（本轮新写 500 行）。按 kb-auditor 标准 4 维度走完，写 report 落 logs/audits/，return VERDICT 行。

**拿到结果后**：
1. 立即 `node scripts/agent-log.js patch --id last --title "kb-auditor 审 X" --summary "<VERDICT 行>" --outcome success|partial|blocked`（按 [[feedback-agent-log-patch]] 纪律）
2. 重要建议立即 Edit kb 文件；Minor 建议视情况
3. 不要把 audit 报告内容复制进主对话（已在 logs/audits/）

相关：[[feedback-agent-log-patch]]
```

- [ ] **Step 2: 更新 MEMORY.md 索引**

Read 当前 `memory/MEMORY.md`，找到 feedback section 末尾（在 feedback-agent-log-patch 那行之后），append:

```markdown
- [Feedback: Spawn kb-auditor](feedback-spawn-kb-auditor.md) — long-form kb 笔记 ≥300 行改动 OR ≥800 行总量后主动 spawn kb-auditor，review-only 隔离 context
```

- [ ] **Step 3: Commit**

```bash
git add memory/feedback-spawn-kb-auditor.md memory/MEMORY.md
git commit -m "docs(memory): add feedback-spawn-kb-auditor discipline"
```

---

## Task 5: .claude/agents/plan-executor.md

**Files:**
- Create: `.claude/agents/plan-executor.md`

- [ ] **Step 1: 创建 plan-executor.md**

Create `.claude/agents/plan-executor.md`:

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

- [ ] **Step 2: 跑测试确认 plan-executor 相关 2 个 pass**

```bash
node --test tests/subagent-definitions.test.js 2>&1 | grep -E "ok|not ok" | head -8
```

Expected: 6 pass（kb-auditor 4 + plan-executor 2），idea-extractor 2 个 fail。

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/plan-executor.md
git commit -m "feat: add plan-executor subagent (nested impl/review, report to logs/plan-runs/)"
```

---

## Task 6: .claude/agents/idea-extractor.md

**Files:**
- Create: `.claude/agents/idea-extractor.md`

- [ ] **Step 1: 创建 idea-extractor.md**

Create `.claude/agents/idea-extractor.md`:

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

- [ ] **Step 2: 跑测试确认所有 8 个 pass**

```bash
node --test tests/subagent-definitions.test.js
```

Expected: 8 pass / 0 fail

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/idea-extractor.md
git commit -m "feat: add idea-extractor subagent (read-only, EXTRACT-VERDICT inline)"
```

---

## Task 7: 端到端 smoke 测试（3 个 subagent 各 dispatch 一次）

**Files:** 无新文件，纯验证

- [ ] **Step 1: 选一个 sample kb 文件做 kb-auditor 验证**

挑一个 kb/ 下的真实 md 文件（建议 800+ 行的 long-form，如 `kb/技术/AI/大模型/Agent 与 MCP.md`，先确认存在）：

```bash
wc -l kb/技术/AI/大模型/*.md | sort -n | tail -5
```

记一个候选（用户 / 实施者按需选）。

- [ ] **Step 2: 用 Task tool spawn kb-auditor**

在 Claude Code 内（或让主 agent 触发）调用 Task tool：
- description: "kb-auditor smoke test on <file>"
- subagent_type: `kb-auditor`（如果 Claude Code 已 reload 配置并识别自定义 subagent）or `general-purpose`（fallback，需把 kb-auditor.md 内容粘进 prompt）
- prompt: "审计文件: <full-path>。按 kb-auditor 标准 4 维度走完，写 report 落 logs/audits/，return VERDICT 行。"

验证产出：

```bash
ls logs/audits/  # 应有 <basename>-YYYY-MM-DD.md
head -20 logs/audits/*.md | head -20  # 检查 frontmatter 含 audit_target / audit_date / verdict
```

- [ ] **Step 3: 用 plan-executor smoke 测试**

⚠️ 注意：plan-executor 会真实施工。**不要**在真实 plan 上跑 smoke（会改 kb 文件）。可以构造一个 mini fake plan：

```bash
cat > /tmp/fake-plan.md <<'EOF'
# Fake Plan

### Task 1: Touch a tmp file
- [ ] Step 1: Run `touch /tmp/plan-executor-smoke-1.txt`
- [ ] Step 2: Commit (skip since no git change)

### Task 2: Echo to a tmp file
- [ ] Step 1: Run `echo "hello" > /tmp/plan-executor-smoke-2.txt`
EOF
```

dispatch plan-executor with prompt: "Run plan at /tmp/fake-plan.md."

验证 `logs/plan-runs/fake-plan-YYYY-MM-DD.md` 存在 + 含 Status 字段。

⚠️ plan-executor 的 review/fix 嵌套机制比较重，smoke 可能 partial / blocked。**重点验证报告产生 + VERDICT return**，不要求完美 pass。

清理：`rm /tmp/fake-plan.md /tmp/plan-executor-smoke-*.txt logs/plan-runs/fake-plan-*.md`（smoke 数据不入库）

- [ ] **Step 4: 用 idea-extractor smoke 测试**

dispatch idea-extractor with prompt:
> 从这段话提取 KB 沉淀候选：
>
> "MCP（Model Context Protocol）是 Anthropic 提出的标准化协议，让 AI 应用以统一方式接外部工具和数据源。MCP 有 4 种 transport：stdio、HTTP、SSE、WebSocket。Spring AI 1.0+ 内置了 MCP server starter，可以用 webflux starter 起 SSE。"

验证 return 含 `EXTRACT-VERDICT:` + 至少 1 个 [新建] / [追加] / [跳过] 标签。
（项目已有 MCP 相关 kb 文件，预期 extractor 给"追加"或"跳过"建议）

- [ ] **Step 5: 验证 agent-log 都收到了 3 条 start + 主 agent patch**

```bash
# 看本月 jsonl 末尾几条
tail -10 logs/agent-runs/$(date +%Y-%m).jsonl

# 应该看到 3 条 start 事件（agent 字段是 kb-auditor / plan-executor / idea-extractor
# OR general-purpose 如果 subagent_type 还没生效），各对应 3 个 patch（含 title）
```

主 agent 在每次 subagent 返回后已按 feedback-agent-log-patch memory patch 了 title/summary/outcome，跑 `node scripts/agent-report.js` 看月报数据。

- [ ] **Step 6: 记录 smoke 结论到一个 commit message**

```bash
# 如果 3 个 subagent 都基本可用（report 落盘 + VERDICT 格式对）
git commit --allow-empty -m "$(cat <<'EOF'
chore: e2e smoke test for 3 subagents

- kb-auditor: 审 <文件> → logs/audits/xxx.md 落盘正常 + VERDICT 返回
- plan-executor: 跑 /tmp fake-plan → logs/plan-runs/xxx.md 落盘 + VERDICT 返回
- idea-extractor: extract MCP 段 → EXTRACT-VERDICT return（建议: <X>）

agent-runs.jsonl 3 条 start + 主 agent 已 patch 完整。

Known limitations: <如有，列出>
EOF
)"
```

如有 subagent 严重失败，记录到 commit + 列入 follow-up plan。

---

## Task 8: 全量回归 + spec/plan status 收尾

- [ ] **Step 1: 跑全量测试**

```bash
bash test.sh
```

Expected: 全绿（包含 Task 2 新增的 8 条 subagent-definitions 测试 + 已有 144 = 152 pass）

- [ ] **Step 2: 跑 arch-lint**

```bash
bash scripts/arch-lint.sh 2>&1 | tail -10
```

Expected: 不出现关于 .claude/agents/ 或 logs/audits 的新警告。

- [ ] **Step 3: 改 spec 和 plan frontmatter status**

```
docs/superpowers/specs/2026-06-03-three-subagents-design.md: status: pending → completed
docs/superpowers/plans/2026-06-03-three-subagents-plan.md (本文件): status: pending → completed
```

- [ ] **Step 4: 最终 commit**

```bash
git add docs/superpowers/specs/2026-06-03-three-subagents-design.md docs/superpowers/plans/2026-06-03-three-subagents-plan.md
git commit -m "chore: mark three-subagents spec + plan as completed"
```

- [ ] **Step 5: push 触发 pre-push gate**

```bash
git push
```

pre-push hook 自动跑 `bash test.sh`，通过后推送。

---

## 落地后的状态

- ✅ 3 个项目级 subagent 注册在 `.claude/agents/` 跟 git
- ✅ kb-auditor 自动 spawn 规则在 `feedback-spawn-kb-auditor` memory 中
- ✅ logs/audits/ + logs/plan-runs/ 目录 + README 落地
- ✅ subagent-definitions.test.js 8 测试守护 frontmatter / tools / body 必备 section
- ✅ 端到端 smoke 验证 3 个 subagent 都能正常运转 + agent-log 集成

**下一步**：日常使用中按 `feedback-spawn-kb-auditor` 触发 kb-auditor；遇长 plan 调 plan-executor；用户给长文时 spawn idea-extractor。

**未来扩展候选**（YAGNI，先不做）：
- subagent 跑出的 verdict 集成到 SPA Activity tab
- audit / plan-run 报告的月度汇总脚本
- subagent 的 prompt 版本化管理
