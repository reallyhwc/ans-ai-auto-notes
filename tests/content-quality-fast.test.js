'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

function withTempKb(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cqf-test-'));
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com" && git config user.name "test"', { cwd: dir, stdio: 'pipe' });

  for (const [relPath, content] of Object.entries(files)) {
    const full = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  execSync('git add -A && git commit -m "init" --allow-empty', { cwd: dir, stdio: 'pipe' });

  const scriptSrc = path.resolve(__dirname, '..', 'scripts', 'content-quality-fast.sh');
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.copyFileSync(scriptSrc, path.join(dir, 'scripts', 'content-quality-fast.sh'));

  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function runCheck(dir, opts = {}) {
  const env = { ...process.env };
  if (opts.checkAll) env.CQF_CHECK_ALL = '1';
  return execSync('bash scripts/content-quality-fast.sh', {
    cwd: dir,
    encoding: 'utf-8',
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

test('content-quality-fast: 缺交叉链接 → 警告', () => {
  withTempKb({
    'kb/技术/Java/test.md': [
      '---',
      'title: Test',
      'description: Test file',
      '---',
      '',
      '> 最后整理: 2026-06-08 | 来源: 对话',
      '',
      '## 1. 内容',
      '',
      '这里有一些内容但没有交叉链接。',
    ].join('\n'),
  }, (dir) => {
    const out = runCheck(dir, { checkAll: true });
    assert.match(out, /交叉链接|相关|cross/i);
  });
});

test('content-quality-fast: 有交叉链接 → 不警告', () => {
  withTempKb({
    'kb/技术/Java/test.md': [
      '---',
      'title: Test',
      'description: Test file',
      '---',
      '',
      '> 最后整理: 2026-06-08 | 来源: 对话',
      '',
      '## 1. 内容',
      '',
      '相关：',
      '- [[其他文件.md]] — 关联内容',
    ].join('\n'),
  }, (dir) => {
    const out = runCheck(dir, { checkAll: true });
    assert.doesNotMatch(out, /缺.*交叉链接/);
  });
});

test('content-quality-fast: 缺 mermaid/代码块/表格 → 警告', () => {
  withTempKb({
    'kb/技术/Java/test.md': [
      '---',
      'title: Test',
      'description: Test file',
      '---',
      '',
      '> 最后整理: 2026-06-08 | 来源: 对话',
      '',
      '## 1. 纯文字内容',
      '',
      '这里只有纯文字，没有代码块、Mermaid 图或表格。',
    ].join('\n'),
  }, (dir) => {
    const out = runCheck(dir, { checkAll: true });
    assert.match(out, /具象元素|mermaid|代码块|表格/i);
  });
});

test('content-quality-fast: 元信息头日期 >30 天 → 警告', () => {
  withTempKb({
    'kb/技术/Java/test.md': [
      '---',
      'title: Test',
      'description: Test file',
      '---',
      '',
      '> 最后整理: 2025-01-01 | 来源: 对话',
      '',
      '## 1. 旧内容',
      '',
      '```java',
      'System.out.println("hello");',
      '```',
      '',
      '相关：',
      '- [[其他.md]]',
    ].join('\n'),
  }, (dir) => {
    const out = runCheck(dir, { checkAll: true });
    assert.match(out, /日期.*过旧|>.*天/);
  });
});

test('content-quality-fast: 合格文件 → 全部 ✓', () => {
  withTempKb({
    'kb/技术/Java/test.md': [
      '---',
      'title: Test',
      'description: Test file',
      '---',
      '',
      '> 最后整理: 2026-06-08 | 来源: 对话',
      '',
      '## 1. 内容',
      '',
      '```java',
      'System.out.println("hello");',
      '```',
      '',
      '相关：',
      '- [[其他.md]] — 关联',
    ].join('\n'),
  }, (dir) => {
    const out = runCheck(dir, { checkAll: true });
    assert.doesNotMatch(out, /⚠️|❌/);
  });
});
