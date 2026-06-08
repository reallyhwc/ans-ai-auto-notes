'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

test('契约: verify-claim 输出格式被 exit-check 正确消费（MISSING 场景）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-test-'));
  const scriptSrc = path.resolve(__dirname, '..', 'scripts', 'verify-claim.sh');
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(scriptSrc, path.join(dir, 'scripts', 'verify-claim.sh'));
  fs.chmodSync(path.join(dir, 'scripts', 'verify-claim.sh'), 0o755);
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'kb'), { recursive: true });

  try {
    execSync('bash scripts/verify-claim.sh', {
      cwd: dir,
      input: JSON.stringify({
        tool_name: 'Write',
        tool_input: { file_path: 'kb/不存在.md' },
      }),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const ledger = fs.readFileSync(path.join(dir, '.claude', 'claim-ledger.log'), 'utf-8');

    const missingCount = (ledger.match(/ \| MISSING$/gm) || []).length;
    assert.equal(missingCount, 1, 'grep " | MISSING$" 应匹配 1 行');

    const lines = ledger.trim().split('\n');
    assert.equal(lines.length, 1);
    const parts = lines[0].split(' | ');
    assert.equal(parts.length, 4, '应有 4 段用 " | " 分隔');
    assert.match(parts[0], /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, '第 1 段是时间戳');
    assert.equal(parts[1], 'Write', '第 2 段是工具名');
    assert.match(parts[2], /\.md$/, '第 3 段是文件路径');
    assert.equal(parts[3], 'MISSING', '第 4 段是状态');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('契约: verify-claim 输出格式被 exit-check 正确消费（exists 场景）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-test-'));
  const scriptSrc = path.resolve(__dirname, '..', 'scripts', 'verify-claim.sh');
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(scriptSrc, path.join(dir, 'scripts', 'verify-claim.sh'));
  fs.chmodSync(path.join(dir, 'scripts', 'verify-claim.sh'), 0o755);
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'kb', '技术'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'kb', '技术', 'test.md'), '# Test');

  try {
    execSync('bash scripts/verify-claim.sh', {
      cwd: dir,
      input: JSON.stringify({
        tool_name: 'Edit',
        tool_input: { file_path: 'kb/技术/test.md' },
      }),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const ledger = fs.readFileSync(path.join(dir, '.claude', 'claim-ledger.log'), 'utf-8');

    const missingCount = (ledger.match(/ \| MISSING$/gm) || []).length;
    assert.equal(missingCount, 0, 'exists 行不应被 MISSING 匹配');

    const parts = ledger.trim().split(' | ');
    assert.equal(parts[3], 'exists');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('契约: exit-check [8/N] 的 grep pattern 与 ledger 格式一致', () => {
  const exitCheck = fs.readFileSync(path.resolve(__dirname, '..', 'exit-check.sh'), 'utf-8');

  assert.match(exitCheck, /grep -c " \| MISSING\$"/, 'exit-check 应使用 grep -c " | MISSING$" pattern');

  const verifyClaim = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'verify-claim.sh'), 'utf-8');
  assert.match(verifyClaim, /\| MISSING"/, 'verify-claim 应写入 "| MISSING" 后缀');
  assert.match(verifyClaim, /\| exists"/, 'verify-claim 应写入 "| exists" 后缀');
});
