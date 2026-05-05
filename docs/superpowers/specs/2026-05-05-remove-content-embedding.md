# 设计：消除 overview.html 内容嵌入，改为动态 fetch

> 日期: 2026-05-05 | 状态: 待实现

## 问题

overview.html 将所有 md 文件的完整 Markdown 内容嵌入为 JS 对象字面量中的 JSON 字符串（KB_DATA），导致：

- 文件膨胀至 140KB / 740 行
- 每次 md 文件变更必须用 Node 脚本同步更新 HTML 嵌入内容
- JS 语法错误（如括号不匹配、条目误入函数体）会导致页面所有交互静默失效
- 维护步骤多（读 HTML → 解析 → 替换 → 序列化 → 语法检查 → 一致性校验）

根因：**内容冗余**——md 文件和 overview.html 各存一份相同内容。

## 方案

将 overview.html 从"内容仓库"改造为"轻量目录索引 + 运行时 fetch 渲染器"。

```
之前: md → 改内容 → Node 脚本同步 overview.html → JS 检查 → 校验
之后: md → 改内容 → 浏览器刷新 → fetch() 自动读到最新
```

通过本地 HTTP 服务器（`python3 -m http.server`）解除 `file://` 协议下浏览器的 fetch 限制。

## 架构

```
┌──────────────────────────────────────────────────────┐
│  serve.sh (一键启动)                                   │
│    ├─ 检查端口 8765 是否已占用                          │
│    ├─ 启动 python3 -m http.server 8765                │
│    └─ open http://localhost:8765                      │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│  overview.html (~15KB, 不再嵌入内容)                    │
│                                                       │
│  FILE_INDEX (轻量元数据):                               │
│    categories[] → children[] → files[]                 │
│      每个 file: {title, path, desc}  ← 无 content 字段  │
│    timeline[] → week, entries[]                        │
│                                                       │
│  运行时:                                                │
│    点击文件 → fetch(path) → 缓存 → renderMarkdown()      │
│    fetch 失败 → 显示启动引导                            │
└──────────────────────────────────────────────────────┘
```

## 变更文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `serve.sh` | 新建 | 启动 python3 http.server 8765 + open 浏览器 |
| `overview.html` | 重写 | 去掉 content 嵌入，改 fetch 模式，约从 740 行降到 ~350 行 |
| `CLAUDE.md` | 精简 | 删 5 条过期 overview.html 规则，加本地预览规则 |

`INDEX.md`、`kb/`、`timeline/`、`.gitignore` 均不改。

## 详细设计

### serve.sh

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

- 幂等：重复执行不会启动多个实例
- `open` 用默认浏览器打开（macOS 原生）
- `python3 -m http.server` 是 Python 标准库，零依赖
- 资源占用：空闲时 0% CPU，~5MB 内存

### overview.html 数据结构变更

**之前**（140KB）：每个 file 条目包含完整 Markdown 正文
```javascript
{"title":"LLM","path":"kb/技术/ai/llm.md","desc":"核心原理...",
 "content":"# LLM（大语言模型）核心原理\n\n> 最后整理..."}
```

**之后**（~15KB）：纯元数据
```javascript
{"title":"LLM","path":"kb/技术/ai/llm.md","desc":"核心原理：架构、因果推理、KV Cache"}
```

### 运行时渲染流程

```
用户点击文件
  → contentCache[path] 命中? → 直接渲染
  → 未命中 → fetch(path)
      → 成功 → 缓存 → renderMarkdown() → 显示
      → 失败 → 显示"请执行 ./serve.sh 启动服务器"
```

- `renderMarkdown()`、`buildToc()` 等现有渲染函数不改
- 新增简单的 `Map` 做内容缓存，避免重复 fetch

### 状态检测

页面加载时：
1. 尝试 `fetch('kb/技术/ai/llm.md')`
2. 成功 → 正常渲染文件树
3. 失败 → 显示启动引导页（告诉用户运行 `./serve.sh`）

### 新增文件时的维护

```
1. 创建 md 文件
2. 更新 INDEX.md（一行）
3. 在 overview.html FILE_INDEX 中加一条 JSON 条目（一手工编辑）
```

### 修改现有内容时的维护

```
1. Edit md 文件
  （overview.html 无需任何改动，刷新浏览器即生效）
```

## CLAUDE.md 规则变更

### 删除的规则

- "每次修改后必跑 JS 语法检查"——不再嵌入内容，JS 结构简单稳定
- "content 字段要么有要么没有"——没有 content 字段了
- "KB_DATA 内容同步检查"——运行时 fetch，不存在内容同步问题
- "用脚本修改，不要手工编辑 KB_DATA"——FILE_INDEX 只是轻量元数据
- 会话退出检查中的 "overview.html 完整性检查"

### 新增规则

```markdown
### 本地预览规则

1. 知识库通过本地 HTTP 服务器预览（`./serve.sh`），端口 8765。
2. overview.html 是轻量目录索引，不嵌入任何 md 文件内容。
3. 运行时通过 fetch() 动态读取 md 文件，浏览器刷新即可看到最新内容。
4. 新增/删除 md 文件时，在 overview.html 的 FILE_INDEX 中增删对应元数据条目。
5. md 文件内容变更不涉及 overview.html 更新——刷新浏览器即生效。
```

## 收益

| 维度 | 之前 | 之后 |
|------|------|------|
| overview.html 大小 | 140KB | ~15KB |
| 每次笔记后维护步骤 | 5-6 步 | 2-3 步（写 md + 更新 INDEX，偶尔更新 FILE_INDEX） |
| 内容同步风险 | 高（7/20 次 commit 在修 HTML 问题） | 零（运行时 fetch，不存在同步问题） |
| JS 语法错误风险 | 高（嵌入大量 Markdown 转义字符串） | 低（无嵌入内容，JS 结构简单） |
| 新增文件操作 | 6 步（含 Node 脚本） | 3 步（写 md + INDEX + 一条 JSON） |
