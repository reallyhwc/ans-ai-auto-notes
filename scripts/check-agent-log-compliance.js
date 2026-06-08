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
const unpatched = records.filter(r => r.agent !== 'main' && r.outcome === 'unknown');

if (unpatched.length === 0) {
  console.log('  ✓ 所有 subagent run 均已 patch');
} else {
  console.log(`  ⚠️  ${unpatched.length} 个 subagent run 未 patch（outcome=unknown）：`);
  for (const r of unpatched) {
    console.log(`    ${r.id} | agent=${r.agent} | time=${r.time}`);
  }
}
