'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function withTempKb(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cq-test-'));
  Object.entries(files).forEach(([rel, content]) => {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  });
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const lintCmd = 'bash ' + path.resolve(__dirname, '..', 'scripts', 'check-content-quality.sh');

test('content-quality: 含 mermaid 块 -> pass', () => {
  withTempKb({
    'kb/技术/x.md': '---\ntitle: X\n---\n# X\n```mermaid\nflowchart LR\nA-->B\n```'
  }, dir => {
    const out = execSync(lintCmd, { cwd: dir, encoding: 'utf-8' });
    assert.ok(!out.includes('kb/技术/x.md'), '不应报警');
  });
});

test('content-quality: 仅纯文字 -> 警告', () => {
  withTempKb({
    'kb/技术/y.md': '---\ntitle: Y\n---\n# Y\n纯文字内容，无 demo 无表格无 mermaid'
  }, dir => {
    const out = execSync(lintCmd, { cwd: dir, encoding: 'utf-8' });
    assert.ok(out.includes('kb/技术/y.md'), '应报警');
  });
});

test('content-quality: 读书笔记/ 路径豁免', () => {
  withTempKb({
    'kb/读书笔记/book.md': '---\ntitle: Book\n---\n# Book\n纯文字感悟'
  }, dir => {
    const out = execSync(lintCmd, { cwd: dir, encoding: 'utf-8' });
    assert.ok(!out.includes('kb/读书笔记/book.md'), '白名单应豁免');
  });
});

test('content-quality: 含代码块 -> pass', () => {
  withTempKb({
    'kb/技术/z.md': '---\ntitle: Z\n---\n# Z\n```\ncode\n```'
  }, dir => {
    const out = execSync(lintCmd, { cwd: dir, encoding: 'utf-8' });
    assert.ok(!out.includes('kb/技术/z.md'));
  });
});

test('content-quality: 含表格 -> pass', () => {
  withTempKb({
    'kb/技术/t.md': '---\ntitle: T\n---\n# T\n| col1 | col2 |\n|---|---|\n| a | b |'
  }, dir => {
    const out = execSync(lintCmd, { cwd: dir, encoding: 'utf-8' });
    assert.ok(!out.includes('kb/技术/t.md'));
  });
});
