#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { foldEvents } = require('./lib-agent-log.js');

const logDir = process.env.AGENT_LOG_DIR || path.join(__dirname, '..', 'logs', 'agent-runs');
const d = new Date();
const mm = String(d.getMonth() + 1).padStart(2, '0');
const logFile = path.join(logDir, `${d.getFullYear()}-${mm}.jsonl`);

if (!fs.existsSync(logFile)) {
  console.log('  ✓ 无当月 agent-log 文件');
  process.exit(0);
}

const content = fs.readFileSync(logFile, 'utf8');
const events = content.split('\n').filter(l => l.trim()).flatMap(l => {
  try { return [JSON.parse(l)]; } catch { return []; }
});

const records = foldEvents(events);
// 未 patch 判定（subagent only）：
//   1. title 缺失（null/undefined）— 自动派生拿不到 + AI 未手动补
//   2. needs_manual_patch === true — final_text 是结构化块（VERDICT/JSON），title 无法自动派生，
//      即使 AI 后续 patch 了 title 但未清除此 flag，仍报（提示 flag 清除纪律）
const unpatched = records.filter(r =>
  r.agent !== 'main' &&
  (r.title === null || r.title === undefined || r.needs_manual_patch === true)
);

if (unpatched.length === 0) {
  console.log('  ✓ 所有 subagent run 均已 patch');
} else {
  console.log(`  ⚠️  ${unpatched.length} 个 subagent run 未 patch（title 缺失或 needs_manual_patch）：`);
  for (const r of unpatched) {
    const reasons = [];
    if (r.title === null || r.title === undefined) reasons.push('title缺失');
    if (r.needs_manual_patch === true) reasons.push('结构化块待patch');
    console.log(`    ${r.id} | agent=${r.agent} | time=${r.time} | ${reasons.join('+')}`);
  }
}
