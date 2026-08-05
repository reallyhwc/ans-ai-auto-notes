#!/bin/bash
# hook-logger.sh — hook 执行包装器，记录每次执行到 JSONL
#
# 用法: bash scripts/hook-logger.sh <hook-name> <actual-command...>
# 输出: 追加一行 JSON 到 logs/hook-runs.jsonl
#
# 字段: { time, hook, command, exit_code, duration_ms }
# 设计: 透明包装，不改变原命令的 exit code 和 stdout/stderr

HOOK_NAME="${1:?Usage: hook-logger.sh <hook-name> <command...>}"
shift
CMD="$*"

LOG_FILE="${HOOK_LOG_FILE:-$(cd "$(dirname "$0")/.." && pwd)/logs/hook-runs.jsonl}"
mkdir -p "$(dirname "$LOG_FILE")"

START_MS=$(perl -MTime::HiRes=time -e 'print int(time*1000)' 2>/dev/null || echo 0)

set +e
( eval "$CMD" )
EXIT_CODE=$?
set -e

END_MS=$(perl -MTime::HiRes=time -e 'print int(time*1000)' 2>/dev/null || echo 0)
DURATION_MS=$((END_MS - START_MS))
TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 用 perl JSON::PP 写 JSON（通过 env var 传 command 避免引号注入）。
# 此前用 python3：启动 ~100ms（负载下更甚），而 macOS 自带 perl 5.34 + 核心模块 JSON::PP，
# perl 启动 ~5ms。仅 command 是任意字符串，用 JSON::PP 编码；time/hook 是安全字符、数字是整数。
HOOK_NAME="$HOOK_NAME" TIME="$TIME" EXIT_CODE="$EXIT_CODE" DURATION_MS="$DURATION_MS" \
HOOK_CMD="$CMD" LOG_FILE="$LOG_FILE" perl -MJSON::PP -e '
  my $cmd = JSON::PP->new->encode($ENV{"HOOK_CMD"});
  chomp($cmd);
  my $line = qq({"time":"$ENV{TIME}","hook":"$ENV{HOOK_NAME}","command":$cmd,"exit_code":$ENV{EXIT_CODE},"duration_ms":$ENV{DURATION_MS}});
  open my $fh, ">>", $ENV{LOG_FILE} or exit 1;
  print $fh $line, "\n";
' 2>/dev/null || true

exit $EXIT_CODE
