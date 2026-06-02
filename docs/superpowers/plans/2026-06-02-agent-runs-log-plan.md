---
title: "Agent Runs 通用日志系统实施计划"
status: pending
date: 2026-06-02
spec: docs/superpowers/specs/2026-06-02-agent-runs-log-design.md
---

# Agent Runs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 ans-ai-auto-notes 加一套通用的 agent 事件日志：主/子 agent 每轮实质工作落一行 JSONL，append-only（event sourcing），可月报可 tail。

**Architecture:** Hook 写机械字段（time/agent/duration/tools/files/model）→ AI 在结束时机 patch 语义字段（title/summary/outcome）→ 月报/viewer 读 jsonl 时按 id fold（start + N patch → 完整 record）。

**Tech Stack:** Pure Node.js（零 npm 依赖，UMD lib 风格），node --test 单测，bash hook 链路。

---

## File Structure

**Create:**
- `scripts/lib-agent-log.js` — 纯函数库（id 生成、appendEvent、foldEvents、parseTranscript）
- `scripts/agent-log-hook.js` — hook 入口（`subagent` / `main` 两个子命令），由 Claude Code Stop/SubagentStop hook 调用
- `scripts/agent-log.js` — AI 用的 patch CLI（`patch --id last --title --summary --outcome`）
- `scripts/agent-report.js` — 月报脚本（聚合统计）
- `scripts/agent-tail.js` — viewer（可选最后一步）
- `tests/agent-log.test.js` — lib + hook + patch 单测
- `tests/agent-report.test.js` — 月报聚合单测
- `tests/fixtures/agent-log-transcript-sample.jsonl` — transcript 采样夹具
- `memory/feedback-agent-log-patch.md` — AI 补全纪律
- `logs/agent-runs/README.md` — schema + 用法文档

**Modify:**
- `.claude/settings.local.json` — 加 Stop / SubagentStop hooks
- `memory/MEMORY.md` — 索引新 feedback memory

**Pattern alignment:** 与现有 `scripts/lib.js`（UMD 风格）、`scripts/build-index.js`（CLI Node 脚本）、`tests/*.test.js`（node --test）一致。

---

## Task 1: lib-agent-log.js 核心函数（id / appendEvent / foldEvents）

**Files:**
- Create: `scripts/lib-agent-log.js`
- Test: `tests/agent-log.test.js`

- [ ] **Step 1: 写 4 个失败测试覆盖核心函数**

Create `tests/agent-log.test.js`:

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { generateId, appendEvent, foldEvents } = require('../scripts/lib-agent-log.js');

test('generateId: 格式 r-YYYY-MM-DD-HH-MM-<4hex>', () => {
  const id = generateId(new Date('2026-06-02T21:50:14+08:00'));
  assert.match(id, /^r-2026-06-02-(13|21)-50-[0-9a-f]{4}$/);
  // 时区依赖：UTC=13:50 / 北京=21:50；只验证格式
});

test('generateId: 两次调用 id 不同（随机后缀）', () => {
  const a = generateId();
  const b = generateId();
  assert.notEqual(a, b);
});

test('appendEvent: 在不存在的文件上 append，自动创建目录+文件', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-log-'));
  const file = path.join(tmpDir, 'sub', '2026-06.jsonl');
  appendEvent(file, { event: 'start', id: 'r-x', time: '2026-06-02T00:00:00Z' });
  const content = fs.readFileSync(file, 'utf8');
  assert.equal(content, '{"event":"start","id":"r-x","time":"2026-06-02T00:00:00Z"}\n');
  fs.rmSync(tmpDir, { recursive: true });
});

test('foldEvents: start + patch → 合并 record（patch 字段覆盖 start，null 不覆盖）', () => {
  const events = [
    { event: 'start', id: 'r-1', time: '2026-06-02T00:00:00Z', agent: 'main', title: null, summary: null, outcome: 'unknown', duration_ms: 100 },
    { event: 'patch', id: 'r-1', time: '2026-06-02T00:01:00Z', title: 'T1', summary: 'S1', outcome: 'success' },
  ];
  const records = foldEvents(events);
  assert.equal(records.length, 1);
  assert.equal(records[0].title, 'T1');
  assert.equal(records[0].summary, 'S1');
  assert.equal(records[0].outcome, 'success');
  assert.equal(records[0].duration_ms, 100);
});

test('foldEvents: 多个 patch 按 time 顺序应用（后写覆盖先写）', () => {
  const events = [
    { event: 'start', id: 'r-1', time: '2026-06-02T00:00:00Z', agent: 'main', outcome: 'unknown' },
    { event: 'patch', id: 'r-1', time: '2026-06-02T00:02:00Z', outcome: 'success' },
    { event: 'patch', id: 'r-1', time: '2026-06-02T00:01:00Z', outcome: 'partial' },
  ];
  const records = foldEvents(events);
  assert.equal(records[0].outcome, 'success'); // 00:02 后于 00:01
});

