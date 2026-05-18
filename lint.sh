#!/bin/bash
set -uo pipefail
cd "$(dirname "$0")"
echo "=== KB 格式检查 (markdownlint) ==="
# 用本地依赖（package.json）锁定版本，避免每次 npx 远程拉取
if [ -f node_modules/.bin/markdownlint ]; then
    LINTER="node_modules/.bin/markdownlint"
else
    echo "（未安装本地依赖，使用 npx 远程拉取；建议运行 npm install）"
    LINTER="npx --yes markdownlint-cli"
fi
$LINTER "kb/**/*.md" --config .markdownlint.json 2>&1
if [ $? -eq 0 ]; then
    echo "✓ 所有文件格式通过"
fi
