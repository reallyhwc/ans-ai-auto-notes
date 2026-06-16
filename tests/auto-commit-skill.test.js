const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const skillPath = '.claude/skills/auto-commit-discipline/SKILL.md';
const skillContent = fs.readFileSync(skillPath, 'utf8');

test('auto-commit skill: 阈值应与 CLAUDE.md 一致（≥3）', () => {
  // Skill 不应包含过时的阈值 5（排除 markdown 代码块中的示例）
  const codeLines = skillContent.split('\n')
    .filter(line => !line.match(/^\s*```/))  // 排除代码块标记
    .filter(line => !line.match(/^\s*-/))    // 排除列表项（通常是示例）
    .join('\n');

  assert.doesNotMatch(codeLines, /[≥>=]+\s*5.*push|阈值.*5/,
    'Skill 不应包含 "≥5" 的过时阈值描述');

  // Skill 如果提到阈值，应与 CLAUDE.md 一致（≥3）
  if (skillContent.match(/[≥>=]+\s*\d+/)) {
    assert.match(skillContent, /[≥>=]+\s*3/,
      'Skill 提到的阈值应与 CLAUDE.md 一致（≥3）');
  }
});

test('auto-commit skill: 不应重复 CLAUDE.md 已有的 Conventional Commits 格式', () => {
  // Skill 不应包含完整的 Conventional Commits 格式定义（如 "- `feat: xxx` — 新功能"）
  // 简短提及 `feat:` / `fix:` 是可以的（快速参考）
  const fullFormatPattern = /-\s*`(feat|fix|chore|docs|refactor):\s*xxx`/;
  assert.doesNotMatch(skillContent, fullFormatPattern,
    'Skill 不应包含完整的 Conventional Commits 格式定义（如 `- feat: xxx — 新功能`），应仅引用 CLAUDE.md');
});

test('auto-commit skill: 应保留独有内容（Checklist + 反面案例）', () => {
  assert.match(skillContent, /自检 Checklist|提交前.*检查/,
    'Skill 应保留独有的自检 Checklist');
  assert.match(skillContent, /反面案例|常见错误/,
    'Skill 应保留独有的反面案例');
});

test('auto-commit skill: 应包含触发条件', () => {
  assert.match(skillContent, /触发条件|何时.*调用|MUST invoke/,
    'Skill 应明确触发条件');
});
