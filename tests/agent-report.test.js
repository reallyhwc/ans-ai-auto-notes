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

function runTail(args) {
  return execFileSync('node', ['scripts/agent-tail.js'].concat(args), { encoding: 'utf8' });
}

test('agent-tail: -n 默认 20，含表头 "时间" "agent" "标题"', () => {
  const out = runTail(['--file', 'tests/fixtures/agent-log-sample.jsonl']);
  assert.match(out, /时间.*agent.*标题/);
});

test('agent-tail: 渲染 outcome 图标（✓ / ✗）', () => {
  const out = runTail(['--file', 'tests/fixtures/agent-log-sample.jsonl']);
  assert.match(out, /fix bug.*✓/);
  assert.match(out, /长任务.*✗/);
});
