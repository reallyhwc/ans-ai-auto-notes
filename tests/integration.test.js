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
