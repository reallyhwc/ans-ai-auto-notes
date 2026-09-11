'use strict';
/**
 * rule-consistency.test.js — 跨文档规则一致性锁
 *
 * 防止"同一条规则在多个文档里表述漂移"：
 * - .claude/agents/README.md 的 kb-auditor dispatch 模板引用了行数拆分规则，
 *   必须与 .claude/skills/kb-content-style/SKILL.md 的现行规则一致
 *   （>1000 关注 / >1500 也只是提示，不提案拆分；拆分决策权归用户）。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const README = fs.readFileSync(
  path.join(ROOT, '.claude', 'agents', 'README.md'),
  'utf8'
);
const STYLE_SKILL = fs.readFileSync(
  path.join(ROOT, '.claude', 'skills', 'kb-content-style', 'SKILL.md'),
  'utf8'
);

// 定位 README 里 kb-auditor dispatch 模板中的行数规则行
function readLineRuleLine() {
  const line = README.split('\n').find(l => /行数\s*[>＞]\s*1000/.test(l));
  assert.ok(line, 'agents README 应包含 "行数 >1000" 规则行');
  return line;
}

test('rule-consistency: subagent README 行数规则不得含"必拆"（过时表述）', () => {
  const line = readLineRuleLine();
  assert.doesNotMatch(
    line,
    /必拆/,
    'README 行数规则不得写 ">1500 必拆"——现行规则是 >1500 同样只是提示，不提案拆分'
  );
});

test('rule-consistency: README 行数规则与 kb-content-style SKILL "不擅自提案"一致', () => {
  const line = readLineRuleLine();
  // skill 现行权威规则
  assert.match(
    STYLE_SKILL,
    /不擅自提案拆分|不提案拆分/,
    'kb-content-style SKILL 应含"不擅自提案拆分"规则'
  );
  // README 表述与 skill 语义一致（只提示关注，不提案拆分）
  assert.match(
    line,
    /不提案|不擅自|只提示|仅提示|关注/,
    'README 行数规则应与 skill 一致：只提示关注、不提案拆分'
  );
});

// ── 2026-09 审计：AGENTS.md（DSH/Codex 侧）长期是 CLAUDE.md 的陈旧快照 ──
//   实测漂移：arch-lint "8 项" vs 实际 15 项、目录树含不存在的 Codex/、
//   缺"自动沉淀纪律 / Subagent 调度纪律 / Skill 开发纪律"三整章。
const AGENTS = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');
const CLAUDE = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');

test('rule-consistency: AGENTS.md 与 CLAUDE.md 声明的检查项数量一致', () => {
  for (const [name, text] of [['AGENTS.md', AGENTS], ['CLAUDE.md', CLAUDE]]) {
    assert.match(text, /arch-lint[\s\S]{0,40}15 项/, `${name} 应声明 arch-lint 15 项`);
    assert.doesNotMatch(text, /arch-lint[\s\S]{0,40}\b8 项/, `${name} 不应残留 "arch-lint 8 项" 旧数字`);
    assert.match(text, /11 项/, `${name} 应声明 exit-check 11 项`);
    assert.match(text, /12 项/, `${name} 应声明 check-overview 12 项`);
  }
});

test('rule-consistency: 两份规则文件的 kb/ 目录树不得出现不存在的子目录', () => {
  for (const [name, text] of [['AGENTS.md', AGENTS], ['CLAUDE.md', CLAUDE]]) {
    assert.doesNotMatch(text, /大模型\/Codex\/|基础\/大模型\/Codex/, `${name} 目录树不应含 Codex/ 子目录`);
    // 实际存在、必须被列出的目录
    for (const dir of ['Java/', '编程语言/', '计算机基础/', '实战/', '读书笔记/', '课程笔记/']) {
      assert.ok(text.includes(dir), `${name} 的目录树应包含 ${dir}`);
    }
  }
});

test('rule-consistency: 两份规则文件都含关键纪律章节且 timeline 口径一致（ADR-002）', () => {
  for (const [name, text] of [['AGENTS.md', AGENTS], ['CLAUDE.md', CLAUDE]]) {
    assert.match(text, /### 自动沉淀纪律/, `${name} 应有"自动沉淀纪律"章节`);
    assert.match(text, /### Skill 开发纪律（SDD）/, `${name} 应有"Skill 开发纪律（SDD）"章节`);
    assert.match(text, /### Subagent 调度纪律/, `${name} 应有"Subagent 调度纪律"章节`);
    // timeline.json 是构建产物（ADR-002），不得写成"手维护/手动维护"
    assert.doesNotMatch(text, /timeline\.json[^\n]*（手维护）/, `${name} 不应把 timeline.json 写成手维护`);
    assert.doesNotMatch(text, /手动维护 `timeline\.json`/, `${name} 不应写"手动维护 timeline.json"`);
  }
});

test('rule-consistency: 规则文档内的 .md 链接不含 %20 编码（解析器不解码）', () => {
  for (const name of ['AGENTS.md', 'CLAUDE.md', 'README.md', 'README_EN.md']) {
    const text = fs.readFileSync(path.join(ROOT, name), 'utf8');
    assert.doesNotMatch(text, /\]\([^)]*%20[^)]*\.md/, `${name} 不应使用 %20 编码的 .md 链接（改用 <尖括号>）`);
  }
});
