#!/bin/bash
# 会话退出自动检查
cd "$(dirname "$0")"

echo "========== 退出检查 =========="

echo ""
echo "[1/3] 格式检查 (markdownlint)..."
bash lint.sh

echo ""
echo "[2/3] Git 状态..."
git status --short

echo ""
echo "[3/3] INDEX.md 日期..."
grep "最后更新" INDEX.md

echo ""
echo "========== 自动检查完成 =========="
echo "请 AI 继续完成：交叉链接检查、Memory 检查、git commit"
