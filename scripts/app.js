/**
 * app.js — 知识库导览应用逻辑
 *
 * 从 overview.html 拆分而来，包含：
 * - Mermaid 初始化与主题切换
 * - marked.js 配置（替代自制 Markdown 渲染器）
 * - 数据加载（manifest.json + timeline.json）
 * - SPA 路由（分类/时间线/搜索/内容查看）
 * - TOC 侧栏、live reload
 *
 * 外部依赖（CDN，在 overview.html 中引用）：
 * - mermaid@10.9.3
 * - marked@18.0.3
 */

// ============================================================
// Mermaid 初始化
// ============================================================
function initMermaid() {
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'neutral',
    securityLevel: 'loose',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  });
}
initMermaid();

// ============================================================
// 深色模式切换
// ============================================================
function getPreferredTheme() {
  var stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  var icon = document.getElementById('themeIcon');
  if (icon) {
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme');
  var next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', next);
  applyTheme(next);
  initMermaid();
  // Re-render current view to apply Mermaid theme
  if (currentView === 'content' && currentFile) {
    contentCache = {};
    viewContent(currentFile);
  }
}

// Listen for system theme changes when user has no manual preference
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
  if (!localStorage.getItem('theme')) {
    applyTheme(e.matches ? 'dark' : 'light');
    initMermaid();
  }
});

// ============================================================
// 全局字体大小调节
// ============================================================
function setFontSize(size) {
  document.documentElement.setAttribute('data-font-size', size);
  localStorage.setItem('font-size', size);
  // 更新按钮高亮状态
  document.querySelectorAll('.font-size-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.size === size);
  });
}

function initFontSize() {
  var saved = localStorage.getItem('font-size') || 'md';
  // 兼容旧值迁移
  if (saved === 'small') saved = 'sm';
  if (saved === 'medium') saved = 'md';
  if (saved === 'large') saved = 'lg';
  document.documentElement.setAttribute('data-font-size', saved);
  document.querySelectorAll('.font-size-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.size === saved);
  });
}

// Apply theme on load (FOUC prevention already handled by inline <script> in <head>)
(function() {
  applyTheme(getPreferredTheme());
  initFontSize();
  var themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleTheme();
      }
    });
  }
})();

// ============================================================
// 工具函数
// 纯函数已抽到 scripts/lib.js（escapeHtml / escapeAttr / slugify /
// buildToc / resolveRelativeMd / renderKbLink），由 overview.html 在 app.js
// 之前 <script> 加载，作为全局可用。
// ============================================================

// ============================================================
// FILE_INDEX — 运行时从 manifest.json + timeline.json 加载
// 不再硬编码，由 build-index.js 构建生成
// ============================================================
var FILE_INDEX = { categories: [], timeline: [] };

// ============================================================
// 文件索引 — path → {title, desc} 映射
// ============================================================
function buildFileIndex() {
  var idx = {};
  function walk(node) {
    if (node.files) {
      node.files.forEach(function(file) {
        if (file.path) {
          idx[file.path] = { title: file.title, desc: file.desc };
        }
      });
    }
    if (node.children) {
      node.children.forEach(walk);
    }
  }
  FILE_INDEX.categories.forEach(walk);
  return idx;
}

// ============================================================
// 内容缓存
// ============================================================
var contentCache = {};

// ============================================================
// 服务器状态检测
// ============================================================
var serverAvailable = null;

function checkServer(callback) {
  if (serverAvailable !== null) {
    callback(serverAvailable);
    return;
  }
  fetch('INDEX.md', { method: 'HEAD' })
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
// Markdown → HTML 渲染器（marked.js）
// 替代自制渲染器，支持完整 GFM 语法
// ============================================================
marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    // 显式控制 heading id，确保与 buildToc 的 slugify 输出一致（TOC 点击跳转依赖此 id）
    heading: function(token) {
      var id = slugify(token.text);
      return '<h' + token.depth + ' id="' + id + '">' + this.parser.parseInline(token.tokens) + '</h' + token.depth + '>';
    },
    code: function(token) {
      if (token.lang === 'mermaid') {
        return '<div class="mermaid">' + token.text + '</div>';
      }
      return '<pre><code>' + escapeHtml(token.text) + '</code></pre>';
    },
    // 把 .md 链接路由到 viewContent，避免原生导航跳出 SPA
    // 渲染逻辑全部在 lib.js 的 renderKbLink，便于 Node 端单测
    link: function(token) {
      return renderKbLink(token.href || '', currentFile, this.parser.parseInline(token.tokens));
    }
  }
});

