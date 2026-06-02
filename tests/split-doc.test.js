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
