#!/bin/bash
# 权限审计 —— 扫描项目脚本和常用命令，对比 settings.json + settings.local.json allowlist
# 找出"应该加白但还没加"的安全命令，减少重复审批
# 由 Stop hook 触发
#
# 判断逻辑（2026-08-04 重写，修复假阳性）：
#   - 合并读取 .claude/settings.json + .claude/settings.local.json 的 permissions.allow。
#     hook 已迁到共享 settings.json，只查 local 会导致每次 Stop 误报缺权限。
#   - Bash 条目按 Claude Code glob 语义判定：一条条目覆盖 `bash scripts/<name>` 当且仅当
#     去壳后的命令 glob 能匹配它。宽泛条目（Bash(bash *) / Bash(bash scripts/* *)）或
#     精确条目（Bash(bash scripts/<name> *)）都算覆盖。
#   - 修复旧 grep bug：此前把 BRE `\(` `\)` 当字面括号，但 BRE 中它们是分组定界符，
#     正则永远匹配不到 allowlist 里的 git 命令，导致已加白的命令也被"建议添加"。
#     改用 node 解析 JSON + glob 匹配，彻底绕开 shell 正则转义陷阱。
set -uo pipefail

cd "$(dirname "$0")/.."
SETTINGS=".claude/settings.local.json"

echo ""
echo "========== 权限审计 =========="

# ── 检查 1: scripts/*.sh 权限覆盖 ──
echo ""
echo "[1/3] 脚本权限覆盖..."

MISSING_SCRIPTS=$(node - <<'NODE'
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();

function loadAllow(file) {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    return (s.permissions && s.permissions.allow) || [];
  } catch { return []; }
}
const entries = loadAllow('.claude/settings.json').concat(loadAllow('.claude/settings.local.json'));

// 把 Claude Code glob（如 "bash scripts/* *"）转成正则；只有 * 是通配符
function globToRe(inner) {
  const escaped = inner.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + escaped + '$');
}
// 一条 allow 条目是否允许执行 cmd（"Bash(<cmd-glob>)" 去壳后 glob 匹配）
function isCommandAllowed(cmd) {
  return entries.some(e => {
    if (typeof e !== 'string' || !e.startsWith('Bash(') || !e.endsWith(')')) return false;
    return globToRe(e.slice(5, -1)).test(cmd);
  });
}

const scripts = fs.readdirSync(path.join(ROOT, 'scripts'))
  .filter(f => f.endsWith('.sh'))
  .sort();
const missing = scripts.filter(name => {
  const base = 'bash scripts/' + name;
  // 同时测无参和有参两种调用形式（精确条目 "Bash(bash scripts/name)" vs 带参 "Bash(bash scripts/name *)"）
  return !(isCommandAllowed(base) || isCommandAllowed(base + ' --arg'));
});
console.log(missing.join('\n'));
NODE
)

if [ -n "$MISSING_SCRIPTS" ]; then
  echo "$MISSING_SCRIPTS" | while IFS= read -r name; do
    [ -z "$name" ] && continue
    echo "  ⚠️  缺少权限: Bash(bash scripts/$name *)"
  done
else
  echo "  ✓ 所有 scripts/*.sh 均已被 allowlist 覆盖"
fi

# ── 检查 2: 常用只读 git 命令覆盖 ──
echo ""
echo "[2/3] Git 只读命令覆盖..."

MISSING_GIT=$(node - <<'NODE'
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();

function loadAllow(file) {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    return (s.permissions && s.permissions.allow) || [];
  } catch { return []; }
}
const entries = loadAllow('.claude/settings.json').concat(loadAllow('.claude/settings.local.json'));

const GIT_COMMANDS = [
  'Bash(git status *)',
  'Bash(git diff *)',
  'Bash(git log *)',
  'Bash(git branch *)',
  'Bash(git remote *)',
  'Bash(git stash list *)',
];

function globToRe(inner) {
  const escaped = inner.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + escaped + '$');
}
function isCommandAllowed(cmd) {
  return entries.some(e => {
    if (typeof e !== 'string' || !e.startsWith('Bash(') || !e.endsWith(')')) return false;
    return globToRe(e.slice(5, -1)).test(cmd);
  });
}

// 每条建议条目测对应的实际命令（去壳：Bash(git status *) → git status）
const missing = GIT_COMMANDS.filter(entry => {
  const inner = entry.slice(5, -1);      // 去 "Bash(" 前缀
  const cmd = inner.replace(/\s+\*$/, ''); // 去尾部 " *"，得到实际命令 "git status"
  return !(isCommandAllowed(cmd) || isCommandAllowed(cmd + ' --arg'));
});
console.log(missing.join('\n'));
NODE
)

if [ -n "$MISSING_GIT" ]; then
  echo "$MISSING_GIT" | while IFS= read -r entry; do
    [ -z "$entry" ] && continue
    echo "  💡 建议添加: $entry"
  done
else
  echo "  ✓ 常用只读 git 命令均已覆盖"
fi

# ── 检查 3: 本次新增脚本检查 ──
echo ""
echo "[3/3] 本次新增脚本检查..."
# 查找未跟踪的脚本文件（本次新建的）
NEW_SCRIPTS=$(git ls-files --others --exclude-standard scripts/ 2>/dev/null | grep "\.sh$")
if [ -n "$NEW_SCRIPTS" ]; then
  echo "  本次新建脚本（需要手动加白）："
  echo "$NEW_SCRIPTS" | while read s; do
    S_NAME=$(basename "$s")
    echo "    → Bash(bash scripts/$S_NAME *)"
  done
  echo ""
  echo "  💡 运行以下命令一键加白："
  echo "    python3 -c \"import json;c=json.load(open('$SETTINGS'));c['permissions']['allow'].append('Bash(bash scripts/$S_NAME *)');json.dump(c,open('$SETTINGS','w'),indent=2,ensure_ascii=False);open('$SETTINGS','a').write(chr(10))\""
else
  echo "  ✓ 无新建脚本"
fi

echo ""
echo "========== 审计完成 =========="
echo "AI 请根据以上建议，判断哪些可以安全加白并执行。"
echo "原则: 只加只读/无破坏性的命令，涉及 rm/force push/delete 的绝不加白。"
echo ""
