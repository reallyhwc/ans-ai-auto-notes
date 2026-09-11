/**
 * check-links.test.js — 链接存在性检查（findBrokenLinks）
 *
 * 根因回归：历史上 integration.test.js 的正则要求 `](` 后紧跟 `./`，
 * 导致 `](<...>)` 尖括号链接与 `[[wiki]]` 链接既不被校验、也不进反链图，
 * 死链静默累积（2026-09 实测 kb/ 内两处 wiki 死链）。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { findBrokenLinks } = require('../scripts/check-links.js');

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-links-'));
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('findBrokenLinks: 标准链接指向存在的文件 -> 不报', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'), '看 [B](./b.md)');
    fs.writeFileSync(path.join(dir, 'b.md'), '# B');
    assert.deepEqual(findBrokenLinks([dir]), []);
  });
});

test('findBrokenLinks: 尖括号链接指向存在的文件 -> 不报', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'), '看 [B 文件](<./b 文件.md>)');
    fs.writeFileSync(path.join(dir, 'b 文件.md'), '# B');
    assert.deepEqual(findBrokenLinks([dir]), []);
  });
});

test('findBrokenLinks: 尖括号链接死链 -> 报告', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'), '看 [B](<./missing.md>)');
    const broken = findBrokenLinks([dir]);
    assert.equal(broken.length, 1);
    assert.equal(broken[0].target, './missing.md');
    assert.equal(broken[0].source.endsWith('a.md'), true);
  });
});

test('findBrokenLinks: 带锚点的尖括号链接按去锚点后路径判断', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'), '看 [B](<./b.md#sec>)');
    fs.writeFileSync(path.join(dir, 'b.md'), '# B');
    assert.deepEqual(findBrokenLinks([dir]), []);
  });
});

test('findBrokenLinks: wiki 链接 [[./x.md]] 死链 -> 报告', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'), '关联：[[./nope.md]]');
    const broken = findBrokenLinks([dir]);
    assert.equal(broken.length, 1);
    assert.equal(broken[0].target, './nope.md');
  });
});

test('findBrokenLinks: 省略 ./ 的 wiki 链接 [[x.md]] 也校验', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'), '关联：[[nope.md]]');
    const broken = findBrokenLinks([dir]);
    assert.equal(broken.length, 1);
    assert.equal(broken[0].target, 'nope.md');
  });
});

test('findBrokenLinks: wiki 死链指向存在文件时不报（含别名语法）', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'), '关联：[[./b.md|别名]]');
    fs.writeFileSync(path.join(dir, 'b.md'), '# B');
    assert.deepEqual(findBrokenLinks([dir]), []);
  });
});

test('findBrokenLinks: 代码块内的链接不参与校验', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'), '```\n示例 [B](./missing.md)\n```\n');
    assert.deepEqual(findBrokenLinks([dir]), []);
  });
});

test('findBrokenLinks: 行内代码里的链接不参与校验', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'), '写法是 `[B](./missing.md)` 这样');
    assert.deepEqual(findBrokenLinks([dir]), []);
  });
});

test('findBrokenLinks: 外链与纯锚点不算死链', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'),
      '[外链](https://example.com/x.md) [锚点](#sec) [邮件](mailto:a@b.com)\n');
    assert.deepEqual(findBrokenLinks([dir]), []);
  });
});

test('findBrokenLinks: 嵌套 ../ 相对路径正确解析', () => {
  withTempDir(dir => {
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', 'a.md'), '看 [B](<../b.md>)');
    fs.writeFileSync(path.join(dir, 'b.md'), '# B');
    assert.deepEqual(findBrokenLinks([dir]), []);
  });
});

test('findBrokenLinks: 同一文件多条死链全部报告', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'), '[X](<./x.md>) 和 [[y.md]]');
    const broken = findBrokenLinks([dir]);
    assert.equal(broken.length, 2);
  });
});
