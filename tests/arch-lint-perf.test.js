const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { execSync } = require('child_process');

test('arch-lint.sh: 检查 6（链接路径大小写）应在 2 秒内完成', () => {
  const start = Date.now();
  const output = execSync(
    'bash /tmp/check6-only.sh 2>&1',
    { encoding: 'utf8', timeout: 30000 }
  );
  const elapsed = (Date.now() - start) / 1000;

  assert.ok(output.includes('[6/15]'), '应包含检查 6 的输出');
  assert.ok(elapsed < 2, `检查 6 应在 2s 内完成，实际 ${elapsed.toFixed(2)}s`);
});

test('arch-lint.sh: 不应包含 python3 fork（性能反模式）', () => {
  const content = fs.readFileSync('scripts/arch-lint.sh', 'utf8');

  const check6Section = content.match(/# ── 检查 6.*?# ── 检查 7/s);
  assert.ok(check6Section, '应找到检查 6 的代码段');

  // 排除注释行（# 开头），只匹配实际 python3 命令调用
  const codeLines = check6Section[0].split('\n').filter(line => !line.match(/^\s*#/));
  const codeOnly = codeLines.join('\n');

  const pythonCalls = (codeOnly.match(/python3/g) || []).length;
  assert.strictEqual(pythonCalls, 0,
    `检查 6 不应调用 python3（发现 ${pythonCalls} 处），应用 bash-native 替代`);
});
