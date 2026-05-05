# AI 驱动个人知识库 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从零搭建个人知识库的完整骨架：git 仓库、目录结构、索引文件、可视化导览页、时间线模板。

**Architecture:** 纯静态文件系统，git + markdown。核心资产：主题分类目录 `kb/`、按周时间线 `timeline/`、总索引 `INDEX.md`、静态可视化页 `overview.html`。AI 行为规则在 `CLAUDE.md`（已存在）。

**Tech Stack:** Git, Markdown, HTML/CSS/JavaScript (vanilla, 零依赖)

---

### Task 1: 初始化 Git 仓库

**Files:**
- Create: `.gitignore`
- Run: `git init`

- [ ] **Step 1: 编写 .gitignore**

```bash
cat > .gitignore << 'GITIGNORE'
# macOS
.DS_Store
.AppleDouble
.LSOverride
Icon
._*
.DocumentRevisions-V100
.fseventsd
.Spotlight-V100
.TemporaryItems
.Trashes
.VolumeIcon.icns
.com.apple.timemachine.donotpresent

# IDE
.idea/
.vscode/
*.swp
*.swo
*~

# Temp files
*.tmp
*.bak
GITIGNORE
```

- [ ] **Step 2: 初始化 Git 仓库并首次提交**

```bash
cd .
git init
git add .gitignore CLAUDE.md docs/
git commit -m "init: 项目初始化 — CLAUDE.md、设计文档、.gitignore"
```

Expected: `git log --oneline` 显示 1 个 commit，`git status` 显示 clean。

---

### Task 2: 创建知识库目录结构

**Files:**
- Create: `kb/技术/java/` (dir)
- Create: `kb/技术/ai/` (dir)
- Create: `kb/技术/系统设计/` (dir)
- Create: `kb/技术/中间件/` (dir)
- Create: `kb/读书笔记/` (dir)
- Create: `kb/日常思考/` (dir)
- Create: `kb/action/` (dir)
- Create: `timeline/` (dir)

- [ ] **Step 1: 创建所有目录**

```bash
cd .
mkdir -p kb/技术/java
mkdir -p kb/技术/ai
mkdir -p kb/技术/系统设计
mkdir -p kb/技术/中间件
mkdir -p kb/读书笔记
mkdir -p kb/日常思考
mkdir -p kb/action
mkdir -p timeline
```

- [ ] **Step 2: 验证目录结构**

```bash
cd .
find kb timeline -type d | sort
```

Expected output:
```
kb
kb/action
kb/技术
kb/技术/ai
kb/技术/java
kb/技术/中间件
kb/技术/系统设计
kb/读书笔记
kb/日常思考
timeline
```

- [ ] **Step 3: 为空目录添加 .gitkeep（确保 git 跟踪空目录）**

```bash
cd .
touch kb/技术/java/.gitkeep
touch kb/技术/ai/.gitkeep
touch kb/技术/系统设计/.gitkeep
touch kb/技术/中间件/.gitkeep
touch kb/读书笔记/.gitkeep
touch kb/日常思考/.gitkeep
touch kb/action/.gitkeep
```

- [ ] **Step 4: 提交**

```bash
cd .
git add kb/ timeline/
git commit -m "feat: 创建知识库目录结构（技术/读书笔记/日常思考/action/timeline）"
```

---

### Task 3: 创建 INDEX.md 总索引

**Files:**
- Create: `INDEX.md`

- [ ] **Step 1: 编写 INDEX.md 模板**

Write file `INDEX.md`:

```markdown
# 知识库索引

> 最后更新: 2026-05-03

## 技术

### Java
<!-- 文件: kb/技术/java/ -->

### AI / 机器学习
<!-- 文件: kb/技术/ai/ -->

### 系统设计
<!-- 文件: kb/技术/系统设计/ -->

### 中间件
<!-- 文件: kb/技术/中间件/ -->

## 读书笔记
<!-- 文件: kb/读书笔记/ -->

## Action（排查记录 / 好文摘要 / 技巧）
<!-- 文件: kb/action/ -->

## 日常思考
<!-- 文件: kb/日常思考/ -->
```

- [ ] **Step 2: 验证文件存在**

```bash
head -3 INDEX.md
```

Expected: 显示 `# 知识库索引` 和更新日期。

- [ ] **Step 3: 提交**

```bash
cd .
git add INDEX.md
git commit -m "feat: 创建 INDEX.md 总索引模板"
```

---

### Task 4: 创建首周 Timeline 文件

**Files:**
- Create: `timeline/2026-W18.md`

We are in 2026-05-03 (Sunday, week 18 per ISO week numbering starting from Jan 1). The current week starting 2026-04-27 is W18. Actually, let's use the correct week number. May 3 2026 is a Sunday. ISO week: W18 (April 27 - May 3).

