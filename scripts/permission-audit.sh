#!/bin/bash
# 权限审计 —— 扫描项目脚本和常用命令，对比 settings.local.json allowlist
# 找出"应该加白但还没加"的安全命令，减少重复审批
# 由 Stop hook 触发
set -uo pipefail

cd "$(dirname "$0")/.."
SETTINGS=".claude/settings.local.json"

echo ""
echo "========== 权限审计 =========="

# 1. 检查 scripts/ 目录下所有脚本是否都有 allowlist 条目
echo ""
echo "[1/3] 脚本权限覆盖..."

while IFS= read -r -d '' script; do
  SCRIPT_NAME=$(basename "$script")
  # 检查 allowlist 中是否有对应的 Bash 条目
  if ! grep -q "$SCRIPT_NAME" "$SETTINGS" 2>/dev/null; then
    echo "  ⚠️  缺少权限: Bash(bash scripts/$SCRIPT_NAME *)"
  fi
done < <(find scripts -name "*.sh" -print0 2>/dev/null)

# 2. 检查常用安全 git 命令是否在 allowlist 中
echo ""
echo "[2/3] Git 只读命令覆盖..."

SAFE_GIT_COMMANDS=(
  "Bash(git status *)"
  "Bash(git diff *)"
  "Bash(git log *)"
  "Bash(git branch *)"
  "Bash(git remote *)"
  "Bash(git stash list *)"
)

for cmd in "${SAFE_GIT_COMMANDS[@]}"; do
  # 提取命令模式用于匹配
  PATTERN=$(echo "$cmd" | sed 's/(/\\\\(/g' | sed 's/)/\\\\)/g' | sed 's/\*/.\*/g')
  if ! grep -q "$PATTERN" "$SETTINGS" 2>/dev/null; then
    echo "  💡 建议添加: $cmd"
  fi
done

# 3. 检查是否有新脚本本次新增但未加白
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