function renderMarkdown(md) {
  return marked.parse(md);
}

// ============================================================
// TOC 渲染（slugify、buildToc 在 lib.js 中）
// ============================================================
function renderToc(tocItems, container) {
  var html = '<div class="toc-title">目录</div>';
  if (tocItems.length === 0) {
    html += '<span style="color: var(--text-faint);font-size:12px;">无标题</span>';
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
  if (!file) {
    // path 不在 manifest.json 的 categories 中（如 CLAUDE.md、docs/ 下的文件）
    // fallback: 用文件名作 title，直接尝试 fetch 渲染
    if (path.endsWith('.md')) {
      file = { title: path.split('/').pop().replace(/\.md$/, ''), desc: '' };
    } else {
      console.warn('[viewContent] 不支持的文件类型: ' + path);
      return;
    }
  }

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

    // Render Mermaid diagrams after DOM insertion
    processMermaid();

    if (showToc) {
      var tocContainer = document.getElementById('toc-sidebar');
      if (tocContainer) {
        renderToc(tocItems, tocContainer);
        setTimeout(setupTocObserver, 100);
      }
    }

    // 渲染反向链接（被以下文件引用）
    renderBacklinks(path);
  }

  if (contentCache[path]) {
    render(contentCache[path]);
    return;
  }

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
        '<p style="margin-top:12px;font-size:13px;color: var(--text-muted);">文件: ' + escapeHtml(path) + '</p>' +
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
// Mermaid 图表渲染
// ============================================================
var mermaidId = 0;

function processMermaid() {
  if (typeof mermaid === 'undefined') return;
  var els = document.querySelectorAll('.mermaid');
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    if (el.dataset.mermaidRendered) continue;
    el.dataset.mermaidRendered = '1';
    var id = 'mermaid-' + (++mermaidId);
    var def = el.textContent;
    (function(element, elemId, definition) {
      try {
        mermaid.render(elemId, definition).then(function(result) {
          element.innerHTML = result.svg;
        }).catch(function(err) {
          element.innerHTML = '<pre class="mermaid-error">Mermaid 渲染失败: ' + err.message + '</pre>';
        });
      } catch(err) {
        element.innerHTML = '<pre class="mermaid-error">Mermaid 加载失败</pre>';
      }
    })(el, id, def);
  }
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
// 分类导览（递归渲染，支持任意深度嵌套）
// ============================================================
function renderCategories() {
  var html = '<h2>分类导览</h2>';
  FILE_INDEX.categories.forEach(function(cat, ci) {
    html += renderNode(cat, 'cat-' + ci);
  });
  main.innerHTML = html;
  bindTreeToggles();
}

function renderNode(node, idPrefix) {
  var html = '<div class="tree-item">';
  html += '<span class="tree-toggle open" data-folder="' + idPrefix + '"></span> ';
  html += '<span class="tree-folder">' + escapeHtml(node.name) + '</span>';
  html += '<div class="tree-children" id="children-' + idPrefix + '">';

  var hasContent = false;

  // 1. 递归渲染子节点（children）
  if (node.children && node.children.length > 0) {
    node.children.forEach(function(child, idx) {
      html += renderNode(child, idPrefix + '-sub-' + idx);
    });
    hasContent = true;
  }

  // 2. 渲染文件（files）
  if (node.files && node.files.length > 0) {
    node.files.forEach(function(file) {
      var title = file.title || file;
      var path = file.path || '';
      if (path) {
        html += '<span class="tree-file" onclick="viewContent(\'' + escapeHtml(path) + '\')" title="' + escapeHtml(path) + '">' + escapeHtml(title) + '</span>';
      } else {
        html += '<span class="tree-file">' + escapeHtml(title) + '</span>';
      }
    });
    hasContent = true;
  }

  // 3. 都为空时显示提示
  if (!hasContent) {
    html += '<span class="tree-empty tree-file">（暂无内容）</span>';
  }

  html += '</div></div>';
  return html;
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
// 搜索 + 词云
// ============================================================
var wordCloudRendered = false;

function renderSearch() {
  var html = '<h2>搜索</h2>';
  html += '<input type="text" class="search-input" id="searchInput" placeholder="输入关键词检索知识库...">';
  html += '<div id="wordCloudContainer" style="width:100%;height:calc(100vh - 200px);min-height:400px;margin-top:20px;"></div>';
  html += '<div id="searchResults" style="display:none;"></div>';
  main.innerHTML = html;

  var input = document.getElementById('searchInput');
  var results = document.getElementById('searchResults');
  var cloudContainer = document.getElementById('wordCloudContainer');

  // 渲染词云
  renderWordCloud(cloudContainer);

  var debounceTimer;
  input.addEventListener('input', function() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() {
      var q = input.value.trim().toLowerCase();
      if (!q) {
        results.style.display = 'none';
        results.innerHTML = '';
        cloudContainer.style.display = 'block';
        return;
      }
      // 隐藏词云，显示搜索结果
      cloudContainer.style.display = 'none';
      results.style.display = 'block';

      var matches = searchKB(q);
      if (matches.length === 0) {
        results.innerHTML = '<div class="empty-state">未找到匹配结果</div>';
      } else {
        results.innerHTML = matches.map(function(m) {
          var path = m.filePath || m.path || '';
          var onclick = path.endsWith('.md') ? 'onclick="viewContent(\'' + escapeAttr(path) + '\')" style="cursor:pointer"' : '';
          return '<div class="search-result" ' + onclick + '><span class="match">' + escapeHtml(m.title) + '</span> <span class="path">' + escapeHtml(m.displayPath || m.path) + '</span></div>';
        }).join('');
      }
    }, 200);
  });
}

