#!/usr/bin/env node
/**
 * overview.html 健康检查脚本（5 项）
 *
 * 检查项：
 *   1. JS 语法 — overview.html 中提取 <script> 段过 vm.Script 解析
 *   2. FILE_INDEX 中所有 path 对应的 md 文件真实存在
 *   3. buildFileIndex / searchKB / renderCategories 三者输出一致
 *   4. INDEX.md 列出的 .md 文件 ↔ FILE_INDEX 中的 path 双向同步
 *   5. git 暂存区不允许有 .tmp-* 文件
 *
 * 用法: node scripts/check-overview.js
 * 退出码: 0 = 全通过, 1 = 有失败
 *
 * 历史背景: 2026-05-07 修复 AI/机器学习 三层目录后沉淀的脚本，
 *   目的是防止 FILE_INDEX 结构变化时，遗漏同步 4 个遍历函数 / INDEX.md / 临时文件残留。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'overview.html');
const INDEX_MD_PATH = path.join(ROOT, 'INDEX.md');

let failed = 0;
function pass(msg) { console.log('  PASS: ' + msg); }
function fail(msg) { console.log('  FAIL: ' + msg); failed++; }
function section(title) { console.log('\n[' + title + ']'); }

// ============================================================
// 加载 overview.html，抽出关键函数
// ============================================================
const html = fs.readFileSync(HTML_PATH, 'utf-8');

function extract(re, name) {
  const m = html.match(re);
  if (!m) {
    fail('提取 ' + name + ' 失败');
    process.exit(1);
  }
  return m[0];
}

const fileIndexCode = extract(/var FILE_INDEX = \{[\s\S]*?^\};/m, 'FILE_INDEX');
const renderCategoriesCode = extract(/function renderCategories\(\)[\s\S]*?^\}/m, 'renderCategories');
const renderNodeCode = extract(/function renderNode\(node, idPrefix\)[\s\S]*?^\}/m, 'renderNode');
const buildFileIndexCode = extract(/function buildFileIndex\(\)[\s\S]*?^\}/m, 'buildFileIndex');
const searchKBCode = extract(/function searchKB\(query\)[\s\S]*?^\}/m, 'searchKB');

// ============================================================
// 检查 1: JS 语法
// ============================================================
section('1/5 JS 语法检查');
const allScriptCode = `
${fileIndexCode}
function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
${renderCategoriesCode}
${renderNodeCode}
${buildFileIndexCode}
${searchKBCode}
var main = { innerHTML: '' };
function bindTreeToggles() {}
`;
try {
  new vm.Script(allScriptCode);
  pass('提取的 5 个关键代码段语法正确');
} catch (e) {
  fail('JS 语法错误: ' + e.message);
}

// 同时整文件 <script> 段也校验一下
const scriptMatches = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
const inlineScripts = scriptMatches.filter(m => m[0].indexOf('src=') === -1).map(m => m[1]);
inlineScripts.forEach((code, i) => {
  try {
    new vm.Script(code);
    pass('inline <script> #' + (i + 1) + ' 语法正确');
  } catch (e) {
    fail('inline <script> #' + (i + 1) + ' 语法错误: ' + e.message);
  }
});

// ============================================================
// 执行代码，准备后续检查所需的数据
// ============================================================
const ctx = vm.createContext({});
const runCode = allScriptCode + '\nrenderCategories(); var __HTML = main.innerHTML; var __IDX = buildFileIndex(); var __FI = FILE_INDEX;';
try {
  vm.runInContext(runCode, ctx, { timeout: 5000 });
} catch (e) {
  fail('执行 overview.html 提取代码失败: ' + e.message);
  console.log('\n=== 检查失败 ===');
  process.exit(1);
}
const FI = ctx.__FI;
const idx = ctx.__IDX;
const renderHtml = ctx.__HTML;
const allPaths = Object.keys(idx);

// ============================================================
// 检查 2: FILE_INDEX 中所有 path 对应的 md 文件真实存在
// ============================================================
section('2/5 FILE_INDEX path 实存检查');
let missingFiles = 0;
for (const p of allPaths) {
  const abs = path.join(ROOT, p);
  if (fs.existsSync(abs)) {
    // 不打 PASS，避免刷屏
  } else {
    fail('文件不存在: ' + p);
    missingFiles++;
  }
}
if (missingFiles === 0) pass(allPaths.length + ' 个文件全部存在');

// ============================================================
// 检查 3: buildFileIndex / searchKB / renderCategories 三者一致
// ============================================================
section('3/5 三函数一致性');

// 3a. renderCategories 输出的 HTML 应包含每个 path
let renderMiss = 0;
for (const p of allPaths) {
  if (renderHtml.indexOf(p) === -1) {
    fail('renderCategories HTML 不含 path: ' + p);
    renderMiss++;
  }
}
if (renderMiss === 0) pass('renderCategories HTML 含全部 ' + allPaths.length + ' 个 path');

// 3b. searchKB 用 title 关键词应能命中（取每个文件 title 的前 2 字符做关键词）
let searchMiss = 0;
for (const p of allPaths) {
  const file = idx[p];
  if (!file || !file.title) continue;
  // 取一个稳定的子串：title 的非空白前 2 字符
  const keyword = file.title.replace(/\s+/g, '').slice(0, 2).toLowerCase();
  if (!keyword) continue;
  const results = vm.runInContext('searchKB(' + JSON.stringify(keyword) + ')', ctx);
  const hit = results.some(r => r.filePath === p);
  if (!hit) {
    fail('searchKB("' + keyword + '") 未命中 ' + p + ' (title=' + file.title + ')');
    searchMiss++;
  }
}
if (searchMiss === 0) pass('searchKB 用 title 前 2 字关键词能命中全部 ' + allPaths.length + ' 个文件');

// ============================================================
// 检查 4: INDEX.md ↔ FILE_INDEX 双向同步
// ============================================================
section('4/5 INDEX.md ↔ FILE_INDEX 双向同步');

const indexMd = fs.readFileSync(INDEX_MD_PATH, 'utf-8');
// 提取 INDEX.md 里的 [text](kb/...md) 链接路径
const indexMdPaths = new Set();
const linkRe = /\]\((kb\/[^)]+\.md)\)/g;
let m;
while ((m = linkRe.exec(indexMd)) !== null) {
  indexMdPaths.add(m[1]);
}

const fiPaths = new Set(allPaths);

// 4a. INDEX.md 中的所有路径都应在 FILE_INDEX 中
let onlyInIndex = 0;
for (const p of indexMdPaths) {
  if (!fiPaths.has(p)) {
    fail('INDEX.md 中存在但 FILE_INDEX 中缺失: ' + p);
    onlyInIndex++;
  }
}
if (onlyInIndex === 0) pass('INDEX.md ' + indexMdPaths.size + ' 个路径全部在 FILE_INDEX 中');

// 4b. FILE_INDEX 中的所有路径都应在 INDEX.md 中
let onlyInFi = 0;
for (const p of fiPaths) {
  if (!indexMdPaths.has(p)) {
    fail('FILE_INDEX 中存在但 INDEX.md 中缺失: ' + p);
    onlyInFi++;
  }
}
if (onlyInFi === 0) pass('FILE_INDEX ' + fiPaths.size + ' 个路径全部在 INDEX.md 中');

// ============================================================
// 检查 5: git 暂存区不允许有 .tmp-* 文件
// ============================================================
section('5/5 git 暂存区临时文件检查');
try {
  const staged = execSync('git diff --cached --name-only', { cwd: ROOT, encoding: 'utf-8' });
  const tmpFiles = staged.split('\n').filter(l => l.match(/(^|\/)\.tmp-/));
  if (tmpFiles.length === 0) {
    pass('git 暂存区无 .tmp-* 文件');
  } else {
    tmpFiles.forEach(f => fail('git 暂存区残留临时文件: ' + f + '（请执行 git rm --cached ' + f + '）'));
  }
} catch (e) {
  pass('跳过（不在 git 仓库中或 git 不可用）');
}

// ============================================================
// 汇总
// ============================================================
console.log('');
if (failed === 0) {
  console.log('=== ✓ 所有检查通过 ===');
  process.exit(0);
} else {
  console.log('=== ✗ ' + failed + ' 项检查失败 ===');
  process.exit(1);
}
