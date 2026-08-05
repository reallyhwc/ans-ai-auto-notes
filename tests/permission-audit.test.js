'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

// permission-audit.sh 复现测试：
//   - 脚本被判定"有权限覆盖"当且仅当 allowlist（settings.json + settings.local.json 合并）
//     中存在能匹配 `bash scripts/<name>` 的 Bash 条目（宽泛 `Bash(bash *)` / `Bash(bash scripts/* *)`
//     或精确 `Bash(bash scripts/<name> *)`）。
//   - 回归：此前只 grep settings.local.json，且把 BRE `\(` `\)` 当字面括号（实际是分组定界符），
//     导致正则永远匹配不到，hook 迁移到共享 settings.json 后每次 Stop 误报 7 条"缺权限"。

function setupDir({ settingsJson = null, settingsLocal = null, scripts = ['verify-claim.sh', 'hook-logger.sh'] }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-test-'));
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  for (const s of scripts) {
    fs.writeFileSync(path.join(dir, 'scripts', s), '#!/bin/bash\necho x\n');
  }
  const src = path.resolve(__dirname, '..', 'scripts', 'permission-audit.sh');
  fs.copyFileSync(src, path.join(dir, 'scripts', 'permission-audit.sh'));
  if (settingsJson) fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), JSON.stringify(settingsJson));
  if (settingsLocal) fs.writeFileSync(path.join(dir, '.claude', 'settings.local.json'), JSON.stringify(settingsLocal));
  return dir;
}

function runAudit(dir) {
  return execSync('bash scripts/permission-audit.sh', {
    cwd: dir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 10000,
  });
}

function allowList(entries) {
  return { permissions: { allow: entries } };
}

test('permission-audit: 宽泛 Bash(bash *) 覆盖所有脚本（修复前误报 7 条假阳性）', () => {
  const dir = setupDir({
    settingsLocal: allowList(['Bash(bash *)']),
  });
  try {
    const out = runAudit(dir);
    assert.match(out, /✓/, '应有覆盖通过的输出');
    assert.doesNotMatch(out, /缺(少)?权限/, '宽泛条目下不应误报缺权限');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('permission-audit: 宽泛 Bash(bash scripts/* *) 覆盖所有脚本', () => {
  const dir = setupDir({
    settingsLocal: allowList(['Bash(bash scripts/* *)']),
  });
  try {
    const out = runAudit(dir);
    assert.match(out, /✓/, '应有覆盖通过的输出');
    assert.doesNotMatch(out, /缺(少)?权限/, 'scripts/* 宽泛条目下不应误报缺权限');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('permission-audit: 精确条目只覆盖对应脚本', () => {
  const dir = setupDir({
    settingsLocal: allowList(['Bash(bash scripts/verify-claim.sh *)']),
  });
  try {
    const out = runAudit(dir);
    assert.doesNotMatch(out, /verify-claim/, '精确条目应覆盖 verify-claim.sh');
    assert.match(out, /hook-logger\.sh/, '未覆盖的脚本仍应报缺权限');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('permission-audit: settings.json（共享）与 settings.local.json 合并检查', () => {
  // hook 迁移到共享 settings.json 后，白名单条目可能在 settings.json 而非 local
  const dir = setupDir({
    settingsJson: allowList(['Bash(bash *)']),
    settingsLocal: allowList([]),
  });
  try {
    const out = runAudit(dir);
    assert.doesNotMatch(out, /缺(少)?权限/, 'settings.json 中的宽泛条目应同样算覆盖');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('permission-audit: 无任何 bash 白名单 → 全部报缺权限', () => {
  const dir = setupDir({
    settingsLocal: allowList(['Bash(git status *)']),
  });
  try {
    const out = runAudit(dir);
    assert.match(out, /缺(少)?权限/, '无 bash 条目时应报缺权限');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('permission-audit: git 只读命令已在 allowlist → 不误报建议添加', () => {
  const dir = setupDir({
    settingsLocal: allowList([
      'Bash(git status *)',
      'Bash(git diff *)',
      'Bash(git log *)',
      'Bash(git branch *)',
      'Bash(git remote *)',
      'Bash(git stash list *)',
    ]),
  });
  try {
    const out = runAudit(dir);
    assert.doesNotMatch(out, /建议添加: Bash\(git status/, '已在 allowlist 的 git 命令不应再建议添加');
    assert.doesNotMatch(out, /建议添加: Bash\(git stash/, '已在 allowlist 的 git stash list 不应再建议添加');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('permission-audit: Bash(git *) 宽泛条目覆盖所有 git 只读命令', () => {
  const dir = setupDir({
    settingsLocal: allowList(['Bash(git *)']),
  });
  try {
    const out = runAudit(dir);
    assert.doesNotMatch(out, /建议添加/, 'Bash(git *) 下不应建议添加任何 git 命令');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
