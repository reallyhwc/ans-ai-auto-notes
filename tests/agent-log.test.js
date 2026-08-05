'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { generateId, appendEvent, foldEvents, parseTranscript, deriveAutoFields } = require('../scripts/lib-agent-log.js');

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

test('parseTranscript: final_text 取最后一条 assistant 消息的文本块', () => {
  const r = parseTranscript('tests/fixtures/agent-log-transcript-with-summary.jsonl');
  assert.equal(r.final_text, '审计完成，发现 2 处链接失效，已在 report 中列出。\nVERDICT: minor (2)');
});

test('parseTranscript: 最后一条 assistant 消息只有 tool_use 无文本 → final_text 为 null', () => {
  const r = parseTranscript('tests/fixtures/agent-log-transcript-sample.jsonl');
  assert.equal(r.final_text, null);
});

test('parseTranscript: has_error 检测 tool_result.is_error', () => {
  const tmpFile = path.join(os.tmpdir(), `has-error-${Date.now()}.jsonl`);
  fs.writeFileSync(tmpFile, [
    '{"type":"assistant","timestamp":"2026-06-02T00:00:00Z","message":{"role":"assistant","model":"x","content":[{"type":"tool_use","name":"Bash","input":{"command":"false"}}]}}',
    '{"type":"tool_result","timestamp":"2026-06-02T00:00:01Z","message":{"role":"user","content":[{"type":"tool_result","content":"command failed","is_error":true}]}}',
  ].join('\n') + '\n');
  try {
    const r = parseTranscript(tmpFile);
    assert.equal(r.has_error, true);
  } finally { fs.unlinkSync(tmpFile); }
});

test('parseTranscript: 无 is_error 字段 → has_error 为 false', () => {
  const r = parseTranscript('tests/fixtures/agent-log-transcript-sample.jsonl');
  assert.equal(r.has_error, false);
});

test('deriveAutoFields: 无 final_text → title/summary null，outcome success，needs_manual_patch false', () => {
  const auto = deriveAutoFields({ final_text: null, has_error: false });
  assert.deepEqual(auto, { title: null, summary: null, outcome: 'success', needs_manual_patch: false });
});

test('deriveAutoFields: 有 final_text → summary=全文，title=首行截断60字', () => {
  const text = '审计完成，发现 2 处链接失效，已在 report 中列出。\nVERDICT: minor (2)';
  const auto = deriveAutoFields({ final_text: text, has_error: false });
  assert.equal(auto.summary, text);
  assert.equal(auto.title, '审计完成，发现 2 处链接失效，已在 report 中列出。');
  assert.equal(auto.outcome, 'success');
});

test('deriveAutoFields: has_error true → outcome partial', () => {
  const auto = deriveAutoFields({ final_text: 'done', has_error: true });
  assert.equal(auto.outcome, 'partial');
});

test('deriveAutoFields: summary 超 200 字截断加省略号，title 超 60 字截断加省略号', () => {
  const longLine = 'x'.repeat(250);
  const auto = deriveAutoFields({ final_text: longLine, has_error: false });
  assert.equal(auto.summary.length, 201); // 200 字 + '…'
  assert.ok(auto.summary.endsWith('…'));
  assert.equal(auto.title.length, 61); // 60 字 + '…'
  assert.ok(auto.title.endsWith('…'));
});

// 假设6：结构化块检测（VERDICT: / EXTRACT-VERDICT: / JSON）→ title null + needs_manual_patch
test('deriveAutoFields: final_text 以 VERDICT: 开头 → title null, needs_manual_patch true', () => {
  const auto = deriveAutoFields({ final_text: 'VERDICT: minor (2)\n详细内容...', has_error: false });
  assert.equal(auto.title, null);
  assert.equal(auto.needs_manual_patch, true);
  assert.equal(auto.outcome, 'success');
});

test('deriveAutoFields: final_text 以 EXTRACT-VERDICT: 开头 → title null, needs_manual_patch true', () => {
  const auto = deriveAutoFields({ final_text: 'EXTRACT-VERDICT: 3 个候选\n...', has_error: false });
  assert.equal(auto.title, null);
  assert.equal(auto.needs_manual_patch, true);
});

test('deriveAutoFields: final_text 是 JSON 对象 → title null, needs_manual_patch true', () => {
  const auto = deriveAutoFields({ final_text: '{"verdict":"pass"}', has_error: false });
  assert.equal(auto.title, null);
  assert.equal(auto.needs_manual_patch, true);
});

test('deriveAutoFields: 自然语言 final_text → title 非空, needs_manual_patch false（回归保护）', () => {
  const auto = deriveAutoFields({ final_text: '审计完成，发现 2 处问题', has_error: false });
  assert.equal(auto.title, '审计完成，发现 2 处问题');
  assert.equal(auto.needs_manual_patch, false);
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
  assert.equal(ev.outcome, 'success');
  assert.equal(ev.title, null);
  assert.equal(ev.summary, null);
  assert.match(ev.id, /^r-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-[0-9a-f]{4}$/);

  fs.rmSync(tmpDir, { recursive: true });
});

