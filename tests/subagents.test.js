'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/build-index.js');

const AGENTS_DIR = path.join(__dirname, '..', '.claude', 'agents');
const EXPECTED = ['idea-extractor', 'kb-auditor', 'plan-executor'];

const TOOL_WHITELIST = {
  'idea-extractor': ['Read', 'Grep', 'Glob', 'WebFetch'],
  'kb-auditor': ['Read', 'Grep', 'Glob', 'Bash'],
  'plan-executor': ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'Task'],
};

const VERDICT_PREFIX = {
  'idea-extractor': 'EXTRACT-VERDICT',
  'kb-auditor': 'VERDICT',
  'plan-executor': 'VERDICT',
};

function loadAgent(name) {
  const file = path.join(AGENTS_DIR, `${name}.md`);
  const raw = fs.readFileSync(file, 'utf8');
  const meta = parseFrontmatter(raw);
  return { raw, meta, file };
}

test('smoke: .claude/agents/ 下三个项目级 agent 都存在', () => {
  for (const name of EXPECTED) {
    const file = path.join(AGENTS_DIR, `${name}.md`);
    assert.ok(fs.existsSync(file), `缺少 ${file}`);
  }
});

test('smoke: 每个 agent frontmatter 含 name + description + tools', () => {
  for (const name of EXPECTED) {
    const { raw } = loadAgent(name);
    const fmEnd = raw.indexOf('---', 3);
    assert.ok(fmEnd > 0, `${name}.md 无合法 frontmatter`);
    const fm = raw.slice(3, fmEnd);
    assert.match(fm, /^name:\s*\S/m, `${name}.md frontmatter 缺 name`);
    assert.match(fm, /^description:\s*\S/m, `${name}.md frontmatter 缺 description`);
    assert.match(fm, /^tools:\s*\S/m, `${name}.md frontmatter 缺 tools`);
  }
});

test('smoke: name 字段与文件名一致', () => {
  for (const name of EXPECTED) {
    const { raw } = loadAgent(name);
    const m = raw.match(/^name:\s*(\S+)/m);
    assert.ok(m, `${name}.md 解析不出 name`);
    assert.equal(m[1], name, `${name}.md frontmatter name="${m[1]}" 与文件名不符`);
  }
});

test('smoke: tools 白名单符合最小权限设计', () => {
  for (const name of EXPECTED) {
    const { raw } = loadAgent(name);
    const m = raw.match(/^tools:\s*(.+)$/m);
    const tools = m[1].split(',').map((s) => s.trim()).sort();
    const expected = [...TOOL_WHITELIST[name]].sort();
    assert.deepEqual(tools, expected, `${name} tools 与设计不符: 实际 ${tools} vs 预期 ${expected}`);
  }
});

test('smoke: kb-auditor / idea-extractor 不能有 Write 或 Edit（review-only）', () => {
  for (const name of ['kb-auditor', 'idea-extractor']) {
    const { raw } = loadAgent(name);
    const tools = raw.match(/^tools:\s*(.+)$/m)[1];
    assert.ok(!/\bWrite\b/.test(tools), `${name} 不应有 Write 工具（review-only）`);
    assert.ok(!/\bEdit\b/.test(tools), `${name} 不应有 Edit 工具（review-only）`);
  }
});

test('smoke: 每个 agent body 含 VERDICT 输出契约说明', () => {
  for (const name of EXPECTED) {
    const { raw } = loadAgent(name);
    const prefix = VERDICT_PREFIX[name];
    assert.ok(raw.includes(prefix), `${name}.md body 缺 "${prefix}" 输出契约`);
  }
});

test('smoke: 每个 agent body 至少 30 行（避免空骨架）', () => {
  for (const name of EXPECTED) {
    const { raw } = loadAgent(name);
    const lines = raw.split('\n').length;
    assert.ok(lines >= 30, `${name}.md 仅 ${lines} 行，prompt 可能过简`);
  }
});
