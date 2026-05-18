# AI Auto Notes — 对话驱动的个人知识库

> 与 AI 聊天，自动沉淀为结构化知识库。

[:books: 浏览知识库 →](INDEX.md) &nbsp;|&nbsp; [:bar_chart: 可视化导览](http://localhost:8765/overview.html)

## 这是什么？

每次与 Claude Code 对话，AI 会自动对内容进行分类、归纳、总结，逐步构建为结构化的 Markdown 知识库。你只需正常聊天——提问、讨论、学习——知识库会在后台自动生长。

**核心理念：不是你在记笔记，是 AI 在帮你记。**

## 特色

- **自动提取**：AI 自动判断哪些内容值得记录，不等你提醒
- **智能聚合**：同主题知识点追加到同一个文件，持续重组而非堆砌
- **主动发散**：AI 不只被动回答，还会主动提议"要不要把 X 也记录下来？"
- **三层约束体系**：基于 Harness Engineering 理念，规则不仅写在 CLAUDE.md 里，更用 hooks 机械强制执行
- **本地预览**：一键启动可视化导览页，支持分类浏览、时间线、全文搜索、Mermaid 图表渲染
- **完全本地**：所有数据存储在本地 Git 仓库，你拥有 100% 控制权

## Harness Engineering 三层约束体系

项目采用 2026 年 AI 工程领域涌现的 **"约束 > 文档 > 对话"** 三层模型，规则从"靠说"升级为"靠执行"：

```
约束层（Hooks 机械执行）  →  SessionStart 预检 + Stop 退出检查 + 架构 Linter
文档层（文件系统持久化）  →  Session 日志 + Memory 分层记忆 + Plan 状态追踪
对话层（AI 实时理解）     →  CLAUDE.md 项目规则 + AI 推理
```

| 层级 | 触发时机 | 做什么 |
|------|---------|--------|
| **约束层** | SessionStart | 环境体检 + 遗留变更提醒 + memory 过期检查（>14天）+ 架构 Linter（frontmatter 完整性 / 死链扫描 / 重复标题 / 行数限制 / 大小写一致性 / memory frontmatter 格式） |
| **约束层** | Stop | Markdown 格式校验 + Git 状态 + INDEX 日期 + 健康检查（12 项含行数）+ Session 日志 + 权限审计 + 未 push 提醒（>5 自动 push） |
| **文档层** | Stop → 文件 | 自动从 git diff 生成结构化 session 日志（变更文件、主题、建议 commit），同日多次 Stop 累加 append |
| **文档层** | 跨 Session | Memory 分层（稳定层/项目层/流水层），所有记忆带 `lastUpdated` 时间戳，>14 天自动告警 |

### Hook 脚本体系

| 脚本 | 触发 | 功能 |
|------|------|------|
| `scripts/preflight.sh` | SessionStart | 上次 session 摘要、遗留变更、manifest 过期、INDEX 日期、memory 淘汰、调用 arch-lint |
| `scripts/arch-lint.sh` | SessionStart（由 preflight 调用） | 8 项 KB 架构检查 |
| `exit-check.sh` | Stop | 串联 lint + check-overview + session-log + permission-audit + 未 push 检查 |
| `scripts/session-log.sh` | Stop（由 exit-check 调用） | 从 git diff 自动生成 session 日志 |
| `scripts/permission-audit.sh` | Stop（由 exit-check 调用） | 扫描 scripts/ vs settings.local.json allowlist，建议安全命令加白 |
| `scripts/check-overview.js` | Stop（由 exit-check 调用） | 12 项健康检查（数据完整性、链接、行数等） |
| `scripts/build-index.js` | 手动 / `serve.sh` | 扫描 kb/ 重建 manifest.json + INDEX.md |

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

AI 会根据 `CLAUDE.md` 中的规则提取知识到 `kb/` 目录。每次文件变更后 AI 自动 commit，退出时由 Stop hook 自动跑健康检查并提醒未 push 的提交。

## 常用命令

```bash
node scripts/build-index.js   # 重建 manifest.json + INDEX.md
./lint.sh                     # markdownlint 格式检查
node scripts/check-overview.js # 12 项健康检查
bash scripts/arch-lint.sh     # 8 项 KB 架构检查
./serve.sh                    # 启停本地预览
```

## 定制

详细规则、目录组织、文件拆分阈值、笔记风格规则均在 [CLAUDE.md](CLAUDE.md)。

- **修改个人背景** → 编辑 `CLAUDE.md` 中的"用户背景"
- **调整知识库结构** → 修改 `CLAUDE.md` 中的目录规则、文件拆分阈值
- **自定义笔记风格** → 修改 `CLAUDE.md` 中的"笔记风格规则"

## License

[MIT](LICENSE) © xuhu
