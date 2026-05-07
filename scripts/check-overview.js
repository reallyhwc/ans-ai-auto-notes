#!/usr/bin/env node
/**
 * overview.html 健康检查脚本（6 项）
 *
 * 数据源: manifest.json + timeline.json（不再从 HTML 中正则提取 FILE_INDEX）
 *
 * 检查项：
 *   1. manifest.json / timeline.json 存在性 + JSON 合法性
 *   2. manifest.json 中所有 path 对应的 md 文件真实存在
 *   3. timeline.json 中所有 link.url 指向的文件真实存在
 *   4. INDEX.md 中的路径 和 manifest.json 中的路径 双向同步
 *   5. timeline 磁盘文件 和 timeline.json 双向同步
 *   6. git 暂存区不允许有 .tmp-* 文件
 *
 * 用法: node scripts/check-overview.js
 * 退出码: 0 = 全通过, 1 = 有失败
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'manifest.json');
const TIMELINE_PATH = path.join(ROOT, 'timeline.json');
const INDEX_MD_PATH = path.join(ROOT, 'INDEX.md');
const TIMELINE_DIR = path.join(ROOT, 'timeline');

let failed = 0;
function pass(msg) { console.log('  PASS: ' + msg); }
function fail(msg) { console.log('  FAIL: ' + msg); failed++; }
function section(title) { console.log('\n[' + title + ']'); }

// ============================================================
// 检查 1: manifest.json / timeline.json 存在性 + JSON 合法性
// ============================================================
section('1/6 数据文件存在性');

if (!fs.existsSync(MANIFEST_PATH)) {
  fail('manifest.json 不存在（请执行 node scripts/build-index.js）');
  console.log('\n=== 检查中止 ===');
  process.exit(1);
}
if (!fs.existsSync(TIMELINE_PATH)) {
  fail('timeline.json 不存在');
  console.log('\n=== 检查中止 ===');
  process.exit(1);
}

let manifest, timeline;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  pass('manifest.json JSON 合法');
} catch (e) {
  fail('manifest.json JSON 解析失败: ' + e.message);
  process.exit(1);
}
try {
  timeline = JSON.parse(fs.readFileSync(TIMELINE_PATH, 'utf-8'));
  pass('timeline.json JSON 合法');
} catch (e) {
  fail('timeline.json JSON 解析失败: ' + e.message);
  process.exit(1);
}

// 递归收集 manifest 中的所有 file path
function collectPaths(node) {
  const paths = [];
  if (node.files) {
    node.files.forEach(function(f) { if (f.path) paths.push(f.path); });
  }
  if (node.children) {
    node.children.forEach(function(c) { paths.push.apply(paths, collectPaths(c)); });
  }
  return paths;
}

const categories = manifest.categories || [];
const allPaths = [];
categories.forEach(function(cat) { allPaths.push.apply(allPaths, collectPaths(cat)); });

// ============================================================
// 检查 2: manifest.json 中所有 path 对应的 md 文件真实存在
// ============================================================
section('2/6 manifest.json path 实存检查');
let missingFiles = 0;
for (const p of allPaths) {
  const abs = path.join(ROOT, p);
  if (!fs.existsSync(abs)) {
    fail('文件不存在: ' + p);
    missingFiles++;
  }
}
if (missingFiles === 0) pass(allPaths.length + ' 个文件全部存在');

// ============================================================
// 检查 3: timeline.json 中所有 link.url 指向的文件真实存在
// ============================================================
section('3/6 timeline.json link 实存检查');
let timelineMissing = 0;
let timelineChecked = 0;
if (Array.isArray(timeline)) {
  timeline.forEach(function(w) {
    (w.entries || []).forEach(function(e) {
      (e.links || []).forEach(function(link) {
        if (!link.url || !link.url.startsWith('kb/')) return;
        timelineChecked++;
        const abs = path.join(ROOT, link.url);
        if (!fs.existsSync(abs)) {
          fail('timeline ' + w.week + ' 链接指向不存在的文件: ' + link.url + ' (label=' + link.label + ')');
          timelineMissing++;
        }
      });
    });
  });
}
if (timelineMissing === 0) pass('timeline.links ' + timelineChecked + ' 条 url 全部真实存在');

// ============================================================
// 检查 4: INDEX.md 和 manifest.json 双向同步
// ============================================================
section('4/6 INDEX.md 和 manifest.json 双向同步');

const indexMd = fs.readFileSync(INDEX_MD_PATH, 'utf-8');
const indexMdPaths = new Set();
const linkRe = /\]\((kb\/[^)]+\.md)\)/g;
let m;
while ((m = linkRe.exec(indexMd)) !== null) {
  indexMdPaths.add(m[1]);
}

const manifestPaths = new Set(allPaths);

let onlyInIndex = 0;
for (const p of indexMdPaths) {
  if (!manifestPaths.has(p)) {
    fail('INDEX.md 中存在但 manifest.json 中缺失: ' + p);
    onlyInIndex++;
  }
}
if (onlyInIndex === 0) pass('INDEX.md ' + indexMdPaths.size + ' 个路径全部在 manifest.json 中');

let onlyInManifest = 0;
for (const p of manifestPaths) {
  if (!indexMdPaths.has(p)) {
    fail('manifest.json 中存在但 INDEX.md 中缺失: ' + p);
    onlyInManifest++;
  }
}
if (onlyInManifest === 0) pass('manifest.json ' + manifestPaths.size + ' 个路径全部在 INDEX.md 中');

// ============================================================
// 检查 5: timeline 磁盘文件 和 timeline.json 双向同步
// ============================================================
section('5/6 timeline 磁盘 和 timeline.json 双向同步');

const diskWeeks = new Set();
if (fs.existsSync(TIMELINE_DIR)) {
  fs.readdirSync(TIMELINE_DIR)
    .filter(function(f) { return /^\d{4}-W\d{2}\.md$/.test(f); })
    .forEach(function(f) { diskWeeks.add(f.replace(/\.md$/, '')); });
}
const tlWeeks = new Set();
if (Array.isArray(timeline)) {
  timeline.forEach(function(w) {
    var wm = (w.week || '').match(/^(\d{4}-W\d{2})/);
    if (wm) tlWeeks.add(wm[1]);
  });
}

let weekDiff = 0;
for (const w of diskWeeks) {
  if (!tlWeeks.has(w)) {
    fail('timeline/' + w + '.md 存在但 timeline.json 中缺失');
    weekDiff++;
  }
}
for (const w of tlWeeks) {
  if (!diskWeeks.has(w)) {
    fail('timeline.json 中存在 ' + w + ' 但磁盘上没有 timeline/' + w + '.md');
    weekDiff++;
  }
}
if (weekDiff === 0) {
  pass('timeline ' + diskWeeks.size + ' 周文件全部双向同步');
}

// ============================================================
// 检查 6: git 暂存区不允许有 .tmp-* 文件
// ============================================================
section('6/6 git 暂存区临时文件检查');
try {
  const staged = execSync('git diff --cached --name-only', { cwd: ROOT, encoding: 'utf-8' });
  const tmpFiles = staged.split('\n').filter(function(l) { return l.match(/(^|\/)\.tmp-/); });
  if (tmpFiles.length === 0) {
    pass('git 暂存区无 .tmp-* 文件');
  } else {
    tmpFiles.forEach(function(f) { fail('git 暂存区残留临时文件: ' + f); });
  }
} catch (e) {
  pass('跳过（不在 git 仓库中或 git 不可用）');
}

// ============================================================
// 汇总
// ============================================================
console.log('');
if (failed === 0) {
  console.log('=== 全部检查通过 ===');
  process.exit(0);
} else {
  console.log('=== ' + failed + ' 项检查失败 ===');
  process.exit(1);
}
