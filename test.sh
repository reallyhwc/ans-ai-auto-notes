#!/bin/bash
# 测试入口：跑 tests/ 下所有 *.test.js
# 使用 Node.js 20+ 内置的 node --test，零依赖
set -uo pipefail
cd "$(dirname "$0")"

# 前置兜底：build-index.test.js 依赖 manifest.json，但它在 .gitignore 中
# 新 clone 或首次 push 时 manifest 不存在，会让测试在 require 阶段直接挂掉
# 若 manifest 缺失 或 比 kb/ 旧 → 自动重建一次（静默，失败不阻断）
if [ ! -f manifest.json ]; then
  echo "[bootstrap] manifest.json 不存在，自动构建..."
  node scripts/build-index.js
elif find kb -name "*.md" -newer manifest.json 2>/dev/null | grep -q .; then
  echo "[bootstrap] manifest.json 过期，自动重建..."
  node scripts/build-index.js
fi

# 同样的兜底：timeline.json 也是构建产物（.gitignore 中），由 build-timeline.js
# 从 git log 聚合而来；check-overview 会比对 timeline/*.md 与它是否一致。
# 手写新周记（timeline/YYYY-WXX.md）后若不重建，健康检查会报"周记存在但 JSON 缺失"——
# 这里照样自动重建，避免每次都要人肉记得跑一遍。
if [ ! -f timeline.json ]; then
  echo "[bootstrap] timeline.json 不存在，自动构建..."
  node scripts/build-timeline.js
elif find timeline -name "*.md" -newer timeline.json 2>/dev/null | grep -q .; then
  echo "[bootstrap] timeline.json 过期，自动重建..."
  node scripts/build-timeline.js
fi

echo "=== 运行测试 (node --test tests/*.test.js) ==="
# Node 20+ 的 node --test 不支持纯目录参数，要传具体文件 / glob
node --test --test-reporter=spec tests/*.test.js
