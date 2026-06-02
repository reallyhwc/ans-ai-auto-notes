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
