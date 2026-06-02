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

  files.forEach(srcAbs => {
    const srcRel = path.relative(root, srcAbs);
    const content = fs.readFileSync(srcAbs, 'utf-8');
    // 匹配 ](path.md#anchor)
    const re = /\]\((\.{0,2}\/[^)]*\.md)#([^)]+)\)/g;
    let m;
    while ((m = re.exec(content))) {
      const linkPath = m[1];
      const anchor = m[2];
      const resolved = resolveRelativeMd(srcRel, linkPath);
      const targetAbs = path.join(root, resolved.path);
      if (!fs.existsSync(targetAbs)) continue; // 死链由别的 lint 报
      let slugs;
      if (headingCache.has(targetAbs)) {
        slugs = headingCache.get(targetAbs);
      } else {
        slugs = extractHeadings(fs.readFileSync(targetAbs, 'utf-8'));
        headingCache.set(targetAbs, slugs);
      }
      if (!slugs.has(anchor)) {
        broken.push({ source: srcAbs, target: resolved.path, anchor: anchor });
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
