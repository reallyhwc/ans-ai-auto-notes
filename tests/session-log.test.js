'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 防御性设计：subprocess 显式锚定 GIT_DIR/GIT_WORK_TREE 到 temp dir，
// 即使 cwd 传递异常也不会让 git 走 .git 向上搜索而污染外层仓库。
function shInTempRepo(commands) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sl-test-')));
  const scriptSrc = path.resolve(__dirname, '..', 'scripts', 'session-log.sh');
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(scriptSrc, path.join(dir, 'scripts', 'session-log.sh'));
  fs.mkdirSync(path.join(dir, '.claude', 'session-logs'), { recursive: true });
  const isolatedEnv = {
    ...process.env,
    GIT_DIR: path.join(dir, '.git'),
    GIT_WORK_TREE: dir,
  };
  execSync('git init -q && git config user.email t@t && git config user.name t', { cwd: dir, env: isolatedEnv });
  fs.writeFileSync(path.join(dir, 'a.txt'), 'init');
  execSync('git add a.txt && git commit -q -m init', { cwd: dir, env: isolatedEnv });
  try {
    const result = execSync(commands, { cwd: dir, env: isolatedEnv, encoding: 'utf-8' });
    return { result, dir };
  } finally {
    // 同步清理，避免 setTimeout 在 worker 退出/重用前未触发导致泄漏
    fs.rmSync(dir, { recursive: true, force: true });
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

// 回归测试：bash 3.2 (macOS 默认) 全角字符紧贴变量名导致 unbound variable
// 复现命令：bash -c 'set -u; X=5; echo "$X）"' → bash: X：unbound variable
// 修复：用 ${X}） 显式 brace 边界
// 之前的 --quiet 测试都绕过了 line 26 的 echo 路径，本测试覆盖非 quiet 路径
test('session-log: 非 quiet 路径在 bash 3.2 下不应触发 unbound variable（line 26 全角字符 bug）', () => {
  const { result } = shInTempRepo(`
    for i in 1 2 3; do echo "$i" >> a.txt && git add a.txt && git commit -q -m "c$i"; done
    git rev-parse HEAD > .claude/session-logs/.last-checkpoint
    # <5 commit 增量，会跑到 line 26 的 echo（非 quiet 路径）
    for i in 4 5 6; do echo "$i" >> a.txt && git add a.txt && git commit -q -m "c$i"; done
    # 不带 --quiet，触发 line 26 echo
    bash scripts/session-log.sh 2>&1
  `);
  // 期望：echo 正常输出（不抛 unbound variable），且包含跳过信息
  assert.ok(result.includes('跳过'), 'echo 输出应含「跳过」字样: ' + result);
  assert.ok(!result.includes('unbound variable'), 'bash 3.2 不应抛 unbound variable: ' + result);
});
