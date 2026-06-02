'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { listOpenPlans, extractStatus } = require('../scripts/list-open-plans.js');

function withTempPlans(plans, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plans-test-'));
  Object.entries(plans).forEach(([name, content]) => {
    fs.writeFileSync(path.join(dir, name), content);
  });
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('listOpenPlans: 识别 frontmatter status 字段', () => {
  withTempPlans({
    'a.md': '---\nstatus: 进行中\n---\n# A',
    'b.md': '---\nstatus: 已完成\n---\n# B',
    'c.md': '---\nstatus: 待开始\n---\n# C',
  }, dir => {
    const open = listOpenPlans(dir);
    const names = open.map(p => path.basename(p.file));
    assert.ok(names.includes('a.md'));
    assert.ok(!names.includes('b.md'));
    assert.ok(names.includes('c.md'));
  });
});

test('listOpenPlans: 识别 "> 状态: xxx" 段', () => {
  withTempPlans({
    'a.md': '# Plan\n> 状态: 进行中\n',
    'b.md': '# Plan\n> 状态: 已完成\n',
  }, dir => {
    const open = listOpenPlans(dir);
    assert.equal(open.length, 1);
    assert.equal(path.basename(open[0].file), 'a.md');
  });
});

test('listOpenPlans: 无 status 视为开放', () => {
  withTempPlans({
    'x.md': '# Plan\n无状态字段',
  }, dir => {
    const open = listOpenPlans(dir);
    assert.equal(open.length, 1);
  });
});

test('listOpenPlans: closed 状态英文别名 (completed/done/closed)', () => {
  withTempPlans({
    'a.md': '---\nstatus: completed\n---\n',
    'b.md': '---\nstatus: DONE\n---\n',
    'c.md': '---\nstatus: closed\n---\n',
    'd.md': '---\nstatus: in-progress\n---\n',
  }, dir => {
    const open = listOpenPlans(dir);
    const names = open.map(p => path.basename(p.file)).sort();
    assert.deepEqual(names, ['d.md']);
  });
});

test('listOpenPlans: 目录不存在返回空数组', () => {
  const open = listOpenPlans('/tmp/definitely-does-not-exist-' + Date.now());
  assert.deepEqual(open, []);
});

test('extractStatus: frontmatter status 带引号', () => {
  assert.equal(extractStatus('---\nstatus: "已完成"\n---\n'), '已完成');
});