function renderWordCloud(container) {
  if (typeof WordCloud === 'undefined') return;

  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var colors = isDark
    ? ['#5dade2', '#48c9b0', '#f39c12', '#e74c3c', '#9b59b6', '#1abc9c', '#e67e22', '#3498db']
    : ['#2980b9', '#27ae60', '#e67e22', '#c0392b', '#8e44ad', '#16a085', '#d35400', '#2c3e50'];

  var data = extractWordCloudData({ categories: FILE_INDEX.categories }, FILE_INDEX.timeline);
  if (data.length === 0) return;

  // 根据容器实际尺寸动态计算字号范围
  var containerWidth = container.offsetWidth || 600;
  var containerHeight = container.offsetHeight || 400;
  var area = containerWidth * containerHeight;
  // 面积越大，字号越大，基准：800x500=400000 对应 18~72px
  var scaleFactor = Math.sqrt(area / 400000);
  var minFont = Math.round(16 * scaleFactor);
  var maxFont = Math.round(80 * scaleFactor);

  // 归一化权重到字号范围
  var maxWeight = data[0][1];
  var minWeight = data[data.length - 1][1];
  var list = data.map(function(item) {
    var normalized = minWeight === maxWeight ? 1 : (item[1] - minWeight) / (maxWeight - minWeight);
    var fontSize = Math.round(minFont + normalized * (maxFont - minFont));
    return [item[0], fontSize];
  });

  // 使用 Canvas 渲染词云
  WordCloud(container, {
    list: list,
    gridSize: Math.max(4, Math.round(6 * scaleFactor)),
    weightFactor: 1,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: function() {
      return colors[Math.floor(Math.random() * colors.length)];
    },
    rotateRatio: 0,
    rotationSteps: 0,
    backgroundColor: 'transparent',
    shrinkToFit: true,
    click: function(item) {
      // 点击词云关键词 → 填入搜索框并触发搜索
      var input = document.getElementById('searchInput');
      if (input) {
        input.value = item[0];
        input.dispatchEvent(new Event('input'));
      }
    },
    hover: function(item, dimension, event) {
      if (item) {
        event.target.style.cursor = 'pointer';
      }
    }
  });
}

