#!/bin/bash
cd "$(dirname "$0")"
echo "=== KB 格式检查 (markdownlint) ==="
npx --yes markdownlint-cli "kb/**/*.md" --config .markdownlint.json 2>&1
if [ $? -eq 0 ]; then
    echo "✓ 所有文件格式通过"
fi
