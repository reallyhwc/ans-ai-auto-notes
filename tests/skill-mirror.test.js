'use strict';
/**
 * skill-mirror.test.js — .claude/skills ↔ .agents/skills 镜像一致性门禁
 *
 * 项目把 skill 维护在 .claude/skills/，并在 .agents/skills/ 保留一份镜像
 * （供 Codex CLI 使用）。两个目录必须保持 parity，否则行为规则双端漂移。
 * 唯一允许的差异是正文里对宿主文档名的引用：.claude 版写 CLAUDE.md，
 * .agents 版写 AGENTS.md——归一化后应完全一致。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CLAUDE_DIR = path.join(ROOT, '.claude', 'skills');
const AGENTS_DIR = path.join(ROOT, '.agents', 'skills');

const HOST = '__HOST_DOC__';

// 归一化：CLAUDE.md 与 AGENTS.md 视为同一宿主文档引用
function normalize(content) {
  return content
    .replace(/CLAUDE\.md/g, HOST)
    .replace(/AGENTS\.md/g, HOST);
}

// 列出某 skills 目录下的所有文件（相对路径，含子目录）
function listFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      for (const inner of fs.readdirSync(p).sort()) {
        out.push(path.posix.join(name, inner));
      }
    } else {
      out.push(name);
    }
  }
  return out;
}

test('skill-mirror: 两侧目录文件集合完全一致', () => {
  assert.deepEqual(
    listFiles(AGENTS_DIR),
    listFiles(CLAUDE_DIR),
    '.agents/skills 文件集合应与 .claude/skills 完全一致（含新增的 reference.md）'
  );
});

test('skill-mirror: 每个对应文件内容一致（归一化 CLAUDE.md/AGENTS.md 后）', () => {
  const files = listFiles(CLAUDE_DIR);
  const mismatches = [];
  for (const rel of files) {
    const a = fs.readFileSync(path.join(CLAUDE_DIR, rel), 'utf8');
    const b = fs.readFileSync(path.join(AGENTS_DIR, rel), 'utf8');
    if (normalize(a) !== normalize(b)) {
      mismatches.push(rel);
    }
  }
  assert.deepEqual(
    mismatches,
    [],
    `镜像漂移文件（除 CLAUDE.md/AGENTS.md 引用差异外必须一致）：\n${mismatches.join('\n')}`
  );
});