test('foldEvents: 孤立 patch（无对应 start）忽略', () => {
  const events = [{ event: 'patch', id: 'r-ghost', time: '2026-06-02T00:00:00Z', title: 'x' }];
  assert.deepEqual(foldEvents(events), []);
});
```

- [ ] **Step 2: 运行测试确认全部 fail**

```bash
node --test tests/agent-log.test.js
```

Expected: 6 failures (Cannot find module './scripts/lib-agent-log.js')

- [ ] **Step 3: 写最小实现**

Create `scripts/lib-agent-log.js`:

```javascript
/**
 * lib-agent-log.js — Agent runs 事件日志的纯函数库
 *
 * 设计：append-only event sourcing。两种 event：
 *   - "start": agent 一轮工作结束时由 hook 写入（机械字段）
 *   - "patch": AI 在补全时机追加（语义字段：title/summary/outcome）
 *
 * 读取时按 id fold：start 为 base，按 time 顺序应用 patch。
 *
 * 测试：tests/agent-log.test.js
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// 生成 id：r-YYYY-MM-DD-HH-MM-<4hex>
// 用本地时区（与 spec 一致：time 字段是 ISO 含偏移）
function generateId(date) {
  const d = date || new Date();
  const pad = n => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const HH = pad(d.getHours());
  const MM = pad(d.getMinutes());
  const rand = crypto.randomBytes(2).toString('hex');
  return `r-${yyyy}-${mm}-${dd}-${HH}-${MM}-${rand}`;
}

// 追加一个 event 到 JSONL 文件，自动创建父目录
function appendEvent(filePath, event) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(event) + '\n');
}

// 读取 events（一个文件或拼接后的数组），按 id fold 成完整 record 列表
function foldEvents(events) {
  const starts = new Map();
  const patches = new Map();
  for (const e of events) {
    if (e.event === 'start') {
      starts.set(e.id, e);
    } else if (e.event === 'patch') {
      if (!patches.has(e.id)) patches.set(e.id, []);
      patches.get(e.id).push(e);
    }
  }
  const records = [];
  for (const [id, start] of starts) {
    const merged = Object.assign({}, start);
    const ps = (patches.get(id) || []).slice().sort((a, b) => a.time.localeCompare(b.time));
    for (const p of ps) {
      for (const k of Object.keys(p)) {
        if (k === 'event' || k === 'id' || k === 'time') continue;
        if (p[k] !== null && p[k] !== undefined) merged[k] = p[k];
      }
    }
    records.push(merged);
  }
  return records;
}

module.exports = { generateId, appendEvent, foldEvents };
```

- [ ] **Step 4: 运行测试确认全部 pass**

```bash
node --test tests/agent-log.test.js
```

Expected: 6 pass, 0 fail

- [ ] **Step 5: Commit**

```bash
git add scripts/lib-agent-log.js tests/agent-log.test.js
git commit -m "feat: add lib-agent-log core (generateId/appendEvent/foldEvents)"
```

---

## Task 2: lib-agent-log.js 增加 transcript 解析

**Files:**
- Modify: `scripts/lib-agent-log.js`
- Modify: `tests/agent-log.test.js`
- Create: `tests/fixtures/agent-log-transcript-sample.jsonl`

- [ ] **Step 1: 创建 transcript fixture**

Create `tests/fixtures/agent-log-transcript-sample.jsonl`:

```jsonl
{"role":"user","content":"修一下 markdown 链接的 bug","timestamp":"2026-06-02T21:50:14+08:00"}
{"role":"assistant","content":[{"type":"text","text":"我来看看"},{"type":"tool_use","name":"Read","input":{"file_path":"kb/a.md"}}],"timestamp":"2026-06-02T21:50:18+08:00","model":"claude-opus-4-7"}
{"role":"tool_result","content":"file contents","timestamp":"2026-06-02T21:50:19+08:00"}
{"role":"assistant","content":[{"type":"tool_use","name":"Edit","input":{"file_path":"kb/a.md","old_string":"x","new_string":"y"}}],"timestamp":"2026-06-02T21:50:25+08:00","model":"claude-opus-4-7"}
{"role":"tool_result","content":"ok","timestamp":"2026-06-02T21:50:26+08:00"}
{"role":"assistant","content":[{"type":"tool_use","name":"Bash","input":{"command":"bash test.sh"}},{"type":"tool_use","name":"Edit","input":{"file_path":"kb/b.md","old_string":"a","new_string":"b"}}],"timestamp":"2026-06-02T21:58:21+08:00","model":"claude-opus-4-7"}
{"role":"tool_result","content":"pass","timestamp":"2026-06-02T21:58:30+08:00"}
```

> **Note (plan-time):** spec §4.1 已标注 Claude Code 实际 transcript schema 需 Task 5 验证。Fixture 用的是合理猜测的 schema（role/content/timestamp/model + tool_use 块）。若 Task 5 发现真实 schema 不同，回头调整 `parseTranscript` 实现 + 重新生成 fixture。

- [ ] **Step 2: 加 3 个失败测试到 tests/agent-log.test.js（在文件末尾）**

```javascript
const { parseTranscript } = require('../scripts/lib-agent-log.js');

test('parseTranscript: duration_ms = 末-首 timestamp 差', () => {
  const r = parseTranscript('tests/fixtures/agent-log-transcript-sample.jsonl');
  // 21:50:14 → 21:58:30 = 8min 16s = 496000 ms
  assert.equal(r.duration_ms, 496000);
});

test('parseTranscript: tools_used 去重排序', () => {
  const r = parseTranscript('tests/fixtures/agent-log-transcript-sample.jsonl');
  assert.deepEqual(r.tools_used.sort(), ['Bash', 'Edit', 'Read']);
});

test('parseTranscript: files_changed 只算写入工具（Edit/Write/NotebookEdit），去重', () => {
  const r = parseTranscript('tests/fixtures/agent-log-transcript-sample.jsonl');
  assert.deepEqual(r.files_changed.sort(), ['kb/a.md', 'kb/b.md']);
});

test('parseTranscript: model 取第一条 assistant 的 model 字段', () => {
  const r = parseTranscript('tests/fixtures/agent-log-transcript-sample.jsonl');
  assert.equal(r.model, 'claude-opus-4-7');
});

test('parseTranscript: has_substantive_work true（有 Edit/Bash 写入类工具）', () => {
  const r = parseTranscript('tests/fixtures/agent-log-transcript-sample.jsonl');
  assert.equal(r.has_substantive_work, true);
});
```

- [ ] **Step 3: 运行测试确认 5 个失败**

```bash
node --test tests/agent-log.test.js
```

Expected: 5 failures (parseTranscript is not a function)

- [ ] **Step 4: 实现 parseTranscript**

Append to `scripts/lib-agent-log.js`（在 module.exports 之前）:

```javascript
// 写入/副作用工具白名单（spec §4.2）
const WRITE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'Bash', 'Task']);
const FILE_WRITE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit']);

// 从 transcript JSONL 文件解析机械字段
// 返回: { duration_ms, tools_used, files_changed, model, has_substantive_work }
function parseTranscript(transcriptPath) {
  const content = fs.readFileSync(transcriptPath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  const messages = lines.map(l => JSON.parse(l));

  if (messages.length === 0) {
    return { duration_ms: 0, tools_used: [], files_changed: [], model: null, has_substantive_work: false };
  }

  const firstTime = new Date(messages[0].timestamp).getTime();
  const lastTime = new Date(messages[messages.length - 1].timestamp).getTime();
  const duration_ms = lastTime - firstTime;

  const toolsSet = new Set();
  const filesSet = new Set();
  let model = null;
  let hasSubstantive = false;

  for (const m of messages) {
    if (m.role === 'assistant') {
      if (m.model && !model) model = m.model;
      if (Array.isArray(m.content)) {
        for (const block of m.content) {
          if (block.type === 'tool_use') {
            toolsSet.add(block.name);
            if (WRITE_TOOLS.has(block.name)) hasSubstantive = true;
            if (FILE_WRITE_TOOLS.has(block.name) && block.input && block.input.file_path) {
              filesSet.add(block.input.file_path);
            }
          }
        }
      }
    }
  }

  return {
    duration_ms,
    tools_used: Array.from(toolsSet),
    files_changed: Array.from(filesSet),
    model,
    has_substantive_work: hasSubstantive,
  };
}
```

Update `module.exports`:

```javascript
module.exports = { generateId, appendEvent, foldEvents, parseTranscript, WRITE_TOOLS, FILE_WRITE_TOOLS };
```

- [ ] **Step 5: 运行测试确认全部 pass**

```bash
node --test tests/agent-log.test.js
```

Expected: 11 pass, 0 fail

- [ ] **Step 6: Commit**

```bash
git add scripts/lib-agent-log.js tests/agent-log.test.js tests/fixtures/agent-log-transcript-sample.jsonl
git commit -m "feat: add lib-agent-log transcript parser (duration/tools/files/model)"
```

---

## Task 3: agent-log-hook.js（hook 入口，subagent + main 两子命令）

**Files:**
- Create: `scripts/agent-log-hook.js`
- Modify: `tests/agent-log.test.js`

- [ ] **Step 1: 加 4 个失败测试到 tests/agent-log.test.js（末尾）**

```javascript
const { execFileSync } = require('node:child_process');

function runHook(mode, stdinJson, env = {}) {
  return execFileSync('node', ['scripts/agent-log-hook.js', mode], {
    input: JSON.stringify(stdinJson),
    env: Object.assign({}, process.env, env),
    encoding: 'utf8',
  });
}

test('agent-log-hook subagent: 解析 stdin + 追加 start event', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-log-hook-'));
  const logFile = path.join(tmpDir, '2026-06.jsonl');
  runHook('subagent', {
    transcript_path: path.resolve('tests/fixtures/agent-log-transcript-sample.jsonl'),
    subagent_name: 'kb-auditor',
  }, { AGENT_LOG_FILE: logFile });

  const content = fs.readFileSync(logFile, 'utf8');
  const lines = content.split('\n').filter(l => l);
  assert.equal(lines.length, 1);
  const ev = JSON.parse(lines[0]);
  assert.equal(ev.event, 'start');
  assert.equal(ev.agent, 'kb-auditor');
  assert.equal(ev.parent_id, null);
  assert.deepEqual(ev.tools_used.sort(), ['Bash', 'Edit', 'Read']);
  assert.deepEqual(ev.files_changed.sort(), ['kb/a.md', 'kb/b.md']);
  assert.equal(ev.duration_ms, 496000);
  assert.equal(ev.model, 'claude-opus-4-7');
  assert.equal(ev.outcome, 'unknown');
  assert.equal(ev.title, null);
  assert.equal(ev.summary, null);
  assert.match(ev.id, /^r-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-[0-9a-f]{4}$/);

  fs.rmSync(tmpDir, { recursive: true });
});

test('agent-log-hook main: 有实质工作 → 写一行 start', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-log-hook-'));
  const logFile = path.join(tmpDir, '2026-06.jsonl');
  runHook('main', {
    transcript_path: path.resolve('tests/fixtures/agent-log-transcript-sample.jsonl'),
  }, { AGENT_LOG_FILE: logFile });

  const content = fs.readFileSync(logFile, 'utf8');
  const lines = content.split('\n').filter(l => l);
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).agent, 'main');

  fs.rmSync(tmpDir, { recursive: true });
});

test('agent-log-hook main: 无实质工作 → 不写', () => {
  // 构造一个只有 Read 的 transcript
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-log-hook-'));
  const fakeTranscript = path.join(tmpDir, 't.jsonl');
  fs.writeFileSync(fakeTranscript, [
    '{"role":"user","content":"问个问题","timestamp":"2026-06-02T00:00:00Z"}',
    '{"role":"assistant","content":[{"type":"tool_use","name":"Read","input":{"file_path":"a"}}],"timestamp":"2026-06-02T00:00:05Z","model":"claude-opus-4-7"}',
  ].join('\n') + '\n');

  const logFile = path.join(tmpDir, '2026-06.jsonl');
  runHook('main', { transcript_path: fakeTranscript }, { AGENT_LOG_FILE: logFile });

  assert.equal(fs.existsSync(logFile), false, 'log file should not be created when no substantive work');

  fs.rmSync(tmpDir, { recursive: true });
});

test('agent-log-hook: 无 transcript_path → 静默退出（不报错）', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-log-hook-'));
  const logFile = path.join(tmpDir, '2026-06.jsonl');
  runHook('main', {}, { AGENT_LOG_FILE: logFile });
  assert.equal(fs.existsSync(logFile), false);
  fs.rmSync(tmpDir, { recursive: true });
});
```

- [ ] **Step 2: 运行测试确认 4 个失败**

```bash
node --test tests/agent-log.test.js
```

Expected: 4 failures（agent-log-hook.js 不存在）

- [ ] **Step 3: 实现 agent-log-hook.js**

Create `scripts/agent-log-hook.js`:

```javascript
#!/usr/bin/env node
/**
 * agent-log-hook.js — Claude Code Stop / SubagentStop hook 入口
 *
 * 用法（由 .claude/settings.local.json hook 调用，stdin 传 JSON）:
 *   node scripts/agent-log-hook.js subagent  # SubagentStop hook
 *   node scripts/agent-log-hook.js main      # Stop hook（带"实质工作"门槛）
 *
 * 环境变量:
 *   AGENT_LOG_FILE  覆盖默认日志文件路径（测试用）
 *
 * 静默策略：任何错误都不阻塞 hook 链路（catch 后 return 0）
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { generateId, appendEvent, parseTranscript } = require('./lib-agent-log.js');

const ROOT = path.resolve(__dirname, '..');

function defaultLogFile() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return path.join(ROOT, 'logs', 'agent-runs', `${yyyy}-${mm}.jsonl`);
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function main() {
  const mode = process.argv[2];
  if (mode !== 'subagent' && mode !== 'main') {
    console.error(`Usage: agent-log-hook.js <subagent|main>`);
    process.exit(0);
  }

  const stdinStr = readStdin();
  if (!stdinStr.trim()) return;
  let stdin;
  try { stdin = JSON.parse(stdinStr); } catch { return; }

  const transcriptPath = stdin.transcript_path;
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return;

  let parsed;
  try { parsed = parseTranscript(transcriptPath); } catch { return; }

  // main 模式：无实质工作则 skip
  if (mode === 'main' && !parsed.has_substantive_work) return;

  const agent = mode === 'subagent' ? (stdin.subagent_name || 'unknown') : 'main';
  const time = new Date().toISOString();

  const event = {
    event: 'start',
    id: generateId(),
    time,
    agent,
    parent_id: null, // v1: 总是 null。spec §3.2 字段保留以便未来按"最近 main start id + 时间窗口"启发式关联，但 v1 不实现（避免误关联孤儿 main）
    tools_used: parsed.tools_used,
    files_changed: parsed.files_changed,
    duration_ms: parsed.duration_ms,
    outcome: 'unknown',
    model: parsed.model,
    title: null,
    summary: null,
  };

  const logFile = process.env.AGENT_LOG_FILE || defaultLogFile();
  appendEvent(logFile, event);
}

try { main(); } catch { /* swallow */ }
```

- [ ] **Step 4: 运行测试确认 pass**

```bash
node --test tests/agent-log.test.js
```

Expected: 15 pass

- [ ] **Step 5: Commit**

```bash
git add scripts/agent-log-hook.js tests/agent-log.test.js
git commit -m "feat: add agent-log-hook (subagent/main with substantive-work gate)"
```

---

## Task 4: agent-log.js patch CLI（AI 用的补全命令）

**Files:**
- Create: `scripts/agent-log.js`
- Modify: `tests/agent-log.test.js`

- [ ] **Step 1: 加 3 个失败测试到 tests/agent-log.test.js（末尾）**

```javascript
function runPatch(args, env = {}) {
  return execFileSync('node', ['scripts/agent-log.js'].concat(args), {
    env: Object.assign({}, process.env, env),
    encoding: 'utf8',
  });
}

