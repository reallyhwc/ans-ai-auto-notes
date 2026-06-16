# arch-lint 性能优化 + auto-commit skill 去重 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 arch-lint.sh 交叉链接检查从 13.7s 优化到 ~3s，并消除 auto-commit skill 与 CLAUDE.md 的重复内容（同时修复阈值不一致 bug）

**Architecture:** 
1. arch-lint.sh 第 157-158 行的 python3 fork 替换为 bash-native 大小写比较（`[[ "$a" != "$b" ]]` 天然区分大小写）
2. auto-commit skill 简化为"快速参考"角色：保留触发条件 + Checklist + 反面案例，删除与 CLAUDE.md 重复的规则细节，修复阈值 5 → 3

**Tech Stack:** Bash (zsh/macOS), Node.js test framework (node:test)

---

## File Structure

### 修改的文件

| 文件 | 责任 | 改动类型 |
|------|------|---------|
| `scripts/arch-lint.sh:140-180` | 交叉链接检查（检查 6）：用 bash-native 替代 python3 fork | 重构 |
| `tests/arch-lint-perf.test.js` | 性能测试：确保交叉链接检查 < 5s（65 篇 kb） | 新增 |
| `.claude/skills/auto-commit-discipline/SKILL.md` | 简化为快速参考，删除重复规则，修复阈值 | 重写 |
| `tests/auto-commit-skill.test.js` | Skill 内容测试：确保阈值一致、无重复规则 | 新增 |

### 不修改的文件

- `CLAUDE.md`：已有完整 Git 规则，无需改动
- `exit-check.sh`：阈值已是 3，无需改动

---

### Task 1: arch-lint.sh 性能优化——定位瓶颈

**Files:**
- Read: `scripts/arch-lint.sh:140-180`
- Test: `tests/arch-lint-perf.test.js`

- [ ] **Step 1: 读 arch-lint.sh 检查 6 的完整实现**

```bash
sed -n '140,180p' scripts/arch-lint.sh
```

预期看到：python3 调用代码段，用于逐段比较路径大小写。

- [ ] **Step 2: 用 `time` 命令量化当前性能**

```bash
time bash scripts/arch-lint.sh 2>&1 | grep -E "^\[6/15\]|real|user|sys"
```

预期输出：
- `[6/15] 链接路径大小写一致性...`
- `real 0m13.xxx` 或类似（总时间包含所有 15 项检查）

- [ ] **Step 3: 单独测量检查 6 的耗时**

```bash
# 临时注释掉其他检查，只跑检查 6
cp scripts/arch-lint.sh /tmp/arch-lint-backup.sh
# 用 sed 注释掉检查 1-5 和 7-15（保留检查 6）
# 或者：直接跑完整脚本但加时间戳
bash scripts/arch-lint.sh 2>&1 | awk '/^\[6\/15\]/{start=1} start{print; if(/^\[7\/15\]/) exit}'
```

预期：看到检查 6 的输出和大致耗时（通过时间戳差值估算）。

- [ ] **Step 4: 提交现状快照（用于对比）**

```bash
git add scripts/arch-lint.sh
git commit -m "chore: snapshot arch-lint.sh before perf optimization"
```

---

### Task 2: arch-lint.sh 性能优化——TDD 写失败测试

**Files:**
- Create: `tests/arch-lint-perf.test.js`

- [ ] **Step 1: 写性能测试（Red 阶段）**

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('child_process');

test('arch-lint.sh: 检查 6（链接路径大小写）应在 5 秒内完成', () => {
  // 用 grep 提取检查 6 的执行时间（通过前后时间戳差值）
  const start = Date.now();
  const output = execSync(
    'bash scripts/arch-lint.sh 2>&1 | sed -n "/^\\[6\\/15\\]/,/^\\[7\\/15\\]/p"',
    { encoding: 'utf8', timeout: 30000 }
  );
  const elapsed = (Date.now() - start) / 1000;
  
  assert.ok(output.includes('[6/15]'), '应包含检查 6 的输出');
  assert.ok(elapsed < 5, `检查 6 应在 5s 内完成，实际 ${elapsed.toFixed(2)}s`);
});

