#!/usr/bin/env node
/**
 * overview.html 健康检查脚本（11 项）
 *
 * 数据源: manifest.json + timeline.json + overview.html + CLAUDE.md + kb/ 磁盘
 *
 * 检查项（前 6 项为原有，7-11 为踩坑经验新增，12 为 CLAUDE.md 行数规则落地）：
 *   1. manifest.json / timeline.json 存在性 + JSON 合法性
 *   2. manifest.json 中所有 path 对应的 md 文件真实存在
 *   3. timeline.json 中所有 link.url 指向的文件真实存在（含非 kb/ 路径）
 *   4. INDEX.md 中的路径 和 manifest.json 中的路径 双向同步
 *   5. timeline 磁盘文件 和 timeline.json 双向同步
 *   6. git 暂存区不允许有 .tmp-* 文件
 *   7. overview.html 必须引用 app.js 和 marked.js（防白屏）
 *   8. scripts/app.js 存在性检查（防白屏）
 *   9. CLAUDE.md 目录结构与磁盘 kb/ 一致性检查（防 AI 幻觉）
 *  10. 所有 kb/ 下 md 文件必须有 frontmatter title（防标题为空）
 *  11. overview.html 不应包含内联 JS 函数定义（防拆分后残留代码）
 *  12. kb/ 下 md 文件行数 >1000 警告 / >1500 失败（CLAUDE.md 文件拆分阈值）
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
section('1/12 数据文件存在性');

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
section('2/12 manifest.json path 实存检查');
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
section('3/12 timeline.json link 实存检查');
let timelineMissing = 0;
let timelineChecked = 0;
if (Array.isArray(timeline)) {
  timeline.forEach(function(w) {
    (w.entries || []).forEach(function(e) {
      (e.links || []).forEach(function(link) {
        if (!link.url) return;
        // 踩坑经验：非 kb/ 路径（如 CLAUDE.md、docs/）也必须检查
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
section('4/12 INDEX.md 和 manifest.json 双向同步');

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
section('5/12 timeline 磁盘 和 timeline.json 双向同步');

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
section('6/12 git 暂存区临时文件检查');
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
// 以下 7-11 项为踩坑经验新增（TDD 驱动）
// ============================================================

// ============================================================
// 检查 7: overview.html 必须引用 app.js 和 marked.js（防白屏）
// 踩坑：JS 拆分后 overview.html 如果没引用 app.js 或 marked.js，页面白屏
// ============================================================
section('7/12 overview.html 脚本引用完整性（防白屏）');
const OVERVIEW_PATH = path.join(ROOT, 'overview.html');
const overviewHtml = fs.readFileSync(OVERVIEW_PATH, 'utf-8');
const requiredScripts = ['scripts/app.js', 'marked', 'mermaid'];
let scriptMissing = 0;
requiredScripts.forEach(function(s) {
  if (!overviewHtml.includes(s)) {
    fail('overview.html 缺少脚本引用: ' + s);
    scriptMissing++;
  }
});
if (scriptMissing === 0) pass('overview.html 引用了 app.js / marked / mermaid');

// ============================================================
// 检查 8: scripts/app.js 存在性检查（防白屏）
// 踩坑：app.js 被误删或未创建，overview.html 白屏
// ============================================================
section('8/12 scripts/app.js 存在性');
const APP_JS_PATH = path.join(ROOT, 'scripts', 'app.js');
if (fs.existsSync(APP_JS_PATH)) {
  pass('scripts/app.js 存在');
} else {
  fail('scripts/app.js 不存在（overview.html 会白屏）');
}

// ============================================================
// 检查 9: CLAUDE.md 目录结构与磁盘 kb/ 一致性（防 AI 幻觉）
// 踩坑：目录重命名（action→实战、ai→AI）后 CLAUDE.md 没同步，
//       下次 AI 读 CLAUDE.md 会按旧路径操作导致错误
// ============================================================
section('9/12 CLAUDE.md 目录结构与磁盘一致性');
const CLAUDE_MD = path.join(ROOT, 'CLAUDE.md');
if (fs.existsSync(CLAUDE_MD)) {
  const claudeContent = fs.readFileSync(CLAUDE_MD, 'utf-8');
  // 提取 CLAUDE.md 中代码块内提到的 kb/ 子目录名
  const claudeDirs = [];
  const dirRe = /│\s+(?:├──|└──)\s+(\S+)\//g;
  let dm;
  while ((dm = dirRe.exec(claudeContent)) !== null) {
    claudeDirs.push(dm[1]);
  }
  // 获取磁盘上 kb/ 的直接子目录
  const KB_DIR = path.join(ROOT, 'kb');
  const diskKbDirs = fs.readdirSync(KB_DIR, { withFileTypes: true })
    .filter(function(d) { return d.isDirectory() && !d.name.startsWith('.'); })
    .map(function(d) { return d.name; });
  // 检查磁盘上的目录是否都在 CLAUDE.md 中提到
  let claudeMismatch = 0;
  diskKbDirs.forEach(function(d) {
    if (!claudeDirs.includes(d)) {
      fail('磁盘 kb/' + d + '/ 存在但 CLAUDE.md 中未提及');
      claudeMismatch++;
    }
  });
  if (claudeMismatch === 0) pass('CLAUDE.md 目录结构与磁盘 kb/ 的 ' + diskKbDirs.length + ' 个子目录一致');
} else {
  pass('跳过（CLAUDE.md 不存在）');
}

// ============================================================
// 检查 10: 所有 kb/ 下 md 文件必须有 frontmatter title（防标题为空）
// 踩坑：新增 md 文件忘记写 frontmatter，manifest 中标题为空白
// ============================================================
section('10/12 kb/ md 文件 frontmatter title 检查');
let noTitle = 0;
for (const p of allPaths) {
  const abs = path.join(ROOT, p);
  if (!fs.existsSync(abs)) continue;
  const content = fs.readFileSync(abs, 'utf-8');
  const hasFrontmatterTitle = content.startsWith('---') &&
    content.indexOf('---', 3) > 3 &&
    /^title:\s*.+/m.test(content.substring(0, content.indexOf('---', 3)));
  const hasH1Title = /^#\s+.+/m.test(content);
  if (!hasFrontmatterTitle && !hasH1Title) {
    fail('缺少 title: ' + p + '（无 frontmatter title 且无 # 标题）');
    noTitle++;
  }
}
if (noTitle === 0) pass(allPaths.length + ' 个 md 文件全部有 title');

// ============================================================
// 检查 11: overview.html 不应包含内联 JS 函数定义（防拆分后残留代码）
// 踩坑：JS 拆分时 overview.html 中残留旧代码导致解析错误或白屏
// ============================================================
section('11/12 overview.html 无内联 JS 残留');
// 排除 head 中的 FOUC 防闪烁脚本（那是合法的内联脚本）
const bodyStart = overviewHtml.indexOf('<body>');
const bodyHtml = bodyStart > 0 ? overviewHtml.substring(bodyStart) : overviewHtml;
const inlineFuncMatch = bodyHtml.match(/\bfunction\s+\w+\s*\(/g);
if (inlineFuncMatch) {
  fail('overview.html <body> 中发现 ' + inlineFuncMatch.length + ' 个内联函数定义（应全部在 scripts/app.js 中）');
} else {
  pass('overview.html <body> 中无内联函数定义');
}

// ============================================================
// 检查 12: kb/ md 文件行数限制（CLAUDE.md 拆分阈值）
// >1000 警告：开始关注；>1500 失败：必须拆分
// ============================================================
section('12/12 kb/ md 文件行数限制（>1000 警告 / >1500 失败）');
let lineWarn = 0;
let lineFail = 0;
for (const p of allPaths) {
  const abs = path.join(ROOT, p);
  if (!fs.existsSync(abs)) continue;
  const lines = fs.readFileSync(abs, 'utf-8').split('\n').length;
  if (lines > 1500) {
    fail(p + ' — ' + lines + ' 行 (>1500，必须拆分)');
    lineFail++;
  } else if (lines > 1000) {
    console.log('  WARN: ' + p + ' — ' + lines + ' 行 (>1000，建议关注)');
    lineWarn++;
  }
}
if (lineFail === 0 && lineWarn === 0) {
  pass(allPaths.length + ' 个 md 文件全部 ≤1000 行');
} else if (lineFail === 0) {
  pass('无超 1500 行的文件（' + lineWarn + ' 个 >1000 警告）');
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
