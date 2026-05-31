/**
 * link-renderer.test.js — renderKbLink 输出契约
 * 防止任何 .md 链接被渲染成原生 <a href> 跳出 SPA 视图（历史 bug：marked
 * 默认 link renderer + 浏览器原生导航导致跳出可视化导览）
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderKbLink } = require('../scripts/lib.js');

const CUR = 'kb/技术/AI/Claude-Code/Harness Engineering：AI Agent 时代的工程范式.md';

test('外链 https → <a target="_blank" rel="noopener">', () => {
  const out = renderKbLink('https://example.com', CUR, 'Example');
  assert.match(out, /^<a href="https:\/\/example\.com" target="_blank" rel="noopener">Example<\/a>$/);
});

test('外链 http → <a target="_blank">', () => {
  const out = renderKbLink('http://example.com', CUR, 'X');
  assert.match(out, /target="_blank"/);
});

test('mailto 也作为外链处理', () => {
  const out = renderKbLink('mailto:foo@bar.com', CUR, 'Mail');
  assert.match(out, /target="_blank"/);
});

test('页内锚点 #xxx → 标准 <a>，不加 target', () => {
  const out = renderKbLink('#section', CUR, 'Jump');
  assert.equal(out, '<a href="#section">Jump</a>');
  assert.doesNotMatch(out, /target=/);
});

test('.md 链接 → <span class="kb-link" onclick=viewContent>，不应是 <a href>', () => {
  const out = renderKbLink('./architecture.md', CUR, 'Arch');
  assert.match(out, /<span class="kb-link"/);
  assert.match(out, /onclick="viewContent\('kb\/技术\/AI\/Claude-Code\/architecture\.md'\)"/);
  assert.doesNotMatch(out, /<a href=/);
});

test('跨子目录 .md 链接 → 路径解析正确', () => {
  const out = renderKbLink('../AI-Coding/foo.md', CUR, 'Foo');
  assert.match(out, /onclick="viewContent\('kb\/技术\/AI\/AI-Coding\/foo\.md'\)"/);
});

test('深层 .md 链接 → 路径正确解析', () => {
  const out = renderKbLink('../../../实战/外部参考链接.md', CUR, 'Ref');
  assert.match(out, /onclick="viewContent\('kb\/实战\/外部参考链接\.md'\)"/);
});

test('其他相对资源（.png/.svg） → 标准 <a>（不路由 SPA）', () => {
  const out = renderKbLink('./image.png', CUR, 'Img');
  assert.equal(out, '<a href="./image.png">Img</a>');
});

test('无 currentFile 时 .md 链接降级为标准 <a>（防御性）', () => {
  const out = renderKbLink('./foo.md', null, 'Foo');
  assert.match(out, /^<a href="\.\/foo\.md">Foo<\/a>$/);
});
