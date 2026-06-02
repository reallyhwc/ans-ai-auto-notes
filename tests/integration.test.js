/**
 * integration.test.js — 全量扫 kb/ 下所有 markdown 文件，验证内部相对链接
 * 都指向磁盘真实存在的文件。
 *
 * 与 arch-lint.sh 的死链检查重叠，但作为 push gate 多一道保险，
 * 同时也是一个示范：未来要测"全量内容某规则"，可以照这个写法。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function walkMd(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkMd(p));
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

test('kb/ 下所有 markdown 相对链接 → 磁盘真实文件', () => {
  const files = walkMd(path.join(ROOT, 'kb'));
  const broken = [];
  // 匹配 [text](./path.md) 或 [text](../../X.md) 等，含可选锚点
  const linkRe = /\]\((\.{1,2}\/[^)]+\.md)([^)]*)\)/g;
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    const fileDir = path.dirname(f);
    let m;
    while ((m = linkRe.exec(content)) !== null) {
      // 去锚点
      const target = m[1].split('#')[0];
      const abs = path.resolve(fileDir, target);
      if (!fs.existsSync(abs)) {
        broken.push(`${path.relative(ROOT, f)} → ${m[1]}`);
      }
    }
  }
  assert.deepEqual(broken, [], '存在死链:\n  ' + broken.join('\n  '));
});

test('kb/ + timeline/ 下含空格/特殊字符的 .md 链接必须用 <尖括号> 包裹（否则 CommonMark 解析失败）', () => {
  // 根因：marked.js 严格按 CommonMark 规范，`[X](path with space.md)` 不识别为链接，
  // 导致页面上看似有链接、实际是纯文本无法跳转。修复：写成 `[X](<path with space.md>)`。
  const files = ['kb', 'timeline'].flatMap(d => walkMd(path.join(ROOT, d)));
  const bad = [];
  // 匹配 ](xxx.md)，URL 部分不能以 < 开头（已包裹则跳过），URL 含空格或 & 触发
  const badLinkRe = /\]\(([^<)][^)]*?\.md(?:#[^)]*)?)\)/g;
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    let m;
    while ((m = badLinkRe.exec(content)) !== null) {
      const url = m[1];
      if (/[ &]/.test(url)) {
        bad.push(`${path.relative(ROOT, f)} → ](${url})`);
      }
    }
  }
  assert.deepEqual(bad, [], `存在含空格/&的未包裹链接（marked 解析失败）:\n  ${bad.slice(0, 10).join('\n  ')}${bad.length > 10 ? `\n  ... 共 ${bad.length} 处` : ''}\n\n修复：把 \`](path with space.md)\` 改为 \`](<path with space.md>)\``);
});
