'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { aggregateByWeek, parseGitLog } = require('../scripts/build-timeline.js');

test('parseGitLog: 解析 git log 格式 (hash|date|subject)', () => {
  const raw = 'abc123|2026-05-28 10:00:00 +0800|docs: 新增 X\n' +
              'def456|2026-05-29 11:00:00 +0800|fix: 修复 Y\n';
  const commits = parseGitLog(raw);
  assert.equal(commits.length, 2);
  assert.equal(commits[0].hash, 'abc123');
  assert.equal(commits[0].subject, 'docs: 新增 X');
  assert.equal(commits[0].date, '2026-05-28');
});

test('aggregateByWeek: 按 ISO 周聚合 commits', () => {
  const commits = [
    { hash: 'a1', date: '2026-05-25', subject: 'feat: A' },  // W22 Mon
    { hash: 'a2', date: '2026-05-31', subject: 'feat: B' },  // W22 Sun
    { hash: 'a3', date: '2026-06-01', subject: 'feat: C' },  // W23 Mon
  ];
  const weeks = aggregateByWeek(commits);
  assert.equal(weeks.length, 2);
  assert.ok(weeks[0].week.startsWith('2026-W23'));
  assert.equal(weeks[0].entries.length, 1);
  assert.ok(weeks[1].week.startsWith('2026-W22'));
  assert.equal(weeks[1].entries.length, 2);
});

test('aggregateByWeek: entries 含 date + summary（commit subject）', () => {
  const commits = [{ hash: 'a1', date: '2026-05-25', subject: 'docs: X' }];
  const weeks = aggregateByWeek(commits);
  assert.equal(weeks[0].entries[0].date, '2026-05-25');
  assert.equal(weeks[0].entries[0].summary, 'docs: X');
});

test('parseGitLog: 跳过日期格式非法的 commit（防止 NaN-WNaN 污染输出）', () => {
  const raw = 'abc123|2026-05-28 10:00:00 +0800|good\n' +
              'def456|bad-date|malformed\n' +
              'ghi789|2026-05-29 11:00:00 +0800|also good';
  const commits = parseGitLog(raw);
  assert.equal(commits.length, 2);
  assert.equal(commits[0].subject, 'good');
  assert.equal(commits[1].subject, 'also good');
});
