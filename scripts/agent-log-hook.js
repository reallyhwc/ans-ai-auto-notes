#!/usr/bin/env node
/**
 * agent-log-hook.js — Claude Code Stop / SubagentStop hook 入口
 *
 * 用法（由 .claude/settings.local.json hook 调用，stdin 传 JSON）:
 *   node scripts/agent-log-hook.js subagent  # SubagentStop hook
 *   node scripts/agent-log-hook.js main      # Stop hook（带"实质工作"门槛）
 *
 * 环境变量:
 *   AGENT_LOG_FILE  覆盖默认日志文件路径（测试用）
 *
 * 静默策略：任何错误都不阻塞 hook 链路（catch 后 return 0）
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { generateId, appendEvent, parseTranscript, deriveAutoFields } = require('./lib-agent-log.js');

const ROOT = path.resolve(__dirname, '..');

function defaultLogFile() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return path.join(ROOT, 'logs', 'agent-runs', `${yyyy}-${mm}.jsonl`);
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function main() {
  const mode = process.argv[2];
  if (mode !== 'subagent' && mode !== 'main') {
    console.error(`Usage: agent-log-hook.js <subagent|main>`);
    process.exit(0);
  }

  const stdinStr = readStdin();
  if (!stdinStr.trim()) return;
  let stdin;
  try { stdin = JSON.parse(stdinStr); } catch { return; }

  // subagent 模式优先用 agent_transcript_path（subagent 专属），fallback transcript_path
  // 真实 Claude Code 字段（2026-06 SubagentStop schema）：
  //   agent_id / agent_type / agent_transcript_path / transcript_path / session_id
  const transcriptPath = (mode === 'subagent' && stdin.agent_transcript_path) || stdin.transcript_path;
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return;

  // main 模式前置快速判断：大 session transcript 可达 MB 级，逐行 JSON.parse 很贵。
  // 先只扫一次原始文本是否同时含 tool_use 块 + 写工具名（Edit/Write/NotebookEdit/Bash/Task），
  // 无则直接退出。语义与 parseTranscript 的 has_substantive_work 完全一致（写工具名精确匹配），
  // 只可能多跑 parse（文本里恰好提到工具名），绝不会漏报（真实 tool_use 必含 type + name 两字段）。
  if (mode === 'main') {
    try {
      const raw = fs.readFileSync(transcriptPath, 'utf8');
      if (!/"type":"tool_use"/.test(raw) || !/"name":"(?:Edit|Write|NotebookEdit|Bash|Task)"/.test(raw)) {
        return;
      }
    } catch { return; }
  }

  let parsed;
  try { parsed = parseTranscript(transcriptPath); } catch { return; }

  // main 模式：无实质工作则 skip
  if (mode === 'main' && !parsed.has_substantive_work) return;

  // agent name：真实 Claude Code 用 agent_type；旧 fixture 用 subagent_name；都没有则 unknown
  const agent = mode === 'subagent'
    ? (stdin.agent_type || stdin.subagent_name || 'unknown')
    : 'main';
  const time = new Date().toISOString();
  const auto = mode === 'subagent'
    ? deriveAutoFields(parsed)
    : { title: null, summary: null, outcome: 'unknown' };

  const event = {
    event: 'start',
    id: generateId(),
    time,
    agent,
    parent_id: null, // v1: 总是 null。spec §3.2 字段保留以便未来按"最近 main start id + 时间窗口"启发式关联，但 v1 不实现（避免误关联孤儿 main）
    tools_used: parsed.tools_used,
    files_changed: parsed.files_changed,
    duration_ms: parsed.duration_ms,
    outcome: auto.outcome,
    model: parsed.model,
    title: auto.title,
    summary: auto.summary,
    needs_manual_patch: auto.needs_manual_patch === true,
  };

  const logFile = process.env.AGENT_LOG_FILE || defaultLogFile();
  appendEvent(logFile, event);
}

try { main(); } catch { /* swallow */ }
