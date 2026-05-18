/**
 * build-index.test.js — manifest.json 数据完整性
 * 与 check-overview.js 的检查 1-2 部分重叠；这里作为 push gate 兜底，
 * 也方便单独测试 manifest 结构契约。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
