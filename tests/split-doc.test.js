'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { splitDocBySections, sanitizeFilename } = require('../scripts/split-doc.js');

test('sanitizeFilename: 冒号→全角，去非法字符', () => {
  assert.equal(sanitizeFilename('A:B'), 'A：B');
  assert.equal(sanitizeFilename('A/B*C?D'), 'ABCD');
  assert.equal(sanitizeFilename('A   B'), 'A B');
});

test('splitDocBySections: 拆出指定章节为新文件', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'split-test-'));
  const big = path.join(dir, 'big.md');
  fs.writeFileSync(big, `---
title: Big
description: D
---

# Big

## 章节 A
内容 A

## 章节 B
内容 B

## 章节 C
内容 C
`);
  const result = splitDocBySections(big, ['章节 A', '章节 B']);
  // 应生成两个新文件
  assert.ok(fs.existsSync(path.join(dir, '章节 A.md')));
  assert.ok(fs.existsSync(path.join(dir, '章节 B.md')));
  // 原文件应只剩章节 C
  const orig = fs.readFileSync(big, 'utf-8');
  assert.ok(!orig.includes('## 章节 A\n内容 A'));
  assert.ok(!orig.includes('## 章节 B\n内容 B'));
  assert.ok(orig.includes('## 章节 C'));
  // 原文件应有拆分提示
  assert.ok(orig.includes('已拆分'));
  assert.ok(orig.includes('章节 A.md'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('splitDocBySections: 章节名不匹配 -> 抛错', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'split-test-'));
  const big = path.join(dir, 'big.md');
  fs.writeFileSync(big, '# Big\n## 章节 A\n内容');
  assert.throws(
    () => splitDocBySections(big, ['不存在的章节']),
    /章节未找到/
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

// ── audit 修复测试 ─────────────────────────────────────────

test('audit #1: 拆分后原文件保留 h1 标题和 lead text', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'split-test-'));
  const big = path.join(dir, 'big.md');
  fs.writeFileSync(big, `---
title: Big
---

# Big

这是 lead 段落，介绍整体内容。

## 章节 A
内容 A

## 章节 B
内容 B
`);
  splitDocBySections(big, ['章节 A']);
  const orig = fs.readFileSync(big, 'utf-8');
  assert.ok(orig.includes('# Big'), 'h1 标题应保留');
  assert.ok(orig.includes('这是 lead 段落'), 'lead text 应保留');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('audit #2: ## N. 样式拆分后剩余章节自动重编号', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'split-test-'));
  const big = path.join(dir, 'big.md');
  fs.writeFileSync(big, `# Big

## 1. 章节一
内容 1

## 2. 章节二
内容 2

## 3. 章节三
内容 3
`);
  splitDocBySections(big, ['2. 章节二']);
  const orig = fs.readFileSync(big, 'utf-8');
  // 剩余应是 1. + 2.（原 3. 重编号到 2.），不是 1. + 3.
  assert.ok(orig.includes('## 1. 章节一'), '原 1 保留');
  assert.ok(orig.includes('## 2. 章节三'), '原 3 应重编号为 2');
  assert.ok(!orig.includes('## 3.'), '不应有跳号 ## 3.');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('audit #3: 新文件 frontmatter title 与磁盘 fname 一致（sanitize 后）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'split-test-'));
  const big = path.join(dir, 'big.md');
  fs.writeFileSync(big, '# Big\n## A: B\n内容\n## C\n');
  splitDocBySections(big, ['A: B']);
  const fname = sanitizeFilename('A: B') + '.md';  // 'A： B.md'（冒号转全角，空格保留）
  const fpath = path.join(dir, fname);
  assert.ok(fs.existsSync(fpath), '文件名应是 sanitize 后版本: ' + fname);
  const newContent = fs.readFileSync(fpath, 'utf-8');
  const expectedTitle = sanitizeFilename('A: B');  // 'A： B'
  assert.ok(newContent.includes(`title: "${expectedTitle}"`),
    'frontmatter title 应与 fname 一致（含全角冒号）: ' + expectedTitle);
  assert.ok(!newContent.includes('title: "A: B"'), 'frontmatter title 不应保留原始半角冒号');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('audit #4: title 含双引号被 sanitize 移除（避免 YAML 破坏）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'split-test-'));
  const big = path.join(dir, 'big.md');
  fs.writeFileSync(big, '# Big\n## 论"X"的本质\n内容\n## C\n');
  splitDocBySections(big, ['论"X"的本质']);
  // sanitizeFilename 会移除 " ，所以 fname 不含引号
  const fname = sanitizeFilename('论"X"的本质') + '.md';  // '论X的本质.md'
  const fpath = path.join(dir, fname);
  assert.ok(fs.existsSync(fpath), 'fname 应去除双引号: ' + fname);
  const newContent = fs.readFileSync(fpath, 'utf-8');
  // title 也不应含双引号（sanitize 后），YAML 干净
  const titleLine = newContent.split('\n').find(l => l.startsWith('title:'));
  assert.ok(titleLine, 'frontmatter 应含 title 字段');
  // title 行中除了 frontmatter 自身的 `"` 包围符外，不应有内部 `"`
  const titleValue = titleLine.replace(/^title:\s*"?(.*?)"?\s*$/, '$1');
  assert.ok(!titleValue.includes('"'),
    'title 值应去除内部双引号: titleLine=' + titleLine + ', titleValue=' + titleValue);
  fs.rmSync(dir, { recursive: true, force: true });
});
