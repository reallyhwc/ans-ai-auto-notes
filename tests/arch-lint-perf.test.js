const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { execSync } = require('child_process');

test('arch-lint.sh: 检查 6（链接路径大小写）应在 10 秒内完成（性能回归检测）', () => {
  // 从 arch-lint.sh 动态提取检查 6 代码段，不依赖预生成文件
  // 阈值 10s：2026-07-29 重写后基线 ~3s（逐段比较每个链接路径的每个目录名大小写，
  // 75 文件 × 大量链接）。旧阈值 2s 是重写前旧基线，重写后稳定超时。
  // 10s = 基线 3x，覆盖高负载（如并行跑 subagent 时）波动，仍能捕获数量级回归（>30s）。
  const content = fs.readFileSync('scripts/arch-lint.sh', 'utf8');
  const match = content.match(/# ── 检查 6.*?(?=# ── 检查 7)/s);
  assert.ok(match, '应找到检查 6 的代码段');

  const tmpFile = '/tmp/check6-only.sh';
  fs.writeFileSync(tmpFile, '#!/bin/bash\nset -uo pipefail\n' + match[0]);

  const start = Date.now();
  const output = execSync(
    `bash ${tmpFile} 2>&1`,
    { encoding: 'utf8', timeout: 30000 }
  );
  const elapsed = (Date.now() - start) / 1000;

  assert.ok(output.includes('[6/15]'), '应包含检查 6 的输出');
  assert.ok(elapsed < 10, `检查 6 应在 10s 内完成（基线 ~3s，10s 为负载波动上限），实际 ${elapsed.toFixed(2)}s`);
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
