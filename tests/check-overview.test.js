'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const scriptPath = path.join(__dirname, '..', 'scripts', 'check-overview.js');
const content = fs.readFileSync(scriptPath, 'utf8');

// ── 源码 grep 保底测试：确保 12 项检查都被实现 ──

test('check-overview.js: 应实现 12 项检查', () => {
  // 12 项检查的标题标识
  const checks = [
    '数据文件存在性',     // 1
    'path 实存',          // 2 (manifest path)
    'timeline',           // 3
    '双向同步',           // 4 (INDEX ↔ manifest)
    'timeline 磁盘',      // 5
    '暂存区',             // 6 (.tmp-*)
    'overview.html',      // 7 (app.js/marked.js 引用)
    'app.js 存在',        // 8
    'CLAUDE.md 目录',     // 9
    'frontmatter title',  // 10
    '内联 JS',            // 11
    '行数',               // 12 (>1000/>1500)
  ];
  for (const c of checks) {
    assert.match(content, new RegExp(c), `应包含检查项: ${c}`);
  }
});

test('check-overview.js: 应有 collectPaths 函数遍历 manifest', () => {
  assert.match(content, /function collectPaths/, '应定义 collectPaths 函数');
  assert.match(content, /collectPaths/, '应调用 collectPaths 收集 manifest 路径');
});

test('check-overview.js: 应实现 INDEX↔manifest 双向同步检查', () => {
  assert.match(content, /INDEX.*manifest|manifest.*INDEX/i, '应对比 INDEX 和 manifest');
  assert.match(content, /双向|bidirectional|only in/i, '应检测双向差异');
});

test('check-overview.js: 行数检查应有 1000 警告 + 1500 失败阈值', () => {
  assert.match(content, /1000/, '应有 1000 行警告阈值');
  assert.match(content, /1500/, '应有 1500 行失败阈值');
});

test('check-overview.js: 应解析 CLAUDE.md 目录树（防 AI 幻觉）', () => {
  // check-overview 从 CLAUDE.md 目录树提取子目录名与磁盘对比
  assert.match(content, /CLAUDE\.md/, '应读 CLAUDE.md');
  assert.match(content, /├──|└──|目录结构/i, '应解析目录树符号');
});

// ── 端到端测试：在项目根跑确认 exit 0（项目当前应健康）──

test('check-overview.js: 项目根跑应 exit 0（当前知识库健康）', () => {
  // 项目当前 manifest/timeline/INDEX 都已构建且一致
  try {
    const out = execSync('node scripts/check-overview.js', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000,
    });
    assert.ok(out.includes('PASS') || out.includes('通过'), '应有 PASS 输出');
  } catch (e) {
    // 如果失败，输出详情便于诊断
    const out = (e.stdout || '') + (e.stderr || '');
    assert.fail(`check-overview.js 应 exit 0 但失败：\n${out.slice(-500)}`);
  }
});

test('check-overview.js: manifest.json 缺失时应 exit 1（检查 1 兜底）', () => {
  // 用临时目录模拟 manifest 缺失
  const os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cov-test-'));
  try {
    // 复制脚本 + timeline.json + CLAUDE.md（缺 manifest.json）
    fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
    fs.copyFileSync(scriptPath, path.join(dir, 'scripts', 'check-overview.js'));
    // check-overview 用 __dirname/.. 定位 ROOT，所以 scripts/ 在 dir/scripts/
    let result;
    try {
      result = execSync('node scripts/check-overview.js', {
        cwd: dir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000,
      });
      assert.fail('manifest 缺失应 exit 1 但 exit 0');
    } catch (e) {
      result = (e.stdout || '') + (e.stderr || '');
      assert.match(result, /manifest\.json.*不存在|检查中止/i, '应报 manifest 不存在并中止');
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// 回归测试：Stop 链"只报失败"——--quiet 抑制 PASS 明细，健康项每项一行 ✓ 汇总
test('check-overview.js: --quiet 健康路径输出精简（无 PASS 明细，逐项 ✓ 汇总）', () => {
  const out = execSync('node scripts/check-overview.js --quiet', {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 15000,
  });
  assert.doesNotMatch(out, /  PASS: /, 'quiet 模式不应输出 PASS 明细');
  assert.match(out, /✓ 1\/12/, 'quiet 模式应有第 1 项 ✓ 汇总');
  assert.match(out, /✓ 12\/12/, 'quiet 模式应有最后一项 ✓ 汇总');
  assert.match(out, /全部检查通过/, '健康路径仍应输出通过汇总');
});

test('check-overview.js: 无参数模式保持兼容（输出 PASS 明细）', () => {
  const out = execSync('node scripts/check-overview.js', {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 15000,
  });
  assert.match(out, /  PASS: /, '默认模式应保留 PASS 明细');
});