test('agent-log patch: --id last 找当前文件最后一条 start 的 id 并追加 patch', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-log-patch-'));
  const logFile = path.join(tmpDir, '2026-06.jsonl');
  fs.writeFileSync(logFile, [
    '{"event":"start","id":"r-1","time":"2026-06-02T00:00:00Z","agent":"main"}',
    '{"event":"start","id":"r-2","time":"2026-06-02T01:00:00Z","agent":"main"}',
  ].join('\n') + '\n');

  runPatch(['patch', '--id', 'last', '--title', 'T2', '--summary', 'S2', '--outcome', 'success'],
    { AGENT_LOG_FILE: logFile });

  const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(l => l);
  assert.equal(lines.length, 3);
  const p = JSON.parse(lines[2]);
  assert.equal(p.event, 'patch');
  assert.equal(p.id, 'r-2');
  assert.equal(p.title, 'T2');
  assert.equal(p.summary, 'S2');
  assert.equal(p.outcome, 'success');

  fs.rmSync(tmpDir, { recursive: true });
});

test('agent-log patch: --id <full> 直接用该 id', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-log-patch-'));
  const logFile = path.join(tmpDir, '2026-06.jsonl');
  fs.writeFileSync(logFile, '{"event":"start","id":"r-x","time":"2026-06-02T00:00:00Z","agent":"main"}\n');

  runPatch(['patch', '--id', 'r-x', '--title', 'X'], { AGENT_LOG_FILE: logFile });

  const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(l => l);
  const p = JSON.parse(lines[1]);
  assert.equal(p.id, 'r-x');
  assert.equal(p.title, 'X');

  fs.rmSync(tmpDir, { recursive: true });
});

