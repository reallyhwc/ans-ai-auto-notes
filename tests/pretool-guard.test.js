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

test('pretool-guard: Write kb/技術/foo.md → 放行（exit 0）', () => {
  withTempProject(dir => {
    runGuard(dir, {
      tool_name: 'Write',
      tool_input: { file_path: 'kb/技術/foo.md' },
    });
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

test('pretool-guard: 無 file_path → 放行（exit 0）', () => {
  withTempProject(dir => {
    runGuard(dir, {
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
    });
  });
});

test('pretool-guard: 絕對路徑含 INDEX.md → 拦截', () => {
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
