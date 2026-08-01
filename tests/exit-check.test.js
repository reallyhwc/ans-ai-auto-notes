'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// exit-check.sh 位于项目根目录（不在 scripts/ 中），由 Stop hook 触发
const scriptPath = path.join(__dirname, '..', 'exit-check.sh');
const content = fs.readFileSync(scriptPath, 'utf8');

// 回归测试：[3/11] INDEX.md 路径提取曾用贪婪 sed 's/.*](\(.*\.md\)).*/\1/'，
// 对含 ) 的路径会截断错误；而同段的 grep 用非贪婪 '[^)]*\.md'。两处正则不一致。
// 修复：统一用 grep -oE '\]\([^)]+\.md\)' 非贪婪提取 + sed 's/](//;s/)$//' 剥壳。
test('exit-check.sh [3/11]: INDEX 路径提取不使用贪婪 sed，统一非贪婪 grep -oE', () => {
  // 贪婪 sed 正则必须消失（\1 反向引用是贪婪捕获的标志）
  assert.ok(
    !content.includes('s/.*](\\(.*\\.md\\)).*/\\1/'),
    '[3/11] 不应使用贪婪 sed 正则 s/.*](\\(.*\\.md\\)).*/\\1/'
  );
  // 应使用 grep -oE 非贪婪提取
  assert.match(content, /grep -oE/, '[3/11] 应使用 grep -oE 提取 ](path.md)');
  // 应使用 sed 剥壳（去掉 ]( 前缀和 ) 后缀）
  assert.ok(
    content.includes("sed 's/](//;s/)$//'"),
    "[3/11] 应使用 sed 's/](//;s/)$//' 剥壳"
  );
});