test('agent-log patch: --id last 但无 start → 报错 exit 1', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-log-patch-'));
  const logFile = path.join(tmpDir, '2026-06.jsonl');
  assert.throws(
    () => runPatch(['patch', '--id', 'last', '--title', 'X'], { AGENT_LOG_FILE: logFile }),
    /no start event found/i
  );
  fs.rmSync(tmpDir, { recursive: true });
});
```

- [ ] **Step 2: 运行测试确认 3 个失败**

```bash
node --test tests/agent-log.test.js
```

Expected: 3 failures（agent-log.js 不存在）

- [ ] **Step 3: 实现 agent-log.js**

Create `scripts/agent-log.js`:

```javascript
#!/usr/bin/env node
/**
 * agent-log.js — Agent runs 日志的 CLI（目前仅 patch 子命令）
 *
 * 用法（AI 在结束工作时调用）:
 *   node scripts/agent-log.js patch --id last \
 *     --title "<本轮一句话标题>" \
 *     --summary "<干了啥>" \
 *     --outcome success|partial|blocked
 *
 *   --id last       追加 patch 到当前月份 jsonl 最后一条 start 的 id
 *   --id <full>     指定 id（如补昨天的：r-2026-06-01-...）
 *
 * 永不修改已写入行（append-only）。
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { appendEvent } = require('./lib-agent-log.js');

const ROOT = path.resolve(__dirname, '..');

function defaultLogFile() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return path.join(ROOT, 'logs', 'agent-runs', `${yyyy}-${mm}.jsonl`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      args[a.slice(2)] = argv[++i];
    } else {
      args._.push(a);
    }
  }
  return args;
}

function findLastStartId(logFile) {
  if (!fs.existsSync(logFile)) return null;
  const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(l => l.trim());
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const ev = JSON.parse(lines[i]);
      if (ev.event === 'start') return ev.id;
    } catch { /* skip malformed */ }
  }
  return null;
}

