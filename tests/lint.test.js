'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

const scriptPath = path.join(__dirname, '..', 'lint.sh');
const content = fs.readFileSync(scriptPath, 'utf8');

// ── 源码 grep 保底测试：确保 9 条 MD 规则都被实现 ──

test('lint.sh: 应实现 9 条 markdownlint 规则', () => {
  const rules = ['MD001', 'MD003', 'MD018', 'MD019', 'MD023', 'MD026', 'MD041', 'MD042', 'MD047'];
  for (const rule of rules) {
    assert.match(content, new RegExp(rule), `应包含 ${rule} 规则`);
  }
});

test('lint.sh: 应跳过 fenced code block 内的内容', () => {
  assert.match(content, /```|~~~/, '应检测 fenced code 边界');
  assert.match(content, /in_code/, '应有 in_code 状态变量');
});

test('lint.sh: 应检测 YAML frontmatter 并跳过', () => {
  assert.match(content, /in_fm/, '应有 in_fm 状态变量');
  assert.match(content, /fm_has_title/, '应检测 frontmatter title 字段');
});

test('lint.sh: frontmatter 有 title 时应跳过 MD041（H1 由 title 等价提供）', () => {
  assert.match(content, /fm_has_title.*MD041|MD041.*fm_has_title|!fm_has_title/, 'MD041 应受 fm_has_title 控制');
});

// ── 功能测试：用临时 kb fixture 验证关键规则 ──

function withTempKb(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-test-'));
  for (const [relPath, fileContent] of Object.entries(files)) {
    const full = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, fileContent);
  }
  // 复制 lint.sh 到临时目录根（lint.sh 用 cd "$(dirname "$0")" 定位）
  fs.copyFileSync(scriptPath, path.join(dir, 'lint.sh'));
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function runLint(dir) {
  try {
    const out = execSync('bash lint.sh', { cwd: dir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status || 1, out: (e.stdout || '') + (e.stderr || '') };
  }
}

test('lint.sh: 合格文件（frontmatter title + 规范标题）应通过', () => {
  withTempKb({
    'kb/技术/Java/test.md': [
      '---',
      'title: Test',
      'description: Test',
      '---',
      '',
      '## 1. 内容',
      '',
      '正文内容。',
      '',  // 末尾换行
    ].join('\n'),
  }, (dir) => {
    const { code, out } = runLint(dir);
    assert.equal(code, 0, `合格文件应 exit 0，实际 ${code}：${out}`);
  });
});

test('lint.sh: frontmatter 有 title 时缺少 H1 不应报 MD041', () => {
  withTempKb({
    'kb/技术/Java/test.md': [
      '---',
      'title: Test',
      '---',
      '',
      '## 1. 直接二级标题（无 H1，但 frontmatter 有 title）',
      '',
      '正文。',
      '',
    ].join('\n'),
  }, (dir) => {
    const { out } = runLint(dir);
    assert.doesNotMatch(out, /MD041/, 'frontmatter 有 title 时不应报 MD041');
  });
});

test('lint.sh: fenced code block 内的 # 注释不应误报 MD018', () => {
  withTempKb({
    'kb/技术/Java/test.md': [
      '---',
      'title: Test',
      '---',
      '',
      '## 1. 代码示例',
      '',
      '```bash',
      '#这是shell注释不是标题',
      'echo hello',
      '```',
      '',
    ].join('\n'),
  }, (dir) => {
    const { out } = runLint(dir);
    assert.doesNotMatch(out, /MD018/, 'code block 内的 # 不应误报 MD018');
  });
});

test('lint.sh: 标题 # 后缺空格应报 MD018', () => {
  withTempKb({
    'kb/技术/Java/test.md': [
      '---',
      'title: Test',
      '---',
      '',
      '##标题缺空格',
      '',
      '正文。',
      '',
    ].join('\n'),
  }, (dir) => {
    const { out } = runLint(dir);
    assert.match(out, /MD018/, '应报 MD018');
  });
});

test('lint.sh: 空链接应报 MD042', () => {
  withTempKb({
    'kb/技术/Java/test.md': [
      '---',
      'title: Test',
      '---',
      '',
      '## 1. 内容',
      '',
      '[空链接]()',
      '',
    ].join('\n'),
  }, (dir) => {
    const { out } = runLint(dir);
    assert.match(out, /MD042/, '应报 MD042 空链接');
  });
});

test('lint.sh: 文件末尾缺换行应报 MD047', () => {
  withTempKb({
    'kb/技术/Java/test.md': [
      '---',
      'title: Test',
      '---',
      '',
      '## 1. 内容',
      '',
      '正文内容。',  // 无末尾换行
    ].join('\n'),
  }, (dir) => {
    const { out } = runLint(dir);
    assert.match(out, /MD047/, '应报 MD047 末尾换行缺失');
  });
});
