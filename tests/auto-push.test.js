const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const exitCheckPath = path.join(__dirname, '..', 'exit-check.sh');
const content = fs.readFileSync(exitCheckPath, 'utf8');

test('exit-check.sh: 自动 push 阈值应为 3（而非 5）', () => {
  // 查找阈值判断行：elif [ "$UNPUSHED_COUNT" -ge 3 ];
  assert.match(content, /\[ "\$UNPUSHED_COUNT" -ge 3 \]/,
    '阈值应为 3 个 commit 触发自动 push');
});

test('exit-check.sh: push 失败时应有 pull --rebase 重试逻辑', () => {
  // 查找 pull --rebase 逻辑
  assert.match(content, /git pull.*--rebase/,
    'push 失败后应尝试 git pull --rebase');
  assert.match(content, /retry|重试/i,
    '应有重试机制');
});

test('exit-check.sh: push 失败时应调用 PushNotification', () => {
  // 查找 PushNotification 调用
  assert.match(content, /PushNotification/,
    'push 失败时应使用 PushNotification 强提醒');
});

test('exit-check.sh: 应同时检查未 commit 文件数', () => {
  // 查找 git status --short 或类似检查
  assert.match(content, /git status.*--short|git status.*-s/,
    '应检查未 commit 的文件数');
});
