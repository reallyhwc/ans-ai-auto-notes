#!/usr/bin/env node
// list-open-plans.js — 扫描 plans 目录，列出未完成的 plan
// 状态识别（按优先级）：frontmatter status -> > 状态: xxx -> 无 = 开放
// closed 状态: 已完成 / completed / done / closed（大小写不敏感）
'use strict';

const fs = require('fs');
const path = require('path');

const CLOSED_STATES = new Set(['已完成', 'completed', 'done', 'closed']);

function extractStatus(content) {
  if (content.startsWith('---')) {
    const end = content.indexOf('---', 3);
    if (end > 0) {
      const yaml = content.substring(3, end);
      const m = yaml.match(/^status:\s*["']?(.+?)["']?\s*$/m);
      if (m) return m[1].trim();
    }
  }
  const m = content.match(/^>\s*状态:\s*(.+)$/m);
  if (m) return m[1].trim();
  return '';
}

function listOpenPlans(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  const open = [];
  files.forEach(f => {
    const full = path.join(dir, f);
    const content = fs.readFileSync(full, 'utf-8');
    const status = extractStatus(content);
    if (!CLOSED_STATES.has(status.toLowerCase())) {
      open.push({ file: full, status: status || '(未知)' });
    }
  });
  return open;
}

function main() {
  const dir = process.argv[2] || path.resolve(__dirname, '..', 'docs', 'superpowers', 'plans');
  const open = listOpenPlans(dir);
  if (open.length === 0) {
    console.log('  ✓ 无进行中的 plan');
  } else {
    open.forEach(p => {
      console.log('  📋 ' + path.basename(p.file) + ' — 状态: ' + p.status);
    });
  }
}

if (require.main === module) main();

module.exports = { listOpenPlans, extractStatus };
