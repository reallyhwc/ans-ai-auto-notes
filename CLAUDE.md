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

### 文件拆分规则（重要）

当一个文件同时满足以下**任意两条**时，主动提案拆分：

| 维度 | 阈值 | 说明 |
|------|------|------|
| **行数** | >1000 行关注，>1500 行必须拆 | 笔记含大量 demo/Mermaid/代码块，1000 行内为舒适区；由 `arch-lint.sh [7/13]` 与 `check-overview.js [12/12]` 自动检查（双 hook 覆盖 SessionStart 和 Stop） |
| **章节数** | > 7-8 个 `##` 级章节 | 章节过多说明主题开始发散 |
| **主题凝聚度** | 覆盖 3+ 个可独立成文的方向 | 即使行数不达标，如果内容明显属于不同子领域也应拆分 |

**判断方法**：读完文件后问自己——"如果一个新人只想了解 X，他需要通读整个文件吗？"如果答案是"是"但 X 只是文件中的一小部分，就应该拆分。

**拆分后**：
- 原文件保留最核心的内容 + 指向子文件的链接
- 子文件各自成为一个独立主题
- 原文件和子文件的章节编号均需重新整理，确保从 1 开始连续无跳号（参见「章节编号与标题 ID 规则」，由 `arch-lint.sh [13/13]` 兜底）
- 更新 INDEX.md 和 overview.html

### 更新策略（混合模式）

1. **小知识点自动记录**：回答完问题后，自动提取知识点追加到对应主题文件，无需询问。
2. **大改动主动提案**：涉及文件拆分、合并、重组、目录结构变更时，主动向用户提案，待确认后执行。
3. **主动性在我这边**：不等用户下指令，我自行判断时机并提案。

### 章节编号与标题 ID 规则（2026-05-23 审计新增）

**规则背景**：一次审计发现两类静默 bug——(a) 内容拆分后 h2 编号跳号（1.7→3），浏览器目录断层；(b) buildToc 与 marked heading renderer 的 id 生成不一致，TOC 点击跳转失效。以下规则 + arch-lint.sh 检查 12/13 机械兜底。

1. **章节编号连续性**：使用 `## N.` 样式的文件，h2 编号必须从 1（或 0）连续递增，不得跳号。内容拆分后若带走中间某个编号，剩余章节需重新编号。此项由 `arch-lint.sh [13/13]` 自动检查。
2. **内联代码不影响 slugify**：`buildToc` 在 slugify 前必须 `stripInline`（去 backtick/粗体/斜体），与 marked 的 `token.text` 行为一致。此项由 `arch-lint.sh [12/13]` 契约检查 + `tests/lib.test.js` 测试兜底。
3. **app.js 与 lib.js 标题 ID 同步**：`app.js` 的 marked heading renderer 必须用 `slugify(token.text)` 显式生成 id，不得依赖 marked 默认 id。修改 slugify 函数或 heading 渲染逻辑时，必须同时更新 lib.js 和 app.js 两边，并跑 `test.sh` 确认测试通过。

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

### 笔记风格规则（重要）

