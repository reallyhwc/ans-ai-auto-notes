'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { tokenize, buildSearchIndex } = require('../scripts/build-index.js');

test('tokenize: 英文按 \\w+ 分词，转小写', () => {
  const tokens = tokenize('Hello World 中文混合 Agent-MCP');
  assert.ok(tokens.includes('hello'));
  assert.ok(tokens.includes('world'));
  assert.ok(tokens.includes('agent'));
  assert.ok(tokens.includes('mcp'));
});

test('tokenize: 中文按字符切（unigram）', () => {
  const tokens = tokenize('知识库');
  assert.ok(tokens.includes('知'));
  assert.ok(tokens.includes('识'));
  assert.ok(tokens.includes('库'));
});

test('tokenize: 去除代码块和 mermaid 块', () => {
  const md = 'hello\n```js\ncode_only_should_be_skipped\n```\nworld';
  const tokens = tokenize(md);
  assert.ok(tokens.includes('hello'));
  assert.ok(tokens.includes('world'));
  assert.ok(!tokens.includes('code_only_should_be_skipped'));
});

test('buildSearchIndex: 倒排表 token -> [fileIdx]', () => {
  const files = [
    { idx: 0, text: 'agent design' },
    { idx: 1, text: 'agent runtime' },
    { idx: 2, text: 'database query' },
  ];
  const idx = buildSearchIndex(files);
  assert.deepEqual(idx['agent'].sort(), [0, 1]);
  assert.deepEqual(idx['design'], [0]);
  assert.deepEqual(idx['database'], [2]);
});
