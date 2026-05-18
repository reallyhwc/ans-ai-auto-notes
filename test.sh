#!/bin/bash
# 测试入口：跑 tests/ 下所有 *.test.js
# 使用 Node.js 22+ 内置的 node --test，零依赖
set -uo pipefail
cd "$(dirname "$0")"

echo "=== 运行测试 (node --test tests/*.test.js) ==="
# Node 22+ 的 node --test 不支持纯目录参数，要传具体文件 / glob
node --test --test-reporter=spec tests/*.test.js