1. **保留对话中的 Demo 和示例**：笔记不是抽象提炼，而是要保留我在对话中给出的具体例子、图解、类比说明。用户更喜欢带 demo 的 QA 风格，而非干瘪的总结。
2. **表达形式自由，优先使用 Mermaid 渲染图**：Markdown 支持多种可视化表达，根据内容选择最合适的：
   - **Mermaid 流程图/时序图/架构图**（` ```mermaid `）—— 优先使用，overview.html 会渲染为可视化图形（参考 `claude-code-architecture.md` 的 8 处 mermaid 用法）
   - 代码块中的 ASCII 示意图、对比表格 —— 仅在 mermaid 不适用的场景使用
   - 直接生成 PNG/SVG 图片插入文档
   - 一切能让概念更直观的形式都可以
3. **重组而非堆砌**：同一主题的多次对话要持续归纳合并，形成自上而下逐步深入的结构化文档，而不是按日期分段的 Q&A 日志。每次新内容追加时，要考虑它和已有内容的逻辑关系，必要时重组章节。不应该出现多个同日期的独立小节堆在一起。
4. **反面例子**：不要写成"卷积操作是通过滤波器在输入矩阵上进行滑动窗口运算提取特征"这种纯定义。
5. **判断标准**：如果笔记读起来像教科书定义，就太抽象了。如果读起来像有人拿着草稿纸在给你演示，就是对的。

### 本地预览规则（单一数据源架构）

1. 知识库通过本地 HTTP 服务器预览，启动命令：`./serve.sh`（端口 8765 + 自动打开浏览器）。
2. **数据流**：`kb/` 下的 md 文件（含 frontmatter）→ `node scripts/build-index.js` → `manifest.json` + `INDEX.md` → `overview.html` 运行时 fetch 加载。
3. **新增/删除 md 文件时**：只需写好 md 文件（含 frontmatter title + description），然后跑 `node scripts/build-index.js` 即可。INDEX.md 也会自动更新。**不要手改 overview.html。**
4. **md 文件内容变更时**：不涉及任何其他文件更新——刷新浏览器即生效。
5. **timeline 更新**：手动维护 `timeline.json`，格式见现有条目。
6. 保留规则：overview.html 中禁止裸链接（`<a href="xxx.md">`），统一使用 `<span onclick="viewContent()">`。

### 测试纪律（软 TDD）

**错误趋向区域必须 TDD**——先写一个能复现问题的失败测试 → 跑红 → 实现 → 跑绿 → 重构。这些区域是历史 bug 高发地：

- **markdown 渲染链路**：marked 配置、自定义 renderer（`renderKbLink` 等）
- **路径解析**：`resolveRelativeMd`、build-index 的扫描逻辑
- **frontmatter 解析**：build-index.js 的 YAML/字段提取
- **静态校验脚本**：check-overview.js、arch-lint.sh 自身的检查逻辑

**Bug 修复同样 TDD**：先在 tests/ 加一个能复现该 bug 的失败测试（红），再修代码让它转绿。这样同类 bug 不会重现。

**豁免**（不强制 TDD）：
- 纯文本编辑：`kb/*.md`、CLAUDE.md、README 等的内容修订
- UI 样式调整：overview.html 的 CSS
- 配置变更：settings.local.json、.gitignore 等

**push 前自动跑测试，双层 gate**：
1. `scripts/git-hooks/pre-push` —— git 层硬拦截（手动/自动 push 都过这一道）
2. `exit-check.sh` 的 auto-push 块 —— Stop 时若 >5 commits 未 push，先跑测试通过才 push

**测试入口**：
- `bash test.sh`（推荐）—— 跑 `tests/*.test.js`，spec reporter
- 直接：`node --test tests/*.test.js`
- 单文件：`node --test tests/lib.test.js`

**首次安装 hook**：`bash scripts/install-hooks.sh`（设置 `core.hooksPath = scripts/git-hooks`，新机器克隆后跑一次）

**测试文件组织**：
```
tests/
├── lib.test.js              ← scripts/lib.js 纯函数
├── link-renderer.test.js    ← marked link renderer 输出契约
├── build-index.test.js      ← manifest.json 数据完整性
└── integration.test.js      ← 全量 kb/ markdown 链接静态解析
```

新增测试时按"被测对象"命名为 `<source>.test.js`。需要在 Node 中可用的纯逻辑统一放 `scripts/lib.js`（UMD 双导出，浏览器和 Node 都能加载）。

### Git 规则

1. **每次完成一批文件变更后立即自动 commit**，不等用户提醒。判断标准：一个逻辑主题的改动完成（如一篇文章的笔记沉淀、一个脚本的编写）→ 立刻 `git add -A && git commit`。
2. Commit message 采用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：
   - `feat: xxx` — 新功能（如新增 lint 工具、live reload）
   - `fix: xxx` — 修复 bug 或格式问题
   - `chore: xxx` — 维护性工作（规则更新、配置调整）
   - `docs: xxx` — 纯文档/知识内容变更
   - `refactor: xxx` — 重构（不改变行为）
3. 消息用中文或英文均可，简明描述"做了什么、为什么"。
4. **退出时提醒未 push 的 commit**，由 Stop hook 自动检查。

### 会话退出检查（重要）

**自动化 Hook 体系**（`.claude/settings.local.json`，基于 Harness Engineering 三层模型）：

| 层级 | Hook | 脚本 | 检查内容 |
|------|------|------|---------|
| **约束层** | SessionStart | `scripts/preflight.sh` → `scripts/arch-lint.sh` | 10 项机械检查：frontmatter 完整性、元信息头规范、交叉链接（死链）、重复标题、磁盘 vs INDEX 一致性、大小写一致性（Linux 兼容）、行数限制（>1000 警告/>1500 错误）、memory frontmatter 格式、零 npm 依赖 enforce、脚本被引用一致性。外加 memory 过期（>14 天，frontmatter lastUpdated 优先，fallback 文件 mtime）、遗留未提交变更、manifest.json 过期、上次 session 摘要 |
| **约束层** | Stop | `exit-check.sh` → `lint.sh` + `check-overview.js` + `session-log.sh` + `permission-audit.sh` + 未 push 检查 | markdown 格式（纯 bash awk 实现，零 npm 依赖）、git 状态、INDEX.md 与 kb/ 数量一致性、overview.html 健康（12 项含行数限制）、session 日志、权限审计、未 push 的 commit（**>5 自动 push，所有分支统一规则**——单人知识库无需 main 保护，由 pre-push hook 的 test + mermaid 守恒兜底）|
| **文档层** | — | `.claude/session-logs/` | 每日 session 日志存档（同日多次 Stop 累加 append） |
| **文档层** | — | `memory/*.md` | 记忆文件优先用 frontmatter 内 `lastUpdated`（任意缩进），无此字段时 fallback 到文件 mtime，>14 天告警 |

> 注：UserPromptSubmit hook 已移除（commit-reminder.sh 已淘汰）——由 AI 主动 auto-commit 替代机械提醒。AI 每完成一批文件变更后立即 `git add -A && git commit`，不等用户提醒。

当用户说"准备退出"、"不聊了"、"下次再继续"或类似结束语时，Stop hook 会自动执行上述检查并输出建议的 commit 命令。除此之外，AI 还需主动完成：

1. **文件格式检查**：运行 `./lint.sh` 做自动格式校验（heading、空行等），然后人工扫描本次变动的 md 文件，确认元信息头（`> 最后整理: YYYY-MM-DD | 来源: xxx`）符合规范。发现格式不一致的文件立即修正。
2. **交叉链接检查**：确认新增/修改的文件有指向关联文件的双向链接（`[[./xxx]]` 或 `> 关联:` 格式）。
3. **Memory 检查**：确认本次会话中用户的新偏好、新反馈、新项目上下文已写入 `memory/` 目录并更新 `MEMORY.md` 索引。
4. **Git 检查**：确认所有变更已提交（AI 应在变更发生后立即 auto-commit，无需等退出），`git status` 显示 clean。同时检查是否有未 push 的 commit，如有则提醒用户 `git push`（>5 时 Stop hook 会自动 push，pre-push 的 test + mermaid 守恒兜底）。
5. **INDEX 一致性**：若新增/删除了 md 文件，确认 `node scripts/build-index.js` 已跑过，INDEX.md 条目数 = kb/ 实际 md 数（INDEX.md 自身不再包含动态日期，避免 git noise）。

上述检查全部通过后，向用户报告检查结果，确认可以安全退出。

## 重要提醒

- 知识库内容和维护规则是分开的：规则在 CLAUDE.md 中维护，知识内容在 kb/ 中沉淀。
- 会话可以不连续，每次进入项目时先读取 CLAUDE.md 和 INDEX.md 了解当前状态。
