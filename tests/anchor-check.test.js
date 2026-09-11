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

// ── 2026-09 审计回归：同文件锚点 ](#x) 此前整类被跳过 ──

test('findBrokenAnchors: 同文件锚点存在 -> 不报', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'),
      '## 5. 事务消息\n\n见 [§5.2](#5-2-事务消息-half-message)\n\n### 5.2 事务消息 Half Message\n');
    assert.deepEqual(findBrokenAnchors(dir), []);
  });
});

test('findBrokenAnchors: 同文件死锚点 -> 报告', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'),
      '## 2. 队列选择\n\n见 [§2.3](#23-队列选择策略)\n\n### 2.3 队列选择策略\n');
    const broken = findBrokenAnchors(dir);
    assert.equal(broken.length, 1);
    assert.equal(broken[0].anchor, '23-队列选择策略');
    assert.equal(broken[0].source.endsWith('a.md'), true);
  });
});

test('findBrokenAnchors: 尖括号形式的跨文件锚点也校验', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'), '看 [B](<./b.md#no-such-section>)');
    fs.writeFileSync(path.join(dir, 'b.md'), '## Real\n');
    const broken = findBrokenAnchors(dir);
    assert.equal(broken.length, 1);
    assert.equal(broken[0].anchor, 'no-such-section');
  });
});

test('findBrokenAnchors: 代码块内的伪锚点不误报', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'), '```\n示例 [X](#fake-anchor)\n```\n');
    assert.deepEqual(findBrokenAnchors(dir), []);
  });
});
