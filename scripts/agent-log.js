#!/usr/bin/env node
/**
 * agent-log.js — Agent runs 日志的 CLI（目前仅 patch 子命令）
 *
 * 用法（AI 在结束工作时调用）:
 *   node scripts/agent-log.js patch --id last \
 *     --title "<本轮一句话标题>" \
 *     --summary "<干了啥>" \
 *     --outcome success|partial|blocked
 *
 *   --id last       追加 patch 到当前月份 jsonl 最后一条 start 的 id
 *   --id <full>     指定 id（如补昨天的：r-2026-06-01-...）
 *
 * 永不修改已写入行（append-only）。
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { appendEvent } = require('./lib-agent-log.js');

const ROOT = path.resolve(__dirname, '..');

function defaultLogFile() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return path.join(ROOT, 'logs', 'agent-runs', `${yyyy}-${mm}.jsonl`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      args[a.slice(2)] = argv[++i];
    } else {
      args._.push(a);
    }
  }
  return args;
}

function findLastStartId(logFile) {
  if (!fs.existsSync(logFile)) return null;
  const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(l => l.trim());
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const ev = JSON.parse(lines[i]);
      if (ev.event === 'start') return ev.id;
    } catch { /* skip malformed */ }
  }
  return null;
}

function cmdPatch(args) {
  const logFile = process.env.AGENT_LOG_FILE || defaultLogFile();

  let id = args.id;
  if (!id) { console.error('--id required'); process.exit(1); }
  if (id === 'last') {
    id = findLastStartId(logFile);
    if (!id) { console.error('no start event found in ' + logFile); process.exit(1); }
  }

  const patch = {
    event: 'patch',
    id,
    time: new Date().toISOString(),
  };
  if (args.title !== undefined) patch.title = args.title;
  if (args.summary !== undefined) patch.summary = args.summary;
  if (args.outcome !== undefined) patch.outcome = args.outcome;

  appendEvent(logFile, patch);
  console.log(`patched ${id}`);
}

function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const args = parseArgs(argv.slice(1));

  if (cmd === 'patch') return cmdPatch(args);

  console.error(`Usage:
  agent-log.js patch --id last|<id> [--title ...] [--summary ...] [--outcome success|partial|blocked]
`);
  process.exit(1);
}

main();
