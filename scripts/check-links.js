#!/usr/bin/env node
/**
 * check-links.js — md 链接存在性检查（覆盖三种链接写法）
 *
 * 为什么单独有这个脚本：
 *   arch-lint [3/15] 只提取 `](./x.md)` 形式且只扫 kb/；
 *   integration.test.js 的正则又要求 `](` 后紧跟 `./`。
 *   于是 `](<含空格路径.md>)`（项目主流写法，全仓 300+ 处）与 `[[./x.md]]`
 *   两种链接**既不被渲染校验、也不进反链图**，死链静默累积（2026-09 审计）。
 *
 * 支持的写法：
 *   1. [文字](<./路径 含空格.md#锚点>)   —— 尖括号包裹（CommonMark 严格解析必需）
 *   2. [文字](./路径.md#锚点)            —— 标准相对路径
 *   3. [[./路径.md]] / [[路径.md|别名]]   —— 双中括号 wiki 形式
 *
 * 不检查：外链（http/mailto/ftp）与纯锚点 `](#x)`（锚点由 check-anchors.js 负责）。
 * 代码块（fenced）与行内代码里的内容一律跳过，避免把示例文本当链接。
 *
 * 用法: node scripts/check-links.js [root...]     默认 kb timeline
 * 退出码: 始终 0（警告级）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { resolveRelativeMd } = require('./lib.js');

function walkMd(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.md')) result.push(full);
    }
  })(dir);
  return result;
}

// 把 fenced code block 与行内代码挖空，只留下真实内容用于扫描
function maskCode(content) {
  let inFence = false;
  return content.split('\n').map(line => {
    if (/^\s*```/.test(line)) { inFence = !inFence; return ''; }
    if (inFence) return '';
    return line.replace(/`[^`]*`/g, m => ' '.repeat(m.length));
  }).join('\n');
}

const ANGLE_RE = /\]\(<([^>\n]+?\.md)(?:#[^>\n]*)?>\)/g;
const PLAIN_RE = /\]\(([^)<\s][^)\n]*?\.md)(?:#[^)\n]*)?\)/g;
const WIKI_RE = /\[\[([^\]|\n]+?\.md)(?:\|[^\]\n]*)?\]\]/g;

function extractLinkTargets(content) {
  const scan = maskCode(content);
  const out = [];
  let m;
  while ((m = ANGLE_RE.exec(scan))) out.push(m[1].trim());
  while ((m = PLAIN_RE.exec(scan))) out.push(m[1].trim());
  while ((m = WIKI_RE.exec(scan))) out.push(m[1].trim());
  return out.filter(Boolean);
}

function isExternal(target) {
  return /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(target) || target.startsWith('#') || target.startsWith('/');
}

function findBrokenLinks(roots) {
  const broken = [];
  for (const root of roots) {
    for (const abs of walkMd(root)) {
      const rel = path.relative(process.cwd(), abs);
      const content = fs.readFileSync(abs, 'utf-8');
      for (const target of extractLinkTargets(content)) {
        if (isExternal(target)) continue;
        const resolved = resolveRelativeMd(rel, target);
        if (!fs.existsSync(resolved.path)) {
          broken.push({ source: abs, target, resolved: resolved.path });
        }
      }
    }
  }
  return broken;
}

function main() {
  const roots = process.argv.slice(2);
  const useRoots = roots.length ? roots : ['kb', 'timeline'];
  const broken = findBrokenLinks(useRoots);
  if (broken.length === 0) {
    console.log('  ✓ 所有 md 链接指向真实文件（含 <尖括号> 与 [[wiki]] 写法）');
  } else {
    broken.forEach(b => {
      console.log('  ⚠️  ' + b.source);
      console.log('      → ' + b.target + '  (解析为 ' + b.resolved + '，不存在)');
    });
  }
  console.log('  结果: ' + broken.length + ' 个死链');
  process.exit(0); // 警告级，不阻断
}

if (require.main === module) main();

module.exports = { findBrokenLinks, extractLinkTargets, maskCode };
