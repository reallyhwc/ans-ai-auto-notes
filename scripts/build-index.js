#!/usr/bin/env node
/**
 * build-index.js — 单一数据源构建脚本
 *
 * 扫描 kb/ 目录，解析每个 .md 文件的 frontmatter，生成：
 *   1. manifest.json — categories 树结构（供 overview.html 运行时加载）
 *   2. INDEX.md     — 人类可读的知识库索引（自动生成，勿手改）
 *
 * 用法: node scripts/build-index.js
 *
 * 数据流: 磁盘 kb/ 下所有 .md 文件 -> frontmatter 解析 -> manifest.json + INDEX.md
 * 设计原则: KISS，目录名 = 分类名，不做映射
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const KB_DIR = path.join(ROOT, 'kb');
const MANIFEST_PATH = path.join(ROOT, 'manifest.json');
const INDEX_MD_PATH = path.join(ROOT, 'INDEX.md');

// ============================================================
// 全文搜索：分词 + 倒排表
// ============================================================

// 中英文混合分词：英文按 \w+，中文按单字（unigram）
function tokenize(text) {
  const tokens = new Set();
  // 去除代码块 ``` ... ``` 内的内容（含 mermaid）
  const stripped = String(text).replace(/```[\s\S]*?```/g, ' ');
  // 英文 token（\w+ 转小写）
  const enMatches = stripped.match(/[a-zA-Z0-9_]+/g) || [];
  enMatches.forEach(t => { if (t.length >= 2) tokens.add(t.toLowerCase()); });
  // 中文单字
  const zhMatches = stripped.match(/[一-鿿]/g) || [];
  zhMatches.forEach(c => tokens.add(c));
  return Array.from(tokens);
}

// 构建倒排表：{token: [fileIdx, ...]}
function buildSearchIndex(files) {
  const idx = {};
  files.forEach(f => {
    const tokens = tokenize(f.text);
    tokens.forEach(t => {
      if (!idx[t]) idx[t] = [];
      if (idx[t][idx[t].length - 1] !== f.idx) idx[t].push(f.idx);
    });
  });
  return idx;
}

// ============================================================
// frontmatter 解析（极简，不引入第三方依赖）
// ============================================================
function parseFrontmatter(content) {
  const result = { title: '', description: '' };
  if (!content.startsWith('---')) {
    // 无 frontmatter，fallback: 从第一行 # 提取 title
    const m = content.match(/^#\s+(.+)/m);
    if (m) result.title = m[1].trim();
    return result;
  }
  const end = content.indexOf('---', 3);
  if (end === -1) {
    const m = content.match(/^#\s+(.+)/m);
    if (m) result.title = m[1].trim();
    return result;
  }
  const yaml = content.substring(3, end);

  // 极简 YAML 解析：只取 title 和 description
  const titleMatch = yaml.match(/^title:\s*"?(.+?)"?\s*$/m);
  if (titleMatch) result.title = titleMatch[1].trim();

  const descMatch = yaml.match(/^description:\s*"?(.+?)"?\s*$/m);
  if (descMatch) result.description = descMatch[1].trim();

  // 如果 frontmatter 中没有 title，fallback 到 # 标题
  if (!result.title) {
    const body = content.substring(end + 3);
    const m = body.match(/^#\s+(.+)/m);
    if (m) result.title = m[1].trim();
  }

  return result;
}

// ============================================================
// 递归扫描目录，构建 categories 树
// ============================================================
function scanDir(dirPath, relPrefix) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const node = {
    name: path.basename(dirPath),
    path: relPrefix,
    files: [],
    children: []
  };

  // 收集 .md 文件
  entries
    .filter(e => e.isFile() && e.name.endsWith('.md') && e.name !== '.gitkeep')
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(e => {
      const filePath = path.join(dirPath, e.name);
      const content = fs.readFileSync(filePath, 'utf-8');
      const meta = parseFrontmatter(content);
      const relPath = relPrefix + e.name;
      node.files.push({
        title: meta.title || e.name.replace(/\.md$/, ''),
        path: relPath,
        desc: meta.description || ''
      });
    });

  // 递归子目录
  entries
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(e => {
      const childRel = relPrefix + e.name + '/';
      const child = scanDir(path.join(dirPath, e.name), childRel);
      // 只保留有内容的子树（有 files 或有 children）
      if (child.files.length > 0 || child.children.length > 0) {
        node.children.push(child);
      }
    });

  return node;
}

// ============================================================
// 生成 INDEX.md
// ============================================================
function generateIndexMd(categories) {
  const lines = [];
  lines.push('# 知识库索引');
  lines.push('');
  lines.push('> 由 build-index.js 自动生成（基于 kb/ 目录扫描），勿手改');
  lines.push('');

  function writeNode(node, depth) {
    // depth 0 = ##, 1 = ###, 2 = ####
    const prefix = '#'.repeat(depth + 2);
    const fileCount = countFiles(node);
    lines.push(prefix + ' ' + node.name + ' (' + fileCount + ' 篇)');
    lines.push('');

    node.files.forEach(f => {
      const desc = f.desc ? ' — ' + f.desc : '';
      lines.push('- [' + f.title + '](' + f.path + ')' + desc);
    });
    if (node.files.length > 0) lines.push('');

    node.children.forEach(child => writeNode(child, depth + 1));
  }

  categories.forEach(cat => writeNode(cat, 0));
  return lines.join('\n');
}

function countFiles(node) {
  let count = node.files.length;
  node.children.forEach(c => { count += countFiles(c); });
  return count;
}

// ============================================================
// 主流程
// ============================================================
function main() {
  console.log('[build-index] 扫描 kb/ 目录...');

  // 扫描 kb/ 下的顶层子目录作为 categories
  const topEntries = fs.readdirSync(KB_DIR, { withFileTypes: true });
  const categories = [];

  topEntries
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(e => {
      const relPath = 'kb/' + e.name + '/';
      const node = scanDir(path.join(KB_DIR, e.name), relPath);
      if (node.files.length > 0 || node.children.length > 0) {
        categories.push(node);
      }
    });

  // 统计
  let totalFiles = 0;
  categories.forEach(c => { totalFiles += countFiles(c); });

  // 构建全文搜索索引（扁平化所有 file，给每个分配 idx）
  const flatFiles = [];
  function collectFiles(node) {
    node.files.forEach(f => {
      const fullPath = path.join(ROOT, f.path);
      let content = '';
      try { content = fs.readFileSync(fullPath, 'utf-8'); } catch (e) { /* skip */ }
      flatFiles.push({
        idx: flatFiles.length,
        path: f.path,
        text: (f.title || '') + ' ' + (f.desc || '') + ' ' + content,
      });
    });
    node.children.forEach(collectFiles);
  }
  categories.forEach(collectFiles);
  const searchIndex = buildSearchIndex(flatFiles);
  const searchFiles = flatFiles.map(f => ({ idx: f.idx, path: f.path }));

  // 输出 manifest.json
  const manifest = {
    categories: categories,
    searchIndex: searchIndex,
    searchFiles: searchFiles,
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  console.log('[build-index] 已生成 manifest.json (' + totalFiles + ' 个文件, ' + categories.length + ' 个顶层分类)');

  // 输出 INDEX.md
  const indexMd = generateIndexMd(categories);
  fs.writeFileSync(INDEX_MD_PATH, indexMd + '\n', 'utf-8');
  console.log('[build-index] 已生成 INDEX.md');

  console.log('[build-index] 完成');
}

// 作为 CLI 执行时运行 main；作为模块 require 时仅导出函数（供单测）
if (require.main === module) {
  main();
}

module.exports = { parseFrontmatter, scanDir, countFiles, generateIndexMd, tokenize, buildSearchIndex };
