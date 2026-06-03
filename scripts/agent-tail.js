#!/usr/bin/env node
/**
 * agent-tail.js — Agent runs 日志的终端 viewer
 *
 * 用法:
 *   node scripts/agent-tail.js          # 当月最近 20 条
 *   node scripts/agent-tail.js -n 50    # 最近 50 条
 *   node scripts/agent-tail.js --file <jsonl>  # 指定文件（测试用）
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { foldEvents } = require('./lib-agent-log.js');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-n') args.n = parseInt(argv[++i], 10);
    else if (a.startsWith('--')) args[a.slice(2)] = argv[++i];
    else args._.push(a);
  }
  return args;
}

function defaultFile() {
  const d = new Date();
  return path.join(ROOT, 'logs', 'agent-runs', `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}.jsonl`);
}

function fmtTime(t) {
  // 2026-06-02T21:50:14+08:00 → 06-02 21:50
  const d = new Date(t);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDur(ms) {
  if (!ms) return '-';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${pad2(s % 60)}s`;
}

function pad2(n) { return String(n).padStart(2, '0'); }

function pad(s, n) {
  // 中文字符宽度=2 计算
  let w = 0;
  for (const ch of String(s)) {
    w += ch.charCodeAt(0) > 127 ? 2 : 1;
  }
  const need = n - w;
  return String(s) + (need > 0 ? ' '.repeat(need) : '');
}

function outcomeIcon(o) {
  return o === 'success' ? '✓' : (o === 'blocked' || o === 'partial' ? '✗' : '…');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = args.file || defaultFile();
  const n = args.n || 20;

  if (!fs.existsSync(file)) {
    console.log(`(no log at ${file})`);
    return;
  }

  const events = fs.readFileSync(file, 'utf8').split('\n').filter(l => l.trim())
    .flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } });
  const records = foldEvents(events).sort((a, b) => a.time.localeCompare(b.time));
  const tail = records.slice(-n);

  console.log(`${pad('时间', 14)} ${pad('agent', 18)} ${pad('标题', 40)} ${pad('耗时', 8)} outcome`);
  console.log('-'.repeat(95));
  for (const r of tail) {
    console.log(`${pad(fmtTime(r.time), 14)} ${pad(r.agent, 18)} ${pad(r.title || '-', 40)} ${pad(fmtDur(r.duration_ms), 8)} ${outcomeIcon(r.outcome)}`);
  }
}

main();