- [ ] **Step 1: 编写 timeline/2026-W18.md**

Write file `timeline/2026-W18.md`:

```markdown
# 2026 第18周 (04.27 - 05.03)

## 2026-05-03 周日

- **项目初始化**：创建 AI 驱动个人知识库项目，确定目录结构、更新策略、文件格式规范 → 详见 [CLAUDE.md](../CLAUDE.md) 和 [设计文档](../docs/superpowers/specs/2026-05-03-ai-auto-knowledge-base-design.md)

> 本周为项目启动周，后续对话内容将在此文件中持续归档。
```

- [ ] **Step 2: 验证**

```bash
head -5 timeline/2026-W18.md
```

- [ ] **Step 3: 提交**

```bash
cd .
git add timeline/
git commit -m "feat: 创建首周 timeline (2026-W18) 并记录项目启动"
```

---

### Task 5: 创建 overview.html 可视化导览页

**Files:**
- Create: `overview.html`

This is the largest piece. A single-file, zero-dependency static page with:
- Left sidebar navigation (tabs: 分类导览 / 时间线 / 搜索)
- Right content area
- Embedded JSON data (populated by AI during each session)
- Tree view for categories
- Timeline list for weekly summaries
- Simple keyword filter for search

- [ ] **Step 1: 编写 overview.html**

