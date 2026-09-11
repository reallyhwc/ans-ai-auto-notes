/**
 * wiki-links.test.js — [[路径.md]] 转标准 markdown 链接
 *
 * 根因回归：kb/ 里有 14 处 `> 关联: [[./x.md]]`，但 app.js 的 marked 渲染器
 * 只处理 `](...)`，`[[...]]` 原样输出纯文本 → 页面里这些关联行点不动（2026-09 审计）。
 * 转换放在 lib.js（纯函数、Node 可测），app.js 在 renderMarkdown 里调用。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { convertWikiLinks } = require('../scripts/lib.js');

test('convertWikiLinks: 基本形式转为标准链接，标签取文件名', () => {
  const out = convertWikiLinks('关联：[[./MySQL B+树索引实现原理.md]]');
  assert.equal(out, '关联：[MySQL B+树索引实现原理](<./MySQL B+树索引实现原理.md>)');
});

test('convertWikiLinks: 无空格路径不加尖括号', () => {
  const out = convertWikiLinks('见 [[./rnn.md]]');
  assert.equal(out, '见 [rnn](./rnn.md)');
});

test('convertWikiLinks: 支持 [[path|别名]] 语法', () => {
  const out = convertWikiLinks('见 [[./rnn.md|循环神经网络]]');
  assert.equal(out, '见 [循环神经网络](./rnn.md)');
});

test('convertWikiLinks: 省略 ./ 的路径也转换', () => {
  const out = convertWikiLinks('见 [[rnn.md]]');
  assert.equal(out, '见 [rnn](rnn.md)');
});

test('convertWikiLinks: 代码块内不转换', () => {
  const md = '```\n[[./x.md]]\n```\n';
  assert.equal(convertWikiLinks(md), md);
});

test('convertWikiLinks: 行内代码内不转换', () => {
  const md = '写法 `[[./x.md]]` 这样';
  assert.equal(convertWikiLinks(md), md);
});

test('convertWikiLinks: 非 .md 的双中括号不受影响（如词云数组）', () => {
  const md = '返回 [[word, weight], ...] 格式';
  assert.equal(convertWikiLinks(md), md);
});

test('convertWikiLinks: ../ 跨目录路径正常转换（全角括号无需尖括号）', () => {
  const out = convertWikiLinks('相关 [[../技术/AI/基础/RNN（循环神经网络）.md]]');
  // 全角（）不是 ASCII 括号，不会截断 CommonMark 链接目标，因此无需 <...> 包裹；
  // 只有 ASCII 空格 / & / () 才需要（与 fix-md-link-spaces.js 的判定一致）
  assert.equal(out, '相关 [RNN（循环神经网络）](../技术/AI/基础/RNN（循环神经网络）.md)');
});

test('convertWikiLinks: ASCII 括号路径用尖括号包裹', () => {
  const out = convertWikiLinks('见 [[./a(1).md]]');
  assert.equal(out, '见 [a(1)](<./a(1).md>)');
});

test('convertWikiLinks: 一行多个 wiki 链接全部转换', () => {
  const out = convertWikiLinks('[[./a.md]] 与 [[./b.md]]');
  assert.equal(out, '[a](./a.md) 与 [b](./b.md)');
});
