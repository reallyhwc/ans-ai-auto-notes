const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const scriptPath = path.join(__dirname, '..', 'scripts', 'arch-lint.sh');
const content = fs.readFileSync(scriptPath, 'utf8');

test('arch-lint.sh: 应检查 frontmatter title + description', () => {
  assert.match(content, /title:/, '应检查 title 字段');
  assert.match(content, /description:/, '应检查 description 字段');
  assert.match(content, /Frontmatter 完整性/, '应有 frontmatter 检查标题');
});

test('arch-lint.sh: 应检查元信息头（最后整理日期）', () => {
  assert.match(content, /最后整理/, '应检查最后整理日期');
  assert.match(content, /元信息头/, '应有元信息头检查');
});

test('arch-lint.sh: 应检查文件行数超标（>1000 警告, >1500 错误）', () => {
  assert.match(content, /1500/, '应有 1500 行错误阈值');
  assert.match(content, /1000/, '应有 1000 行警告阈值');
  assert.match(content, /文件行数/, '应有行数检查标题');
});

test('arch-lint.sh: 应检查交叉链接有效性', () => {
  assert.match(content, /交叉链接/, '应有交叉链接检查');
  assert.match(content, /\]\(\.\//, '应检测相对路径链接');
});

test('arch-lint.sh: 应检查零 npm 依赖', () => {
  assert.match(content, /npm|npx|yarn|pnpm/, '应检测包管理器调用');
  assert.match(content, /零 npm 依赖/, '应有零依赖检查标题');
  assert.match(content, /package\.json/, '应检查 package.json 存在');
});

test('arch-lint.sh: 应检查 memory 文件 frontmatter 格式', () => {
  assert.match(content, /memory\/\*\.md/, '应扫描 memory 目录');
  assert.match(content, /frontmatter 未正确闭合/, '应检测未闭合的 frontmatter');
});

test('arch-lint.sh: 应使用 find -print0 + read -d 处理中文文件名空格', () => {
  assert.match(content, /find.*-print0/, '应使用 -print0 输出');
  assert.match(content, /read.*-d\s*''/, '应使用 -d 空分隔符读取');
});

test('arch-lint.sh: 应输出 15 项检查汇总', () => {
  assert.match(content, /Linter 汇总/, '应有汇总标题');
  assert.match(content, /通过.*错误.*警告/, '应输出通过/错误/警告数');
});
