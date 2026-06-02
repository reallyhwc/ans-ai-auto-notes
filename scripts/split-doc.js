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

// 把 md 按 ## 切段，返回 { prologue, sections }
// prologue: 首个 ## 之前的所有内容（含 h1 + lead text），不属于任何 section
// sections: [{title, body, raw}]
function parseH2Sections(content) {
  const lines = content.split('\n');
  const sections = [];
  let current = null;
  let prologue = '';
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) { inCode = !inCode; }
    if (!inCode) {
      const m = /^##\s(.+)$/.exec(line);
      if (m) {
        if (current) sections.push(current);
        current = { title: m[1].trim(), raw: '' };
        continue;
      }
    }
    if (current) {
      current.raw += line + '\n';
    } else {
      prologue += line + '\n';
    }
  }
  if (current) sections.push(current);
  sections.forEach(s => {
    s.body = s.raw;  // body 不含 ## 标题行
    s.raw = '## ' + s.title + '\n' + s.body;
  });
  return { prologue, sections };
}

// 检测剩余章节是否都是 `## N. ...` 样式；是则重编号从 1 开始
function renumberH2Sections(sections) {
  const numberedPattern = /^(\d+)\.\s(.+)$/;
  // 只有所有 section 都是 N. 样式时才重编号（混合样式不动）
  const allNumbered = sections.length > 0 && sections.every(s => numberedPattern.test(s.title));
  if (!allNumbered) return sections;
  return sections.map((s, idx) => {
    const m = numberedPattern.exec(s.title);
    const newTitle = (idx + 1) + '. ' + m[2];
    return {
      ...s,
      title: newTitle,
      raw: '## ' + newTitle + '\n' + s.body,
    };
  });
}

// YAML 安全转义：title 含双引号时转义为 \"
function escapeYamlString(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
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
  const { prologue, sections } = parseH2Sections(body);
  const titleSet = new Set(sections.map(s => s.title));
  // 验证章节存在
  for (const t of sectionTitles) {
    if (!titleSet.has(t)) {
      throw new Error('章节未找到: ' + t + '（可用：' + [...sections.map(s => s.title)].join('，') + '）');
    }
  }
  // 生成新文件 + 收集要移除的章节
  const removed = new Set(sectionTitles);
  const newFiles = [];
  sectionTitles.forEach(t => {
    const sec = sections.find(s => s.title === t);
    // sanitize 后的名字同时用于 fname 和 frontmatter title（保持一致）
    const safeName = sanitizeFilename(t);
    const fname = safeName + '.md';
    const fpath = path.join(dir, fname);
    if (fs.existsSync(fpath)) {
      throw new Error('输出文件已存在: ' + fpath);
    }
    const safeNameYaml = escapeYamlString(safeName);
    const sourceFnYaml = escapeYamlString(path.basename(filePath));
    const newFm = '---\ntitle: "' + safeNameYaml + '"\ndescription: "从 ' + sourceFnYaml + ' 拆出"\n---\n\n# ' + safeName + '\n\n' + sec.body;
    fs.writeFileSync(fpath, newFm);
    newFiles.push({ title: t, safeName: safeName, path: fpath });
  });
  // 重写原文件
  let remaining = sections.filter(s => !removed.has(s.title));
  // 如果剩余章节都是 `## N. ...` 样式，重编号防跳号（CLAUDE.md 强约束）
  remaining = renumberH2Sections(remaining);
  let newBody = fm;
  // 保留 prologue（h1 + lead text）
  if (prologue.trim()) {
    newBody += prologue.replace(/\n+$/, '') + '\n\n';
  }
  // 在保留章节前插入拆分提示
  // URL 部分只把空格 encode 成 %20（CommonMark 严格解析需要），中文字符保留可读性
  if (newFiles.length > 0) {
    newBody += '> 已拆分到：' + newFiles.map(f => {
      const urlSafeFname = path.basename(f.path).replace(/ /g, '%20');
      return '[' + f.safeName + '](./' + urlSafeFname + ')';
    }).join('、') + '\n\n';
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