function searchKB(query) {
  var results = [];
  function walk(node, pathSegs) {
    // 节点名称命中
    if (node.name && node.name.toLowerCase().includes(query)) {
      results.push({ title: node.name, path: pathSegs.length ? pathSegs.join(' / ') : '分类' });
    }
    // 文件命中
    if (node.files) {
      node.files.forEach(function(file) {
        var title = file.title || file;
        var desc = file.desc || '';
        if (title.toLowerCase().includes(query) || desc.toLowerCase().includes(query)) {
          var displayPath = (pathSegs.length ? pathSegs.join(' / ') + ' / ' : '') + title;
          results.push({ title: title, displayPath: displayPath, filePath: file.path });
        }
      });
    }
    // 递归子节点
    if (node.children) {
      node.children.forEach(function(child) {
        walk(child, pathSegs.concat(node.name ? [node.name] : []));
      });
    }
  }
  FILE_INDEX.categories.forEach(function(cat) { walk(cat, []); });
  FILE_INDEX.timeline.forEach(function(week) {
    if (week.entries) {
      week.entries.forEach(function(entry) {
        if (entry.summary.toLowerCase().includes(query)) {
          // 取第一个 link 的 url 作为可点击路径
          var linkUrl = (entry.links && entry.links.length > 0) ? entry.links[0].url : '';
          results.push({ title: entry.summary, path: '时间线 / ' + entry.date, filePath: linkUrl });
        }
      });
    }
  });
  return results;
}

// ============================================================
// Live reload — 监听 kb/ 目录变化，自动刷新当前视图
// 带断线指数退避重连（serve.sh 重启后页面不需手动刷新）
// ============================================================
function setupLiveReload() {
  var retryDelay = 1000;
  var maxDelay = 30000;
  function connect() {
    var es = new EventSource('/__reload');
    es.onopen = function() {
      retryDelay = 1000; // 连上后重置退避
    };
    es.onmessage = function() {
      // manifest 可能已更新，重新加载分类数据
      loadManifest(function() {
        contentCache = {};
        if (currentView === 'content' && currentFile) {
          viewContent(currentFile);
        } else if (currentView === 'categories') {
          renderCategories();
        }
      });
    };
    es.onerror = function() {
      es.close();
      setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, maxDelay);
    };
  }
  connect();
}

// ============================================================
// 加载 manifest.json + timeline.json（单一数据源）
// ============================================================
function loadManifest(callback) {
  var p1 = fetch('manifest.json').then(function(r) { return r.json(); });
  var p2 = fetch('timeline.json').then(function(r) { return r.json(); }).catch(function() { return []; });
  Promise.all([p1, p2]).then(function(results) {
    FILE_INDEX.categories = results[0].categories || [];
    FILE_INDEX.timeline = results[1] || [];
    // 暴露完整 manifest 给侧栏全文搜索 + 反向链接渲染消费
    window.__manifest = results[0];
    callback(true);
  }).catch(function(err) {
    console.warn('[loadManifest] 加载失败:', err);
    callback(false);
  });
}

// ============================================================
// 初始化
// ============================================================
function init() {
  checkServer(function(available) {
    if (!available) {
      main.innerHTML =
        '<div class="server-guide">' +
        '<h2>知识库导览</h2>' +
        '<p style="margin-bottom:16px;">需要本地 HTTP 服务器才能加载笔记内容。</p>' +
        '<p>请在终端执行:</p>' +
        '<p style="margin:12px 0;"><code>./serve.sh</code></p>' +
        '<p class="server-hint">然后刷新此页面</p>' +
        '</div>';
      return;
    }
    // 服务器可用，加载数据后渲染
    loadManifest(function(ok) {
      if (!ok) {
        main.innerHTML =
          '<div class="server-guide">' +
          '<h2>数据加载失败</h2>' +
          '<p>无法加载 manifest.json 或 timeline.json</p>' +
          '<p>请确认已执行 <code>node scripts/build-index.js</code></p>' +
          '</div>';
        return;
      }
      setupLiveReload();
      renderCategories();
    });
  });
}