function cmdPatch(args) {
  const logFile = process.env.AGENT_LOG_FILE || defaultLogFile();

  let id = args.id;
  if (!id) { console.error('--id required'); process.exit(1); }
  if (id === 'last') {
    id = findLastStartId(logFile);
    if (!id) { console.error('no start event found in ' + logFile); process.exit(1); }
  }

  const patch = {
    event: 'patch',
    id,
    time: new Date().toISOString(),
  };
  if (args.title !== undefined) patch.title = args.title;
  if (args.summary !== undefined) patch.summary = args.summary;
  if (args.outcome !== undefined) patch.outcome = args.outcome;

  appendEvent(logFile, patch);
  console.log(`patched ${id}`);
}

function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const args = parseArgs(argv.slice(1));

  if (cmd === 'patch') return cmdPatch(args);

  console.error(`Usage:
  agent-log.js patch --id last|<id> [--title ...] [--summary ...] [--outcome success|partial|blocked]
`);
  process.exit(1);
}

main();
```

- [ ] **Step 4: 运行测试确认 pass**

```bash
node --test tests/agent-log.test.js
```

Expected: 18 pass

- [ ] **Step 5: Commit**

```bash
git add scripts/agent-log.js tests/agent-log.test.js
git commit -m "feat: add agent-log.js patch CLI (append-only patch event)"
```

---

## Task 5: 接入 Claude Code hooks + 实地验证 transcript schema

**Files:**
- Modify: `.claude/settings.local.json`
- Possibly: `scripts/lib-agent-log.js` (if transcript schema 与 fixture 不符)

- [ ] **Step 1: 读现有 .claude/settings.local.json 找到 hooks 段**

```bash
cat .claude/settings.local.json | head -40
```

定位 `hooks` 字段下是否已有 `Stop` 和 `SubagentStop` 数组。如果没有，需要新建。

- [ ] **Step 2: 加 hook 配置（保守追加，不覆盖现有）**

**重要**：用 jq 或编辑器精确合并，不要全文重写 settings.local.json（里面已有大量配置）。如果手动编辑，确保保留所有现有顶层字段。

`.claude/settings.local.json` 的 `hooks` 字段中，在 `Stop` 数组追加：

```json
{
  "matcher": "",
  "hooks": [
    { "type": "command", "command": "node $CLAUDE_PROJECT_DIR/scripts/agent-log-hook.js main" }
  ]
}
```

在 `SubagentStop` 数组追加（如不存在该顶层 key 则新建）：

```json
"SubagentStop": [
  {
    "matcher": "",
    "hooks": [
      { "type": "command", "command": "node $CLAUDE_PROJECT_DIR/scripts/agent-log-hook.js subagent" }
    ]
  }
]
```

- [ ] **Step 3: 实地验证 transcript schema（关键！）**

在 Claude Code 内做一次 trivial 操作（如 Read 一个文件 + Edit 一个文件），让 Stop hook 触发。

```bash
# 触发完后看是否产出 log 行
ls logs/agent-runs/
cat logs/agent-runs/$(date +%Y-%m).jsonl | head -5
```

**对照验证**：
1. `tools_used` 是否真实反映了本轮工具调用
2. `files_changed` 是否真实反映了 Edit 改的文件
3. `duration_ms` 数值合理
4. `model` 字段存在

**若发现解析不对**（fixture 与真实 transcript schema 不符）：
1. `cat <transcript_path>` 看真实结构
2. 调 `scripts/lib-agent-log.js` 的 `parseTranscript` 适配真实字段
3. 重新生成 `tests/fixtures/agent-log-transcript-sample.jsonl` 用真实 schema
4. 重跑 `node --test tests/agent-log.test.js` 确保还通过

- [ ] **Step 4: 验证 SubagentStop 字段（必要时调整）**

派一次 subagent（例如调一个 Explore agent 做简单查询），让 SubagentStop 触发。

```bash
cat logs/agent-runs/$(date +%Y-%m).jsonl | tail -3
```

确认：
- `agent` 字段是 subagent 的真实名称（如 `general-purpose` 或具体 subagent 名）
- 如果 `stdin.subagent_name` 不存在，要从其他字段（如 stdin 的别的 key 或 transcript 内部）推断

**若 stdin 没有 subagent_name 字段**：
- 看 stdin 还有什么字段（在 agent-log-hook.js 里加 `fs.writeFileSync('/tmp/hook-debug.json', stdinStr)` 临时调试，事后删掉）
- 调整 agent-log-hook.js 第 53 行 `const agent = ...` 那行

- [ ] **Step 5: 跑全量测试确认未破坏**

```bash
bash test.sh
```

Expected: 全绿

- [ ] **Step 6: Commit**

```bash
git add .claude/settings.local.json
# 如果调整了 lib-agent-log.js / fixture 也一并加
git commit -m "feat: wire agent-log into Stop/SubagentStop hooks + verify transcript schema"
```

---

## Task 6: agent-report.js 月报脚本

**Files:**
- Create: `scripts/agent-report.js`
- Create: `tests/agent-report.test.js`
- Create: `tests/fixtures/agent-log-sample.jsonl`

- [ ] **Step 1: 创建月报 fixture**

Create `tests/fixtures/agent-log-sample.jsonl`:

```jsonl
{"event":"start","id":"r-1","time":"2026-06-01T10:00:00+08:00","agent":"main","tools_used":["Edit","Bash"],"files_changed":["a.md"],"duration_ms":120000,"outcome":"unknown","model":"claude-opus-4-7","title":null,"summary":null}
{"event":"patch","id":"r-1","time":"2026-06-01T10:02:00+08:00","title":"fix bug","summary":"修了 a.md","outcome":"success"}
{"event":"start","id":"r-2","time":"2026-06-01T11:00:00+08:00","agent":"kb-auditor","tools_used":["Read","Grep"],"files_changed":[],"duration_ms":60000,"outcome":"unknown","model":"claude-opus-4-7","title":null,"summary":null}
{"event":"patch","id":"r-2","time":"2026-06-01T11:01:00+08:00","title":"审 a.md","summary":"通过","outcome":"success"}
{"event":"start","id":"r-3","time":"2026-06-02T09:00:00+08:00","agent":"main","tools_used":["Bash","Task"],"files_changed":[],"duration_ms":300000,"outcome":"unknown","model":"claude-opus-4-7","title":null,"summary":null}
{"event":"patch","id":"r-3","time":"2026-06-02T09:06:00+08:00","title":"长任务","summary":"卡住了","outcome":"blocked"}
```

- [ ] **Step 2: 写失败测试**

Create `tests/agent-report.test.js`:

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

function runReport(file) {
  return execFileSync('node', ['scripts/agent-report.js', '--file', file], { encoding: 'utf8' });
}

test('agent-report: 总条目数 3', () => {
  const out = runReport('tests/fixtures/agent-log-sample.jsonl');
  assert.match(out, /总调用数:\s*3/);
});

test('agent-report: 按 agent 分组 main=2 kb-auditor=1', () => {
  const out = runReport('tests/fixtures/agent-log-sample.jsonl');
  assert.match(out, /main\s+2/);
  assert.match(out, /kb-auditor\s+1/);
});

test('agent-report: outcome 统计含 success / blocked', () => {
  const out = runReport('tests/fixtures/agent-log-sample.jsonl');
  // 1 个 blocked 列出
  assert.match(out, /r-3.*main.*blocked/);
});

test('agent-report: 工具使用 Top 显示 Bash 出现 2 次（在 r-1 和 r-3）', () => {
  const out = runReport('tests/fixtures/agent-log-sample.jsonl');
  assert.match(out, /Bash:\s*2/);
});
```

