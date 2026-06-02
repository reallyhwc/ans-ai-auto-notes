'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { generateId, appendEvent, foldEvents, parseTranscript } = require('../scripts/lib-agent-log.js');

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

test('parseTranscript: 空文件 → zero/empty 默认值', () => {
  const tmpFile = path.join(os.tmpdir(), `empty-transcript-${Date.now()}.jsonl`);
  fs.writeFileSync(tmpFile, '');
  try {
    const r = parseTranscript(tmpFile);
    assert.equal(r.duration_ms, 0);
    assert.deepEqual(r.tools_used, []);
    assert.deepEqual(r.files_changed, []);
    assert.equal(r.model, null);
    assert.equal(r.has_substantive_work, false);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('parseTranscript: 无 assistant 消息（只有 user/tool_result）→ model=null, has_substantive_work=false', () => {
  const tmpFile = path.join(os.tmpdir(), `no-assistant-${Date.now()}.jsonl`);
  fs.writeFileSync(tmpFile, [
    '{"role":"user","content":"hi","timestamp":"2026-06-02T00:00:00Z"}',
    '{"role":"tool_result","content":"ok","timestamp":"2026-06-02T00:00:05Z"}',
  ].join('\n') + '\n');
  try {
    const r = parseTranscript(tmpFile);
    assert.equal(r.model, null);
    assert.deepEqual(r.tools_used, []);
    assert.deepEqual(r.files_changed, []);
    assert.equal(r.has_substantive_work, false);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('parseTranscript: 写入工具但缺 input.file_path → tools_used 记，files_changed 不记', () => {
  const tmpFile = path.join(os.tmpdir(), `no-file-path-${Date.now()}.jsonl`);
  fs.writeFileSync(tmpFile, [
    '{"role":"user","content":"x","timestamp":"2026-06-02T00:00:00Z"}',
    '{"role":"assistant","content":[{"type":"tool_use","name":"Edit","input":{}}],"timestamp":"2026-06-02T00:00:05Z","model":"claude-opus-4-7"}',
  ].join('\n') + '\n');
  try {
    const r = parseTranscript(tmpFile);
    assert.deepEqual(r.tools_used, ['Edit']);
    assert.deepEqual(r.files_changed, []);
    assert.equal(r.has_substantive_work, true);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('parseTranscript: 含 malformed JSON 行 → 跳过坏行，其他行正常解析', () => {
  const tmpFile = path.join(os.tmpdir(), `malformed-${Date.now()}.jsonl`);
  fs.writeFileSync(tmpFile, [
    '{"role":"user","content":"x","timestamp":"2026-06-02T00:00:00Z"}',
    '{ this is not valid json',  // ← 坏行，应被跳过
    '{"role":"assistant","content":[{"type":"tool_use","name":"Bash","input":{"command":"echo"}}],"timestamp":"2026-06-02T00:00:05Z","model":"claude-opus-4-7"}',
  ].join('\n') + '\n');
  try {
    const r = parseTranscript(tmpFile);
    assert.deepEqual(r.tools_used, ['Bash']);
    assert.equal(r.has_substantive_work, true);
    assert.equal(r.duration_ms, 5000);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

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
