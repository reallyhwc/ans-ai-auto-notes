'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CLAUDE_MD = fs.readFileSync(
  path.resolve(__dirname, '..', 'CLAUDE.md'),
  'utf-8'
);

test('auto-save: CLAUDE.md 包含独立的"自动沉淀纪律"章节', () => {
  assert.ok(
    CLAUDE_MD.includes('### 自动沉淀纪律'),
    '应有 ### 自动沉淀纪律 独立小节'
  );
});

test('auto-save: 包含违规模式黑名单', () => {
  const forbiddenPatterns = [
    '要不要沉淀',
    '需要沉淀',
    '是否沉淀',
    '要记录到',
    '要写入知识库',
  ];
  const section = CLAUDE_MD.split('### 自动沉淀纪律')[1];
  assert.ok(section, '应存在"自动沉淀纪律"章节');
  for (const p of forbiddenPatterns) {
    assert.ok(
      section.includes(p),
      `违规模式黑名单应包含 "${p}"`
    );
  }
});

test('auto-save: 包含唯一的例外条件说明', () => {
  const section = CLAUDE_MD.split('### 自动沉淀纪律')[1];
  assert.ok(section, '应存在"自动沉淀纪律"章节');
  assert.ok(
    section.includes('唯一例外') || section.includes('可以询问的情况'),
    '应说明唯一例外条件'
  );
  assert.ok(
    section.includes('文件拆分') || section.includes('目录'),
    '例外条件应涉及文件拆分/目录变更'
  );
});

test('auto-save: 包含决策算法（判断流程）', () => {
  const section = CLAUDE_MD.split('### 自动沉淀纪律')[1];
  assert.ok(section, '应存在"自动沉淀纪律"章节');
  assert.ok(
    section.includes('判断') || section.includes('算法') || section.includes('流程'),
    '应包含决策算法/判断流程'
  );
});
