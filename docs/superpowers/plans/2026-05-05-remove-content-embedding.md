# Remove overview.html Content Embedding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace overview.html's embedded content architecture with runtime fetch, eliminating dual maintenance of md content.

**Architecture:** overview.html becomes a lightweight directory index (~15KB) that fetches md content on demand via a local `python3 -m http.server`. All md files remain the single source of truth.

**Tech Stack:** Vanilla HTML/CSS/JS (no build tools), Python 3 stdlib http.server, Bash

---

## File Structure

| File | Role | Change |
|------|------|--------|
| `serve.sh` | One-click server launcher + browser opener | **Create** |
| `overview.html` | Visual knowledge base browser | **Rewrite** (740→~380 lines) |
| `CLAUDE.md` | Project rules and maintenance guide | **Modify** (remove 5 rules, add 1 section) |

`kb/`, `INDEX.md`, `timeline/`, `.gitignore` — no changes.

---

### Task 1: Create serve.sh

**Files:**
- Create: `serve.sh`

- [ ] **Step 1: Write serve.sh**

```bash
#!/bin/bash
cd "$(dirname "$0")"
PORT=8765

if lsof -i :$PORT -sTCP:LISTEN > /dev/null 2>&1; then
    echo "已在运行 → http://localhost:$PORT"
else
    echo "启动知识库服务器..."
    python3 -m http.server $PORT --directory . &
    sleep 0.5
fi

open "http://localhost:$PORT"
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x serve.sh
```

- [ ] **Step 3: Commit**

```bash
git add serve.sh
git commit -m "feat: add one-click local server launcher for knowledge base preview"
```

---

### Task 2: Rewrite overview.html

**Files:**
- Rewrite: `overview.html`

This is the core change. The entire FILE_INDEX (metadata without content) replaces KB_DATA. `viewContent()` uses `fetch()` with caching. Server detection on load. All existing rendering functions (`renderMarkdown`, `buildToc`, search, tree toggle, tab switch) are preserved unchanged.

