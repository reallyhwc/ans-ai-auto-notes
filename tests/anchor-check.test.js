'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { findBrokenAnchors } = require('../scripts/check-anchors.js');

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anchor-test-'));
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('findBrokenAnchors: 锚点匹配现有 H2 -> 不报', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'), '看 [link](./b.md#section-one)');
    fs.writeFileSync(path.join(dir, 'b.md'), '## Section One\ncontent');
    const broken = findBrokenAnchors(dir);
    assert.deepEqual(broken, []);
  });
});

test('findBrokenAnchors: 锚点不存在 -> 报告', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'), '看 [link](./b.md#missing-section)');
    fs.writeFileSync(path.join(dir, 'b.md'), '## Real Section\ncontent');
    const broken = findBrokenAnchors(dir);
    assert.equal(broken.length, 1);
    assert.equal(broken[0].source.endsWith('a.md'), true);
    assert.equal(broken[0].anchor, 'missing-section');
  });
});

test('findBrokenAnchors: 内联代码不影响 anchor 匹配（slugify stripInline）', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'), '看 [link](./b.md#3-tool-注解的内部机制)');
    fs.writeFileSync(path.join(dir, 'b.md'), '## 3. `@Tool` 注解的内部机制');
    const broken = findBrokenAnchors(dir);
    assert.deepEqual(broken, []);
  });
});

test('findBrokenAnchors: 链接无锚点 -> 不报', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'), '看 [link](./b.md)');
    fs.writeFileSync(path.join(dir, 'b.md'), '## Section');
    const broken = findBrokenAnchors(dir);
    assert.deepEqual(broken, []);
  });
});
