# Agent Runs 日志

> 主/子 agent 每轮**实质工作**的事件日志。设计文档：[design spec](../../docs/superpowers/specs/2026-06-02-agent-runs-log-design.md)

## 文件组织

- 按月分文件：`YYYY-MM.jsonl`
- Append-only：永不修改已写入行
- Event sourcing：每条 record 由 1 个 `start` 事件 + 0..N 个 `patch` 事件组成，读取时按 `id` fold

## Schema

每行一个 JSON object。

### `event: "start"`（由 hook 自动写入）

| 字段 | 类型 | 说明 |
|------|------|------|
| `event` | "start" | 事件类型 |
| `id` | string | `r-YYYY-MM-DD-HH-MM-<4hex>`，全局唯一 |
| `time` | ISO 8601 | 事件时刻 |
| `agent` | string | `main` 或 subagent 名称（来自 SubagentStop 的 `agent_type` 字段） |
| `parent_id` | string \| null | v1 总是 null；未来按"最近 main start + 时间窗口"启发式关联 |
| `tools_used` | string[] | 本轮用的工具去重列表 |
| `files_changed` | string[] | Edit/Write/NotebookEdit 改的文件列表（ROOT 相对路径） |
| `duration_ms` | number | 本轮耗时（毫秒） |
| `outcome` | "unknown" | start 时固定 unknown，由后续 patch 补 |
| `model` | string | 模型 ID |
| `title` | null | 由 patch 补 |
| `summary` | null | 由 patch 补 |

### `event: "patch"`（由 AI 主动追加）

| 字段 | 类型 | 说明 |
|------|------|------|
| `event` | "patch" | |
| `id` | string | 对应的 start 事件 id |
| `time` | ISO 8601 | patch 时刻 |
| `title` | string | 一句话标题（<30 字） |
| `summary` | string | 1-3 句描述 |
| `outcome` | "success" \| "partial" \| "blocked" | 结果 |

## 怎么用

### AI 补全（手动调）

```bash
node scripts/agent-log.js patch --id last \
  --title "修复 kb 含空格 .md 链接" \
  --summary "218 处包裹为 <尖括号>，47 文件" \
  --outcome success
```

### 看月报

```bash
node scripts/agent-report.js          # 当月
node scripts/agent-report.js 2026-06  # 指定月
```

### 直接看原始日志（jq）

```bash
# 当月所有调用
cat logs/agent-runs/$(date +%Y-%m).jsonl | jq -s 'group_by(.id) | map({id: .[0].id, events: length})'

# 失败的所有任务
cat logs/agent-runs/$(date +%Y-%m).jsonl | jq -s '
  [.[] | select(.event=="patch" and .outcome=="blocked")]
'
```

## 不在这里记什么

- 用户 prompt 原文（隐私）
- 完整 transcript（太大）
- Token / cost（未来按需加）
