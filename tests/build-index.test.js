/**
 * build-index.test.js — manifest.json 数据完整性 + parseFrontmatter 纯函数测试
 * 与 check-overview.js 的检查 1-2 部分重叠；这里作为 push gate 兜底，
 * 也方便单独测试 manifest 结构契约 + frontmatter 解析边界。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/build-index.js');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'manifest.json');

test('manifest.json 是合法 JSON', () => {
  const raw = fs.readFileSync(MANIFEST, 'utf8');
  assert.doesNotThrow(() => JSON.parse(raw));
});

test('manifest.categories 是非空数组', () => {
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  assert.ok(Array.isArray(m.categories), 'categories 必须是数组');
  assert.ok(m.categories.length > 0, 'categories 不应为空');
});

test('每个 manifest.path 对应的 md 文件都真实存在', () => {
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  function collectPaths(node) {
    const paths = [];
    if (node.files) for (const f of node.files) if (f.path) paths.push(f.path);
    if (node.children) for (const c of node.children) paths.push(...collectPaths(c));
    return paths;
  }
  const paths = m.categories.flatMap(collectPaths);
  assert.ok(paths.length > 0, 'manifest 应至少包含 1 个文件');
  const missing = paths.filter(p => !fs.existsSync(path.join(ROOT, p)));
  assert.deepEqual(missing, [], '以下 manifest path 不存在: ' + missing.join(', '));
});

test('manifest 中每个 file 必须有 title 字段', () => {
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  function checkFiles(node, errors) {
    if (node.files) {
      for (const f of node.files) {
        if (!f.title || !f.title.trim()) errors.push(f.path || '<no path>');
      }
    }
    if (node.children) for (const c of node.children) checkFiles(c, errors);
  }
  const errors = [];
  for (const cat of m.categories) checkFiles(cat, errors);
  assert.deepEqual(errors, [], '以下文件缺 title: ' + errors.join(', '));
});

// ============================================================
// parseFrontmatter 边界用例（CLAUDE.md "软 TDD" 区域之一）
// ============================================================

test('parseFrontmatter: 标准 frontmatter 含 title + description', () => {
  const c = `---\ntitle: foo\ndescription: bar baz\n---\nbody`;
  const r = parseFrontmatter(c);
  assert.equal(r.title, 'foo');
  assert.equal(r.description, 'bar baz');
});

test('parseFrontmatter: title 含双引号包围（应剥引号）', () => {
  const c = `---\ntitle: "Quoted Title"\n---\n`;
  const r = parseFrontmatter(c);
  assert.equal(r.title, 'Quoted Title');
});

test('parseFrontmatter: title 含冒号（YAML 规范要求引号包围）', () => {
  const c = `---\ntitle: "Foo: A Bar"\n---\n`;
  const r = parseFrontmatter(c);
  assert.equal(r.title, 'Foo: A Bar');
});

test('parseFrontmatter: title 含中文 + 特殊字符 ! ?', () => {
  const c = `---\ntitle: 大模型推理实战 — 真的吗？\n---\n`;
  const r = parseFrontmatter(c);
  assert.equal(r.title, '大模型推理实战 — 真的吗？');
});

test('parseFrontmatter: title 后含尾部空格应被 trim', () => {
  const c = `---\ntitle: foo   \n---\n`;
  const r = parseFrontmatter(c);
  assert.equal(r.title, 'foo');
});

test('parseFrontmatter: 无 frontmatter 时 fallback 到首个 H1', () => {
  const c = `# My Title\n\nbody content`;
  const r = parseFrontmatter(c);
  assert.equal(r.title, 'My Title');
});

test('parseFrontmatter: frontmatter 未闭合时 fallback 到 H1', () => {
  // 缺少结尾 --- → 走 fallback 分支
  const c = `---\ntitle: should_not_use_this\nincomplete_yaml\n# Real H1\n`;
  const r = parseFrontmatter(c);
  assert.equal(r.title, 'Real H1');
});

test('parseFrontmatter: 空 content 返回空字段', () => {
  const r = parseFrontmatter('');
  assert.equal(r.title, '');
  assert.equal(r.description, '');
});

test('parseFrontmatter: 仅有 frontmatter 无 title 时从 body 提 H1', () => {
  const c = `---\ndescription: only desc\n---\n# Body H1\n`;
  const r = parseFrontmatter(c);
  assert.equal(r.title, 'Body H1');
  assert.equal(r.description, 'only desc');
});

test('parseFrontmatter: description 含等号/百分号', () => {
  const c = `---\ntitle: t\ndescription: 占比 75% = 输入 token\n---\n`;
  const r = parseFrontmatter(c);
  assert.equal(r.description, '占比 75% = 输入 token');
});
