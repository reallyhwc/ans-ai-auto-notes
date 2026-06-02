# ANS AI Auto Notes - 项目指令

## 项目定位

通过 AI 对话自动构建个人知识库。每次对话中，我除了回答问题，还要智能地对内容进行分类、归纳、总结，逐步沉淀为结构化的 markdown 知识库。

## 用户背景

- 28 岁，男性，已婚未育
- 大厂 Java 后端程序员
- 近期在读李飞飞的《我看见的世界》

## 知识库结构

```
ans-ai-auto-notes/
├── kb/                          ← 知识库主目录（按主题分类）
│   ├── 技术/                    ← 技术领域
│   │   ├── AI/                  ← AI/机器学习（基础/大模型/Claude-Code/AI-Coding/应用 五子目录）
│   │   ├── Java/                ← Java 技术栈
│   │   └── 计算机基础/          ← 图灵机、贝叶斯等基础理论
│   ├── 实战/                    ← 排查记录、好文摘要、技巧
│   └── 读书笔记/                ← 读书相关，一本书一个文件
├── timeline/                    ← 按周归档的对话摘要
├── tests/                       ← 单元 + 集成测试（node --test，零依赖）
├── test.sh                      ← 测试入口
├── scripts/                     ← 构建/检查脚本
│   ├── build-index.js           ← 扫描 kb/ 生成 manifest.json + INDEX.md
│   ├── check-overview.js        ← 12 项健康检查（含行数限制）
│   ├── arch-lint.sh             ← 8 项 KB 架构检查
│   ├── preflight.sh             ← SessionStart 预检
│   ├── session-log.sh           ← 自动生成 session 日志
│   ├── permission-audit.sh      ← 权限审计
│   ├── lib.js                   ← 纯函数库（浏览器+Node 双环境，便于单测）
│   ├── app.js                   ← overview.html 前端逻辑
│   ├── install-hooks.sh         ← 一次性安装 git pre-push hook
│   └── git-hooks/pre-push       ← push 前跑 test.sh，失败阻断
├── INDEX.md                     ← 总目录索引（由 build-index.js 自动生成，勿手改）
├── manifest.json                ← 分类数据（构建产物，.gitignore 中，勿手改）
├── timeline.json                ← 时间线数据（手维护）
├── overview.html                ← 可视化导览页（运行时 fetch manifest.json + timeline.json）
├── server.js                    ← 本地预览服务器（端口 8765 + SSE live reload）
├── serve.sh                     ← 启动脚本（build-index.js → server.js）
├── CLAUDE.md                    ← 本文件
└── .gitignore
```

## 核心规则

### 文件组织规则

1. **同主题聚合到一个文件**：同一个主题的知识点持续追加到同一个 md 文件，不按日期拆分。例如所有 JVM GC 内容都在 `kb/技术/Java/jvm-gc.md` 中。
2. **文件内按时间倒序**：最新内容追加在文件顶部，以 `## YYYY-MM-DD - 标题` 作为二级标题。
3. **目录深度规则**：默认两层（如 `技术/Java/jvm-gc.md`）；当一个领域内容显著膨胀且能划分清晰子领域时（如 AI 已分化出"基础/大模型/Claude-Code/AI-Coding/应用"），允许使用三层。第三层需要满足：每个子目录有 ≥3 篇文件 且 子领域之间边界清晰。
4. **新主题新建文件**：遇到全新主题时创建新文件。
5. **中文文件名（强制性）**：所有 `kb/` 下的 md 文件名必须与 frontmatter `title` 一致（即 Web 页面显示什么，磁盘文件名就是什么）。规则：(a) 冒号 `:` 替换为全角 `：`；(b) 移除 `/` `\` `*` `?` `"` `<` `>` `|` 等非法字符；(c) 多空格合并为一个；(d) 过长时（>60 字）截断。新文件创建时直接使用中文名；旧文件重命名用 `node scripts/rename-mapping.js --apply` 批量处理。

