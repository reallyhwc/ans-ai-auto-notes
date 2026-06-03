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

// 写入/副作用工具白名单（spec §4.2）
const WRITE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'Bash', 'Task']);
const FILE_WRITE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit']);

const ROOT = path.resolve(__dirname, '..');

// 从 transcript JSONL 文件解析机械字段
// 返回: { duration_ms, tools_used, files_changed, model, has_substantive_work }
//
// 支持两种 schema:
//   Claude Code 真实: { timestamp, type, message: { role, content, model, ... } }
//   测试 fixture (flat): { timestamp, role, content, model, ... }
//
// 跳过无 timestamp 的 meta 行（如 type=last-prompt / permission-mode）。
// file_path 若是 ROOT 下的绝对路径，归一化为相对路径。
function parseTranscript(transcriptPath) {
  const content = fs.readFileSync(transcriptPath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  const messages = lines.flatMap(l => {
    try { return [JSON.parse(l)]; } catch { return []; }
  });

  // 过滤无 timestamp 的 meta 行（Claude Code 头部的 last-prompt / permission-mode）
  const withTime = messages.filter(m => m.timestamp);
  if (withTime.length === 0) {
    return { duration_ms: 0, tools_used: [], files_changed: [], model: null, has_substantive_work: false };
  }

  const firstTime = new Date(withTime[0].timestamp).getTime();
  const lastTime = new Date(withTime[withTime.length - 1].timestamp).getTime();
  const duration_ms = lastTime - firstTime;

  const toolsSet = new Set();
  const filesSet = new Set();
  let model = null;
  let hasSubstantive = false;

  for (const m of withTime) {
    // 真实 Claude Code: message 嵌套。测试 fixture: 字段平铺。
    const msg = m.message || m;
    if (msg.role === 'assistant') {
      if (msg.model && !model) model = msg.model;
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'tool_use') {
            toolsSet.add(block.name);
            if (WRITE_TOOLS.has(block.name)) hasSubstantive = true;
            if (FILE_WRITE_TOOLS.has(block.name) && block.input && block.input.file_path) {
              let fp = block.input.file_path;
              if (path.isAbsolute(fp) && fp.startsWith(ROOT + path.sep)) {
                fp = path.relative(ROOT, fp);
              }
              filesSet.add(fp);
            }
          }
        }
      }
    }
  }

  return {
    duration_ms,
    tools_used: Array.from(toolsSet),
    files_changed: Array.from(filesSet),
    model,
    has_substantive_work: hasSubstantive,
  };
}

module.exports = { generateId, appendEvent, foldEvents, parseTranscript, WRITE_TOOLS, FILE_WRITE_TOOLS };
