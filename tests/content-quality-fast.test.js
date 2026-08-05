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

// 合格 fixture 用的"近期日期"——动态取今天，避免硬编码日期随时间过期导致 flaky
const today = new Date();
const recentDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

test('content-quality-fast: 缺交叉链接 → 警告', () => {
  withTempKb({
    'kb/技术/Java/test.md': [
      '---',
      'title: Test',
      'description: Test file',
      '---',
      '',
      `> 最后整理: ${recentDate} | 来源: 对话`,
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
      `> 最后整理: ${recentDate} | 来源: 对话`,
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
      `> 最后整理: ${recentDate} | 来源: 对话`,
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
      `> 最后整理: ${recentDate} | 来源: 对话`,
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

// 回归测试：原 `git diff HEAD~1` 只覆盖最近 1 个 commit，多 commit session 会漏更早的 commit
// 修复：基线优先 .last-checkpoint，退回"今天最早 commit 的父提交"，覆盖整个今日 session。
test('content-quality-fast: 默认模式覆盖多 commit session + 未跟踪新文件', () => {
  withTempKb({}, (dir) => {
    const freshDate = recentDate;
    function kbFile(title) {
      return [
        '---',
        `title: ${title}`,
        'description: Test file',
        '---',
        '',
        `> 最后整理: ${freshDate} | 来源: 对话`,
        '',
        '## 1. 内容',
        '',
        '```js',
        'console.log(1);',
        '```',
        // 故意缺交叉链接 → 每个文件都会报 ⚠️ 带路径，便于断言"被检查到"
      ].join('\n');
    }
    // commit 1（首个 session commit）
    const aPath = path.join(dir, 'kb/技术/Java/committed-a.md');
    fs.mkdirSync(path.dirname(aPath), { recursive: true });
    fs.writeFileSync(aPath, kbFile('A'));
    execSync('git add -A && git commit -m "commit1"', { cwd: dir, stdio: 'pipe' });
    // commit 2
    const bPath = path.join(dir, 'kb/技术/Java/committed-b.md');
    fs.writeFileSync(bPath, kbFile('B'));
    execSync('git add -A && git commit -m "commit2"', { cwd: dir, stdio: 'pipe' });
    // 未跟踪新文件
    fs.writeFileSync(path.join(dir, 'kb/技术/Java/new-c.md'), kbFile('C'));

    const out = runCheck(dir, {}); // 默认模式（非 CQF_CHECK_ALL）
    assert.match(out, /committed-a\.md/, 'commit 1 的文件应被检查到');
    assert.match(out, /committed-b\.md/, 'commit 2 的文件应被检查到');
    assert.match(out, /new-c\.md/, '未跟踪新文件应被检查到');
  });
});
