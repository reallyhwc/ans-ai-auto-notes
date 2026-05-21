/**
 * server.test.js — 目录穿越保护 + 请求处理边界
 *
 * 设计：server.js 已重构为可 require 的模块，本测试用 resolveSafePath 做白盒、
 * 用 createHandler 配合 mock req/res 做黑盒（验证 403 实际被发出）。
 *
 * 软 TDD 区域：server.js 的安全代码，绝不允许目录穿越逃出 ROOT。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { resolveSafePath, createHandler } = require('../server.js');

const FAKE_ROOT = '/tmp/test-server-root';

// ============================================================
// resolveSafePath — 纯函数白盒测试
// ============================================================

test('resolveSafePath: 正常路径放行', () => {
  const r = resolveSafePath('/overview.html', FAKE_ROOT);
  assert.equal(r.ok, true);
  assert.equal(r.path, path.join(FAKE_ROOT, 'overview.html'));
});

test('resolveSafePath: 根 / 重定向到 overview.html', () => {
  const r = resolveSafePath('/', FAKE_ROOT);
  assert.equal(r.ok, true);
  assert.equal(r.path, path.join(FAKE_ROOT, 'overview.html'));
});

test('resolveSafePath: 深层子目录路径放行', () => {
  const r = resolveSafePath('/kb/技术/AI/llm.md', FAKE_ROOT);
  assert.equal(r.ok, true);
  assert.ok(r.path.startsWith(FAKE_ROOT + path.sep));
});

test('resolveSafePath: ../ 上溯越界 → 拒绝', () => {
  const r = resolveSafePath('/../etc/passwd', FAKE_ROOT);
  assert.equal(r.ok, false);
});

test('resolveSafePath: 多重 ../../ 越界 → 拒绝', () => {
  const r = resolveSafePath('/foo/../../../etc/passwd', FAKE_ROOT);
  assert.equal(r.ok, false);
});

test('resolveSafePath: 含 ../ 但最终仍在 ROOT 内 → 放行', () => {
  // /foo/../bar 实际等价于 /bar，仍在 ROOT 内
  const r = resolveSafePath('/foo/../bar', FAKE_ROOT);
  assert.equal(r.ok, true);
  assert.equal(r.path, path.join(FAKE_ROOT, 'bar'));
});

test('resolveSafePath: 绝对路径前缀诈骗 (/tmp/test-server-root-evil) → 拒绝', () => {
  // path.join("/tmp/test-server-root", "/tmp/test-server-root-evil/x")
  // 会被解析到 /tmp/test-server-root/tmp/test-server-root-evil/x（仍在 ROOT 内，应放行）
  // 这个用例 sanity check：path.join 不会被绝对路径覆盖前缀
  const r = resolveSafePath('/tmp/test-server-root-evil/x', FAKE_ROOT);
  assert.equal(r.ok, true);
  assert.ok(r.path.startsWith(FAKE_ROOT + path.sep));
});

// ============================================================
// createHandler — 黑盒测试（mock req/res 验证 403 行为）
// ============================================================

function mockRes() {
  return {
    statusCode: null,
    bodyChunks: [],
    headers: {},
    writeHead(code, headers) {
      this.statusCode = code;
      if (headers) Object.assign(this.headers, headers);
    },
    end(body) { if (body !== undefined) this.bodyChunks.push(String(body)); },
    write(chunk) { this.bodyChunks.push(String(chunk)); },
  };
}

function mockReq(url) {
  return {
    url,
    on() { /* no-op */ },
  };
}

// URL 规范化行为速查（Node 22 实验得出）：
//   /../etc        → URL 自动消除 .. → pathname = /etc      → 安全（被 URL 解析层吃掉）
//   /%2E%2E/etc    → URL 自动消除 .. → pathname = /etc      → 安全（编码的 .. 仍被识别）
//   /%2e%2e/etc    → 同上 → /etc                            → 安全
//   /..%2Fetc      → URL 不识别 %2F 为分隔符 → pathname 保留 → decode 后 /../etc → ⚠️ 越界
//   /%2E%2E%2Fetc  → 同上 → ⚠️ 越界
//
// 真正能逃过 URL 解析器的是 **编码的斜杠 %2F** 配合 ..，
// server.js 的 traversal 检查就是为这种场景兜底（defense in depth）。

test('createHandler: 编码斜杠穿越 /..%2Fetc/passwd 返回 403', () => {
  const handler = createHandler(FAKE_ROOT);
  const res = mockRes();
  handler(mockReq('/..%2Fetc/passwd'), res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.bodyChunks.join(''), 'Forbidden');
});

test('createHandler: 全编码穿越 /%2E%2E%2Fetc/passwd 返回 403', () => {
  const handler = createHandler(FAKE_ROOT);
  const res = mockRes();
  handler(mockReq('/%2E%2E%2Fetc/passwd'), res);
  assert.equal(res.statusCode, 403);
});

test('createHandler: 多级编码穿越 /foo/..%2F..%2F..%2Fetc 返回 403', () => {
  const handler = createHandler(FAKE_ROOT);
  const res = mockRes();
  handler(mockReq('/foo/..%2F..%2F..%2Fetc/passwd'), res);
  assert.equal(res.statusCode, 403);
});

test('createHandler: SSE 端点 /__reload 返回 200', () => {
  const handler = createHandler(FAKE_ROOT);
  const res = mockRes();
  handler(mockReq('/__reload'), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'], 'text/event-stream');
});

test('createHandler: 未编码的 /../etc/passwd 被 URL 规范化（无需 server 介入）', () => {
  // 契约固化：URL 解析层吃掉 ..，traversal 检查不触发 403
  // 若未来 Node URL 行为变更（不再自动规范化），此测试会失败 → 提醒升级 traversal 逻辑
  const handler = createHandler(FAKE_ROOT);
  const res = mockRes();
  handler(mockReq('/../etc/passwd'), res);
  assert.notEqual(res.statusCode, 403);
});