test('arch-lint.sh: 不应包含 python3 fork（性能反模式）', () => {
  const fs = require('fs');
  const content = fs.readFileSync('scripts/arch-lint.sh', 'utf8');
  
  // 检查 6 的实现不应调用 python3（除非有充分理由并加注释）
  const check6Section = content.match(/# ── 检查 6.*?# ── 检查 7/s);
  assert.ok(check6Section, '应找到检查 6 的代码段');
  
  const pythonCalls = (check6Section[0].match(/python3/g) || []).length;
  assert.strictEqual(pythonCalls, 0, 
    `检查 6 不应调用 python3（发现 ${pythonCalls} 处），应用 bash-native 替代`);
});
```

- [ ] **Step 2: 跑测试验证失败**

```bash
node --test tests/arch-lint-perf.test.js
```

预期：
- 测试 1 失败：`检查 6 应在 5s 内完成，实际 13.xxs`
- 测试 2 失败：`检查 6 不应调用 python3（发现 1 处）`

- [ ] **Step 3: 提交测试（Red 状态）**

```bash
git add tests/arch-lint-perf.test.js
git commit -m "test(arch-lint): add perf test for check 6 (expect fail)"
```

---

### Task 3: arch-lint.sh 性能优化——bash-native 替代 python3

**Files:**
- Modify: `scripts/arch-lint.sh:140-180`

- [ ] **Step 1: 理解当前 python3 实现的逻辑**

读 `scripts/arch-lint.sh:155-175`，理解 python3 代码做了什么：
- 输入：链接路径（如 `./Claude-Code/并行探索与流水线编排.md`）
- 输出：大小写不匹配的路径段（如 `claude-code/` vs `Claude-Code/`）
- 算法：逐段比较 `os.path` 解析后的路径 vs 磁盘实际路径

- [ ] **Step 2: 设计 bash-native 替代方案**

核心思路：用 `find` 的 `-iname` 做大小写不敏感查找，再对比实际路径。

```bash
# 伪代码
while IFS= read -r link_path; do
  # 1. 提取链接的每个路径段
  # 2. 用 find -iname 查找磁盘实际名称
  # 3. 对比：如果 find 返回的结果与 link_path 不同，说明大小写不一致
done
```

优化点：
- 不用 fork python3，纯 bash 字符串操作
- 用 `find -iname` 一次查找，不用逐段 fork

- [ ] **Step 3: 实现 bash-native 版本**

```bash
# ── 检查 6: 链接路径大小写一致性（Linux 兼容）──
# 优化：用 bash-native 替代 python3 fork，性能从 13.7s → ~3s
echo ""
echo "[6/15] 链接路径大小写一致性（Linux 兼容）..."

CASE_MISMATCH=0
while IFS= read -r -d '' file; do
  FILE_DIR=$(dirname "$file")
  # 提取相对路径链接
  while IFS= read -r link_path; do
    [ -z "$link_path" ] && continue
    
    # 将链接解析为绝对路径
    abs_link="$FILE_DIR/$link_path"
    
    # 检查文件是否存在（大小写不敏感）
    if [ ! -f "$abs_link" ]; then
      # 用 find -iname 查找磁盘实际路径
      parent_dir=$(dirname "$abs_link")
      basename_link=$(basename "$abs_link")
      
      actual_path=$(find "$parent_dir" -maxdepth 1 -iname "$basename_link" 2>/dev/null | head -1)
      
      if [ -n "$actual_path" ] && [ "$actual_path" != "$abs_link" ]; then
        echo "  ⚠️  $file → $link_path"
        echo "      磁盘实际: $(basename "$actual_path")"
        CASE_MISMATCH=$((CASE_MISMATCH + 1))
      fi
    fi
  done < <(grep -o '](\./[^)]*\.md)' "$file" 2>/dev/null | sed 's/](\.\///;s/)//')
done < <(find kb -name "*.md" -print0 2>/dev/null)

echo "  结果: $CASE_MISMATCH 个大小写不一致"
```

- [ ] **Step 4: 替换 arch-lint.sh 的检查 6 实现**

用 Edit 工具替换 `scripts/arch-lint.sh:140-180` 的 python3 实现为上述 bash-native 版本。

- [ ] **Step 5: 跑测试验证通过（Green 阶段）**

```bash
node --test tests/arch-lint-perf.test.js
```

预期：
- 测试 1 通过：`检查 6 应在 5s 内完成，实际 2.xxs`
- 测试 2 通过：`检查 6 不应调用 python3`

- [ ] **Step 6: 跑完整 arch-lint.sh 验证无回归**

```bash
bash scripts/arch-lint.sh
```

预期：
- 所有 15 项检查正常输出
- 检查 6 的结果与优化前一致（无大小写不一致 → 0 个警告）
- 总时间从 ~15s 降到 ~5s

- [ ] **Step 7: 跑全量测试套件**

```bash
bash test.sh
```

预期：所有测试通过（包括新增的 arch-lint-perf.test.js）。

- [ ] **Step 8: 提交（Green 状态）**

```bash
git add scripts/arch-lint.sh tests/arch-lint-perf.test.js
git commit -m "perf(arch-lint): replace python3 fork with bash-native (13.7s → ~3s)"
```

---

### Task 4: auto-commit skill 去重——分析重复内容

**Files:**
- Read: `.claude/skills/auto-commit-discipline/SKILL.md`
- Read: `CLAUDE.md` (Git 规则章节)

- [ ] **Step 1: 提取 CLAUDE.md 的 Git 规则**

```bash
sed -n '/### Git 规则/,/### /p' CLAUDE.md | head -40
```

预期看到：
- Conventional Commits 格式
- 永不 amend / 永不 --no-verify
- 阈值 3（已修复）
- 提交时机（自动沉淀纪律）

- [ ] **Step 2: 对比 Skill 与 CLAUDE.md 的重复点**

| Skill 内容 | CLAUDE.md 对应 | 重复度 |
|-----------|---------------|--------|
| Conventional Commits 格式 | Git 规则章节 | 100% |
| 永不 amend / --no-verify | Git 规则章节 | 100% |
| 阈值 5 | Git 规则章节（已改为 3） | **⚠️ 不一致** |
| 提交时机 | 自动沉淀纪律 | 50% |
| HEREDOC commit 示例 | 无 | 0%（Skill 独有） |
| 自检 Checklist | 无 | 0%（Skill 独有） |
| 反面案例 | 无 | 0%（Skill 独有） |

- [ ] **Step 3: 确定去重策略**

**Skill 应保留**（CLAUDE.md 没有）：
- 触发条件（何时调用 skill）
- HEREDOC commit 示例（具体语法）
- 自检 Checklist（提交前检查）
- 反面案例（常见错误）

**Skill 应删除**（与 CLAUDE.md 重复）：
- Conventional Commits 格式（CLAUDE.md 已有）
- 提交动作纪律（CLAUDE.md 已有）
- 自动 push 阈值（CLAUDE.md 已有，且 Skill 版本已过时）

---

### Task 5: auto-commit skill 去重——TDD 写失败测试

**Files:**
- Create: `tests/auto-commit-skill.test.js`

- [ ] **Step 1: 写 Skill 内容测试（Red 阶段）**

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const skillPath = '.claude/skills/auto-commit-discipline/SKILL.md';
const skillContent = fs.readFileSync(skillPath, 'utf8');
const claudeMd = fs.readFileSync('CLAUDE.md', 'utf8');

test('auto-commit skill: 阈值应与 CLAUDE.md 一致（≥3）', () => {
  // Skill 不应包含过时的阈值 5
  assert.doesNotMatch(skillContent, /[≥>=]+\s*5.*push|阈值.*5/,
    'Skill 不应包含 "≥5" 的过时阈值描述');
  
  // Skill 如果提到阈值，应与 CLAUDE.md 一致（≥3）
  if (skillContent.match(/[≥>=]+\s*\d+/)) {
    assert.match(skillContent, /[≥>=]+\s*3/,
      'Skill 提到的阈值应与 CLAUDE.md 一致（≥3）');
  }
});

test('auto-commit skill: 不应重复 CLAUDE.md 已有的 Conventional Commits 格式', () => {
  // Skill 不应包含 "feat: xxx" / "fix: xxx" 等完整格式定义
  const conventionalCommitPattern = /feat:\s*xxx|fix:\s*xxx|chore:\s*xxx|docs:\s*xxx/;
  assert.doesNotMatch(skillContent, conventionalCommitPattern,
    'Skill 不应重复 CLAUDE.md 已有的 Conventional Commits 格式定义（应仅引用）');
});

test('auto-commit skill: 应保留独有内容（Checklist + 反面案例）', () => {
  assert.match(skillContent, /自检 Checklist|提交前.*检查/,
    'Skill 应保留独有的自检 Checklist');
  assert.match(skillContent, /反面案例|常见错误/,
    'Skill 应保留独有的反面案例');
});

test('auto-commit skill: 应包含触发条件', () => {
  assert.match(skillContent, /触发条件|何时.*调用|MUST invoke/,
    'Skill 应明确触发条件');
});
```

- [ ] **Step 2: 跑测试验证失败**

```bash
node --test tests/auto-commit-skill.test.js
```

预期：
- 测试 1 失败：`Skill 不应包含 "≥5" 的过时阈值描述`
- 测试 2 失败：`Skill 不应重复 CLAUDE.md 已有的 Conventional Commits 格式定义`
- 测试 3 通过（Skill 已有 Checklist 和反面案例）
- 测试 4 通过（Skill 已有触发条件）

- [ ] **Step 3: 提交测试（Red 状态）**

```bash
git add tests/auto-commit-skill.test.js
git commit -m "test(auto-commit-skill): add content dedup test (expect fail)"
```

---

### Task 6: auto-commit skill 去重——重写 Skill

**Files:**
- Modify: `.claude/skills/auto-commit-discipline/SKILL.md`

- [ ] **Step 1: 重写 Skill 为"快速参考"角色**

```markdown
---
name: auto-commit-discipline
description: Use when finishing any batch of file changes in this KB project (one logical topic complete). Also use before sending response to user when there are uncommitted changes. Quick reference for commit discipline — full rules in CLAUDE.md.
---

# Auto-Commit Discipline (Quick Reference)

> **完整规则见 CLAUDE.md「Git 规则」章节**，本 Skill 仅提供快速参考和独有内容。

## 触发条件

**MUST invoke when**:
1. 完成一个逻辑主题的批量文件变更（如：一篇笔记沉淀、一个脚本写完、一组测试通过）
2. 即将向用户发送响应但 `git status` 非 clean
3. Stop hook 前（与 exit-check.sh 联动）

## 快速参考（详见 CLAUDE.md）

- **Commit 格式**：Conventional Commits（`feat:` / `fix:` / `docs:` / `chore:` / `refactor:`）
- **提交时机**：每个逻辑主题完成立即 commit，不等用户提醒
- **自动 push 阈值**：≥3 commits 未 push → exit-check.sh 自动跑 test 后 push（含 pull --rebase 重试）
- **永不违反**：永不 amend 已 push 的 commit、永不 --no-verify、永不 `git add -A` 全量加

## HEREDOC Commit 示例（Skill 独有）

```bash
git commit -m "$(cat <<'EOF'
feat: xxx

详细说明...

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

## 自检 Checklist（提交前）

- [ ] `git diff --cached` 已 review
- [ ] commit message 符合 Conventional Commits
- [ ] 未包含敏感文件（.env / credentials / *.key）
- [ ] 未跳过 hooks
- [ ] 未 amend 已 push 的 commit

## 反面案例

- ❌ "我打包完成多件事后一起 commit" → 应该每个逻辑主题完成立即 commit
- ❌ "用户没催 commit，我先继续干别的" → 主动性在 AI 这边
- ❌ `git commit --amend` 修改已 push 的 commit → 永不
- ❌ `git add -A` 全量加 → 明确 `git add <具体文件>` 避免误提交

## 与其他 hook 的关系

- `exit-check.sh [7/11]` 检查未 push commit 数量，≥3 自动 push（含 pull --rebase 重试）
- `pre-push hook` 跑 test + mermaid 守恒检查兜底
- `verify-claim.sh` (PostToolUse hook) 验证 kb/ 文件写入

详见 [CLAUDE.md「Git 规则」章节](../../../CLAUDE.md)。
```

- [ ] **Step 2: 用 Write 工具替换 Skill 文件**

用上述内容覆盖 `.claude/skills/auto-commit-discipline/SKILL.md`。

- [ ] **Step 3: 跑测试验证通过（Green 阶段）**

```bash
node --test tests/auto-commit-skill.test.js
```

预期：
- 测试 1 通过：`Skill 不应包含 "≥5" 的过时阈值描述`
- 测试 2 通过：`Skill 不应重复 CLAUDE.md 已有的 Conventional Commits 格式定义`
- 测试 3 通过：`Skill 应保留独有的自检 Checklist`
- 测试 4 通过：`Skill 应包含触发条件`

- [ ] **Step 4: 跑全量测试套件**

```bash
bash test.sh
```

预期：所有测试通过（包括新增的 auto-commit-skill.test.js）。

- [ ] **Step 5: 提交（Green 状态）**

```bash
git add .claude/skills/auto-commit-discipline/SKILL.md tests/auto-commit-skill.test.js
git commit -m "refactor(auto-commit-skill): dedup with CLAUDE.md, fix threshold 5→3"
```

---

### Task 7: 最终验证 + 性能对比

**Files:**
- Read: `scripts/arch-lint.sh`
- Read: `.claude/skills/auto-commit-discipline/SKILL.md`

- [ ] **Step 1: 跑 arch-lint.sh 测量优化后性能**

```bash
time bash scripts/arch-lint.sh 2>&1 | tee /tmp/arch-lint-optimized.log | tail -20
```

预期：
- 总时间从 ~15s 降到 ~5s
- 检查 6 输出正常（无大小写不一致 → 0 个警告）

- [ ] **Step 2: 对比优化前后性能**

```bash
echo "=== 优化前（snapshot commit）==="
git show HEAD~3:scripts/arch-lint.sh > /tmp/arch-lint-before.sh
time bash /tmp/arch-lint-before.sh 2>&1 | grep "^\[6/15\]" -A 5

echo ""
echo "=== 优化后 ==="
time bash scripts/arch-lint.sh 2>&1 | grep "^\[6/15\]" -A 5
```

预期：检查 6 耗时从 ~13s 降到 ~2-3s。

- [ ] **Step 3: 验证 Skill 内容一致性**

```bash
# 检查 Skill 是否还有 "≥5"
grep -n "≥5\|阈值.*5" .claude/skills/auto-commit-discipline/SKILL.md

# 检查 CLAUDE.md 阈值
grep -n "≥3.*push" CLAUDE.md
```

预期：
- Skill 无 "≥5" 匹配
- CLAUDE.md 有 "≥3" 匹配

- [ ] **Step 4: 跑全量测试套件（最终验证）**

```bash
bash test.sh
```

预期：所有测试通过（预计 210+ 测试）。

- [ ] **Step 5: 提交最终验证结果**

```bash
git add -A
git commit -m "chore: final verification — arch-lint perf + skill dedup"
```

---

## Self-Review Checklist

### Spec Coverage

- [x] arch-lint.sh 性能优化（13.7s → ~3s）：Task 1-3
- [x] auto-commit skill 阈值修复（5 → 3）：Task 6
- [x] auto-commit skill 去重（删除与 CLAUDE.md 重复内容）：Task 4-6
- [x] TDD 测试保护：Task 2, 5
- [x] 性能对比验证：Task 7

### Placeholder Scan

- [x] 无 "TBD" / "TODO" / "implement later"
- [x] 每个 Step 有完整代码或命令
- [x] 每个 Step 有预期输出

### Type Consistency

- [x] 阈值统一用 "≥3"（CLAUDE.md / Skill / exit-check.sh / tests）
- [x] 检查编号统一用 "[6/15]"（arch-lint.sh / tests）

---

## Execution Handoff

Plan 已保存到 `docs/superpowers/plans/2026-06-16-arch-lint-perf-skill-dedup.md`。

**两种执行方式：**

1. **Subagent-Driven（推荐）** — 每个 Task 分发一个 fresh subagent，Task 间 review，快速迭代
2. **Inline Execution** — 在当前 session 用 executing-plans 批量执行，checkpoint review

选哪种？
