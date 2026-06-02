/**
 * lib-agent-log.js — Agent runs 事件日志的纯函数库
 *
 * 设计：append-only event sourcing。两种 event：
 *   - "start": agent 一轮工作结束时由 hook 写入（机械字段）
 *   - "patch": AI 在补全时机追加（语义字段：title/summary/outcome）
 *
 * 读取时按 id fold：start 为 base，按 time 顺序应用 patch。
 *
 * 测试：tests/agent-log.test.js
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// 生成 id：r-YYYY-MM-DD-HH-MM-<4hex>
// 用本地时区（与 spec 一致：time 字段是 ISO 含偏移）
function generateId(date) {
  const d = date || new Date();
  const pad = n => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const HH = pad(d.getHours());
  const MM = pad(d.getMinutes());
  const rand = crypto.randomBytes(2).toString('hex');
  return `r-${yyyy}-${mm}-${dd}-${HH}-${MM}-${rand}`;
}

// 追加一个 event 到 JSONL 文件，自动创建父目录
function appendEvent(filePath, event) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(event) + '\n');
}

// 读取 events（一个文件或拼接后的数组），按 id fold 成完整 record 列表
function foldEvents(events) {
  const starts = new Map();
  const patches = new Map();
  for (const e of events) {
    if (e.event === 'start') {
      starts.set(e.id, e);
    } else if (e.event === 'patch') {
      if (!patches.has(e.id)) patches.set(e.id, []);
      patches.get(e.id).push(e);
    }
  }
  const records = [];
  for (const [id, start] of starts) {
    const merged = Object.assign({}, start);
    const ps = (patches.get(id) || []).slice().sort((a, b) => a.time.localeCompare(b.time));
    for (const p of ps) {
      for (const k of Object.keys(p)) {
        if (k === 'event' || k === 'id' || k === 'time') continue;
        if (p[k] !== null && p[k] !== undefined) merged[k] = p[k];
      }
    }
    records.push(merged);
  }
  return records;
}

module.exports = { generateId, appendEvent, foldEvents };
