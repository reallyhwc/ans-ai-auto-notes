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
