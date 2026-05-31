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

test('buildToc: 内联代码的 backtick 不影响 id（与 marked token.text 对齐）', () => {
  const md = '## 3. `@Tool` 注解的内部机制';
  const toc = buildToc(md);
  assert.equal(toc.length, 1);
  assert.equal(toc[0].text, '3. `@Tool` 注解的内部机制');
  // id 应该用去掉 backtick 后的文本生成，匹配 marked 的 token.text
  assert.equal(toc[0].id, slugify('3. @Tool 注解的内部机制'));
});

// ── resolveRelativeMd ──────────────────────────────────────
const cur = 'kb/技术/AI/Claude-Code/Harness Engineering：AI Agent 时代的工程范式.md';

test('resolveRelativeMd: 同目录 ./X.md', () => {
  const r = resolveRelativeMd(cur, './Claude Code 整体架构 & 工作流程.md');
  assert.equal(r.path, 'kb/技术/AI/Claude-Code/Claude Code 整体架构 & 工作流程.md');
  assert.equal(r.anchor, '');
});

test('resolveRelativeMd: 跨子目录 ../X/Y.md', () => {
  const r = resolveRelativeMd(cur, '../AI-Coding/AI 编程工具：CLI Agent 与 GUI IDE 全景对比.md');
  assert.equal(r.path, 'kb/技术/AI/AI-Coding/AI 编程工具：CLI Agent 与 GUI IDE 全景对比.md');
});

test('resolveRelativeMd: 多层向上 ../../../X/Y.md', () => {
  const r = resolveRelativeMd(cur, '../../../实战/外部参考链接.md');
  assert.equal(r.path, 'kb/实战/外部参考链接.md');
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
