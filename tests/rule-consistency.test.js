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
