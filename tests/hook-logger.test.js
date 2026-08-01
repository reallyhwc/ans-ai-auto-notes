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

// 回归测试：每次 hook 调用 fork 2 次 python3 取毫秒时间戳（4 hook × 2 = 8 次/轮，
// ~200-400ms 开销）。perl 启动比 python3 快约 2x，macOS 自带 perl。
// 修复：START_MS / END_MS 时间戳获取改用 perl -MTime::HiRes，不再 fork python3。
test('hook-logger.sh: 毫秒时间戳应使用 perl Time::HiRes 而非 python3（减少 fork 开销）', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'hook-logger.sh'), 'utf8');
  // 只检查时间戳获取行（START_MS / END_MS），不检查 JSON 写入行（line 29 仍可用 python3）
  const tsLines = src.split('\n').filter(l => l.includes('_MS=$') && l.includes('print'));
  assert.ok(tsLines.length >= 2, `应至少有 2 处时间戳获取（START_MS, END_MS），实际 ${tsLines.length}`);
  for (const line of tsLines) {
    assert.ok(!line.includes('python3'), `时间戳获取不应 fork python3: ${line.trim()}`);
    assert.match(line, /perl/, `时间戳获取应使用 perl: ${line.trim()}`);
  }
});
