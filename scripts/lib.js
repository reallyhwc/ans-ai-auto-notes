/**
 * lib.js — 浏览器 + Node 双环境共享的纯函数库
 *
 * 设计：所有函数无 DOM、无 window 依赖；通过 UMD 模式导出
 *   - 浏览器：plain <script> 加载，函数挂在 window 全局
 *   - Node：require('./scripts/lib.js') 走 module.exports
 *
 * 测试：tests/lib.test.js + tests/link-renderer.test.js
 *
 * 不要在这里放任何 DOM/marked/mermaid/localStorage 调用——那是 app.js 的责任
 */

'use strict';

// HTML 转义（用于代码块等不需要引号转义的位置）
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// HTML 属性转义（用于 onclick="..." 等属性值，需转义引号）
function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// 标题转 anchor id：小写、保留中文、其他字符替换为 -
function slugify(text) {
  return String(text).toLowerCase().replace(/[^\w一-鿿]+/g, '-').replace(/^-|-$/g, '');
}

// 从 markdown 抽取 ## 和 ### 作为 TOC（跳过代码块内的 #）
function buildToc(markdown) {
  var lines = String(markdown).split('\n');
  var toc = [];
  var inCodeBlock = false;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (/^```/.test(line)) { inCodeBlock = !inCodeBlock; continue; }
    if (inCodeBlock) continue;
    var h2 = /^##\s(.+)/.exec(line);
    var h3 = /^###\s(.+)/.exec(line);
    if (h2) toc.push({ level: 2, text: h2[1], id: slugify(h2[1]) });
    else if (h3) toc.push({ level: 3, text: h3[1], id: slugify(h3[1]) });
  }
  return toc;
}

// 把相对路径解析为相对项目根的绝对路径
// 输入: 当前文件路径（如 'kb/技术/AI/Claude-Code/foo.md'）+ 相对链接（如 '../X/y.md#sec'）
// 输出: { path: 'kb/技术/AI/X/y.md', anchor: '#sec' }
function resolveRelativeMd(currentFilePath, href) {
  var hrefStr = String(href);
  var anchorIdx = hrefStr.indexOf('#');
  var pathPart = anchorIdx >= 0 ? hrefStr.slice(0, anchorIdx) : hrefStr;
  var anchor = anchorIdx >= 0 ? hrefStr.slice(anchorIdx) : '';
  var segs = String(currentFilePath).split('/');
  segs.pop(); // 去掉文件名
  var hrefSegs = pathPart.split('/');
  for (var i = 0; i < hrefSegs.length; i++) {
    var s = hrefSegs[i];
    if (s === '' || s === '.') continue;
    if (s === '..') segs.pop();
    else segs.push(s);
  }
  return { path: segs.join('/'), anchor: anchor };
}

// 把一个 markdown 链接渲染为合适的 HTML
// - 外链（http/mailto） → <a target="_blank">
// - 页内锚点（#xxx）    → <a> 不加 target
// - .md 文件           → <span class="kb-link" onclick=viewContent> 路由到 SPA viewer
// - 其他相对资源       → 标准 <a>
function renderKbLink(href, currentFile, renderedInnerText) {
  var hrefStr = String(href || '');
  // 外链
  if (/^(https?:|mailto:)/i.test(hrefStr)) {
    return '<a href="' + escapeAttr(hrefStr) + '" target="_blank" rel="noopener">' + renderedInnerText + '</a>';
  }
  // 纯锚点
  if (hrefStr.charAt(0) === '#') {
    return '<a href="' + escapeAttr(hrefStr) + '">' + renderedInnerText + '</a>';
  }
  // .md 文件
  if (/\.md(#|$)/.test(hrefStr) && currentFile) {
    var resolved = resolveRelativeMd(currentFile, hrefStr);
    return '<span class="kb-link" onclick="viewContent(\'' + escapeAttr(resolved.path) + '\')">' + renderedInnerText + '</span>';
  }
  // 其他相对链接（图片等）
  return '<a href="' + escapeAttr(hrefStr) + '">' + renderedInnerText + '</a>';
}

// Node 导出（浏览器 <script> 模式下 module 未定义，跳过）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeHtml,
    escapeAttr,
    slugify,
    buildToc,
    resolveRelativeMd,
    renderKbLink,
  };
}