### 更新策略（混合模式）

1. **小知识点自动记录**：回答完问题后，自动提取知识点追加到对应主题文件，无需询问。
2. **大改动主动提案**：涉及文件拆分、合并、重组、目录结构变更时，主动向用户提案，待确认后执行。
3. **主动性在我这边**：不等用户下指令，我自行判断时机并提案。
4. **知识内容自动沉淀，不询问**：对话中产生的技术讲解、概念梳理、方案对比等知识内容，直接写入 kb/ 对应文件，不要问"要不要沉淀到知识库？"。仅当涉及文件拆分、合并、重组、目录结构变更时才主动提案。

> 文件拆分、章节编号、"严禁口头沉淀"等内容质量规则统一收敛到 [kb-content-style skill](.claude/skills/kb-content-style/SKILL.md)，写入 kb/ 时由 Claude Code 自动加载。

### 跨文件关联规则

1. 当一个知识点涉及多个维度时（如读了《我看见的世界》提到 RNN），需要分别记录：
   - 读书笔记文件：侧重阅读上下文和感悟
   - 技术文件：侧重纯技术干货
2. 两处内容各有侧重，**不是复制**。
3. 两处互相留链接：`相关: ../技术/ai/rnn.md` ↔ `相关: ../../读书笔记/我看见的世界.md`

### Timeline 规则

1. 按周生成：`timeline/YYYY-WXX.md`
2. 每周文件内记录当周所有对话的摘要，附链接指向 kb 中对应主题文件的具体段落。
3. INDEX.md 实时更新，作为总目录。

### 笔记风格 & 拆分 & 章节规则

详见 [.claude/skills/kb-content-style/SKILL.md](.claude/skills/kb-content-style/SKILL.md) —— Claude Code 在写入 kb/ 时自动加载。核心要点：

- 保留 demo、Mermaid 优先、反抽象化
- 同主题聚合，文件内时间倒序
- 中文文件名 = frontmatter title
- 行数 >1000 关注 / >1500 必拆
- 章节编号必须从 1 连续无跳号
- 严禁"口头沉淀"（说"已沉淀"前必须 Read 验证文件存在）

### 本地预览规则（单一数据源架构）

1. 知识库通过本地 HTTP 服务器预览，启动命令：`./serve.sh`（端口 8765 + 自动打开浏览器）。
2. **数据流**：`kb/` 下的 md 文件（含 frontmatter）→ `node scripts/build-index.js` → `manifest.json` + `INDEX.md` → `overview.html` 运行时 fetch 加载。
3. **新增/删除 md 文件时**：只需写好 md 文件（含 frontmatter title + description），然后跑 `node scripts/build-index.js` 即可。INDEX.md 也会自动更新。**不要手改 overview.html。**
4. **md 文件内容变更时**：不涉及任何其他文件更新——刷新浏览器即生效。
5. **timeline 更新**：手动维护 `timeline.json`，格式见现有条目。
6. 保留规则：overview.html 中禁止裸链接（`<a href="xxx.md">`），统一使用 `<span onclick="viewContent()">`。

### 测试纪律（软 TDD）

详见 [.claude/skills/kb-tdd-discipline/SKILL.md](.claude/skills/kb-tdd-discipline/SKILL.md) —— Claude Code 在修改 scripts/ 或 tests/ 时自动加载。核心要点：

- 错误趋向区域（marked 渲染、路径解析、frontmatter、lint 脚本）必须 TDD：先红后绿
- Bug 修复必须先在 tests/ 加复现 case
- 测试入口：`bash test.sh`
- pre-push hook 兜底：`bash scripts/install-hooks.sh` 安装

### Git 规则

详见 [.claude/skills/auto-commit-discipline/SKILL.md](.claude/skills/auto-commit-discipline/SKILL.md) —— Claude Code 会按 skill 触发条件自动加载完整规则。核心要点：

