#!/usr/bin/env node
/**
 * agent-report.js — Agent runs 月度报告
 *
 * 用法:
 *   node scripts/agent-report.js          # 当月
 *   node scripts/agent-report.js 2026-06  # 指定月
 *   node scripts/agent-report.js --file <jsonl>  # 指定 jsonl 文件（测试用）
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { foldEvents } = require('./lib-agent-log.js');

const ROOT = path.resolve(__dirname, '..');

function resolveFile(args) {
  if (args.file) return args.file;
  const month = args._[0] || (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  return path.join(ROOT, 'logs', 'agent-runs', `${month}.jsonl`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) args[a.slice(2)] = argv[++i];
    else args._.push(a);
  }
  return args;
}

function pad(s, n) { return String(s).padEnd(n); }

function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = resolveFile(args);

  if (!fs.existsSync(file)) {
    console.log(`(no log file at ${file})`);
    return;
  }

  const events = fs.readFileSync(file, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
  const records = foldEvents(events);
  const monthLabel = path.basename(file, '.jsonl');

  console.log(`========== Agent Runs 月报 ${monthLabel} ==========\n`);
  console.log(`总调用数: ${records.length}`);

  // 按 agent 分组
  const byAgent = {};
  for (const r of records) {
    if (!byAgent[r.agent]) byAgent[r.agent] = [];
    byAgent[r.agent].push(r);
  }
  console.log('');
  console.log('按 agent 统计:');
  console.log(`  ${pad('agent', 18)} ${pad('count', 8)} ${pad('avg_dur(s)', 12)} ${pad('success%', 10)} ${pad('blocked%', 10)}`);
  for (const a of Object.keys(byAgent).sort()) {
    const rs = byAgent[a];
    const avgDur = (rs.reduce((s, r) => s + (r.duration_ms || 0), 0) / rs.length / 1000).toFixed(1);
    const succ = rs.filter(r => r.outcome === 'success').length;
    const blocked = rs.filter(r => r.outcome === 'blocked').length;
    console.log(`  ${pad(a, 18)} ${pad(rs.length, 8)} ${pad(avgDur, 12)} ${pad((succ * 100 / rs.length).toFixed(1) + '%', 10)} ${pad((blocked * 100 / rs.length).toFixed(1) + '%', 10)}`);
  }

  // 工具使用 Top 5
  const toolCount = {};
  for (const r of records) {
    for (const t of (r.tools_used || [])) {
      toolCount[t] = (toolCount[t] || 0) + 1;
    }
  }
  console.log('');
  console.log('工具使用 Top 5:');
  Object.entries(toolCount).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([t, c]) => {
    console.log(`  ${t}: ${c}`);
  });

  // 失败/阻塞列表
  const bad = records.filter(r => r.outcome === 'blocked' || r.outcome === 'partial');
  if (bad.length) {
    console.log('');
    console.log('失败/阻塞记录:');
    for (const r of bad) {
      console.log(`  - ${r.id} ${r.agent} ${r.outcome}: ${r.title || '(no title)'}`);
    }
  }
}

main();
