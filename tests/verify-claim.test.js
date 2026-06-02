'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// 拷贝 verify-claim.sh 到临时仓，构造 .claude/ledger 路径，跑脚本，读 ledger
function withTempProject(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-test-'));
  const scriptSrc = path.resolve(__dirname, '..', 'scripts', 'verify-claim.sh');
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(scriptSrc, path.join(dir, 'scripts', 'verify-claim.sh'));
  fs.chmodSync(path.join(dir, 'scripts', 'verify-claim.sh'), 0o755);
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'kb', '技术'), { recursive: true });
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function runHook(dir, payload) {
  // 模拟真实 Claude Code：stdin 传 JSON
  return execSync(`bash scripts/verify-claim.sh`, {
    cwd: dir,
    input: JSON.stringify(payload),
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function readLedger(dir) {
  const p = path.join(dir, '.claude', 'claim-ledger.log');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
}

test('verify-claim: stdin JSON 解析 tool_input.file_path 不存在文件 → MISSING', () => {
  withTempProject(dir => {
    runHook(dir, {
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { file_path: 'kb/不存在.md', content: 'x' },
    });
    const log = readLedger(dir);
    assert.match(log, / \| Write \| kb\/不存在\.md \| MISSING$/m);
  });
});

test('verify-claim: stdin JSON 文件存在 → exists', () => {
  withTempProject(dir => {
    fs.writeFileSync(path.join(dir, 'kb', '技术', 'a.md'), '# A');
    runHook(dir, {
      tool_name: 'Edit',
      tool_input: { file_path: 'kb/技术/a.md' },
    });
    const log = readLedger(dir);
    assert.match(log, / \| Edit \| kb\/技术\/a\.md \| exists$/m);
  });
});

test('verify-claim: 非 kb/ 非 memory/ 路径 → 不写 ledger', () => {
  withTempProject(dir => {
    runHook(dir, {
      tool_name: 'Write',
      tool_input: { file_path: 'random.txt' },
    });
    const log = readLedger(dir);
    assert.equal(log, '', 'ledger 应为空');
  });
});

test('verify-claim: 绝对路径含 /kb/ → 命中', () => {
  withTempProject(dir => {
    const abs = path.join(dir, 'kb', '技术', '不存在.md');
    runHook(dir, {
      tool_name: 'Write',
      tool_input: { file_path: abs },
    });
    const log = readLedger(dir);
    assert.match(log, / \| MISSING$/m);
  });
});

test('verify-claim: memory/ 路径 → 命中', () => {
  withTempProject(dir => {
    runHook(dir, {
      tool_name: 'Write',
      tool_input: { file_path: 'memory/foo.md' },
    });
    const log = readLedger(dir);
    assert.match(log, / \| Write \| memory\/foo\.md \| MISSING$/m);
  });
});

test('verify-claim: env var fallback（无 stdin）仍工作', () => {
  withTempProject(dir => {
    execSync(`bash scripts/verify-claim.sh < /dev/null`, {
      cwd: dir,
      env: {
        ...process.env,
        CLAUDE_TOOL_NAME: 'Write',
        CLAUDE_TOOL_INPUT: JSON.stringify({ file_path: 'kb/legacy.md' }),
      },
      encoding: 'utf-8',
    });
    const log = readLedger(dir);
    assert.match(log, / \| Write \| kb\/legacy\.md \| MISSING$/m);
  });
});

test('verify-claim: 无 file_path 字段 → 不写 ledger', () => {
  withTempProject(dir => {
    runHook(dir, { tool_name: 'Bash', tool_input: { command: 'ls' } });
    const log = readLedger(dir);
    assert.equal(log, '');
  });
});

test('verify-claim: notebook_path 也识别', () => {
  withTempProject(dir => {
    runHook(dir, {
      tool_name: 'NotebookEdit',
      tool_input: { notebook_path: 'kb/技术/x.ipynb' },
    });
    const log = readLedger(dir);
    assert.match(log, / \| NotebookEdit \| kb\/技术\/x\.ipynb \| MISSING$/m);
  });
});