- [ ] **Step 3: 运行确认 4 个失败**

```bash
node --test tests/agent-report.test.js
```

Expected: 4 failures（agent-report.js 不存在）

- [ ] **Step 4: 实现 agent-report.js**

Create `scripts/agent-report.js`:

```javascript
#!/usr/bin/env node
/**
 * agent-report.js — Agent runs 月度报告
 *
 * 用法:
 *   node scripts/agent-report.js          # 当月
 *   node scripts/agent-report.js 2026-06  # 指定月
 *   node scripts/agent-report.js --file <jsonl>  # 指定 jsonl 文件（测试用）
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { foldEvents } = require('./lib-agent-log.js');

const ROOT = path.resolve(__dirname, '..');

function resolveFile(args) {
  if (args.file) return args.file;
  const month = args._[0] || (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  return path.join(ROOT, 'logs', 'agent-runs', `${month}.jsonl`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) args[a.slice(2)] = argv[++i];
    else args._.push(a);
  }
  return args;
}

function pad(s, n) { return String(s).padEnd(n); }

function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = resolveFile(args);

  if (!fs.existsSync(file)) {
    console.log(`(no log file at ${file})`);
    return;
  }

  const events = fs.readFileSync(file, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
  const records = foldEvents(events);
  const monthLabel = path.basename(file, '.jsonl');

  console.log(`========== Agent Runs 月报 ${monthLabel} ==========\n`);
  console.log(`总调用数: ${records.length}`);

  // 按 agent 分组
  const byAgent = {};
  for (const r of records) {
    if (!byAgent[r.agent]) byAgent[r.agent] = [];
    byAgent[r.agent].push(r);
  }
  console.log('');
  console.log('按 agent 统计:');
  console.log(`  ${pad('agent', 18)} ${pad('count', 8)} ${pad('avg_dur(s)', 12)} ${pad('success%', 10)} ${pad('blocked%', 10)}`);
  for (const a of Object.keys(byAgent).sort()) {
    const rs = byAgent[a];
    const avgDur = (rs.reduce((s, r) => s + (r.duration_ms || 0), 0) / rs.length / 1000).toFixed(1);
    const succ = rs.filter(r => r.outcome === 'success').length;
    const blocked = rs.filter(r => r.outcome === 'blocked').length;
    console.log(`  ${pad(a, 18)} ${pad(rs.length, 8)} ${pad(avgDur, 12)} ${pad((succ * 100 / rs.length).toFixed(1) + '%', 10)} ${pad((blocked * 100 / rs.length).toFixed(1) + '%', 10)}`);
  }

  // 工具使用 Top 5
  const toolCount = {};
  for (const r of records) {
    for (const t of (r.tools_used || [])) {
      toolCount[t] = (toolCount[t] || 0) + 1;
    }
  }
  console.log('');
  console.log('工具使用 Top 5:');
  Object.entries(toolCount).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([t, c]) => {
    console.log(`  ${t}: ${c}`);
  });

  // 失败/阻塞列表
  const bad = records.filter(r => r.outcome === 'blocked' || r.outcome === 'partial');
  if (bad.length) {
    console.log('');
    console.log('失败/阻塞记录:');
    for (const r of bad) {
      console.log(`  - ${r.id} ${r.agent} ${r.outcome}: ${r.title || '(no title)'}`);
    }
  }
}

main();
```

- [ ] **Step 5: 运行确认 4 个 pass**