Write file `overview.html`:

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
  .sidebar { width: 200px; background: #2c3e50; color: #ecf0f1; display: flex; flex-direction: column; padding-top: 20px; flex-shrink: 0; }
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
  .tree-file { color: #2980b9; cursor: pointer; margin-left: 20px; font-size: 14px; }
  .tree-file:hover { text-decoration: underline; }
  .tree-children { margin-left: 16px; }
  .tree-children.collapsed { display: none; }
  .timeline-week { margin-bottom: 24px; }
  .timeline-week h3 { font-size: 16px; color: #2c3e50; margin-bottom: 8px; }
  .timeline-entry { padding: 6px 0 6px 16px; border-left: 2px solid #ddd; margin-left: 6px; font-size: 14px; }
  .timeline-entry .date { color: #7f8c8d; font-size: 12px; }
  .timeline-entry a { color: #2980b9; text-decoration: none; }
  .timeline-entry a:hover { text-decoration: underline; }
  .search-input { width: 100%; padding: 10px 14px; font-size: 14px; border: 1px solid #ddd; border-radius: 6px; margin-bottom: 20px; outline: none; }
  .search-input:focus { border-color: #3498db; box-shadow: 0 0 0 2px rgba(52,152,219,0.2); }
  .search-result { padding: 8px 0; font-size: 14px; border-bottom: 1px solid #eee; }
  .search-result .match { color: #2c3e50; font-weight: 600; }
  .search-result .path { color: #7f8c8d; font-size: 12px; }
  .empty-state { color: #95a5a6; font-size: 14px; margin-top: 40px; text-align: center; }
</style>
</head>
<body>

<div class="sidebar">
  <div class="title">知识库导览</div>
  <div class="tab active" data-tab="categories">分类导览</div>
  <div class="tab" data-tab="timeline">时间线</div>
  <div class="tab" data-tab="search">搜索</div>
</div>

<div class="main" id="main"></div>

<script>
// ============================================================
// 知识库数据 — 由 AI 在每次整理时同步更新此 JSON
// ============================================================
const KB_DATA = {
  "categories": [
    {
      "name": "技术",
      "children": [
        { "name": "Java", "files": [], "path": "kb/技术/java/" },
        { "name": "AI / 机器学习", "files": [], "path": "kb/技术/ai/" },
        { "name": "系统设计", "files": [], "path": "kb/技术/系统设计/" },
        { "name": "中间件", "files": [], "path": "kb/技术/中间件/" }
      ],
      "path": "kb/技术/"
    },
    {
      "name": "读书笔记",
      "children": [],
      "path": "kb/读书笔记/"
    },
    {
      "name": "Action（排查/技巧/摘要）",
      "children": [],
      "path": "kb/action/"
    },
    {
      "name": "日常思考",
      "children": [],
      "path": "kb/日常思考/"
    }
  ],
  "timeline": [
  ]
};

// ============================================================
// Tab 切换
// ============================================================
const tabs = document.querySelectorAll('.tab');
const main = document.getElementById('main');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const tabName = tab.dataset.tab;
    if (tabName === 'categories') renderCategories();
    else if (tabName === 'timeline') renderTimeline();
    else if (tabName === 'search') renderSearch();
  });
});

// ============================================================
// 分类导览
// ============================================================
function renderCategories() {
  let html = '<h2>分类导览</h2>';

  KB_DATA.categories.forEach(cat => {
    html += `<div class="tree-item">`;
    html += `<span class="tree-toggle open" data-folder="${cat.name}"></span> `;
    html += `<span class="tree-folder">${cat.name}</span>`;

    if (cat.children && cat.children.length > 0) {
      html += `<div class="tree-children" id="children-${cat.name}">`;
      cat.children.forEach(child => {
        html += `<div class="tree-item">`;
        html += `<span class="tree-toggle open" data-folder="${cat.name}-${child.name}"></span> `;
        html += `<span class="tree-folder">${child.name}</span>`;
        html += `<div class="tree-children" id="children-${cat.name}-${child.name}">`;
        if (child.files && child.files.length > 0) {
          child.files.forEach(file => {
            const fname = file.path || file.title || file;
            const title = file.title || file;
            html += `<div class="tree-file" title="${fname}">${title}</div>`;
          });
        } else {
          html += `<div class="tree-file" style="color:#bdc3c7; cursor:default;">（暂无内容）</div>`;
        }
        html += `</div></div>`;
      });
      html += `</div>`;
    } else {
      html += `<div class="tree-children" id="children-${cat.name}">`;
      html += `<div class="tree-file" style="color:#bdc3c7; cursor:default;">（暂无内容）</div>`;
      html += `</div>`;
    }
    html += `</div>`;
  });

  main.innerHTML = html;
  bindTreeToggles();
}

function bindTreeToggles() {
  document.querySelectorAll('.tree-toggle').forEach(toggle => {
    toggle.addEventListener('click', function() {
      const folder = this.dataset.folder;
      const children = document.getElementById('children-' + folder);
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
  let html = '<h2>时间线</h2>';

  if (KB_DATA.timeline.length === 0) {
    html += '<div class="empty-state">暂无时间线记录，开始对话后 AI 会自动归档每周摘要。</div>';
  } else {
    KB_DATA.timeline.forEach(week => {
      html += `<div class="timeline-week">`;
      html += `<h3>${week.week}</h3>`;
      if (week.entries && week.entries.length > 0) {
        week.entries.forEach(entry => {
          html += `<div class="timeline-entry">`;
          html += `<span class="date">${entry.date}</span> — ${entry.summary}`;
          if (entry.links && entry.links.length > 0) {
            entry.links.forEach(link => {
              html += ` <a href="${link.url}">${link.label}</a>`;
            });
          }
          html += `</div>`;
        });
      } else {
        html += `<div class="timeline-entry" style="color:#bdc3c7;">本周暂无记录</div>`;
      }
      html += `</div>`;
    });
  }

  main.innerHTML = html;
}

// ============================================================
// 搜索
// ============================================================
function renderSearch() {
  let html = '<h2>搜索</h2>';
  html += '<input type="text" class="search-input" id="searchInput" placeholder="输入关键词检索知识库...">';
  html += '<div id="searchResults"></div>';
  main.innerHTML = html;

  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { results.innerHTML = ''; return; }
    const matches = searchKB(q);
    if (matches.length === 0) {
      results.innerHTML = '<div class="empty-state">未找到匹配结果</div>';
    } else {
      results.innerHTML = matches.map(m =>
        `<div class="search-result"><span class="match">${m.title}</span> <span class="path">${m.path}</span></div>`
      ).join('');
    }
  });
}

function searchKB(query) {
  const results = [];
  KB_DATA.categories.forEach(cat => {
    if (cat.children) {
      cat.children.forEach(child => {
        if (child.files) {
          child.files.forEach(file => {
            const title = file.title || file;
            const desc = file.desc || '';
            if (title.toLowerCase().includes(query) || desc.toLowerCase().includes(query) || (child.name && child.name.toLowerCase().includes(query))) {
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
  return results;
}

// ============================================================
// 初始化：默认显示分类导览
// ============================================================
renderCategories();
</script>
</body>
</html>
```

- [ ] **Step 2: 验证文件存在且为有效 HTML**

```bash
head -5 overview.html
```

Expected: `<!DOCTYPE html>` followed by `<html lang="zh-CN">`.

- [ ] **Step 3: 提交**

```bash
cd .
git add overview.html
git commit -m "feat: 创建 overview.html 可视化导览页（三Tab：分类/时间线/搜索）"
```

---

### Task 6: 最终验证与完整提交

- [ ] **Step 1: 验证完整目录结构**

```bash
cd .
find . -not -path './.git/*' -not -name '.git' | sort
```

Expected: 完整的项目结构，包含所有文件和目录。

- [ ] **Step 2: 查看 Git 日志**

```bash
cd .
git log --oneline
```

Expected: 5 个 commit（init → 目录结构 → INDEX → timeline → overview）。

- [ ] **Step 3: 最终状态检查**

```bash
cd .
git status
```

Expected: `nothing to commit, working tree clean`。