- [ ] **Step 1: Write the complete new overview.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>个人知识库导览</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; display: flex; height: 100vh; color: #1a1a1a; background: #f8f9fa; }
  .sidebar { width: 200px; background: #2c3e50; color: #ecf0f1; display: flex; flex-direction: column; padding-top: 20px; flex-shrink: 0; transition: width 0.2s; }
  .sidebar.collapsed { width: 40px; }
  .sidebar.collapsed .tab, .sidebar.collapsed .title { display: none; }
  .sidebar .title { padding: 0 20px 20px; font-size: 14px; font-weight: 700; letter-spacing: 0.5px; }
  .tab { padding: 10px 20px; cursor: pointer; font-size: 14px; border-left: 3px solid transparent; transition: all 0.15s; }
  .tab:hover { background: #34495e; }
  .tab.active { background: #34495e; border-left-color: #3498db; color: #fff; }
  .main { flex: 1; overflow-y: auto; padding: 30px 40px; }
  .main h2 { margin-bottom: 20px; font-size: 22px; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; }
  .tree-item { margin: 4px 0; }
  .tree-toggle { cursor: pointer; user-select: none; display: inline-block; width: 16px; color: #7f8c8d; }
  .tree-toggle.open::before { content: "▼"; }
  .tree-toggle.closed::before { content: "▶"; }
  .tree-folder { font-weight: 600; color: #2c3e50; cursor: pointer; }
  .tree-file { color: #2980b9; margin-left: 20px; font-size: 14px; cursor: pointer; display: block; }
  .tree-file:hover { text-decoration: underline; }
  .tree-children { margin-left: 16px; }
  .tree-children.collapsed { display: none; }
  .timeline-week { margin-bottom: 24px; }
  .timeline-week h3 { font-size: 16px; color: #2c3e50; margin-bottom: 8px; }
  .timeline-entry { padding: 6px 0 6px 16px; border-left: 2px solid #ddd; margin-left: 6px; font-size: 14px; }
  .timeline-entry .date { color: #7f8c8d; font-size: 12px; }
  .timeline-entry a { color: #2980b9; text-decoration: none; }
  .timeline-entry a:hover { text-decoration: underline; }
  .timeline-entry .tl-link { color: #2980b9; cursor: pointer; }
  .timeline-entry .tl-link:hover { text-decoration: underline; }
  .search-input { width: 100%; padding: 10px 14px; font-size: 14px; border: 1px solid #ddd; border-radius: 6px; margin-bottom: 20px; outline: none; }
  .search-input:focus { border-color: #3498db; box-shadow: 0 0 0 2px rgba(52,152,219,0.2); }
  .search-result { padding: 8px 0; font-size: 14px; border-bottom: 1px solid #eee; }
  .search-result .match { color: #2c3e50; font-weight: 600; }
  .search-result .path { color: #7f8c8d; font-size: 12px; }
  .empty-state { color: #95a5a6; font-size: 14px; margin-top: 40px; text-align: center; }
  .tree-empty { color: #bdc3c7; cursor: default; }
  .tl-empty { color: #bdc3c7; }
  .server-guide { text-align: center; margin-top: 60px; color: #7f8c8d; }
  .server-guide code { background: #ecf0f1; padding: 2px 8px; border-radius: 4px; font-size: 15px; color: #2c3e50; }
  .server-guide h2 { border: none; margin-bottom: 12px; }

  .back-link { display: inline-block; margin-bottom: 16px; color: #3498db; cursor: pointer; font-size: 14px; }
  .back-link:hover { text-decoration: underline; }
  .content-meta { color: #7f8c8d; font-size: 13px; margin-bottom: 24px; }
  .md-content { line-height: 1.8; font-size: 15px; }
  .md-content h1 { font-size: 26px; margin: 24px 0 12px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px; }
  .md-content h2 { font-size: 20px; margin: 22px 0 10px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
  .md-content h3 { font-size: 17px; margin: 18px 0 8px; }
  .md-content p { margin: 8px 0; }
  .md-content ul, .md-content ol { margin: 8px 0 8px 20px; }
  .md-content li { margin: 4px 0; }
  .md-content strong { color: #2c3e50; }
  .md-content code { background: #ecf0f1; padding: 1px 5px; border-radius: 3px; font-size: 13px; font-family: "SF Mono", Monaco, "Cascadia Code", monospace; }
  .md-content pre { background: #2c3e50; color: #ecf0f1; padding: 14px 18px; border-radius: 6px; overflow-x: auto; margin: 12px 0; }
  .md-content pre code { background: none; padding: 0; font-size: 13px; color: #ecf0f1; }
  .md-content blockquote { border-left: 3px solid #3498db; padding: 6px 14px; margin: 12px 0; color: #555; background: #f0f3f5; border-radius: 0 4px 4px 0; }
  .md-content hr { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
  .md-content table { border-collapse: collapse; margin: 12px 0; font-size: 14px; }
  .md-content th { background: #ecf0f1; padding: 6px 12px; border: 1px solid #ddd; text-align: left; }
  .md-content td { padding: 6px 12px; border: 1px solid #ddd; }
  .md-content a { color: #2980b9; }
  .sidebar-toggle { display: none; padding: 10px; cursor: pointer; text-align: center; color: #ecf0f1; font-size: 18px; }
  .sidebar.collapsed .sidebar-toggle { display: block; }

  .content-with-toc { display: flex; gap: 0; }
  .content-with-toc .md-content { flex: 1; min-width: 0; padding-right: 24px; }
  .toc-sidebar { width: 200px; flex-shrink: 0; position: sticky; top: 20px; align-self: flex-start; max-height: calc(100vh - 40px); overflow-y: auto; border-left: 1px solid #e0e0e0; padding-left: 16px; font-size: 13px; }
  .toc-sidebar .toc-title { font-weight: 600; color: #2c3e50; margin-bottom: 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  .toc-sidebar a { display: block; color: #7f8c8d; text-decoration: none; padding: 3px 0; border-left: 2px solid transparent; padding-left: 8px; margin-left: -10px; transition: all 0.15s; line-height: 1.4; }
  .toc-sidebar a:hover { color: #2980b9; }
  .toc-sidebar a.active { color: #2980b9; border-left-color: #3498db; font-weight: 500; }
  .toc-sidebar a.toc-h2 { padding-left: 8px; }
  .toc-sidebar a.toc-h3 { padding-left: 20px; font-size: 12px; }

  .load-error { padding: 40px; text-align: center; color: #e74c3c; }
  .load-error code { background: #fdf0ef; padding: 2px 8px; border-radius: 4px; }
</style>
</head>
<body>

<div class="sidebar" id="sidebar">
  <div class="title">知识库导览</div>
  <div class="sidebar-toggle" title="展开侧栏" onclick="toggleSidebar()">☰</div>
  <div class="tab active" data-tab="categories">分类导览</div>
  <div class="tab" data-tab="timeline">时间线</div>
  <div class="tab" data-tab="search">搜索</div>
</div>

<div class="main" id="main"></div>

<script>
// ============================================================
// 工具函数
// ============================================================
function escapeHtml(str) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ============================================================
// 文件索引 — 纯元数据，不含 Markdown 正文
// 新增/删除文件时在此增删条目
// ============================================================
var FILE_INDEX = {
  "categories": [
    {
      "name": "技术",
      "children": [
        { "name": "Java", "files": [
          {"title": "Spring AI", "path": "kb/技术/java/spring-ai.md", "desc": "Spring 生态 LLM 集成，流式/非流式调用"}
        ], "path": "kb/技术/java/" },
        { "name": "AI / 机器学习", "files": [
          {"title": "CNN（卷积神经网络）", "path": "kb/技术/ai/cnn.md", "desc": "图像处理专用网络，卷积+池化"},
          {"title": "RNN（循环神经网络）", "path": "kb/技术/ai/rnn.md", "desc": "序列数据处理，LSTM/GRU"},
          {"title": "Transformer", "path": "kb/技术/ai/transformer.md", "desc": "自注意力机制，现代大模型底座"},
          {"title": "LLM（大语言模型）", "path": "kb/技术/ai/llm.md", "desc": "核心原理：架构、因果推理、逐字生成、KV Cache"},
          {"title": "Prompt 与 RAG", "path": "kb/技术/ai/llm-prompt-rag.md", "desc": "Prompt工程、RAG、向量数据库/Milvus、Embedding、LangChain"},
          {"title": "Agent 与 MCP", "path": "kb/技术/ai/llm-agent-mcp.md", "desc": "Agent循环、MCP协议、FC机制、Skill定位、五者关系"},
          {"title": "AI Agent 工具生态", "path": "kb/技术/ai/ai-agent-tools.md", "desc": "Hermes Agent（养马）vs OpenClaw（养龙虾）对比、微信 AI 机器人接入"},
          {"title": "AI 编程 IDE", "path": "kb/技术/ai/ai-coding-ides.md", "desc": "Cursor vs Windsurf 对比，AI 编程工具的两种交互哲学"}
        ], "path": "kb/技术/ai/" },
        { "name": "系统设计", "files": [], "path": "kb/技术/系统设计/" },
        { "name": "中间件", "files": [], "path": "kb/技术/中间件/" }
      ],
      "path": "kb/技术/"
    },
    {
      "name": "读书笔记",
      "children": [
        { "name": "我看见的世界", "files": [
          {"title": "我看见的世界", "path": "kb/读书笔记/我看见的世界.md", "desc": "李飞飞"}
        ], "path": "kb/读书笔记/" }
      ],
      "path": "kb/读书笔记/"
    },
    {
      "name": "Action（排查/技巧/摘要）",
      "children": [
        { "name": "排查记录", "files": [
          {"title": "overview.html 维护踩坑记录", "path": "kb/action/overview-html-踩坑记录.md", "desc": "JS语法错误静默炸页面、content缺失、内容同步"}
        ], "path": "kb/action/" }
      ],
      "path": "kb/action/"
    },
    {
      "name": "日常思考",
      "children": [],
      "path": "kb/日常思考/"
    }
  ],
  "timeline": [
    {
      "week": "2026-W18 (04.27 - 05.03)",
      "entries": [
        {
          "date": "2026-05-03",
          "summary": "项目初始化：创建 AI 驱动个人知识库，确定目录结构、更新策略、文件格式规范",
          "links": [
            {"label": "CLAUDE.md", "url": "CLAUDE.md"},
            {"label": "设计文档", "url": "docs/superpowers/specs/2026-05-03-ai-auto-knowledge-base-design.md"}
          ]
        },
        {
          "date": "2026-05-03",
          "summary": "读书/技术：梳理 CNN、RNN、Transformer 三大深度学习基础架构",
          "links": [
            {"label": "CNN", "url": "kb/技术/ai/cnn.md"},
            {"label": "RNN", "url": "kb/技术/ai/rnn.md"},
            {"label": "Transformer", "url": "kb/技术/ai/transformer.md"},
            {"label": "读书笔记", "url": "kb/读书笔记/我看见的世界.md"}
          ]
        },
        {
          "date": "2026-05-04",
          "summary": "技术/AI：新增 LLM 核心概念（Prompt、RAG、微调、Agent）及生态（LangChain、向量数据库/Milvus、MCP 协议），讨论大模型同源性与'猜'的本质",
          "links": [
            {"label": "LLM", "url": "kb/技术/ai/llm.md"}
          ]
        }
      ]
    }
  ]
};

// ============================================================
// 文件索引 — path → {title, desc} 映射
// ============================================================
function buildFileIndex() {
  var idx = {};
  FILE_INDEX.categories.forEach(function(cat) {
    if (cat.children) {
      cat.children.forEach(function(child) {
        if (child.files) {
          child.files.forEach(function(file) {
            if (file.path) {
              idx[file.path] = { title: file.title, desc: file.desc };
            }
          });
        }
      });
    }
  });
  return idx;
}

// ============================================================
// 内容缓存
// ============================================================
var contentCache = {};

// ============================================================
// 服务器状态检测
// ============================================================
var serverAvailable = null; // null = unchecked, true/false = checked

function checkServer(callback) {
  if (serverAvailable !== null) {
    callback(serverAvailable);
    return;
  }
  fetch('kb/技术/ai/llm.md', { method: 'HEAD' })
    .then(function(resp) {
      serverAvailable = resp.ok;
      callback(serverAvailable);
    })
    .catch(function() {
      serverAvailable = false;
      callback(false);
    });
}

// ============================================================
// Markdown → HTML 渲染器
// ============================================================
function renderMarkdown(md) {
  var lines = md.split('\n');
  var html = '';
  var inCodeBlock = false;
  var codeBuf = [];
  var inTable = false;
  var tableRows = [];

  function processInline(text) {
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\[\[([^\]]+)\]\]/g, '<code>[[$1]]</code>');
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    return text;
  }

  function flushTable() {
    if (tableRows.length === 0) return '';
    var h = '<table>';
    tableRows.forEach(function(row, i) {
      h += '<tr>';
      row.forEach(function(cell) {
        h += (i === 0 ? '<th>' : '<td>') + processInline(cell.trim()) + (i === 0 ? '</th>' : '</td>');
      });
      h += '</tr>';
    });
    h += '</table>';
    tableRows = [];
    return h;
  }

  function processLine(line) {
    if (inCodeBlock) {
      if (/^```\s*$/.test(line)) {
        inCodeBlock = false;
        var code = escapeHtml(codeBuf.join('\n'));
        codeBuf = [];
        return '<pre><code>' + code + '</code></pre>';
      }
      codeBuf.push(line);
      return null;
    }

    if (/^```/.test(line)) {
      inCodeBlock = true;
      codeBuf = [];
      return null;
    }

    if (/^\|.+\|$/.test(line) && !/^\|-+\|$/.test(line)) {
      if (!inTable) { inTable = true; tableRows = []; }
      tableRows.push(line.split('|').slice(1, -1));
      return null;
    }
    if (/^\|[-:\s|]+\|$/.test(line)) {
      return null;
    }
    if (inTable) {
      inTable = false;
      var th = flushTable();
      inTable = false;
      tableRows = [];
      return th;
    }

    function slugify(text) {
      return text.toLowerCase().replace(/[^\w一-鿿]+/g, '-').replace(/^-|-$/g, '');
    }
    if (/^######\s/.test(line)) { var t = line.replace(/^######\s/, ''); return '<h6 id="' + slugify(t) + '">' + processInline(t) + '</h6>'; }
    if (/^#####\s/.test(line)) { var t = line.replace(/^#####\s/, ''); return '<h5 id="' + slugify(t) + '">' + processInline(t) + '</h5>'; }
    if (/^####\s/.test(line)) { var t = line.replace(/^####\s/, ''); return '<h4 id="' + slugify(t) + '">' + processInline(t) + '</h4>'; }
    if (/^###\s/.test(line)) { var t = line.replace(/^###\s/, ''); return '<h3 id="' + slugify(t) + '">' + processInline(t) + '</h3>'; }
    if (/^##\s/.test(line)) { var t = line.replace(/^##\s/, ''); return '<h2 id="' + slugify(t) + '">' + processInline(t) + '</h2>'; }
    if (/^#\s/.test(line)) { var t = line.replace(/^#\s/, ''); return '<h1 id="' + slugify(t) + '">' + processInline(t) + '</h1>'; }

    if (/^>\s/.test(line)) return '<blockquote>' + processInline(line.replace(/^>\s?/, '')) + '</blockquote>';
    if (/^---\s*$/.test(line)) return '<hr>';
    if (/^-\s/.test(line)) return '<li>' + processInline(line.replace(/^-\s/, '')) + '</li>';
    if (/^\s*$/.test(line)) return '<br>';
    return '<p>' + processInline(line) + '</p>';
  }

  for (var i = 0; i < lines.length; i++) {
    var result = processLine(lines[i]);
    if (result !== null) {
      if (inTable) { inTable = false; var th = flushTable(); if (th) html += th; }
      html += result + '\n';
    }
  }
  if (inTable) { var th2 = flushTable(); if (th2) html += th2; }
  if (inCodeBlock) { html += '<pre><code>' + escapeHtml(codeBuf.join('\n')) + '</code></pre>'; }

  return html;
}

// ============================================================
// TOC 生成
// ============================================================
function buildToc(markdown) {
  var lines = markdown.split('\n');
  var toc = [];
  var inCodeBlock = false;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (/^```/.test(line)) { inCodeBlock = !inCodeBlock; continue; }
    if (inCodeBlock) continue;
    var h2 = /^##\s(.+)/.exec(line);
    var h3 = /^###\s(.+)/.exec(line);
    if (h2) {
      toc.push({ level: 2, text: h2[1], id: slugify(h2[1]) });
    } else if (h3) {
      toc.push({ level: 3, text: h3[1], id: slugify(h3[1]) });
    }
  }
  return toc;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^\w一-鿿]+/g, '-').replace(/^-|-$/g, '');
}

function renderToc(tocItems, container) {
  var html = '<div class="toc-title">目录</div>';
  if (tocItems.length === 0) {
    html += '<span style="color:#bdc3c7;font-size:12px;">无标题</span>';
  }
  tocItems.forEach(function(item) {
    html += '<a href="#' + item.id + '" class="toc-h' + item.level + '" data-toc-id="' + item.id + '">' + escapeHtml(item.text) + '</a>';
  });
  container.innerHTML = html;

  container.querySelectorAll('a').forEach(function(a) {
    a.addEventListener('click', function(e) {
      e.preventDefault();
      var target = document.getElementById(this.dataset.tocId);
      if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });
}

function setupTocObserver() {
  var headings = document.querySelectorAll('.md-content h2, .md-content h3');
  var tocLinks = document.querySelectorAll('.toc-sidebar a[data-toc-id]');
  if (headings.length === 0 || tocLinks.length === 0) return;

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        tocLinks.forEach(function(link) {
          link.classList.toggle('active', link.dataset.tocId === entry.target.id);
        });
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });

  headings.forEach(function(h) { observer.observe(h); });
}

// ============================================================
// 内容查看 — fetch 动态读取 md 文件
// ============================================================
var currentView = 'categories';
var currentFile = null;

function viewContent(path) {
  var fileIndex = buildFileIndex();
  var file = fileIndex[path];
  if (!file) return;

  currentView = 'content';
  currentFile = path;
  document.getElementById('sidebar').classList.add('collapsed');

  var main = document.getElementById('main');
  main.innerHTML = '<h2>' + escapeHtml(file.title) + '</h2><div class="content-meta">加载中...</div>';

  function render(fileContent) {
    var tocItems = buildToc(fileContent);
    var showToc = tocItems.length >= 2;

    var html = '';
    html += '<span class="back-link" onclick="goBack()">← 返回分类导览</span>';
    html += '<h2>' + escapeHtml(file.title) + '</h2>';
    if (file.desc) {
      html += '<div class="content-meta">' + escapeHtml(file.desc) + '</div>';
    }

    if (showToc) {
      html += '<div class="content-with-toc">';
      html += '<div class="md-content">' + renderMarkdown(fileContent) + '</div>';
      html += '<div class="toc-sidebar" id="toc-sidebar"></div>';
      html += '</div>';
    } else {
      html += '<div class="md-content">' + renderMarkdown(fileContent) + '</div>';
    }

    main.innerHTML = html;

    if (showToc) {
      var tocContainer = document.getElementById('toc-sidebar');
      if (tocContainer) {
        renderToc(tocItems, tocContainer);
        setTimeout(setupTocObserver, 100);
      }
    }
  }

  // 命中缓存
  if (contentCache[path]) {
    render(contentCache[path]);
    return;
  }

  // 动态 fetch
  fetch(path)
    .then(function(resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.text();
    })
    .then(function(text) {
      contentCache[path] = text;
      render(text);
    })
    .catch(function() {
      main.innerHTML =
        '<div class="load-error">' +
        '<h2>无法加载文件</h2>' +
        '<p>请在终端执行 <code>./serve.sh</code> 启动本地服务器，然后刷新页面。</p>' +
        '<p style="margin-top:12px;font-size:13px;color:#95a5a6;">文件: ' + escapeHtml(path) + '</p>' +
        '</div>';
    });
}

function goBack() {
  document.getElementById('sidebar').classList.remove('collapsed');
  currentView = 'categories';
  currentFile = null;
  renderCategories();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

// ============================================================
// Tab 切换
// ============================================================
var tabs = document.querySelectorAll('.tab');
var main = document.getElementById('main');

tabs.forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.getElementById('sidebar').classList.remove('collapsed');
    tabs.forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    var tabName = tab.dataset.tab;
    currentView = tabName;
    if (tabName === 'categories') renderCategories();
    else if (tabName === 'timeline') renderTimeline();
    else if (tabName === 'search') renderSearch();
  });
});

// ============================================================
// 分类导览
// ============================================================
function renderCategories() {
  var html = '<h2>分类导览</h2>';

  FILE_INDEX.categories.forEach(function(cat, ci) {
    html += '<div class="tree-item">';
    html += '<span class="tree-toggle open" data-folder="cat-' + ci + '"></span> ';
    html += '<span class="tree-folder">' + escapeHtml(cat.name) + '</span>';

    if (cat.children && cat.children.length > 0) {
      html += '<div class="tree-children" id="children-cat-' + ci + '">';
      cat.children.forEach(function(child, si) {
        html += '<div class="tree-item">';
        html += '<span class="tree-toggle open" data-folder="cat-' + ci + '-sub-' + si + '"></span> ';
        html += '<span class="tree-folder">' + escapeHtml(child.name) + '</span>';
        html += '<div class="tree-children" id="children-cat-' + ci + '-sub-' + si + '">';
        if (child.files && child.files.length > 0) {
          child.files.forEach(function(file) {
            var title = file.title || file;
            var path = file.path || '';
            if (path) {
              html += '<span class="tree-file" onclick="viewContent(\'' + escapeHtml(path) + '\')" title="' + escapeHtml(path) + '">' + escapeHtml(title) + '</span>';
            } else {
              html += '<span class="tree-file">' + escapeHtml(title) + '</span>';
            }
          });
        } else {
          html += '<span class="tree-empty tree-file">（暂无内容）</span>';
        }
        html += '</div></div>';
      });
      html += '</div>';
    } else {
      html += '<div class="tree-children" id="children-cat-' + ci + '">';
      html += '<span class="tree-empty tree-file">（暂无内容）</span>';
      html += '</div>';
    }
    html += '</div>';
  });

  main.innerHTML = html;
  bindTreeToggles();
}

function bindTreeToggles() {
  document.querySelectorAll('.tree-toggle').forEach(function(toggle) {
    toggle.addEventListener('click', function() {
      var folder = this.dataset.folder;
      var children = document.getElementById('children-' + folder);
      if (children) {
        children.classList.toggle('collapsed');
        this.classList.toggle('open');
        this.classList.toggle('closed');
      }
    });
  });
}

// ============================================================
// 时间线
// ============================================================
function renderTimeline() {
  var html = '<h2>时间线</h2>';

  if (FILE_INDEX.timeline.length === 0) {
    html += '<div class="empty-state">暂无时间线记录，开始对话后 AI 会自动归档每周摘要。</div>';
  } else {
    FILE_INDEX.timeline.forEach(function(week) {
      html += '<div class="timeline-week">';
      html += '<h3>' + escapeHtml(week.week) + '</h3>';
      if (week.entries && week.entries.length > 0) {
        week.entries.forEach(function(entry) {
          html += '<div class="timeline-entry">';
          html += '<span class="date">' + escapeHtml(entry.date) + '</span> — ' + escapeHtml(entry.summary);
          if (entry.links && entry.links.length > 0) {
            entry.links.forEach(function(link) {
              if (link.url) {
                html += ' <span class="tl-link" onclick="viewContent(\'' + escapeHtml(link.url) + '\')">' + escapeHtml(link.label) + '</span>';
              } else {
                html += ' ' + escapeHtml(link.label);
              }
            });
          }
          html += '</div>';
        });
      } else {
        html += '<div class="tl-empty timeline-entry">本周暂无记录</div>';
      }
      html += '</div>';
    });
  }

  main.innerHTML = html;
}

// ============================================================
// 搜索
// ============================================================
function renderSearch() {
  var html = '<h2>搜索</h2>';
  html += '<input type="text" class="search-input" id="searchInput" placeholder="输入关键词检索知识库...">';
  html += '<div id="searchResults"></div>';
  main.innerHTML = html;

  var debounceTimer;
  var input = document.getElementById('searchInput');
  var results = document.getElementById('searchResults');
  input.addEventListener('input', function() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() {
      var q = input.value.trim().toLowerCase();
      if (!q) { results.innerHTML = ''; return; }
      var matches = searchKB(q);
      if (matches.length === 0) {
        results.innerHTML = '<div class="empty-state">未找到匹配结果</div>';
      } else {
        results.innerHTML = matches.map(function(m) {
          return '<div class="search-result"><span class="match">' + escapeHtml(m.title) + '</span> <span class="path">' + escapeHtml(m.path) + '</span></div>';
        }).join('');
      }
    }, 200);
  });
}

function searchKB(query) {
  var results = [];
  FILE_INDEX.categories.forEach(function(cat) {
    if (cat.children) {
      cat.children.forEach(function(child) {
        if (child.files) {
          child.files.forEach(function(file) {
            var title = file.title || file;
            var desc = file.desc || '';
            if (title.toLowerCase().includes(query) || desc.toLowerCase().includes(query)) {
              results.push({ title: title, path: (child.name || cat.name) + ' / ' + title });
            }
          });
        }
        if (child.name && child.name.toLowerCase().includes(query)) {
          results.push({ title: child.name, path: cat.name + ' / ' + child.name });
        }
      });
    }
    if (cat.name && cat.name.toLowerCase().includes(query)) {
      results.push({ title: cat.name, path: '分类' });
    }
  });
  FILE_INDEX.timeline.forEach(function(week) {
    if (week.entries) {
      week.entries.forEach(function(entry) {
        if (entry.summary.toLowerCase().includes(query)) {
          results.push({ title: entry.summary, path: '时间线 / ' + entry.date });
        }
      });
    }
  });
  return results;
}

// ============================================================
// 初始化
// ============================================================
function init() {
  checkServer(function(available) {
    if (available) {
      renderCategories();
    } else {
      main.innerHTML =
        '<div class="server-guide">' +
        '<h2>知识库导览</h2>' +
        '<p style="margin-bottom:16px;">需要本地 HTTP 服务器才能加载笔记内容。</p>' +
        '<p>请在终端执行:</p>' +
        '<p style="margin:12px 0;"><code>./serve.sh</code></p>' +
        '<p style="font-size:13px;color:#95a5a6;">然后刷新此页面</p>' +
        '</div>';
    }
  });
}

init();
</script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add overview.html
git commit -m "refactor: replace content embedding with runtime fetch, shrink overview.html from 140KB to ~12KB"
```

---

### Task 3: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace the overview.html maintenance section**

Replace lines 87-98 (the entire `### overview.html 维护规则（重要）` section) with the new simplified version:

```markdown
### 本地预览规则

1. 知识库通过本地 HTTP 服务器预览，启动命令：`./serve.sh`（端口 8765 + 自动打开浏览器）。
2. overview.html 是轻量目录索引，**不嵌入任何 md 文件内容**。运行时通过 `fetch()` 动态读取 md 文件，浏览器刷新即可看到最新内容。
3. **新增/删除 md 文件时**：在 overview.html 的 `FILE_INDEX` 中增删对应的元数据条目（纯 JSON，手工编辑一行即可），同时更新 INDEX.md。
4. **md 文件内容变更时**：不涉及 overview.html 更新——刷新浏览器即生效。
5. 保留规则：overview.html 中禁止裸链接（`<a href="xxx.md">`），统一使用 `<span onclick="viewContent()">`。
```

- [ ] **Step 2: Simplify the exit checklist**

Replace lines 107-117 (the `### 会话退出检查（重要）` section) — remove item 4 (overview.html integrity check) and renumber:

In the exit checklist, replace:
```markdown
1. **文件格式检查**：...
2. **交叉链接检查**：...
3. **Memory 检查**：...
4. **overview.html 完整性检查**：如果本次会话修改了 overview.html 或任何已嵌入的 .md 文件——
   - 执行 JS 语法检查：`sed -n '/<script>/,/<\/script>/p' overview.html | sed '1d;$d' > /tmp/check.js && node --check /tmp/check.js`
   - 执行内容一致性校验：用 `vm.runInContext` 解析 KB_DATA 后与对应 .md 文件逐字节比对，修复不一致
5. **Git 检查**：确认所有变更已提交，`git status` 显示 clean。
6. **INDEX.md 日期**：确认索引日期已更新至本次会话日期。
```

With:
```markdown
1. **文件格式检查**：扫描所有 kb/ 下本次变动的 md 文件，确认章节格式（`##` 标题）、元信息头（`> 最后整理: YYYY-MM-DD | 来源: xxx`）符合规范。发现格式不一致的文件立即修正。
2. **交叉链接检查**：确认新增/修改的文件有指向关联文件的双向链接（`[[./xxx]]` 或 `> 关联:` 格式）。
3. **Memory 检查**：确认本次会话中用户的新偏好、新反馈、新项目上下文已写入 `memory/` 目录并更新 `MEMORY.md` 索引。
4. **Git 检查**：确认所有变更已提交，`git status` 显示 clean。
5. **INDEX.md 日期**：确认索引日期已更新至本次会话日期。
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "chore: remove content-embedding maintenance rules, add local preview rules"
```

---

### Task 4: End-to-end verification

- [ ] **Step 1: Verify serve.sh starts correctly**

```bash
./serve.sh
# Expected: browser opens at localhost:8765, knowledge base renders
# Press Ctrl+C in terminal to stop
```

- [ ] **Step 2: Verify server detection works when server is down**

```bash
# Kill any running server first
kill $(lsof -t -i:8765) 2>/dev/null
# Open overview.html via file:// (double-click in Finder)
# Expected: shows server guide page with "./serve.sh" instruction
```

- [ ] **Step 3: Verify all files load correctly via fetch**

```bash
./serve.sh
# In the opened browser:
# - Click each file in the tree, verify content renders (no "加载中..." stuck)
# - Verify TOC sidebar appears for files with ≥2 headings
# - Click TOC links, verify smooth scrolling
# - Switch between Categories / Timeline / Search tabs
# - Click timeline links, verify they load content
# - Use search, verify results appear
# - Click "← 返回分类导览", verify tree re-renders
```

- [ ] **Step 4: Verify cache behavior**

```bash
# In browser DevTools Network tab:
# Click a file → fetch appears in network
# Click same file again → no new network request (served from contentCache)
```

- [ ] **Step 5: Verify CLAUDE.md consistency**

```bash
# Confirm no references to KB_DATA, content embedding, JS syntax check remain
grep -n "KB_DATA\|content 字段\|语法检查\|内容同步\|content 一致性\|vm.runInContext" CLAUDE.md
# Expected: no matches (all removed)
```

- [ ] **Step 6: Commit any remaining changes**

```bash
git status
git add -A
git commit -m "chore: finalize content-embedding removal, verification passed"
```