init();

// ============================================================
// 侧栏全文搜索（消费 build-index.js 生成的倒排表）
// 与"搜索"tab 的 title/desc 检索互补，能搜到正文 token
// ============================================================
var __kbSearchDebounceTimer = null;
function onSearchInput(query) {
  clearTimeout(__kbSearchDebounceTimer);
  __kbSearchDebounceTimer = setTimeout(function() { performKbSearch(query); }, 100);
}

function performKbSearch(query) {
  var results = document.getElementById('kb-search-results');
  if (!results) return;
  var q = (query || '').trim().toLowerCase();
  if (q.length < 1) {
    results.style.display = 'none';
    results.innerHTML = '';
    return;
  }
  if (!window.__manifest || !window.__manifest.searchIndex) {
    results.innerHTML = '<div class="kb-search-empty">索引未加载</div>';
    results.style.display = 'block';
    return;
  }
  var idx = window.__manifest.searchIndex;
  var files = window.__manifest.searchFiles || [];
  // 拆 query 为 tokens（与 build-index.tokenize 保持一致：英文 \w+ ≥2，中文单字）
  var tokens = [];
  (q.match(/[a-zA-Z0-9_]+/g) || []).forEach(function(t) {
    if (t.length >= 2) tokens.push(t);
  });
  (q.match(/[一-鿿]/g) || []).forEach(function(c) { tokens.push(c); });
  if (tokens.length === 0) {
    results.style.display = 'none';
    return;
  }
  // AND 匹配：取所有 token 命中文件 idx 的交集
  var hitSet = null;
  for (var i = 0; i < tokens.length; i++) {
    var hits = idx[tokens[i]] || [];
    var hitsSet = new Set(hits);
    if (hitSet === null) {
      hitSet = hitsSet;
    } else {
      var next = new Set();
      hitSet.forEach(function(x) { if (hitsSet.has(x)) next.add(x); });
      hitSet = next;
    }
    if (hitSet.size === 0) break;
  }
  var matched = Array.from(hitSet || []).map(function(i) { return files[i]; }).filter(Boolean).slice(0, 20);
  if (matched.length === 0) {
    results.innerHTML = '<div class="kb-search-empty">未找到匹配</div>';
  } else {
    results.innerHTML = matched.map(function(f) {
      var title = (f.path || '').split('/').pop().replace(/\.md$/, '');
      return '<span class="kb-search-item" onclick="viewContent(\'' + escapeAttr(f.path) + '\')" title="' + escapeAttr(f.path) + '">' + escapeHtml(title) + '</span>';
    }).join('');
  }
  results.style.display = 'block';
}

// ============================================================
// 反向链接渲染（追加到 .md-content 底部）
// ============================================================
function renderBacklinks(path) {
  if (!window.__manifest || !window.__manifest.backlinks) return;
  var refs = window.__manifest.backlinks[path] || [];
  if (refs.length === 0) return;
  var mdContent = document.querySelector('.md-content');
  if (!mdContent) return;
  var html = '<div class="backlinks-block">';
  html += '<div class="backlinks-title">被以下文件引用 (' + refs.length + ')</div>';
  html += '<ul>';
  refs.forEach(function(r) {
    var title = r.split('/').pop().replace(/\.md$/, '');
    html += '<li><span class="kb-link" onclick="viewContent(\'' + escapeAttr(r) + '\')" title="' + escapeAttr(r) + '">' + escapeHtml(title) + '</span></li>';
  });
  html += '</ul></div>';
  mdContent.insertAdjacentHTML('beforeend', html);
}
