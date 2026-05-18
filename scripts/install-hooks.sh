#!/bin/bash
# 一次性安装 git hooks：把 git 的 hooks 路径指向 scripts/git-hooks/
# 这样 .git/hooks/ 不需要手工管理，hooks 随仓库走
set -euo pipefail
cd "$(dirname "$0")/.."

git config core.hooksPath scripts/git-hooks
chmod +x scripts/git-hooks/*

echo "✓ Git hooks 已安装"
echo "  core.hooksPath = scripts/git-hooks"
echo ""
echo "  生效的钩子："
ls -1 scripts/git-hooks/ | sed 's/^/    - /'
echo ""
echo "  现在 git push 前会自动运行 test.sh，失败将阻断推送。"
echo "  绕过方式（不推荐）：git push --no-verify"