- 完成一批文件变更立即 commit（不等用户提醒）
- Conventional Commits 格式
- ≥5 commits 未 push 时 Stop hook 自动 push
- 永不 amend 已 push 的 commit、永不 --no-verify

### 会话退出检查（重要）

**自动化 Hook 体系**（`.claude/settings.local.json`，基于 Harness Engineering 三层模型）：

| 层级 | Hook | 脚本 | 检查内容 |
|------|------|------|---------|
| **约束层** | SessionStart | `scripts/preflight.sh` → `scripts/arch-lint.sh` | 10 项机械检查：frontmatter 完整性、元信息头规范、交叉链接（死链）、重复标题、磁盘 vs INDEX 一致性、大小写一致性（Linux 兼容）、行数限制（>1000 警告/>1500 错误）、memory frontmatter 格式、零 npm 依赖 enforce、脚本被引用一致性。外加 memory 过期（>14 天，frontmatter lastUpdated 优先，fallback 文件 mtime）、遗留未提交变更、manifest.json 过期、上次 session 摘要 |
| **约束层** | Stop | `exit-check.sh` → `lint.sh` + `check-overview.js` + `session-log.sh` + `permission-audit.sh` + 未 push 检查 | markdown 格式（纯 bash awk 实现，零 npm 依赖）、git 状态、INDEX.md 与 kb/ 数量一致性、overview.html 健康（12 项含行数限制）、session 日志、权限审计、未 push 的 commit（**≥5 自动 push，所有分支统一规则**——单人知识库无需 main 保护，由 pre-push hook 的 test + mermaid 守恒兜底）|
| **文档层** | — | `.claude/session-logs/` | 每日 session 日志存档（同日多次 Stop 累加 append） |
| **文档层** | — | `memory/*.md` | 记忆文件优先用 frontmatter 内 `lastUpdated`（任意缩进），无此字段时 fallback 到文件 mtime，>14 天告警 |

> 注：UserPromptSubmit hook 已移除（commit-reminder.sh 已淘汰）——由 AI 主动 auto-commit 替代机械提醒。AI 每完成一批文件变更后立即 `git add -A && git commit`，不等用户提醒。

当用户说"准备退出"、"不聊了"、"下次再继续"或类似结束语时，Stop hook 会自动执行上述检查并输出建议的 commit 命令。除此之外，AI 还需主动完成：

1. **文件格式检查**：运行 `./lint.sh` 做自动格式校验（heading、空行等），然后人工扫描本次变动的 md 文件，确认元信息头（`> 最后整理: YYYY-MM-DD | 来源: xxx`）符合规范。发现格式不一致的文件立即修正。
2. **交叉链接检查**：确认新增/修改的文件有指向关联文件的双向链接（`[[./xxx]]` 或 `> 关联:` 格式）。
3. **Memory 检查**：确认本次会话中用户的新偏好、新反馈、新项目上下文已写入 `memory/` 目录并更新 `MEMORY.md` 索引。
4. **Git 检查**：确认所有变更已提交（AI 应在变更发生后立即 auto-commit，无需等退出），`git status` 显示 clean。同时检查是否有未 push 的 commit，如有则提醒用户 `git push`（≥5 时 Stop hook 会自动 push，pre-push 的 test + mermaid 守恒兜底）。
5. **INDEX 一致性**：若新增/删除了 md 文件，确认 `node scripts/build-index.js` 已跑过，INDEX.md 条目数 = kb/ 实际 md 数（INDEX.md 自身不再包含动态日期，避免 git noise）。

上述检查全部通过后，向用户报告检查结果，确认可以安全退出。

## 重要提醒

- 知识库内容和维护规则是分开的：规则在 CLAUDE.md 中维护，知识内容在 kb/ 中沉淀。
- 会话可以不连续，每次进入项目时先读取 CLAUDE.md 和 INDEX.md 了解当前状态。
