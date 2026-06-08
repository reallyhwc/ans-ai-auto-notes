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
