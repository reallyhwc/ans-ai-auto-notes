#!/bin/bash
# 会话退出自动检查
cd "$(dirname "$0")"

echo "========== 退出检查 =========="

echo ""
echo "[1/4] 格式检查 (markdownlint)..."
bash lint.sh

echo ""
echo "[2/4] Git 状态..."
git status --short

echo ""
echo "[3/4] INDEX.md 日期..."
grep "最后更新" INDEX.md

echo ""
echo "[4/4] overview.html 健康检查..."
node scripts/check-overview.js

echo ""
echo "========== 自动检查完成 =========="
echo "请 AI 继续完成：交叉链接检查、Memory 检查、git commit"