```bash
node --test tests/agent-report.test.js
```

Expected: 4 pass

- [ ] **Step 6: 跑一次真实命令验证输出**

```bash
node scripts/agent-report.js --file tests/fixtures/agent-log-sample.jsonl
```

人眼检查格式美观，数据正确（main=2 / kb-auditor=1 / Bash 2 次 / r-3 blocked）。

- [ ] **Step 7: Commit**

```bash
git add scripts/agent-report.js tests/agent-report.test.js tests/fixtures/agent-log-sample.jsonl
git commit -m "feat: add agent-report.js (monthly stats by agent/tools/outcome)"
```

---

## Task 7: AI 补全纪律 memory + MEMORY.md 索引

**Files:**
- Create: `memory/feedback-agent-log-patch.md`
- Modify: `memory/MEMORY.md`

- [ ] **Step 1: 写 feedback memory**

Create `memory/feedback-agent-log-patch.md`:

```markdown
---
name: feedback-agent-log-patch
description: subagent 调用结束 / 主 agent 完成一轮实质工作后，必须立即 patch agent-log 补 title/summary/outcome
metadata:
  type: feedback
  lastUpdated: 2026-06-02
---

完成一轮**实质工作**后（spawn 了 subagent / 改了文件 / 跑了 Bash），在向用户发送响应前必须调用：

```bash
bash scripts/agent-log.sh patch --id last \
  --title "<本轮一句话标题，<30 字>" \
  --summary "<干了啥的 1-3 句>" \
  --outcome success|partial|blocked
```

实际命令：`node scripts/agent-log.js patch --id last --title "..." --summary "..." --outcome success`

**Why**: hook 只能采集机械字段（工具、文件、耗时），title/summary 反映任务的"为什么和结果"——
不补的话日志只能做"工具使用频次"这种浅层分析。

**How to apply**:
- **触发时机**：和 [[auto-commit-discipline]] 同位（每完成一批文件变更立刻提交 + 立刻 patch）
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
```

- [ ] **Step 2: 更新 MEMORY.md 索引**

Read 当前 `memory/MEMORY.md`，在 `## Feedback` 段尾追加一行：

```markdown
- [agent-log-patch 纪律](feedback-agent-log-patch.md) — 主子 agent 一轮实质工作结束后必须 patch agent-log 补 title/summary/outcome
```

更新顶部"最后更新"日期为 `2026-06-02`。

- [ ] **Step 3: Commit**

```bash
git add memory/feedback-agent-log-patch.md memory/MEMORY.md
git commit -m "docs(memory): add feedback-agent-log-patch discipline"
```

---

## Task 8: logs/agent-runs/README.md

**Files:**
- Create: `logs/agent-runs/README.md`

- [ ] **Step 1: 写 README**

Create `logs/agent-runs/README.md`:

```markdown
# Agent Runs 日志

> 主/子 agent 每轮**实质工作**的事件日志。设计文档：[design spec](../../docs/superpowers/specs/2026-06-02-agent-runs-log-design.md)

## 文件组织

- 按月分文件：`YYYY-MM.jsonl`
- Append-only：永不修改已写入行
- Event sourcing：每条 record 由 1 个 `start` 事件 + 0..N 个 `patch` 事件组成，读取时按 `id` fold

## Schema

每行一个 JSON object。

### `event: "start"`（由 hook 自动写入）

| 字段 | 类型 | 说明 |
|------|------|------|
| `event` | "start" | 事件类型 |
| `id` | string | `r-YYYY-MM-DD-HH-MM-<4hex>`，全局唯一 |
| `time` | ISO 8601 | 事件时刻 |
| `agent` | string | `main` 或 subagent 名称 |
| `parent_id` | string \| null | subagent 的 parent_id 指向调用方 main 的 id |
| `tools_used` | string[] | 本轮用的工具去重列表 |
| `files_changed` | string[] | Edit/Write/NotebookEdit 改的文件列表 |
| `duration_ms` | number | 本轮耗时（毫秒） |
| `outcome` | "unknown" | start 时固定 unknown，由后续 patch 补 |
| `model` | string | 模型 ID |
| `title` | null | 由 patch 补 |
| `summary` | null | 由 patch 补 |

### `event: "patch"`（由 AI 主动追加）

| 字段 | 类型 | 说明 |
|------|------|------|
| `event` | "patch" | |
| `id` | string | 对应的 start 事件 id |
| `time` | ISO 8601 | patch 时刻 |
| `title` | string | 一句话标题（<30 字） |
| `summary` | string | 1-3 句描述 |
| `outcome` | "success" \| "partial" \| "blocked" | 结果 |

## 怎么用

### AI 补全（手动调）

```bash
node scripts/agent-log.js patch --id last \
  --title "修复 kb 含空格 .md 链接" \
  --summary "218 处包裹为 <尖括号>，47 文件" \
  --outcome success
```

### 看月报

```bash
node scripts/agent-report.js          # 当月
node scripts/agent-report.js 2026-06  # 指定月
```

### 直接看原始日志（jq）

```bash
# 当月所有调用
cat logs/agent-runs/$(date +%Y-%m).jsonl | jq -s 'group_by(.id) | map({id: .[0].id, events: length})'

# 失败的所有任务
cat logs/agent-runs/$(date +%Y-%m).jsonl | jq -s '
  [.[] | select(.event=="patch" and .outcome=="blocked")]
'
```

## 不在这里记什么

- 用户 prompt 原文（隐私）
- 完整 transcript（太大）
- Token / cost（未来按需加）
```

- [ ] **Step 2: Commit**

```bash
git add logs/agent-runs/README.md
git commit -m "docs: add logs/agent-runs/ README (schema + usage)"
```

---

## Task 9 (可选): agent-tail.js viewer

**Files:**
- Create: `scripts/agent-tail.js`
- Create test in `tests/agent-report.test.js` (复用 fixture)

- [ ] **Step 1: 加 2 个失败测试到 tests/agent-report.test.js**

