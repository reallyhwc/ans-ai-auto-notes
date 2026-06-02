'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function shInTempRepo(commands) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-test-'));
  const scriptSrc = path.resolve(__dirname, '..', 'scripts', 'session-log.sh');
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(scriptSrc, path.join(dir, 'scripts', 'session-log.sh'));
  fs.mkdirSync(path.join(dir, '.claude', 'session-logs'), { recursive: true });
  execSync('git init -q && git config user.email t@t && git config user.name t', { cwd: dir });
  fs.writeFileSync(path.join(dir, 'a.txt'), 'init');
  execSync('git add a.txt && git commit -q -m init', { cwd: dir });
  try {
    const result = execSync(commands, { cwd: dir, encoding: 'utf-8' });
    return { result, dir };
  } finally {
    setTimeout(() => fs.rmSync(dir, { recursive: true, force: true }), 100);
  }
}

test('session-log: <5 commit 增量不生成日志', () => {
  const { result } = shInTempRepo(`
    for i in 1 2 3; do echo "$i" >> a.txt && git add a.txt && git commit -q -m "c$i"; done
    git rev-parse HEAD > .claude/session-logs/.last-checkpoint
    for i in 4 5 6; do echo "$i" >> a.txt && git add a.txt && git commit -q -m "c$i"; done
    bash scripts/session-log.sh --quiet 2>&1
    ls .claude/session-logs/*.md 2>/dev/null | wc -l
  `);
  assert.equal(result.trim().split('\n').pop().trim(), '0');
});

test('session-log: ≥5 commit 增量生成日志', () => {
  const { result } = shInTempRepo(`
    git rev-parse HEAD > .claude/session-logs/.last-checkpoint
    for i in 1 2 3 4 5; do echo "$i" >> a.txt && git add a.txt && git commit -q -m "c$i"; done
    bash scripts/session-log.sh --quiet 2>&1
    ls .claude/session-logs/*.md 2>/dev/null | wc -l
  `);
  assert.equal(result.trim().split('\n').pop().trim(), '1');
});
