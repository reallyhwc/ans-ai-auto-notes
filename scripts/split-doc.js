#!/usr/bin/env node
/**
 * split-doc.js — 半自动拆分 KB 大文件
 *
 * 用法: node scripts/split-doc.js <file.md> --sections "章节A,章节B"
 * 行为:
 *   1. parse <file.md>，按 h2 切割
 *   2. 抽出指定章节生成新文件（文件名 = sanitizeFilename(章节)，同目录）
 *   3. 原文件留拆分提示：> 已拆分到 [章节 A.md] (...)
 *   4. 自动跑 build-index 重建 INDEX
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function sanitizeFilename(name) {
  return String(name)
    .replace(/:/g, '：')
    .replace(/[\/\\*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 把 md 按 ## 切段，返回 [{title, body, raw, startIdx, endIdx}]
function parseH2Sections(content) {
  const lines = content.split('\n');
  const sections = [];
  let current = null;
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) { inCode = !inCode; }
    if (!inCode) {
      const m = /^##\s(.+)$/.exec(line);
      if (m) {
        if (current) {
          current.endIdx = i - 1;
          sections.push(current);
        }
        current = { title: m[1].trim(), startIdx: i, endIdx: lines.length - 1, raw: '' };
        continue;
      }
    }
    if (current) {
      current.raw += line + '\n';
    }
  }
  if (current) sections.push(current);
  sections.forEach(s => {
    s.body = s.raw;  // body 不含 ## 标题行
    s.raw = '## ' + s.title + '\n' + s.body;
  });
  return sections;
}

function splitDocBySections(filePath, sectionTitles) {
  const dir = path.dirname(filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  // 分离 frontmatter
  let fm = '';
  let body = content;
  if (content.startsWith('---')) {
    const end = content.indexOf('---', 3);
    if (end > 0) {
      fm = content.substring(0, end + 3) + '\n\n';
      body = content.substring(end + 3).replace(/^\n+/, '');
    }
  }
  const sections = parseH2Sections(body);
  const titleSet = new Set(sections.map(s => s.title));
  // 验证章节存在
  for (const t of sectionTitles) {
    if (!titleSet.has(t)) {
      throw new Error('章节未找到: ' + t + '（可用：' + [...titleSet].join('，') + '）');
    }
  }
  // 生成新文件 + 收集要移除的章节
  const removed = new Set(sectionTitles);
  const newFiles = [];
  sectionTitles.forEach(t => {
    const sec = sections.find(s => s.title === t);
    const fname = sanitizeFilename(t) + '.md';
    const fpath = path.join(dir, fname);
    if (fs.existsSync(fpath)) {
      throw new Error('输出文件已存在: ' + fpath);
    }
    const newFm = '---\ntitle: "' + t + '"\ndescription: "从 ' + path.basename(filePath) + ' 拆出"\n---\n\n# ' + t + '\n\n' + sec.body;
    fs.writeFileSync(fpath, newFm);
    newFiles.push({ title: t, path: fpath });
  });
  // 重写原文件
  const remaining = sections.filter(s => !removed.has(s.title));
  let newBody = fm;
  // 在保留章节前插入拆分提示
  if (newFiles.length > 0) {
    newBody += '> 已拆分到：' + newFiles.map(f => '[' + f.title + '](./' + path.basename(f.path) + ')').join('、') + '\n\n';
  }
  newBody += remaining.map(s => s.raw).join('\n');
  fs.writeFileSync(filePath, newBody);
  return { newFiles, remaining: remaining.map(s => s.title) };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 3 || args[1] !== '--sections') {
    console.error('用法: node scripts/split-doc.js <file.md> --sections "章节A,章节B"');
    process.exit(1);
  }
  const file = args[0];
  const sections = args[2].split(',').map(s => s.trim());
  const result = splitDocBySections(file, sections);
  console.log('已拆出 ' + result.newFiles.length + ' 个新文件：');
  result.newFiles.forEach(f => console.log('  ✓ ' + f.path));
  console.log('原文件保留 ' + result.remaining.length + ' 个章节');
  // 自动重建 INDEX
  console.log('重建 INDEX...');
  execSync('node scripts/build-index.js', { stdio: 'inherit' });
}

if (require.main === module) main();

module.exports = { splitDocBySections, sanitizeFilename, parseH2Sections };