test('agent-log-hook subagent: 最后消息有文本 → 自动填充 title/summary/outcome=success', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-log-hook-'));
  const logFile = path.join(tmpDir, '2026-06.jsonl');
  runHook('subagent', {
    transcript_path: path.resolve('tests/fixtures/agent-log-transcript-with-summary.jsonl'),
    subagent_name: 'kb-auditor',
  }, { AGENT_LOG_FILE: logFile });

  const ev = JSON.parse(fs.readFileSync(logFile, 'utf8').trim());
  assert.equal(ev.outcome, 'success');
  assert.equal(ev.title, '审计完成，发现 2 处链接失效，已在 report 中列出。');
  assert.match(ev.summary, /VERDICT: minor \(2\)/);

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

// 回归测试：main 前置短路——transcript 仅含文本（无 tool_use 块）→ 不 parse 直接跳过
test('agent-log-hook main: 仅文本无 tool_use → 前置短路不写（大 transcript 免 parse）', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-log-hook-'));
  const fakeTranscript = path.join(tmpDir, 't.jsonl');
  // 文本里提到 Edit 工具名，但没有任何 tool_use 块
  fs.writeFileSync(fakeTranscript, [
    '{"role":"user","content":"请用 Edit 工具修改文件","timestamp":"2026-06-02T00:00:00Z"}',
    '{"role":"assistant","content":[{"type":"text","text":"好的，我用 Edit 完成"}],"timestamp":"2026-06-02T00:00:05Z","model":"claude-opus-4-7"}',
  ].join('\n') + '\n');

  const logFile = path.join(tmpDir, '2026-06.jsonl');
  runHook('main', { transcript_path: fakeTranscript }, { AGENT_LOG_FILE: logFile });

  assert.equal(fs.existsSync(logFile), false, '无 tool_use 的 transcript 应被前置短路跳过');
  fs.rmSync(tmpDir, { recursive: true });
});

test('agent-log-hook: 无 transcript_path → 静默退出（不报错）', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-log-hook-'));
  const logFile = path.join(tmpDir, '2026-06.jsonl');
  runHook('main', {}, { AGENT_LOG_FILE: logFile });
  assert.equal(fs.existsSync(logFile), false);
  fs.rmSync(tmpDir, { recursive: true });
});

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

// Task 5 schema discovery (2026-06-02)：真实 Claude Code SubagentStop hook 传的字段是
// agent_type + agent_transcript_path（不是 subagent_name + transcript_path）。本测试锁定。
test('agent-log-hook subagent: 用真实 Claude Code stdin schema（agent_type + agent_transcript_path）', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-log-hook-real-'));
  const logFile = path.join(tmpDir, '2026-06.jsonl');
  runHook('subagent', {
    session_id: 'test-session',
    agent_id: 'a1234567890',
    agent_type: 'general-purpose',
    agent_transcript_path: path.resolve('tests/fixtures/agent-log-transcript-sample.jsonl'),
    transcript_path: '/some/main/transcript.jsonl', // 应该被忽略，优先 agent_transcript_path
    hook_event_name: 'SubagentStop',
  }, { AGENT_LOG_FILE: logFile });

  const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(l => l);
  assert.equal(lines.length, 1);
  const ev = JSON.parse(lines[0]);
  assert.equal(ev.agent, 'general-purpose');
  assert.deepEqual(ev.tools_used.sort(), ['Bash', 'Edit', 'Read']);
  assert.deepEqual(ev.files_changed.sort(), ['kb/a.md', 'kb/b.md']);

  fs.rmSync(tmpDir, { recursive: true });
});

// Task 5 schema discovery：真实 transcript 嵌套 message 结构（含 meta 行无 timestamp）
test('parseTranscript: 真实 Claude Code nested message schema + meta 行跳过', () => {
  const tmpFile = path.join(os.tmpdir(), `nested-schema-${Date.now()}.jsonl`);
  fs.writeFileSync(tmpFile, [
    '{"type":"last-prompt","leafUuid":"m1"}',  // ← meta 行无 timestamp，应跳过
    '{"type":"permission-mode","permissionMode":"x"}',  // ← 同上
    '{"type":"user","timestamp":"2026-06-02T00:00:00Z","message":{"role":"user","content":"hi"}}',
    '{"type":"assistant","timestamp":"2026-06-02T00:00:10Z","message":{"role":"assistant","model":"claude-opus-4-7","content":[{"type":"tool_use","name":"Edit","input":{"file_path":"kb/x.md","old_string":"a","new_string":"b"}}]}}',
  ].join('\n') + '\n');
  try {
    const r = parseTranscript(tmpFile);
    assert.equal(r.duration_ms, 10000);  // 00:10 - 00:00 = 10s（meta 行不算）
    assert.deepEqual(r.tools_used, ['Edit']);
    assert.deepEqual(r.files_changed, ['kb/x.md']);
    assert.equal(r.model, 'claude-opus-4-7');
    assert.equal(r.has_substantive_work, true);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// Task 5 schema discovery：absolute file_path 归一化为相对 ROOT
test('parseTranscript: 绝对路径 file_path 归一化为 ROOT 相对路径', () => {
  const tmpFile = path.join(os.tmpdir(), `abs-path-${Date.now()}.jsonl`);
  const projectRoot = path.resolve(__dirname, '..');
  fs.writeFileSync(tmpFile, [
    `{"type":"assistant","timestamp":"2026-06-02T00:00:00Z","message":{"role":"assistant","model":"x","content":[{"type":"tool_use","name":"Edit","input":{"file_path":"${projectRoot}/kb/y.md"}}]}}`,
    `{"type":"assistant","timestamp":"2026-06-02T00:00:01Z","message":{"role":"assistant","content":[{"type":"tool_use","name":"Edit","input":{"file_path":"/tmp/outside.md"}}]}}`,
  ].join('\n') + '\n');
  try {
    const r = parseTranscript(tmpFile);
    assert.deepEqual(r.files_changed.sort(), ['/tmp/outside.md', 'kb/y.md']);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
