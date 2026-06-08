# Harness 架构演进：五项改进 Implementation Plan

> 状态: completed (2026-06-08)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 围绕 Claude Code harness 体系实现 5 项改进：PreToolUse 守卫、agent-log patch 合规检查、hook 依赖契约测试、内容质量 fast-path、hook 执行可观测性。

**Architecture:** 所有改进遵循"约束层"理念——机械约束替代文档约束。每个改进独立，可并行实现。新脚本遵循项目现有模式：bash 脚本用于 hook，Node.js 用于需要 JSON 处理的逻辑。零 npm 依赖。

**Tech Stack:** Bash / Node.js (内置模块) / node:test 测试框架

---

## File Structure

| 文件 | 职责 | Task |
|------|------|------|
| `scripts/pretool-guard.sh` (新建) | PreToolUse hook：拦截对勿手改文件的 Write/Edit | Task 1 |
| `tests/pretool-guard.test.js` (新建) | pretool-guard 的测试 | Task 1 |
| `.claude/settings.local.json` (修改) | 注册 PreToolUse hook | Task 1 |
| `scripts/check-agent-log-compliance.js` (新建) | 扫描当月 JSONL 找未 patch 的 run | Task 2 |
| `tests/agent-log-compliance.test.js` (新建) | compliance 检查的测试 | Task 2 |
| `exit-check.sh` (修改) | 新增 [10/11] agent-log patch 合规检查 | Task 2 |
| `tests/hook-contract.test.js` (新建) | verify-claim → exit-check 链路契约测试 | Task 3 |
| `scripts/content-quality-fast.sh` (新建) | Stop hook 轻量内容质量检查 | Task 4 |
| `tests/content-quality-fast.test.js` (新建) | 内容质量 fast-path 测试 | Task 4 |
| `exit-check.sh` (修改) | 新增 [11/11] 内容质量 fast-path | Task 4 |
| `scripts/hook-logger.sh` (新建) | hook 通用 wrapper，记录执行结果到 JSONL | Task 5 |
| `tests/hook-logger.test.js` (新建) | hook-logger 测试 | Task 5 |
| `CLAUDE.md` (修改) | Hook 体系表更新 | Task 5 |

---

### Task 1: PreToolUse 守卫 — 拦截勿手改文件

**Files:**
- Create: `scripts/pretool-guard.sh`
- Create: `tests/pretool-guard.test.js`
- Modify: `.claude/settings.local.json:108-119`

- [ ] **Step 1: 写失败测试**

