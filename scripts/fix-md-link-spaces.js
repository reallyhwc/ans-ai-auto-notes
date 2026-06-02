#!/usr/bin/env node
/**
 * fix-md-link-spaces.js — 把 kb/ 下含空格/& 的未包裹 .md 链接改成 <尖括号> 包裹形式
 *
 * 根因：marked.js 严格遵循 CommonMark，`[X](path with space.md)` 不会被识别为链接，
 *      页面看似有链接、实际是纯文本无法跳转。修复：写成 `[X](<path with space.md>)`。
 *
 * 用法：node scripts/fix-md-link-spaces.js [--dry-run]
 * 幂等：再跑一次 0 修改。
 *
 * 防回归：tests/integration.test.js 有静态检查，arch-lint.sh 也有同样检查。
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
// 扫描根：kb 是主战场；timeline 是手维护的周记，里面有大量指向 kb/ 的链接
const SCAN_ROOTS = ['kb', 'timeline'].map(d => path.join(ROOT, d));

const dryRun = process.argv.includes('--dry-run');

function walkMd(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkMd(p));
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

// 匹配 ](URL)，URL 不能以 < 开头（已包裹则跳过），且必须以 .md 或 .md#anchor 结尾
const BAD_LINK_RE = /\]\(([^<)][^)]*?\.md(?:#[^)]*)?)\)/g;

function fixContent(content) {
  let count = 0;
  const out = content.replace(BAD_LINK_RE, (match, url) => {
    if (!/[ &]/.test(url)) return match;
    count++;
    return `](<${url}>)`;
  });
  return { out, count };
}

module.exports = { fixContent };

if (require.main === module) {
  const files = SCAN_ROOTS.flatMap(r => fs.existsSync(r) ? walkMd(r) : []);
  let totalFiles = 0;
  let totalFixes = 0;

  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    const { out, count } = fixContent(content);
    if (count === 0) continue;
    totalFiles++;
    totalFixes += count;
    console.log(`${dryRun ? '[dry] ' : ''}${path.relative(ROOT, f)}: ${count} 处`);
    if (!dryRun) fs.writeFileSync(f, out);
  }

  console.log(`\n${dryRun ? '[dry] ' : ''}修复完成：${totalFixes} 处 across ${totalFiles} 个文件`);
}
