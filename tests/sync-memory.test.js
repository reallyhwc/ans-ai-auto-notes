'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function setupTwoSides() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-test-'));
  const sideA = path.join(root, 'memory-a');
  const sideB = path.join(root, 'memory-b');
  fs.mkdirSync(sideA, { recursive: true });
  fs.mkdirSync(sideB, { recursive: true });
  return { root, sideA, sideB };
}

function setMtime(file, secondsAgo) {
  const t = Date.now() / 1000 - secondsAgo;
  fs.utimesSync(file, t, t);
}

const scriptPath = path.resolve(__dirname, '..', 'scripts', 'sync-memory.sh');

test('sync-memory: 仅同步 allowlist 中的文件', () => {
  const { sideA, sideB } = setupTwoSides();
  fs.writeFileSync(path.join(sideA, 'allowed.md'), 'content from A');
  fs.writeFileSync(path.join(sideA, 'not-allowed.md'), 'should not sync');
  fs.writeFileSync(path.join(sideB, '.allowlist'), 'allowed.md\n');
  execSync(`bash "${scriptPath}" "${sideA}" "${sideB}"`, { encoding: 'utf-8' });
  assert.ok(fs.existsSync(path.join(sideB, 'allowed.md')), 'allowed.md 应同步');
  assert.ok(!fs.existsSync(path.join(sideB, 'not-allowed.md')), '不在白名单的不应同步');
});

test('sync-memory: mtime 较新者覆盖较旧者（A → B）', () => {
  const { sideA, sideB } = setupTwoSides();
  fs.writeFileSync(path.join(sideA, 'x.md'), 'A version (newer)');
  fs.writeFileSync(path.join(sideB, 'x.md'), 'B version (older)');
  setMtime(path.join(sideA, 'x.md'), 10);
  setMtime(path.join(sideB, 'x.md'), 1000);
  fs.writeFileSync(path.join(sideB, '.allowlist'), 'x.md\n');
  execSync(`bash "${scriptPath}" "${sideA}" "${sideB}"`, { encoding: 'utf-8' });
  assert.equal(fs.readFileSync(path.join(sideB, 'x.md'), 'utf-8'), 'A version (newer)');
});

test('sync-memory: mtime 较新者覆盖较旧者（B → A）', () => {
  const { sideA, sideB } = setupTwoSides();
  fs.writeFileSync(path.join(sideA, 'y.md'), 'A version (older)');
  fs.writeFileSync(path.join(sideB, 'y.md'), 'B version (newer)');
  setMtime(path.join(sideA, 'y.md'), 1000);
  setMtime(path.join(sideB, 'y.md'), 10);
  fs.writeFileSync(path.join(sideB, '.allowlist'), 'y.md\n');
  execSync(`bash "${scriptPath}" "${sideA}" "${sideB}"`, { encoding: 'utf-8' });
  assert.equal(fs.readFileSync(path.join(sideA, 'y.md'), 'utf-8'), 'B version (newer)');
});

test('sync-memory: 单边存在的文件直接复制过去', () => {
  const { sideA, sideB } = setupTwoSides();
  fs.writeFileSync(path.join(sideA, 'only-a.md'), 'only in A');
  fs.writeFileSync(path.join(sideB, '.allowlist'), 'only-a.md\nonly-b.md\n');
  fs.writeFileSync(path.join(sideB, 'only-b.md'), 'only in B');
  execSync(`bash "${scriptPath}" "${sideA}" "${sideB}"`, { encoding: 'utf-8' });
  assert.equal(fs.readFileSync(path.join(sideB, 'only-a.md'), 'utf-8'), 'only in A');
  assert.equal(fs.readFileSync(path.join(sideA, 'only-b.md'), 'utf-8'), 'only in B');
});

test('sync-memory: allowlist 注释行（#开头）跳过', () => {
  const { sideA, sideB } = setupTwoSides();
  fs.writeFileSync(path.join(sideA, 'real.md'), 'content');
  fs.writeFileSync(path.join(sideB, '.allowlist'), '# this is a comment\nreal.md\n');
  execSync(`bash "${scriptPath}" "${sideA}" "${sideB}"`, { encoding: 'utf-8' });
  assert.ok(fs.existsSync(path.join(sideB, 'real.md')));
});
