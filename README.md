# AI Auto Notes — 对话驱动的个人知识库

> 与 AI 聊天，自动沉淀为结构化知识库。零手动整理，完全本地，38+ 篇笔记持续生长中。

[:books: 浏览知识库 →](INDEX.md) &nbsp;|&nbsp; [:bar_chart: 可视化导览](http://localhost:8765/overview.html)

## 这是什么？

每次与 Claude Code 对话，AI 会自动对内容进行分类、归纳、总结，逐步构建为结构化的 Markdown 知识库。你只需正常聊天——提问、讨论、学习——知识库会在后台自动生长。

**核心理念：不是你在记笔记，是 AI 在帮你记。**

## 特色

- **自动提取**：AI 自动判断哪些内容值得记录，不等你提醒
- **智能聚合**：同主题知识点追加到同一个文件，持续重组而非堆砌
- **主动发散**：AI 不只被动回答，还会主动提议"要不要把 X 也记录下来？"
- **三层约束体系**：基于 Harness Engineering 理念，规则不仅写在 CLAUDE.md 里，更用 hooks 机械强制执行
- **可视化导览**：一键启动本地预览页，支持分类浏览、时间线、全文搜索、词云、Mermaid 图表渲染
- **零网络依赖**：所有前端资源（mermaid / marked / wordcloud2）固化到本地 vendor 目录，离线秒开
- **完全本地**：所有数据存储在本地 Git 仓库，你拥有 100% 控制权

## 知识库内容概览

当前已积累 **38+ 篇**结构化笔记，覆盖以下领域：

| 分类 | 代表笔记 |
|------|----------|
| **AI / 大模型** | LLM 原理、Agent 与 MCP 协议、Prompt & RAG、多模态、微调部署 |
| **AI / 应用生态** | AI Coding 工具对比、团队治理、Workflow 平台、Agent 开发实战 |
| **AI / Claude-Code** | 架构解析、Harness Engineering、高级工作流、Remote Control |
| **Java 后端** | RocketMQ 底层实现、分布式事务全景、热点账户高并发方案、Spring AI |
| **计算机基础** | 贝叶斯统计、图灵与冯诺依曼 |
| **实战踩坑** | overview.html 踩坑记录、GitHub 仓库搭建 |
| **读书笔记** | 《我看见的世界》、《世界的逻辑》 |

## 可视化导览

一键 `./serve.sh` 启动本地预览页，提供：

- **分类浏览**：递归树状展示所有笔记，支持展开/折叠
- **时间线**：按周归档每次对话摘要，可跳转到对应笔记
- **全文搜索 + 词云**：搜索前显示知识库关键词词云（基于 wordcloud2.js），点击词汇即跳转搜索
- **Markdown 渲染**：支持代码高亮、Mermaid 图表、站内链接跳转、目录导航
- **Live Reload**：文件变更后浏览器自动刷新
- **深色模式**：跟随系统主题或手动切换
- **字号调节**：四档字号（S/M/L/XL）一键切换

所有前端依赖（mermaid 3.3MB / marked 43KB / wordcloud2 37KB）均固化在 `scripts/vendor/` 目录，**零网络请求，离线秒开**。

## Harness Engineering 三层约束体系

项目采用 **"约束 > 文档 > 对话"** 三层模型，规则从"靠说"升级为"靠执行"：

```
约束层（Hooks 机械执行）  →  SessionStart 预检 + Stop 退出检查 + 架构 Linter
文档层（文件系统持久化）  →  Session 日志 + Memory 分层记忆 + Plan 状态追踪
对话层（AI 实时理解）     →  CLAUDE.md 项目规则 + AI 推理
```

| 层级 | 触发时机 | 做什么 |
|------|---------|--------|
| **约束层** | SessionStart | 环境体检 + 遗留变更提醒 + memory 过期检查（>14天）+ 架构 Linter（frontmatter / 死链 / 重复标题 / 行数 / 大小写一致性） |
| **约束层** | Stop | Markdown lint + Git 状态 + 健康检查（12 项）+ Session 日志 + 权限审计 + 未 push 提醒（>5 自动 push） |
| **文档层** | Stop → 文件 | 从 git diff 自动生成结构化 session 日志，同日多次累加 |
| **文档层** | 跨 Session | Memory 分层（稳定层/项目层/流水层），所有记忆带时间戳，>14 天自动告警 |

### Hook 脚本体系

| 脚本 | 触发 | 功能 |
|------|------|------|
| `scripts/preflight.sh` | SessionStart | 上次 session 摘要、遗留变更、manifest 过期、memory 淘汰、调用 arch-lint |
| `scripts/arch-lint.sh` | SessionStart | 8 项 KB 架构检查（frontmatter / 死链 / 行数 / 重复标题等） |
| `exit-check.sh` | Stop | 串联 lint + check-overview + session-log + permission-audit + 未 push 检查 |
| `scripts/session-log.sh` | Stop | 从 git diff 自动生成 session 日志 |
| `scripts/permission-audit.sh` | Stop | 扫描 scripts/ vs allowlist，建议安全命令加白 |
| `scripts/check-overview.js` | Stop | 12 项健康检查（数据完整性、链接、行数等） |
| `scripts/build-index.js` | 手动 / `serve.sh` | 扫描 kb/ 重建 manifest.json + INDEX.md |

## 项目结构

```
ans-ai-auto-notes/
├── kb/                     # 知识库主目录
│   ├── 技术/AI/            # AI 相关笔记（大模型、应用、Coding、Claude-Code）
│   ├── 技术/Java/          # Java 后端（MQ、事务、热点账户、Spring AI）
│   ├── 技术/计算机基础/     # 计算机基础（统计、计算理论）
│   ├── 实战/               # 踩坑记录 & 实战技巧
│   └── 读书笔记/           # 读书笔记
├── timeline/               # 按周归档的对话摘要
├── memory/                 # AI 记忆层（用户画像、项目知识、反馈记录）
├── scripts/                # 自动化脚本
│   ├── vendor/             # 前端依赖（mermaid / marked / wordcloud2）
│   ├── app.js              # 导览页前端逻辑
│   ├── lib.js              # 纯函数库（浏览器 + Node 双环境）
│   ├── build-index.js      # 索引构建
│   └── ...                 # lint / session-log / audit 等
├── overview.html           # 可视化导览页
├── server.js               # 本地 HTTP 服务器（SSE live reload）
├── CLAUDE.md               # AI 行为规则（核心配置文件）
└── timeline.json           # 时间线数据
```

## 快速开始

### 前置依赖

- [Node.js](https://nodejs.org/) >= 18
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)（AI 对话驱动）

### 1. 克隆项目

```bash
git clone git@github.com:reallyhwc/ans-ai-auto-notes.git
cd ans-ai-auto-notes
```

### 2. 启动知识库预览

```bash
./serve.sh
```

启动本地 HTTP 服务器（端口 8765，仅监听 `127.0.0.1`）并自动打开浏览器。`kb/` 下的 Markdown 文件变更时浏览器实时刷新，新增/删除文件自动重建索引。

### 3. 用 Claude Code 开始对话

```bash
claude
```

AI 会根据 `CLAUDE.md` 中的规则自动提取知识到 `kb/` 目录。每次文件变更后自动 commit，退出时由 Stop hook 自动跑健康检查并提醒未 push 的提交。

## 常用命令

```bash
./serve.sh                    # 启动本地预览（端口 8765）
node scripts/build-index.js   # 重建 manifest.json + INDEX.md
./lint.sh                     # markdownlint 格式检查
node scripts/check-overview.js # 12 项健康检查
bash scripts/arch-lint.sh     # 8 项 KB 架构检查
```

## 定制

详细规则、目录组织、文件拆分阈值、笔记风格规则均在 [CLAUDE.md](CLAUDE.md)。

- **修改个人背景** → 编辑 `CLAUDE.md` 中的"用户背景"
- **调整知识库结构** → 修改 `CLAUDE.md` 中的目录规则、文件拆分阈值
- **自定义笔记风格** → 修改 `CLAUDE.md` 中的"笔记风格规则"
- **添加新分类** → 在 `kb/` 下新建目录，AI 会自动识别并归类

## 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| AI 引擎 | Claude Code + Superpowers | 对话驱动 + TDD/Debugging 等 skill 框架 |
| 前端渲染 | mermaid + marked + wordcloud2 | 图表/Markdown/词云，全部本地化 |
| 服务端 | Node.js (server.js) | 零依赖 HTTP 服务 + SSE live reload |
| 索引构建 | build-index.js | 扫描 kb/ 生成 manifest.json |
| 质量保障 | arch-lint + check-overview + markdownlint | Hook 自动执行，CI 级别的本地检查 |
| 数据存储 | Git + 纯 Markdown | 全量版本控制，零锁定 |

## License

[MIT](LICENSE) © xuhu
