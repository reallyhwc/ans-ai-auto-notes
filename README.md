# AI Auto Notes — 对话驱动的个人知识库

> 与 AI 聊天，自动沉淀为结构化知识库。

[:books: 开始浏览知识库 →](INDEX.md)

## 这是什么？

每次与 Claude Code 对话，AI 会自动对内容进行分类、归纳、总结，逐步构建为结构化的 Markdown 知识库。你只需正常聊天——提问、讨论、学习——知识库会在后台自动生长。

**核心特性：**
- **自动提取**：不用手动记笔记，AI 自动判断哪些内容值得记录
- **智能聚合**：同主题知识点追加到同一个文件，持续重组而非堆砌
- **本地预览**：一键启动可视化导览页，支持分类浏览、时间线、全文搜索
- **完全本地**：所有数据存储在本地 Git 仓库中，你拥有 100% 的控制权

## 快速开始

### 前置依赖

- [Node.js](https://nodejs.org/) >= 18（用于本地预览服务器）
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)（AI 对话驱动）

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd ans-ai-auto-notes
```

### 2. 启动知识库预览

```bash
./serve.sh
```

这会启动本地 HTTP 服务器（端口 8765）并自动打开浏览器。编辑 `kb/` 下的任何 Markdown 文件，浏览器会实时刷新。

- 再次运行 `./serve.sh` 可停止服务器。
- 直接用浏览器打开 <http://localhost:8765/overview.html>

### 3. 用 Claude Code 开始对话

```bash
claude
```

每次对话中，AI 会根据 `CLAUDE.md` 中定义的规则自动提取知识到 `kb/` 目录。

## 定制你的知识库

### 修改个人背景

编辑 `CLAUDE.md` 中的"用户背景"部分：

```markdown
## 用户背景

- 28 岁，男性，已婚未育
- 大厂 Java 后端程序员
- 近期在读李飞飞的《我看见的世界》
```

替换为你自己的背景信息。AI 会根据这些信息调整知识提取的侧重点和风格。

### 调整知识库结构

`CLAUDE.md` 中定义了完整的知识库维护规则，你可以根据自己的需求修改：
- 目录结构（`kb/` 下的分类）
- 文件组织规则（同主题聚合、拆分阈值等）
- 笔记风格（保留 Demo、可视化表达）

### 运行格式检查

```bash
./lint.sh
```

使用 markdownlint 自动检查所有知识库文件的格式规范。

## 项目结构

```
ans-ai-auto-notes/
├── kb/                          ← 知识库主目录
│   ├── 技术/                    ← 技术领域（Java、AI、系统设计等）
│   ├── 读书笔记/                ← 读书相关
│   ├── 日常思考/                ← 随笔、想法
│   └── action/                  ← 排查记录、技巧、灵感碎片
├── timeline/                    ← 按周归档的对话摘要
├── INDEX.md                     ← 总目录索引
├── overview.html                ← 可视化导览页（运行时 fetch md 文件）
├── CLAUDE.md                    ← AI 行为规则配置
├── server.js                    ← Node.js 本地预览服务器（实时刷新）
├── serve.sh                     ← 一键启动/停止预览服务器
├── lint.sh                      ← Markdown 格式检查
└── exit-check.sh                ← 会话退出自动检查
```

## 常见问题

**Q: 数据存储在哪里？**
A: 所有知识内容存储在 `kb/` 目录下的 Markdown 文件中。完全本地，你可以用任何文本编辑器查看和编辑。

**Q: 可以不装 Claude Code 使用吗？**
A: 可以。知识库本质就是一系列 Markdown 文件，你可以直接用 `./serve.sh` 浏览，也可以手动编辑。

**Q: 如何备份？**
A: `git push` 到远程仓库即可，或者直接复制整个目录。

## License

[MIT](LICENSE) © xuhu
