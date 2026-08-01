/**
 * subagent-definitions.test.js — 验证 .claude/agents/*.md 三个 subagent 定义文件的
 * frontmatter 合法 + body 含必备 section
 *
 * 这是 LLM 配置不是代码，所以测试只验证"结构对、关键约束在"，不验证 prompt 质量。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function readAgent(name) {
  const filePath = path.join(ROOT, '.claude', 'agents', `${name}.md`);
  return fs.readFileSync(filePath, 'utf8');
}

function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('no frontmatter');
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return { frontmatter: fm, body: m[2] };
}

test('kb-auditor: frontmatter 含 name/description/tools', () => {
  const { frontmatter } = parseFrontmatter(readAgent('kb-auditor'));
  assert.equal(frontmatter.name, 'kb-auditor');
  assert.ok(frontmatter.description, 'description required');
  assert.ok(frontmatter.tools, 'tools required');
});

test('kb-auditor: tools 白名单仅含 Read/Grep/Glob/Bash（review-only）', () => {
  const { frontmatter } = parseFrontmatter(readAgent('kb-auditor'));
  const tools = frontmatter.tools.split(',').map(s => s.trim());
  assert.deepEqual(tools.sort(), ['Bash', 'Glob', 'Grep', 'Read']);
  assert.ok(!tools.includes('Edit'), 'Edit must not be in kb-auditor tools (review-only)');
  assert.ok(!tools.includes('Write') || tools.includes('Bash'),
    'Write only OK if Bash absent (we want auditor to write reports via Bash echo redirect, not Write tool)');
});

test('kb-auditor: body 含 4 审查维度章节', () => {
  const { body } = parseFrontmatter(readAgent('kb-auditor'));
  assert.match(body, /深度与具象度/);
  assert.match(body, /论述流畅性/);
  assert.match(body, /链接.*关联/);
  assert.match(body, /视觉化|Mermaid/);
});

test('kb-auditor: body 含 VERDICT 输出契约 + logs/audits/ 路径', () => {
  const { body } = parseFrontmatter(readAgent('kb-auditor'));
  assert.match(body, /VERDICT:/);
  assert.match(body, /logs\/audits\//);
});

test('plan-executor: frontmatter + 全工具白名单', () => {
  const { frontmatter } = parseFrontmatter(readAgent('plan-executor'));
  assert.equal(frontmatter.name, 'plan-executor');
  assert.ok(frontmatter.description);
  const tools = frontmatter.tools.split(',').map(s => s.trim());
  // plan-executor 要施工，需要 Edit/Write/Task
  assert.ok(tools.includes('Edit'));
  assert.ok(tools.includes('Write'));
  assert.ok(tools.includes('Task'));
});

test('plan-executor: body 含 VERDICT + logs/plan-runs/ + 嵌套 spawn 说明', () => {
  const { body } = parseFrontmatter(readAgent('plan-executor'));
  assert.match(body, /VERDICT:/);
  assert.match(body, /logs\/plan-runs\//);
  assert.match(body, /implementer|嵌套|Task tool/);
});

test('idea-extractor: frontmatter + 只读工具白名单（含 WebFetch）', () => {
  const { frontmatter } = parseFrontmatter(readAgent('idea-extractor'));
  assert.equal(frontmatter.name, 'idea-extractor');
  const tools = frontmatter.tools.split(',').map(s => s.trim());
  assert.ok(tools.includes('Read'));
  assert.ok(tools.includes('WebFetch'));
  assert.ok(!tools.includes('Edit'), 'Edit must not be in idea-extractor (only suggests, never writes)');
  assert.ok(!tools.includes('Write'), 'Write must not be in idea-extractor');
});

test('idea-extractor: body 含 EXTRACT-VERDICT 契约 + 新建/追加/跳过 三态', () => {
  const { body } = parseFrontmatter(readAgent('idea-extractor'));
  assert.match(body, /EXTRACT-VERDICT:/);
  assert.match(body, /新建/);
  assert.match(body, /追加/);
  assert.match(body, /跳过/);
});
