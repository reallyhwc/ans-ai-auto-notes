/**
 * lib.test.js — scripts/lib.js 纯函数单测
 * 运行：node --test tests/lib.test.js  或  bash test.sh
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  escapeHtml,
  escapeAttr,
  slugify,
  buildToc,
  resolveRelativeMd,
} = require('../scripts/lib.js');

// ── escapeHtml ─────────────────────────────────────────────
test('escapeHtml: <、>、& 转义；引号不转（用于代码块文本）', () => {
  assert.equal(escapeHtml('<a href="x">'), '&lt;a href="x"&gt;');
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
  assert.equal(escapeHtml(''), '');
});

test('escapeHtml: 数字/null/undefined 都安全转字符串', () => {
  assert.equal(escapeHtml(123), '123');
  assert.equal(escapeHtml(null), 'null');
  assert.equal(escapeHtml(undefined), 'undefined');
});

// ── escapeAttr ─────────────────────────────────────────────
test('escapeAttr: 五字符全转义（用于属性值）', () => {
  assert.equal(escapeAttr(`a"b'c`), `a&quot;b&#39;c`);
  assert.equal(escapeAttr('<&>'), '&lt;&amp;&gt;');
});

// ── slugify ────────────────────────────────────────────────
test('slugify: 英文转小写连字符', () => {
  assert.equal(slugify('Hello World'), 'hello-world');
  assert.equal(slugify('Hello, World!'), 'hello-world');
});

test('slugify: 中文保留', () => {
  assert.equal(slugify('一句话定位'), '一句话定位');
  assert.equal(slugify('AI 的本质'), 'ai-的本质');
});

// ── buildToc ───────────────────────────────────────────────
test('buildToc: 抽取 ## 和 ### 标题', () => {
  const md = '# H1 ignored\n## A\n### B\n\n## C';
  const toc = buildToc(md);
  assert.equal(toc.length, 3);
  assert.deepEqual(toc[0], { level: 2, text: 'A', id: 'a' });
  assert.deepEqual(toc[1], { level: 3, text: 'B', id: 'b' });
  assert.deepEqual(toc[2], { level: 2, text: 'C', id: 'c' });
});

test('buildToc: 跳过代码块内的 #', () => {
  const md = '## Real\n```\n## fake-toc-in-code\n```\n## Also Real';
  const toc = buildToc(md);
  assert.equal(toc.length, 2);
  assert.equal(toc[0].text, 'Real');
  assert.equal(toc[1].text, 'Also Real');
});

// ── resolveRelativeMd ──────────────────────────────────────
const cur = 'kb/技术/AI/Claude-Code/harness-engineering.md';

test('resolveRelativeMd: 同目录 ./X.md', () => {
  const r = resolveRelativeMd(cur, './claude-code-architecture.md');
  assert.equal(r.path, 'kb/技术/AI/Claude-Code/claude-code-architecture.md');
  assert.equal(r.anchor, '');
});

test('resolveRelativeMd: 跨子目录 ../X/Y.md', () => {
  const r = resolveRelativeMd(cur, '../AI-Coding/ai-coding-tools.md');
  assert.equal(r.path, 'kb/技术/AI/AI-Coding/ai-coding-tools.md');
});

test('resolveRelativeMd: 多层向上 ../../../X/Y.md', () => {
  const r = resolveRelativeMd(cur, '../../../实战/技巧/external-references.md');
  assert.equal(r.path, 'kb/实战/技巧/external-references.md');
});

test('resolveRelativeMd: 锚点保留', () => {
  const r = resolveRelativeMd('kb/a/b.md', './c.md#section-3');
  assert.equal(r.path, 'kb/a/c.md');
  assert.equal(r.anchor, '#section-3');
});

test('resolveRelativeMd: 无前缀的相对路径', () => {
  const r = resolveRelativeMd('kb/a/b.md', 'c.md');
  assert.equal(r.path, 'kb/a/c.md');
});
