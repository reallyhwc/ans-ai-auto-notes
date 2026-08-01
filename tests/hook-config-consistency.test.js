'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 假设3：.codex/hooks.json 与 .claude/settings.json 的 hook 配置一致性
// 两份 hook 配置重复维护，改一处容易忘了另一边。此测试保障"两边共有的 hook 类型
// 调用相同的核心脚本"（忽略 hook-logger 包装、$CLAUDE_PROJECT_DIR 前缀等执行环境差异）。
// .codex 缺 PostToolUse/PreToolUse 不报错（Codex CLI 可能不支持这俩 hook 类型，
// 属于工具能力差异，非配置漂移）。

const claudeSettings = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.claude', 'settings.json'), 'utf8'));
const codexHooks = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.codex', 'hooks.json'), 'utf8'));

// 提取 hook 命令里的核心脚本名（.sh 或 .js 文件名）
function extractCoreScript(command) {
  // 匹配 xxx.sh 或 xxx.js（不含路径），取最后一个（hook-logger 包装时被引号包围的是核心）
  const matches = command.match(/[\w.-]+\.(?:sh|js)/g);
  if (!matches) return null;
  // hook-logger 包装形如：bash scripts/hook-logger.sh NAME "bash exit-check.sh"
  // 核心脚本在引号内，是最后一个 .sh/.js
  // agent-log 形如：node $CLAUDE_PROJECT_DIR/scripts/agent-log-hook.js main
  // 核心是 agent-log-hook.js
  // 取最后一个匹配（核心命令的脚本），但排除 hook-logger.sh 自身
  const filtered = matches.filter(m => m !== 'hook-logger.sh');
  return filtered[filtered.length - 1] || matches[matches.length - 1];
}

// 收集某个 hook 配置里所有 (hookType -> [coreScript, ...]) 映射
function collectHookCores(hooksObj) {
  const map = {};  // hookType -> Set of core scripts
  for (const [hookType, entries] of Object.entries(hooksObj)) {
    const cores = new Set();
    for (const entry of entries) {
      for (const h of (entry.hooks || [])) {
        const core = extractCoreScript(h.command || '');
        if (core) cores.add(core);
      }
    }
    map[hookType] = cores;
  }
  return map;
}

const claudeMap = collectHookCores(claudeSettings.hooks || {});
const codexMap = collectHookCores(codexHooks.hooks || {});

test('hook-config-consistency: .codex 与 .claude 共有 hook 类型应调用相同核心脚本', () => {
  const commonTypes = Object.keys(claudeMap).filter(t => t in codexMap);
  assert.ok(commonTypes.length > 0, '两边应至少有 1 个共有 hook 类型');

  const mismatches = [];
  for (const hookType of commonTypes) {
    const claudeCores = claudeMap[hookType];
    const codexCores = codexMap[hookType];
    // 两边共有的 hook 类型，核心脚本集合应相同
    for (const core of claudeCores) {
      if (!codexCores.has(core)) {
        mismatches.push(`${hookType}: claude 调 ${core}，codex 未调`);
      }
    }
    for (const core of codexCores) {
      if (!claudeCores.has(core)) {
        mismatches.push(`${hookType}: codex 调 ${core}，claude 未调`);
      }
    }
  }
  assert.deepEqual(mismatches, [], `共有 hook 类型核心脚本不一致：\n${mismatches.join('\n')}`);
});

test('hook-config-consistency: 应提取核心脚本名（忽略 hook-logger 包装 + $CLAUDE_PROJECT_DIR）', () => {
  assert.equal(extractCoreScript('bash scripts/hook-logger.sh exit-check "bash exit-check.sh"'), 'exit-check.sh');
  assert.equal(extractCoreScript('bash exit-check.sh'), 'exit-check.sh');
  assert.equal(extractCoreScript('node $CLAUDE_PROJECT_DIR/scripts/agent-log-hook.js main'), 'agent-log-hook.js');
  assert.equal(extractCoreScript('bash scripts/hook-logger.sh preflight "bash scripts/preflight.sh"'), 'preflight.sh');
});

test('hook-config-consistency: .claude 应有 5 个 hook 类型（含 PostToolUse/PreToolUse）', () => {
  const types = Object.keys(claudeMap).sort();
  assert.deepEqual(types, ['PostToolUse', 'PreToolUse', 'SessionStart', 'Stop', 'SubagentStop']);
});

test('hook-config-consistency: 记录 .codex 缺的 hook 类型（工具能力差异，不报错）', () => {
  // .codex 缺 PostToolUse/PreToolUse——可能是 Codex CLI 不支持这俩 hook 类型
  // 此测试只记录差异，不报错（避免工具能力差异被误报为配置漂移）
  const claudeOnly = Object.keys(claudeMap).filter(t => !(t in codexMap));
  // 预期缺 PostToolUse + PreToolUse
  console.log('  ℹ️  .codex 缺的 hook 类型（工具能力差异）:', claudeOnly.join(', ') || '(无)');
  // 如果未来 .codex 加了 PostToolUse/PreToolUse，这个测试会提醒更新预期
  assert.ok(claudeOnly.length <= 2, `.codex 缺的 hook 类型不应超过 2 个（PostToolUse/PreToolUse），实际缺 ${claudeOnly.length} 个：${claudeOnly.join(',')}`);
});
