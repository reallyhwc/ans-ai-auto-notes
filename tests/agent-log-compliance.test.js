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
