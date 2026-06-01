#!/usr/bin/env node
/**
 * build-timeline.js — 从 git log 聚合周时间线
 *
 * 用法: node scripts/build-timeline.js
 * 输出: timeline.json（构建产物，已加入 .gitignore）
 *
 * 数据流: git log -> commits -> ISO 周聚合 -> timeline.json
 * 设计原则: 零依赖；与历史 timeline.json schema 兼容（weeks[].entries[].summary + links[]）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TIMELINE_PATH = path.join(ROOT, 'timeline.json');

// 解析 git log --pretty=format:"%h|%ai|%s" 输出
function parseGitLog(raw) {
  return raw.split('\n')
    .filter(l => l.trim())
    .map(line => {
      const parts = line.split('|');
      if (parts.length < 3) return null;
      const hash = parts[0];
      const dateStr = parts[1].split(' ')[0]; // 取日期部分
      const subject = parts.slice(2).join('|');
      return { hash, date: dateStr, subject };
    })
    .filter(Boolean);
}

// ISO 周计算：(year, weekNum) — 周一为一周起始
function isoWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  // 复制并定位到周四（ISO 周以含周四的为准）
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (target.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const weekNum = 1 + Math.round((target - firstThursday) / (7 * 24 * 3600 * 1000));
  return { year: target.getUTCFullYear(), week: weekNum };
}

// 取该 ISO 周的周一和周日日期（用于显示）
function weekRangeLabel(year, weekNum) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - jan4Day);
  const mon = new Date(week1Mon);
  mon.setUTCDate(mon.getUTCDate() + (weekNum - 1) * 7);
  const sun = new Date(mon);
  sun.setUTCDate(sun.getUTCDate() + 6);
  const fmt = d => String(d.getUTCMonth() + 1).padStart(2, '0') + '.' + String(d.getUTCDate()).padStart(2, '0');
  const weekStr = String(weekNum).padStart(2, '0');
  return year + '-W' + weekStr + ' (' + fmt(mon) + ' - ' + fmt(sun) + ')';
}

// 按周聚合
function aggregateByWeek(commits) {
  const byWeek = new Map();
  for (const c of commits) {
    const { year, week } = isoWeek(c.date);
    const key = year + '-' + String(week).padStart(2, '0');
    if (!byWeek.has(key)) {
      byWeek.set(key, {
        week: weekRangeLabel(year, week),
        sortKey: key,
        entries: [],
      });
    }
    byWeek.get(key).entries.push({
      date: c.date,
      summary: c.subject,
      links: [],
    });
  }
  // 按 sortKey 倒序（最新周在前）
  return Array.from(byWeek.values())
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    .map(w => { delete w.sortKey; return w; });
}

function main() {
  console.log('[build-timeline] 提取 git log...');
  const raw = execSync(
    'git log --since="6 months ago" --pretty=format:"%h|%ai|%s"',
    { cwd: ROOT, encoding: 'utf-8' }
  );
  const commits = parseGitLog(raw);
  console.log('[build-timeline] 解析 ' + commits.length + ' 个 commit');
  const weeks = aggregateByWeek(commits);
  fs.writeFileSync(TIMELINE_PATH, JSON.stringify(weeks, null, 2) + '\n', 'utf-8');
  console.log('[build-timeline] 已生成 timeline.json (' + weeks.length + ' 周)');
}

if (require.main === module) {
  main();
}

module.exports = { parseGitLog, aggregateByWeek, isoWeek, weekRangeLabel };
