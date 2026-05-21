**[English](README_EN.md)** | 中文

# AI Auto Notes Template — Fork 即用的 AI 知识库脚手架

> Fork 本仓库，填写你的背景信息，然后和 AI 聊天——知识库会自动生长。零手动整理，完全本地。

[:books: 浏览知识库 →](INDEX.md) &nbsp;|&nbsp; [:bar_chart: 可视化导览](http://localhost:8765/overview.html)

## 这是什么？

这是一个**开箱即用的 AI 知识库模板**。Fork 后，每次与 Claude Code 对话，AI 会自动对内容进行分类、归纳、总结，逐步构建属于你自己的结构化 Markdown 知识库。

**核心理念：你不需要记笔记——AI 帮你记。你只需聊天。**

## 快速开始（3 步）

```bash
# 1. Fork & 克隆
git clone git@github.com:<your-username>/ans-ai-auto-notes.git
cd ans-ai-auto-notes

# 2. 填写你的背景（AI 会据此调整风格）
#    编辑 CLAUDE.md 中的"用户背景"部分
#    编辑 memory/user-profile.md 填入详细信息

# 3. 开始聊天，知识库自动生长
claude
```

就这么简单。AI 会根据对话内容自动：
- 提取知识点 → 写入 `kb/` 对应主题文件
- 自动 Git commit → 每批改动自动提交
- 文件过大时 → 主动提案拆分
- 退出时 → 自动跑健康检查

## 特色功能

- **自动提取**：AI 自动判断哪些内容值得记录，不等你提醒
- **智能聚合**：同主题知识点追加到同一个文件，持续重组而非堆砌
- **主动发散**：AI 不只被动回答，还会主动提议"要不要把 X 也记录下来？"
- **三层约束体系**：基于 Harness Engineering 理念，规则用 hooks 机械强制执行
- **可视化导览**：一键启动本地预览，支持分类浏览、时间线、全文搜索、词云、Mermaid 图表
- **零网络依赖**：所有前端资源固化到本地 vendor 目录，离线秒开
- **完全本地**：所有数据存储在本地 Git 仓库，你拥有 100% 控制权
- **自动文件管理**：文件过大自动提案拆分，同主题自动合并，目录结构自动维护

## 可视化导览

运行 `./serve.sh` 启动本地预览页，内置以下功能：

- **分类浏览**：递归树状展示所有笔记，支持展开/折叠
- **时间线**：按周归档每次对话摘要，可跳转到对应笔记
- **全文搜索 + 词云**：搜索前显示知识库关键词词云，点击词汇即跳转搜索
- **Markdown 渲染**：代码高亮、Mermaid 图表、站内链接跳转、目录导航
- **Live Reload**：文件变更后浏览器自动刷新
- **深色模式**：跟随系统主题或手动切换
- **字号调节**：四档字号（S/M/L/XL）一键切换

所有前端依赖均固化在 `scripts/vendor/` 目录，**零网络请求，离线秒开**。

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
├── kb/                     # 知识库主目录（你的笔记在这里自动生长）
│   ├── 技术/AI/            # AI 相关（预设 5 个子目录）
│   ├── 技术/Java/          # Java 技术栈
│   ├── 技术/计算机基础/     # 计算机基础
│   ├── 实战/               # 踩坑记录 & 实战技巧
│   └── 读书笔记/           # 读书笔记
├── timeline/               # 按周归档的对话摘要（自动生成）
├── memory/                 # AI 记忆层（用户画像、项目规则、反馈）
├── scripts/                # 自动化脚本（无需改动）
│   ├── vendor/             # 前端依赖（mermaid / marked / wordcloud2）
│   ├── build-index.js      # 索引构建
│   └── ...                 # lint / session-log / audit 等
├── overview.html           # 可视化导览页
├── server.js               # 本地 HTTP 服务器（SSE live reload）
├── CLAUDE.md               # ⚠️ AI 行为规则（Fork 后需修改用户背景）
└── timeline.json           # 时间线数据
```

## 前置依赖

- [Node.js](https://nodejs.org/) >= 18
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)（AI 对话驱动引擎）

## 常用命令

```bash
./serve.sh                    # 启动本地预览（端口 8765）
node scripts/build-index.js   # 重建 manifest.json + INDEX.md
./lint.sh                     # markdownlint 格式检查
node scripts/check-overview.js # 12 项健康检查
bash scripts/arch-lint.sh     # 8 项 KB 架构检查
```

## 定制指南

Fork 后，你只需要修改以下内容，其他一切开箱即用：

| 必须修改 | 文件 | 说明 |
|---------|------|------|
| **用户背景** | `CLAUDE.md` → "用户背景"部分 | AI 据此调整回答风格和知识沉淀方向 |
| **详细画像** | `memory/user-profile.md` | 职业、技术栈、兴趣方向 |

| 可选定制 | 文件 | 说明 |
|---------|------|------|
| 知识库结构 | `CLAUDE.md` → 目录规则 | 默认 技术/实战/读书笔记 三大类 |
| 文件拆分阈值 | `CLAUDE.md` → 文件拆分规则 | 默认 >1000 行关注，>1500 行必拆 |
| 笔记风格 | `CLAUDE.md` → 笔记风格规则 | 默认带 Demo 的 QA 风格 |
| 新增分类 | `kb/` 下新建目录 | AI 自动识别并归类 |

## 内置的自动化能力

| 能力 | 说明 |
|------|------|
| **自动知识提取** | 每次对话后 AI 自动判断并沉淀知识点 |
| **自动 Git Commit** | 每批文件变更后立即 commit，不等提醒 |
| **文件拆分提案** | 文件 >1000 行时 AI 主动提案拆分 |
| **退出健康检查** | 12 项自动检查（lint / 死链 / Git 状态等） |
| **索引自动重建** | 新增/删除文件后自动更新 INDEX.md |
| **Memory 记忆** | AI 记住你的偏好和反馈，跨 Session 持续生效 |

## 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| AI 引擎 | Claude Code | 对话驱动，自动知识沉淀 |
| 前端渲染 | mermaid + marked + wordcloud2 | 图表/Markdown/词云，全部本地化 |
| 服务端 | Node.js (server.js) | 零依赖 HTTP 服务 + SSE live reload |
| 索引构建 | build-index.js | 扫描 kb/ 生成 manifest.json |
| 质量保障 | arch-lint + check-overview + markdownlint | Hook 自动执行，CI 级别的本地检查 |
| 数据存储 | Git + 纯 Markdown | 全量版本控制，零锁定 |

## FAQ

**Q: 我不是程序员，能用吗？**
A: 目前需要安装 Node.js 和 Claude Code，有一定技术门槛。但使用过程本身零代码——你只需要聊天。

**Q: 目录结构可以改吗？**
A: 可以。`kb/` 下的目录结构完全自定义，在 `CLAUDE.md` 中修改目录规则即可。

**Q: 知识库内容会上传到云端吗？**
A: 不会。所有数据存储在本地 Git 仓库，你可以选择是否 push 到 GitHub。

**Q: 可以用 Cursor / Windsurf 等其他 AI IDE 吗？**
A: 本模板基于 Claude Code 的 Hooks 体系设计，其他 AI 工具暂不支持完整功能。

## License

[MIT](LICENSE)
