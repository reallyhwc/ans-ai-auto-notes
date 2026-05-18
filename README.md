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

## 项目架构

### Harness Engineering 三层模型

项目采用 2026 年 AI 工程领域涌现的 **"约束 > 文档 > 对话"** 三层模型，规则从"靠说"升级为"靠执行"：

```
约束层（Hooks 机械执行）  →  SessionStart 预检 + Stop 退出检查 + KB 架构 Linter
文档层（文件系统持久化）  →  Session 日志 + Memory 分层记忆 + Plan 状态追踪
对话层（AI 实时理解）     →  CLAUDE.md 项目规则 + AI 推理
```

| 层级 | 触发时机 | 做什么 |
|------|---------|--------|
| **约束层** | SessionStart | 环境体检 + 遗留变更提醒 + memory 过期检查（>14天）+ 架构 Linter（frontmatter 完整性/死链扫描/重复标题） |
| **约束层** | Stop | Markdown 格式校验 + Git 状态 + INDEX 日期 + 健康检查(11项) + Session 日志 + 权限审计 + 未 push 提醒 |
| **文档层** | Stop → 文件 | 自动从 git diff 生成结构化 session 日志（变更文件、主题、建议 commit） |
| **文档层** | 跨 Session | Memory 分层（稳定层/项目层/流水层），所有记忆带 `lastUpdated` 时间戳，>14 天自动告警 |

### 知识库规模

- **32 个主题文件**，9,000+ 行内容
- **3 个顶层分类**：技术（AI/Java/计算机基础/中间件/系统设计）、实战、读书笔记
- **3 周 timeline** 按周归档
- **AI Coding 专题**：从 Vibe Coding 到多 Agent 协作、从美团 31 万行代码重构到 Claude Code 进阶工作流

### Hook 脚本体系

| 脚本 | 触发 | 功能 |
|------|------|------|
| `scripts/preflight.sh` | SessionStart | 6 项预检：遗留变更、上次 session 摘要、manifest 过期、INDEX 日期、memory 淘汰、架构 linter |
| `scripts/arch-lint.sh` | SessionStart（由 preflight 调用） | 5 项 KB 架构检查：frontmatter 完整性、元信息头规范、死链扫描、重复标题、磁盘一致性 |
| `scripts/session-log.sh` | Stop | 从 git diff 自动生成 session 日志（文件变更、新增、主题、建议 commit） |
| `scripts/permission-audit.sh` | Stop | 扫描 scripts/ vs settings.local.json allowlist，建议安全命令加白 |
| `scripts/commit-reminder.sh` | — | 已淘汰，改为 AI 主动 auto-commit |

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

启动本地 HTTP 服务器（端口 8765）并自动打开浏览器。`kb/` 下的 Markdown 文件变更时浏览器实时刷新。

### 3. 用 Claude Code 开始对话

```bash
claude
```

AI 会自动根据 `CLAUDE.md` 中的规则提取知识到 `kb/` 目录。每次文件变更后 AI 自动 commit，退出时提醒未 push 的提交。

## 定制你的知识库

### 修改个人背景

编辑 `CLAUDE.md` 中的"用户背景"部分：

```markdown
## 用户背景

- 年龄、职业、技术栈
- 近期在读的书、关注的方向
```

AI 会根据这些信息调整知识提取的侧重点和风格。

### 调整知识库结构

`CLAUDE.md` 中定义了完整的维护规则，可根据需求修改：
- 目录结构（`kb/` 下的分类）
- 文件组织规则（同主题聚合、拆分阈值：>350行 / >5章节 / 覆盖3+方向）
- 笔记风格（保留 Demo 示例、Mermaid 图表优先）

### 运行格式检查

```bash
./lint.sh                        # Markdown 格式检查
node scripts/check-overview.js   # 11 项健康检查
bash scripts/arch-lint.sh        # KB 架构 linter
```

## 项目结构

```
ans-ai-auto-notes/
├── kb/                          ← 知识库主目录（32 个主题文件）
│   ├── 技术/                    ← 技术领域
│   │   ├── AI/                  ← 基础/大模型/应用生态 三层
│   │   ├── Java/                ← Java 技术栈
│   │   ├── 计算机基础/          ← 图灵机、贝叶斯等基础理论
│   │   ├── 中间件/              ← (规划中)
│   │   └── 系统设计/            ← (规划中)
│   ├── 实战/                    ← 排查记录、技巧、外部参考
│   ├── 读书笔记/                ← 一本书一个文件
│   └── 日常思考/                ← 随笔、想法
├── scripts/                     ← 构建/检查/Hook 脚本
│   ├── build-index.js           ← 扫描 kb/ 生成 manifest.json + INDEX.md
│   ├── check-overview.js        ← 11 项健康检查
│   ├── preflight.sh             ← SessionStart 预检
│   ├── arch-lint.sh             ← KB 架构 Linter
│   ├── session-log.sh           ← 自动生成 session 日志
│   └── permission-audit.sh      ← 权限审计
├── timeline/                    ← 按周归档的对话摘要
├── .claude/
│   ├── session-logs/            ← 每日 session 日志存档
│   └── settings.local.json      ← Hook 配置 + 权限白名单
├── INDEX.md                     ← 总目录索引（自动生成）
├── overview.html                ← 可视化导览页（运行时加载）
├── server.js                    ← Node.js 本地预览服务器（SSE live reload）
├── serve.sh                     ← 一键启动/停止
├── CLAUDE.md                    ← AI 行为规则（项目指令）
├── lint.sh / exit-check.sh      ← 格式检查 / 退出检查
└── .gitignore
```

## 近期主要更新

<details>
<summary>点击展开</summary>

- **Hooks 三层约束体系**：SessionStart 预检 + Stop 退出检查 + KB 架构 Linter + 权限审计
- **AI Coding 专题**：Vibe/Spec/Agentic 三种编程范式、美团 31 万行代码重构、Claude Code 进阶工作流四阶段模型、Harness Engineering 六原则自检
- **MCP 开发实战**：Spring AI 集成方案、`@Tool` 注解内部机制、完整请求链路、stdin/stdout OS 层细节
- **Memory 分层淘汰**：稳定层/项目层/流水层 + `lastUpdated` 时间戳 + >14 天自动告警
- **预制脚本体系**：build-index（自动索引）、check-overview（11 项健康检查）、arch-lint（5 项架构检查）
- **AI 自动 commit**：每批文件变更后 AI 主动 commit，退出时提醒未 push

</details>

## License

[MIT](LICENSE) © xuhu