创建 `tests/pretool-guard.test.js`：

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function withTempProject(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptg-test-'));
  const scriptSrc = path.resolve(__dirname, '..', 'scripts', 'pretool-guard.sh');
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(scriptSrc, path.join(dir, 'scripts', 'pretool-guard.sh'));
  fs.chmodSync(path.join(dir, 'scripts', 'pretool-guard.sh'), 0o755);
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function runGuard(dir, payload) {
  return execSync('bash scripts/pretool-guard.sh', {
    cwd: dir,
    input: JSON.stringify(payload),
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

test('pretool-guard: Write INDEX.md → 拦截（exit 2）', () => {
  withTempProject(dir => {
    assert.throws(() => {
      runGuard(dir, {
        tool_name: 'Write',
        tool_input: { file_path: 'INDEX.md' },
      });
    }, (err) => {
      assert.equal(err.status, 2);
      assert.match(err.stderr.toString(), /INDEX\.md/);
      return true;
    });
  });
});

test('pretool-guard: Edit manifest.json → 拦截（exit 2）', () => {
  withTempProject(dir => {
    assert.throws(() => {
      runGuard(dir, {
        tool_name: 'Edit',
        tool_input: { file_path: 'manifest.json' },
      });
    }, (err) => {
      assert.equal(err.status, 2);
      return true;
    });
  });
});

test('pretool-guard: Write overview.html → 拦截（exit 2）', () => {
  withTempProject(dir => {
    assert.throws(() => {
      runGuard(dir, {
        tool_name: 'Write',
        tool_input: { file_path: '/abs/path/overview.html' },
      });
    }, (err) => {
      assert.equal(err.status, 2);
      return true;
    });
  });
});

test('pretool-guard: Write kb/技术/foo.md → 放行（exit 0）', () => {
  withTempProject(dir => {
    const out = runGuard(dir, {
      tool_name: 'Write',
      tool_input: { file_path: 'kb/技术/foo.md' },
    });
    // exit 0，无输出
  });
});

test('pretool-guard: Edit CLAUDE.md → 放行（exit 0）', () => {
  withTempProject(dir => {
    runGuard(dir, {
      tool_name: 'Edit',
      tool_input: { file_path: 'CLAUDE.md' },
    });
  });
});

test('pretool-guard: 无 file_path → 放行（exit 0）', () => {
  withTempProject(dir => {
    runGuard(dir, {
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
    });
  });
});

test('pretool-guard: 绝对路径含 INDEX.md → 拦截', () => {
  withTempProject(dir => {
    assert.throws(() => {
      runGuard(dir, {
        tool_name: 'Write',
        tool_input: { file_path: '/Users/xuhu/workspace/ans-ai-auto-notes/INDEX.md' },
      });
    }, (err) => {
      assert.equal(err.status, 2);
      return true;
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/pretool-guard.test.js`
Expected: FAIL（scripts/pretool-guard.sh 不存在）

- [ ] **Step 3: 实现 pretool-guard.sh**

创建 `scripts/pretool-guard.sh`：

```bash
#!/bin/bash
# arch-lint-ignore-unref: Hook script attached via PreToolUse in .claude/settings.local.json
# pretool-guard.sh — PreToolUse hook：拦截对勿手改文件的直接编辑
#
# 被拦截文件（构建产物或自动生成）：
#   - INDEX.md（由 build-index.js 生成）
#   - manifest.json（由 build-index.js 生成）
#   - overview.html（手改会被覆盖/破坏）
#
# 退出码：
#   0 = 放行
#   2 = 拦截（Claude Code 会阻断该工具调用）
set -uo pipefail

STDIN_JSON=""
if [ ! -t 0 ]; then
  STDIN_JSON=$(cat)
fi

[ -z "$STDIN_JSON" ] && exit 0

FILE_PATH=$(echo "$STDIN_JSON" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    ti = d.get('tool_input', {}) or {}
    print(ti.get('file_path') or ti.get('notebook_path') or '')
except Exception:
    print('')
" 2>/dev/null)

[ -z "$FILE_PATH" ] && exit 0

# 提取文件名（去掉目录前缀）
BASENAME=$(basename "$FILE_PATH")

case "$BASENAME" in
  INDEX.md|manifest.json|overview.html)
    echo "🚫 pretool-guard: $BASENAME 是构建产物，禁止直接编辑。请通过 build-index.js 或修改源文件。" >&2
    exit 2
    ;;
esac

exit 0
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/pretool-guard.test.js`
Expected: 7 tests PASS

- [ ] **Step 5: 注册 PreToolUse hook 到 settings.local.json**

在 `.claude/settings.local.json` 的 `hooks` 对象中，在 `PostToolUse` 之前添加 `PreToolUse`：

```json
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash scripts/pretool-guard.sh",
            "timeout": 10
          }
        ]
      }
    ],
```

- [ ] **Step 6: 运行全量测试**

Run: `bash test.sh`
Expected: 所有测试通过（包括新增的 pretool-guard 测试）

- [ ] **Step 7: Commit**

```bash
git add scripts/pretool-guard.sh tests/pretool-guard.test.js .claude/settings.local.json
git commit -m "feat(harness): PreToolUse 守卫 — 拦截 INDEX.md/manifest.json/overview.html 直接编辑"
```

---

### Task 2: Agent-log patch 合规检查

**Files:**
- Create: `scripts/check-agent-log-compliance.js`
- Create: `tests/agent-log-compliance.test.js`
- Modify: `exit-check.sh`

- [ ] **Step 1: 写失败测试**

创建 `tests/agent-log-compliance.test.js`：

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

function withTempLog(lines, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alc-test-'));
  const logDir = path.join(dir, 'logs', 'agent-runs');
  fs.mkdirSync(logDir, { recursive: true });
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const logFile = path.join(logDir, `${d.getFullYear()}-${mm}.jsonl`);
  fs.writeFileSync(logFile, lines.map(l => JSON.stringify(l)).join('\n') + '\n');
  try { fn(dir, logFile); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function runCheck(dir) {
  const script = path.resolve(__dirname, '..', 'scripts', 'check-agent-log-compliance.js');
  return execSync(`node "${script}"`, {
    cwd: dir,
    encoding: 'utf-8',
    env: { ...process.env, AGENT_LOG_DIR: path.join(dir, 'logs', 'agent-runs') },
  });
}

test('compliance: 所有 run 已 patch → 输出 ✓ + exit 0', () => {
  withTempLog([
    { event: 'start', id: 'r-2026-06-08-10-00-ab12', time: '2026-06-08T10:00:00+08:00', agent: 'kb-auditor', outcome: 'unknown' },
    { event: 'patch', id: 'r-2026-06-08-10-00-ab12', time: '2026-06-08T10:05:00+08:00', outcome: 'success', title: 'T', summary: 'S' },
  ], (dir) => {
    const out = runCheck(dir);
    assert.match(out, /✓/);
  });
});

test('compliance: 有 outcome=unknown 未 patch → 输出 ⚠️ + 列出 id', () => {
  withTempLog([
    { event: 'start', id: 'r-2026-06-08-10-00-ab12', time: '2026-06-08T10:00:00+08:00', agent: 'kb-auditor', outcome: 'unknown' },
  ], (dir) => {
    const out = runCheck(dir);
    assert.match(out, /⚠️/);
    assert.match(out, /r-2026-06-08-10-00-ab12/);
  });
});

test('compliance: 无日志文件 → 输出 ✓ + exit 0', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alc-test-'));
  try {
    const script = path.resolve(__dirname, '..', 'scripts', 'check-agent-log-compliance.js');
    const out = execSync(`node "${script}"`, {
      cwd: dir,
      encoding: 'utf-8',
      env: { ...process.env, AGENT_LOG_DIR: path.join(dir, 'logs', 'agent-runs') },
    });
    assert.match(out, /✓|无/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('compliance: main agent outcome=unknown → 不报（仅检查 subagent）', () => {
  withTempLog([
    { event: 'start', id: 'r-2026-06-08-10-00-ab12', time: '2026-06-08T10:00:00+08:00', agent: 'main', outcome: 'unknown' },
  ], (dir) => {
    const out = runCheck(dir);
    assert.match(out, /✓/);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/agent-log-compliance.test.js`
Expected: FAIL（scripts/check-agent-log-compliance.js 不存在）

- [ ] **Step 3: 实现 check-agent-log-compliance.js**

创建 `scripts/check-agent-log-compliance.js`：

```javascript
#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { foldEvents } = require('./lib-agent-log.js');

const logDir = process.env.AGENT_LOG_DIR || path.join(__dirname, '..', 'logs', 'agent-runs');
const d = new Date();
const mm = String(d.getMonth() + 1).padStart(2, '0');
const logFile = path.join(logDir, `${d.getFullYear()}-${mm}.jsonl`);

if (!fs.existsSync(logFile)) {
  console.log('  ✓ 无当月 agent-log 文件');
  process.exit(0);
}

const content = fs.readFileSync(logFile, 'utf8');
const events = content.split('\n').filter(l => l.trim()).flatMap(l => {
  try { return [JSON.parse(l)]; } catch { return []; }
});

const records = foldEvents(events);
const unpatched = records.filter(r => r.agent !== 'main' && r.outcome === 'unknown');

if (unpatched.length === 0) {
  console.log('  ✓ 所有 subagent run 均已 patch');
} else {
  console.log(`  ⚠️  ${unpatched.length} 个 subagent run 未 patch（outcome=unknown）：`);
  for (const r of unpatched) {
    console.log(`    ${r.id} | agent=${r.agent} | time=${r.time}`);
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/agent-log-compliance.test.js`
Expected: 4 tests PASS

- [ ] **Step 5: 集成到 exit-check.sh**

将 `exit-check.sh` 中的检查项从 `[N/9]` 改为 `[N/11]`（9→11，因为 Task 2 和 Task 4 各加一项），并在 `[9/11] plans 状态汇总` 之后添加：

```bash
# [10/11] agent-log patch 合规检查
echo ""
echo "[10/11] agent-log patch 合规..."
node scripts/check-agent-log-compliance.js
```

同时把所有 `[N/9]` 改为 `[N/11]`。

- [ ] **Step 6: 运行全量测试**

Run: `bash test.sh`
Expected: 所有测试通过

- [ ] **Step 7: Commit**

```bash
git add scripts/check-agent-log-compliance.js tests/agent-log-compliance.test.js exit-check.sh
git commit -m "feat(harness): agent-log patch 合规检查 — Stop hook 检查未 patch 的 subagent run"
```

---

### Task 3: Hook 依赖契约测试

**Files:**
- Create: `tests/hook-contract.test.js`

- [ ] **Step 1: 写契约测试**

创建 `tests/hook-contract.test.js`：

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

// 契约：verify-claim.sh 写入 claim-ledger.log 的格式 必须 能被 exit-check.sh [8/N] 正确消费
// 即 exit-check.sh 用 `grep -c " | MISSING$"` 来检测，verify-claim.sh 的输出必须以 ` | MISSING` 结尾

test('契约: verify-claim 输出格式被 exit-check 正确消费（MISSING 场景）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-test-'));
  const scriptSrc = path.resolve(__dirname, '..', 'scripts', 'verify-claim.sh');
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(scriptSrc, path.join(dir, 'scripts', 'verify-claim.sh'));
  fs.chmodSync(path.join(dir, 'scripts', 'verify-claim.sh'), 0o755);
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'kb'), { recursive: true });

  try {
    // 写入一个不存在的文件
    execSync('bash scripts/verify-claim.sh', {
      cwd: dir,
      input: JSON.stringify({
        tool_name: 'Write',
        tool_input: { file_path: 'kb/不存在.md' },
      }),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const ledger = fs.readFileSync(path.join(dir, '.claude', 'claim-ledger.log'), 'utf-8');

    // exit-check 用这个 pattern 消费 ledger
    const missingCount = (ledger.match(/ \| MISSING$/gm) || []).length;
    assert.equal(missingCount, 1, 'grep " | MISSING$" 应匹配 1 行');

    // 验证格式：YYYY-MM-DD HH:MM:SS | TOOL | PATH | STATUS
    const lines = ledger.trim().split('\n');
    assert.equal(lines.length, 1);
    const parts = lines[0].split(' | ');
    assert.equal(parts.length, 4, '应有 4 段用 " | " 分隔');
    assert.match(parts[0], /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, '第 1 段是时间戳');
    assert.equal(parts[1], 'Write', '第 2 段是工具名');
    assert.match(parts[2], /\.md$/, '第 3 段是文件路径');
    assert.equal(parts[3], 'MISSING', '第 4 段是状态');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('契约: verify-claim 输出格式被 exit-check 正确消费（exists 场景）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-test-'));
  const scriptSrc = path.resolve(__dirname, '..', 'scripts', 'verify-claim.sh');
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(scriptSrc, path.join(dir, 'scripts', 'verify-claim.sh'));
  fs.chmodSync(path.join(dir, 'scripts', 'verify-claim.sh'), 0o755);
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'kb', '技术'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'kb', '技术', 'test.md'), '# Test');

  try {
    execSync('bash scripts/verify-claim.sh', {
      cwd: dir,
      input: JSON.stringify({
        tool_name: 'Edit',
        tool_input: { file_path: 'kb/技术/test.md' },
      }),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const ledger = fs.readFileSync(path.join(dir, '.claude', 'claim-ledger.log'), 'utf-8');

    // exit-check 的 " | MISSING$" 不应匹配 exists 行
    const missingCount = (ledger.match(/ \| MISSING$/gm) || []).length;
    assert.equal(missingCount, 0, 'exists 行不应被 MISSING 匹配');

    const parts = ledger.trim().split(' | ');
    assert.equal(parts[3], 'exists');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('契约: exit-check [8/N] 的 grep pattern 与 ledger 格式一致', () => {
  // 直接验证 exit-check.sh 中使用的 grep pattern
  const exitCheck = fs.readFileSync(path.resolve(__dirname, '..', 'exit-check.sh'), 'utf-8');

  // exit-check 使用 `grep -c " | MISSING$"` 来计数
  assert.match(exitCheck, /grep -c " \| MISSING\$"/, 'exit-check 应使用 grep -c " | MISSING$" pattern');

  // verify-claim 写入的格式：`$TS | $TOOL | $FILE_PATH | MISSING`
  const verifyClaim = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'verify-claim.sh'), 'utf-8');
  assert.match(verifyClaim, /\| MISSING"/, 'verify-claim 应写入 "| MISSING" 后缀');
  assert.match(verifyClaim, /\| exists"/, 'verify-claim 应写入 "| exists" 后缀');
});
```

- [ ] **Step 2: 运行测试确认通过**

Run: `node --test tests/hook-contract.test.js`
Expected: 3 tests PASS（这是验证现有代码的契约，应该立即通过）

- [ ] **Step 3: Commit**

```bash
git add tests/hook-contract.test.js
git commit -m "test(harness): hook 依赖契约测试 — verify-claim → exit-check 链路格式校验"
```

---

### Task 4: 内容质量 fast-path

**Files:**
- Create: `scripts/content-quality-fast.sh`
- Create: `tests/content-quality-fast.test.js`
- Modify: `exit-check.sh`

- [ ] **Step 1: 写失败测试**

创建 `tests/content-quality-fast.test.js`：

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

function withTempKb(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cqf-test-'));
  // 模拟 git repo（脚本中需要 git diff）
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com" && git config user.name "test"', { cwd: dir, stdio: 'pipe' });

  for (const [relPath, content] of Object.entries(files)) {
    const full = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  // 初始 commit
  execSync('git add -A && git commit -m "init" --allow-empty', { cwd: dir, stdio: 'pipe' });

  const scriptSrc = path.resolve(__dirname, '..', 'scripts', 'content-quality-fast.sh');
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.copyFileSync(scriptSrc, path.join(dir, 'scripts', 'content-quality-fast.sh'));

  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function runCheck(dir, opts = {}) {
  const env = { ...process.env };
  if (opts.checkAll) env.CQF_CHECK_ALL = '1';
  return execSync('bash scripts/content-quality-fast.sh', {
    cwd: dir,
    encoding: 'utf-8',
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

test('content-quality-fast: 缺交叉链接 → 警告', () => {
  withTempKb({
    'kb/技术/Java/test.md': [
      '---',
      'title: Test',
      'description: Test file',
      '---',
      '',
      '> 最后整理: 2026-06-08 | 来源: 对话',
      '',
      '## 1. 内容',
      '',
      '这里有一些内容但没有交叉链接。',
    ].join('\n'),
  }, (dir) => {
    const out = runCheck(dir, { checkAll: true });
    assert.match(out, /交叉链接|相关|cross/i);
  });
});

test('content-quality-fast: 有交叉链接 → 不警告', () => {
  withTempKb({
    'kb/技术/Java/test.md': [
      '---',
      'title: Test',
      'description: Test file',
      '---',
      '',
      '> 最后整理: 2026-06-08 | 来源: 对话',
      '',
      '## 1. 内容',
      '',
      '相关：',
      '- [[其他文件.md]] — 关联内容',
    ].join('\n'),
  }, (dir) => {
    const out = runCheck(dir, { checkAll: true });
    assert.doesNotMatch(out, /缺.*交叉链接/);
  });
});

test('content-quality-fast: 缺 mermaid/代码块/表格 → 警告', () => {
  withTempKb({
    'kb/技术/Java/test.md': [
      '---',
      'title: Test',
      'description: Test file',
      '---',
      '',
      '> 最后整理: 2026-06-08 | 来源: 对话',
      '',
      '## 1. 纯文字内容',
      '',
      '这里只有纯文字，没有代码块、Mermaid 图或表格。',
    ].join('\n'),
  }, (dir) => {
    const out = runCheck(dir, { checkAll: true });
    assert.match(out, /具象元素|mermaid|代码块|表格/i);
  });
});

test('content-quality-fast: 元信息头日期 >30 天 → 警告', () => {
  withTempKb({
    'kb/技术/Java/test.md': [
      '---',
      'title: Test',
      'description: Test file',
      '---',
      '',
      '> 最后整理: 2025-01-01 | 来源: 对话',
      '',
      '## 1. 旧内容',
      '',
      '```java',
      'System.out.println("hello");',
      '```',
      '',
      '相关：',
      '- [[其他.md]]',
    ].join('\n'),
  }, (dir) => {
    const out = runCheck(dir, { checkAll: true });
    assert.match(out, /日期.*过旧|>.*天/);
  });
});

test('content-quality-fast: 合格文件 → 全部 ✓', () => {
  withTempKb({
    'kb/技术/Java/test.md': [
      '---',
      'title: Test',
      'description: Test file',
      '---',
      '',
      '> 最后整理: 2026-06-08 | 来源: 对话',
      '',
      '## 1. 内容',
      '',
      '```java',
      'System.out.println("hello");',
      '```',
      '',
      '相关：',
      '- [[其他.md]] — 关联',
    ].join('\n'),
  }, (dir) => {
    const out = runCheck(dir, { checkAll: true });
    assert.doesNotMatch(out, /⚠️|❌/);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/content-quality-fast.test.js`
Expected: FAIL（scripts/content-quality-fast.sh 不存在）

- [ ] **Step 3: 实现 content-quality-fast.sh**

创建 `scripts/content-quality-fast.sh`：

```bash
#!/bin/bash
# content-quality-fast.sh — 轻量级 kb/ 内容质量检查（Stop hook 用）
# 不 spawn agent，纯 shell 检查三项：交叉链接、具象元素、元信息头日期
#
# 模式：
#   默认: 只检查本 session 修改过的 kb/ 文件（git diff --name-only HEAD~）
#   CQF_CHECK_ALL=1: 检查所有 kb/ 文件
set -uo pipefail
cd "$(dirname "$0")/.."

WARN_COUNT=0

if [ "${CQF_CHECK_ALL:-}" = "1" ]; then
  FILES=$(find kb -name "*.md" -type f 2>/dev/null)
else
  FILES=$(git diff --name-only HEAD~ 2>/dev/null | grep '^kb/.*\.md$' || true)
fi

[ -z "$FILES" ] && echo "  ✓ 无 kb/ 文件需检查" && exit 0

TODAY_TS=$(date +%s)
STALE_DAYS=30

while IFS= read -r file; do
  [ -f "$file" ] || continue
  ISSUES=""

  # 检查 1: 交叉链接（相关/关联/[[...]]）
  if ! grep -qE '相关[：:]|\[\[.*\]\]|关联[：:]' "$file" 2>/dev/null; then
    ISSUES="${ISSUES}缺交叉链接 "
  fi

  # 检查 2: 具象元素（mermaid / 代码块 / 表格）
  HAS_CONCRETE=0
  grep -q '```mermaid' "$file" 2>/dev/null && HAS_CONCRETE=1
  [ "$HAS_CONCRETE" -eq 0 ] && grep -q '```' "$file" 2>/dev/null && HAS_CONCRETE=1
  [ "$HAS_CONCRETE" -eq 0 ] && grep -qE '^\|.*\|.*\|' "$file" 2>/dev/null && HAS_CONCRETE=1
  if [ "$HAS_CONCRETE" -eq 0 ]; then
    ISSUES="${ISSUES}缺具象元素(mermaid/代码块/表格) "
  fi

  # 检查 3: 元信息头日期是否 >30 天
  META_DATE=$(grep -m1 '^> 最后整理:' "$file" 2>/dev/null | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
  if [ -n "$META_DATE" ]; then
    META_TS=$(date -j -f "%Y-%m-%d" "$META_DATE" +%s 2>/dev/null || date -d "$META_DATE" +%s 2>/dev/null || echo "")
    if [ -n "$META_TS" ]; then
      DIFF_DAYS=$(( (TODAY_TS - META_TS) / 86400 ))
      if [ "$DIFF_DAYS" -gt "$STALE_DAYS" ]; then
        ISSUES="${ISSUES}元信息头日期过旧(>${STALE_DAYS}天: ${META_DATE}) "
      fi
    fi
  fi

  if [ -n "$ISSUES" ]; then
    echo "  ⚠️  $file — $ISSUES"
    WARN_COUNT=$((WARN_COUNT + 1))
  fi
done <<< "$FILES"

if [ "$WARN_COUNT" -eq 0 ]; then
  echo "  ✓ 已检查 kb/ 文件，内容质量达标"
fi
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/content-quality-fast.test.js`
Expected: 5 tests PASS

- [ ] **Step 5: 集成到 exit-check.sh**

在 `exit-check.sh` 末尾 `========== 退出检查完成 ==========` 之前添加：

```bash
# [11/11] 内容质量 fast-path
echo ""
echo "[11/11] 内容质量 fast-path..."
bash scripts/content-quality-fast.sh
```

- [ ] **Step 6: 运行全量测试**

Run: `bash test.sh`
Expected: 所有测试通过

- [ ] **Step 7: Commit**

```bash
git add scripts/content-quality-fast.sh tests/content-quality-fast.test.js exit-check.sh
git commit -m "feat(harness): 内容质量 fast-path — Stop hook 轻量检查交叉链接/具象元素/元信息头日期"
```

---

### Task 5: Hook 执行可观测性

**Files:**
- Create: `scripts/hook-logger.sh`
- Create: `tests/hook-logger.test.js`
- Modify: `.claude/settings.local.json`
- Modify: `CLAUDE.md`

- [ ] **Step 1: 写失败测试**

创建 `tests/hook-logger.test.js`：

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-test-'));
  const scriptSrc = path.resolve(__dirname, '..', 'scripts', 'hook-logger.sh');
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(scriptSrc, path.join(dir, 'scripts', 'hook-logger.sh'));
  fs.chmodSync(path.join(dir, 'scripts', 'hook-logger.sh'), 0o755);
  fs.mkdirSync(path.join(dir, 'logs'), { recursive: true });
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function runLogger(dir, hookName, cmd, opts = {}) {
  const env = { ...process.env, HOOK_LOG_FILE: path.join(dir, 'logs', 'hook-runs.jsonl') };
  return execSync(`bash scripts/hook-logger.sh "${hookName}" ${cmd}`, {
    cwd: dir,
    encoding: 'utf-8',
    env,
    timeout: opts.timeout || 10000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function readLog(dir) {
  const p = path.join(dir, 'logs', 'hook-runs.jsonl');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf-8').trim().split('\n').map(l => JSON.parse(l));
}

test('hook-logger: 成功命令 → 记录 exit_code=0', () => {
  withTempDir(dir => {
    runLogger(dir, 'test-hook', 'echo hello');
    const logs = readLog(dir);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].hook, 'test-hook');
    assert.equal(logs[0].exit_code, 0);
    assert.ok(logs[0].duration_ms >= 0);
    assert.match(logs[0].time, /^\d{4}-\d{2}-\d{2}T/);
  });
});

test('hook-logger: 失败命令 → 记录 exit_code!=0', () => {
  withTempDir(dir => {
    try {
      runLogger(dir, 'fail-hook', 'exit 1');
    } catch { /* expected */ }
    const logs = readLog(dir);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].exit_code, 1);
  });
});

test('hook-logger: 多次调用 → append', () => {
  withTempDir(dir => {
    runLogger(dir, 'hook-a', 'echo a');
    runLogger(dir, 'hook-b', 'echo b');
    const logs = readLog(dir);
    assert.equal(logs.length, 2);
    assert.equal(logs[0].hook, 'hook-a');
    assert.equal(logs[1].hook, 'hook-b');
  });
});

test('hook-logger: 传递原始命令的 exit code', () => {
  withTempDir(dir => {
    try {
      runLogger(dir, 'exit2', 'exit 2');
    } catch (err) {
      assert.equal(err.status, 2, 'wrapper 应传递原始 exit code');
    }
    const logs = readLog(dir);
    assert.equal(logs[0].exit_code, 2);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/hook-logger.test.js`
Expected: FAIL（scripts/hook-logger.sh 不存在）

- [ ] **Step 3: 实现 hook-logger.sh**

创建 `scripts/hook-logger.sh`：

```bash
#!/bin/bash
# hook-logger.sh — hook 执行包装器，记录每次执行到 JSONL
#
# 用法: bash scripts/hook-logger.sh <hook-name> <actual-command...>
# 输出: 追加一行 JSON 到 logs/hook-runs.jsonl
#
# 字段: { time, hook, command, exit_code, duration_ms }
# 设计: 透明包装，不改变原命令的 exit code 和 stdout/stderr

HOOK_NAME="${1:?Usage: hook-logger.sh <hook-name> <command...>}"
shift
CMD="$*"

LOG_FILE="${HOOK_LOG_FILE:-$(cd "$(dirname "$0")/.." && pwd)/logs/hook-runs.jsonl}"
mkdir -p "$(dirname "$LOG_FILE")"

START_MS=$(python3 -c "import time; print(int(time.time()*1000))" 2>/dev/null || echo 0)

set +e
eval "$CMD"
EXIT_CODE=$?
set -e

END_MS=$(python3 -c "import time; print(int(time.time()*1000))" 2>/dev/null || echo 0)
DURATION_MS=$((END_MS - START_MS))
TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 用 python3 写 JSON（避免 shell 转义问题）
python3 -c "
import json, sys
entry = {
    'time': '$TIME',
    'hook': '$HOOK_NAME',
    'command': '''$CMD''',
    'exit_code': $EXIT_CODE,
    'duration_ms': $DURATION_MS
}
with open('$LOG_FILE', 'a') as f:
    f.write(json.dumps(entry) + '\n')
" 2>/dev/null || true

exit $EXIT_CODE
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/hook-logger.test.js`
Expected: 4 tests PASS

- [ ] **Step 5: 包装现有 hooks**

修改 `.claude/settings.local.json`，将现有 hook 命令包装为 `hook-logger.sh` 调用：

SessionStart hook:
```
bash scripts/hook-logger.sh SessionStart bash scripts/preflight.sh
```

Stop hook:
```
bash scripts/hook-logger.sh Stop bash exit-check.sh
```

PostToolUse (verify-claim) hook:
```
bash scripts/hook-logger.sh PostToolUse:verify-claim bash scripts/verify-claim.sh
```

PreToolUse (pretool-guard) hook（Task 1 中新增的）:
```
bash scripts/hook-logger.sh PreToolUse:pretool-guard bash scripts/pretool-guard.sh
```

- [ ] **Step 6: 更新 CLAUDE.md Hook 体系表**

在 Hook 体系表的末尾（文档层之后）添加一行说明：

```
> 所有 hook 通过 `scripts/hook-logger.sh` 包装执行，执行结果（耗时、exit code）记录到 `logs/hook-runs.jsonl`（.gitignore 中）。
```

确认 `logs/hook-runs.jsonl` 已在 `.gitignore` 中（与 `manifest.json` 类似的构建/运行时产物）。

- [ ] **Step 7: 运行全量测试**

Run: `bash test.sh`
Expected: 所有测试通过

- [ ] **Step 8: Commit**

```bash
git add scripts/hook-logger.sh tests/hook-logger.test.js .claude/settings.local.json CLAUDE.md .gitignore
git commit -m "feat(harness): hook 执行可观测性 — hook-logger.sh 包装 + JSONL 日志"
```

---

## 验证清单

所有 5 个 Task 完成后，执行以下端到端验证：

1. `bash test.sh` — 全量测试通过（包含所有新增测试）
2. `bash scripts/preflight.sh` — SessionStart 预检无报错
3. `bash scripts/arch-lint.sh` — 15 项架构检查无错误
4. `bash exit-check.sh` — 11 项退出检查全部通过
5. 验证 `logs/hook-runs.jsonl` 存在且有记录（在上述命令被 hook-logger 包装后）
6. `git log --oneline -5` — 确认 5 个独立 commit
