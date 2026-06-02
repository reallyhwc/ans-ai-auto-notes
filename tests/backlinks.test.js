'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { extractLinks, buildBacklinks } = require('../scripts/build-index.js');

test('extractLinks: 提取 ](./x.md) 风格', () => {
  const md = '看 [X](./x.md) 和 [Y](../sub/y.md)';
  const links = extractLinks(md);
  assert.deepEqual(links.sort(), ['../sub/y.md', './x.md'].sort());
});

test('extractLinks: 提取 [[./x.md]] 双中括号风格', () => {
  const md = '关联 [[./other.md]]';
  const links = extractLinks(md);
  assert.deepEqual(links, ['./other.md']);
});

test('extractLinks: 忽略外链', () => {
  const md = '看 [github](https://github.com/x/y)';
  const links = extractLinks(md);
  assert.equal(links.length, 0);
});

test('extractLinks: 识别同目录裸路径 [x](foo.md)', () => {
  // reviewer 反馈的覆盖盲区：之前正则只匹配 ./ 或 ../，裸路径漏掉
  const md = '同目录 [Foo](foo.md) 和 [Bar](bar.md#anchor)';
  const links = extractLinks(md);
  assert.ok(links.includes('foo.md'), '应识别 foo.md: ' + JSON.stringify(links));
  assert.ok(links.includes('bar.md'), '应识别 bar.md: ' + JSON.stringify(links));
});

test('extractLinks: 识别仓根路径 [x](kb/sub/foo.md)', () => {
  const md = '看 [Foo](kb/技术/foo.md)';
  const links = extractLinks(md);
  assert.ok(links.includes('kb/技术/foo.md'), '应识别仓根路径: ' + JSON.stringify(links));
});

test('extractLinks: 不误识别非 md 文件 / 锚点纯链接', () => {
  // 不应把 [x](#section) 或 [x](file.txt) 识别为 md 链接
  const md = '锚点 [Sec](#section) 和文本 [Txt](file.txt)';
  const links = extractLinks(md);
  assert.equal(links.length, 0, '不应识别非 md: ' + JSON.stringify(links));
});

test('buildBacklinks: 反向图 target -> [sources]', () => {
  const files = [
    { path: 'kb/a.md', text: '看 [B](./b.md)' },
    { path: 'kb/b.md', text: '看 [A](./a.md)' },
    { path: 'kb/c.md', text: '同时引 [A](./a.md) 和 [B](./b.md)' },
  ];
  const bl = buildBacklinks(files);
  assert.deepEqual(bl['kb/a.md'].sort(), ['kb/b.md', 'kb/c.md'].sort());
  assert.deepEqual(bl['kb/b.md'].sort(), ['kb/a.md', 'kb/c.md'].sort());
  assert.equal(bl['kb/c.md'], undefined);  // c 没被引
});
