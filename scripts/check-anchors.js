#!/usr/bin/env node
/**
 * check-anchors.js — 锚点存活检查
 *
 * 扫描 kb/ 下所有 md 文件，对每个含 #anchor 的链接，验证目标文件中存在对应标题。
 * 使用 lib.js 的 slugify + stripInline 计算 anchor，与浏览器渲染逻辑保持一致。
 *
 * 用法: node scripts/check-anchors.js [root_dir]
 * 退出码: 始终 0（警告级别，不阻断 SessionStart）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { slugify, stripInline, resolveRelativeMd } = require('./lib.js');

function walkMd(dir) {
  const result = [];
  function walk(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.md')) result.push(full);
    }
  }
  walk(dir);
  return result;
}

function extractHeadings(content) {
  const slugs = new Set();
  let inCode = false;
  content.split('\n').forEach(line => {
    if (/^```/.test(line)) { inCode = !inCode; return; }
    if (inCode) return;
    const m = /^(#{1,6})\s(.+)$/.exec(line);
    if (m) slugs.add(slugify(stripInline(m[2])));
  });
  return slugs;
}

function findBrokenAnchors(root) {
  const broken = [];
  const files = walkMd(root);
  const headingCache = new Map();

  function slugsOf(abs) {
    if (!headingCache.has(abs)) {
      headingCache.set(abs, extractHeadings(fs.readFileSync(abs, 'utf-8')));
    }
    return headingCache.get(abs);
  }

  files.forEach(srcAbs => {
    const srcRel = path.relative(root, srcAbs);
    const content = fs.readFileSync(srcAbs, 'utf-8');
    // 跳过 fenced code block：示例文本里的伪链接不是真链接，否则会误报
    let inCode = false;
    const scan = content.split('\n').map(line => {
      if (/^```/.test(line)) { inCode = !inCode; return ''; }
      return inCode ? '' : line;
    }).join('\n');

    // (a) 跨文件锚点：](./b.md#x) 与 ](<./b.md#x>) 两种写法
    const crossRe = /\]\(<?([^)>\n#]+\.md)#([^)>\n]+?)>?\)/g;
    // (b) 同文件锚点：](#x) —— 2026-09 审计发现此类此前被整类漏检
    //     （RocketMQ 6 处 / LLM 2 处 / MCP 1 处 / Skills 1 处因此静默失效）
    const sameRe = /\]\(#([^)\s]+)\)/g;

    let m;
    while ((m = crossRe.exec(scan))) {
      const resolved = resolveRelativeMd(srcRel, m[1]);
      const targetAbs = path.join(root, resolved.path);
      if (!fs.existsSync(targetAbs)) continue; // 死链由 check-links / arch-lint 报
      if (!slugsOf(targetAbs).has(m[2])) {
        broken.push({ source: srcAbs, target: resolved.path, anchor: m[2] });
      }
    }
    while ((m = sameRe.exec(scan))) {
      if (!slugsOf(srcAbs).has(m[1])) {
        broken.push({ source: srcAbs, target: srcRel, anchor: m[1] });
      }
    }
  });
  return broken;
}

function main() {
  const root = process.argv[2] || path.resolve(__dirname, '..', 'kb');
  const broken = findBrokenAnchors(root);
  if (broken.length === 0) {
    console.log('  ✓ 所有 anchor 链接有效');
  } else {
    broken.forEach(b => {
      console.log('  ⚠️  ' + b.source);
      console.log('      → ' + b.target + '#' + b.anchor + ' (anchor 不存在)');
    });
  }
  console.log('  结果: ' + broken.length + ' 个失效 anchor');
  process.exit(0); // 警告级，不阻断
}

if (require.main === module) main();

module.exports = { findBrokenAnchors, extractHeadings };
