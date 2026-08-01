'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

// 提取 arch-lint.sh 检查 6 的独立代码段，写到临时脚本里跑（同 arch-lint-perf.test.js 的技巧）
function extractCheck6() {
  const content = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'arch-lint.sh'), 'utf8');
  const match = content.match(/# ── 检查 6.*?(?=# ── 检查 7)/s);
  assert.ok(match, '应找到检查 6 的代码段');
  return match[0];
}

function runCheck6InTempKb(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arch-lint-check6-'));
  for (const [relPath, content] of Object.entries(files)) {
    const full = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  const scriptFile = path.join(dir, 'check6.sh');
  fs.writeFileSync(scriptFile, '#!/bin/bash\nset -uo pipefail\n' + extractCheck6());
  try {
    return execSync(`bash "${scriptFile}"`, { cwd: dir, encoding: 'utf8', timeout: 30000 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('arch-lint.sh 检查 6: 链接大小写与磁盘完全一致 → 不告警', () => {
  const out = runCheck6InTempKb({
    'kb/a/source.md': '[link](../b/target.md)',
    'kb/b/target.md': '# target',
  });
  assert.match(out, /结果: 0 个大小写不一致/);
});

test('arch-lint.sh 检查 6: 链接目录大小写与磁盘不一致 → 告警', () => {
  const out = runCheck6InTempKb({
    'kb/a/source.md': '[link](../B/target.md)',
    'kb/b/target.md': '# target',
  });
  assert.match(out, /大小写不一致/);
  assert.match(out, /结果: 1 个大小写不一致/);
});

test('arch-lint.sh 检查 6: 链接文件名大小写与磁盘不一致 → 告警', () => {
  const out = runCheck6InTempKb({
    'kb/a/source.md': '[link](../b/Target.md)',
    'kb/b/target.md': '# target',
  });
  assert.match(out, /大小写不一致/);
  assert.match(out, /结果: 1 个大小写不一致/);
});

test('arch-lint.sh 检查 6: 同级目录链接（./ 前缀）大小写一致 → 不告警', () => {
  const out = runCheck6InTempKb({
    'kb/a/source.md': '[link](./Sibling.md)',
    'kb/a/Sibling.md': '# sibling',
  });
  assert.match(out, /结果: 0 个大小写不一致/);
});