```javascript
function runTail(args) {
  return execFileSync('node', ['scripts/agent-tail.js'].concat(args), { encoding: 'utf8' });
}

test('agent-tail: -n 默认 20，含表头 "时间" "agent" "标题"', () => {
  const out = runTail(['--file', 'tests/fixtures/agent-log-sample.jsonl']);
  assert.match(out, /时间.*agent.*标题/);
});

test('agent-tail: 渲染 outcome 图标（✓ / ✗）', () => {
  const out = runTail(['--file', 'tests/fixtures/agent-log-sample.jsonl']);
  assert.match(out, /✓.*fix bug/);
  assert.match(out, /✗.*长任务/);
});
```

- [ ] **Step 2: 运行确认 2 失败**

```bash
node --test tests/agent-report.test.js
```

Expected: 2 failures

- [ ] **Step 3: 实现 agent-tail.js**

Create `scripts/agent-tail.js`:

```javascript
#!/usr/bin/env node
/**
 * agent-tail.js — Agent runs 日志的终端 viewer
 *
 * 用法:
 *   node scripts/agent-tail.js          # 当月最近 20 条
 *   node scripts/agent-tail.js -n 50    # 最近 50 条
 *   node scripts/agent-tail.js --file <jsonl>  # 指定文件（测试用）
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { foldEvents } = require('./lib-agent-log.js');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-n') args.n = parseInt(argv[++i], 10);
    else if (a.startsWith('--')) args[a.slice(2)] = argv[++i];
    else args._.push(a);
  }
  return args;
}

function defaultFile() {
  const d = new Date();
  return path.join(ROOT, 'logs', 'agent-runs', `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}.jsonl`);
}

function fmtTime(t) {
  // 2026-06-02T21:50:14+08:00 → 06-02 21:50
  const d = new Date(t);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDur(ms) {
  if (!ms) return '-';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${pad2(s % 60)}s`;
}

function pad2(n) { return String(n).padStart(2, '0'); }

function pad(s, n) {
  // 中文字符宽度=2 计算
  let w = 0;
  for (const ch of String(s)) {
    w += ch.charCodeAt(0) > 127 ? 2 : 1;
  }
  const need = n - w;
  return String(s) + (need > 0 ? ' '.repeat(need) : '');
}

function outcomeIcon(o) {
  return o === 'success' ? '✓' : (o === 'blocked' || o === 'partial' ? '✗' : '…');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = args.file || defaultFile();
  const n = args.n || 20;

  if (!fs.existsSync(file)) {
    console.log(`(no log at ${file})`);
    return;
  }

  const events = fs.readFileSync(file, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
  const records = foldEvents(events).sort((a, b) => a.time.localeCompare(b.time));
  const tail = records.slice(-n);

  console.log(`${pad('时间', 14)} ${pad('agent', 18)} ${pad('标题', 40)} ${pad('耗时', 8)} outcome`);
  console.log('-'.repeat(95));
  for (const r of tail) {
    console.log(`${pad(fmtTime(r.time), 14)} ${pad(r.agent, 18)} ${pad(r.title || '-', 40)} ${pad(fmtDur(r.duration_ms), 8)} ${outcomeIcon(r.outcome)}`);
  }
}

main();
```

- [ ] **Step 4: 运行测试确认 pass**

```bash
node --test tests/agent-report.test.js
```

Expected: 6 pass（4 老 + 2 新）

- [ ] **Step 5: 真实验证**

```bash
node scripts/agent-tail.js --file tests/fixtures/agent-log-sample.jsonl
```

人眼检查表格格式美观。

- [ ] **Step 6: Commit**

```bash
git add scripts/agent-tail.js tests/agent-report.test.js
git commit -m "feat: add agent-tail.js viewer (recent N records with outcome icons)"
```

---

## Task 10: 全量回归 + 总结 commit

- [ ] **Step 1: 跑全量测试**

```bash
bash test.sh
```

Expected: 全绿（含新增 23 条 agent-log + agent-report 测试）

- [ ] **Step 2: 跑 arch-lint**

```bash
bash scripts/arch-lint.sh 2>&1 | tail -20
```

Expected: 不出现关于 agent-log 系列脚本的孤儿警告（注意 scripts/arch-lint.sh 检查 10 只扫 *.sh 文件，新 *.js 脚本不在范围内 → 不会误报）

- [ ] **Step 3: 验证 hook 实际工作（端到端）**

在另一个 Claude Code 会话内做一次 Edit 操作，触发 Stop hook，检查：

```bash
ls logs/agent-runs/
cat logs/agent-runs/$(date +%Y-%m).jsonl | tail -3
```

应该看到本会话的 start 事件。

然后手动 patch 验证：

```bash
node scripts/agent-log.js patch --id last --title "测试" --summary "端到端验证" --outcome success
cat logs/agent-runs/$(date +%Y-%m).jsonl | tail -2
```

应该看到追加的 patch 事件。

- [ ] **Step 4: status 更新 spec 文件**

修改 `docs/superpowers/specs/2026-06-02-agent-runs-log-design.md` frontmatter：

```
status: pending  →  status: completed
```

- [ ] **Step 5: 最终 commit**

```bash
git add docs/superpowers/specs/2026-06-02-agent-runs-log-design.md
git commit -m "chore: mark agent-runs-log spec as completed"
```

---

## 落地后的状态

- ✅ `logs/agent-runs/YYYY-MM.jsonl` 自动落盘主/子 agent 每轮实质工作
- ✅ `node scripts/agent-log.js patch --id last ...` AI 主动补 title/summary/outcome
- ✅ `node scripts/agent-report.js` 出月报
- ✅ `node scripts/agent-tail.js` 看最近 N 条
- ✅ feedback memory 强化 AI 补全纪律
- ✅ 测试覆盖核心 lib + hook + CLI + report + viewer

**下一步**：进 3 个 subagent 的 brainstorming（kb-auditor / plan-executor / idea-extractor），它们一上线就自动产出日志。
