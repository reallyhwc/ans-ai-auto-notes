# ANS AI Auto Notes - 项目指令

## 项目定位

通过 AI 对话自动构建个人知识库。每次对话中，我除了回答问题，还要智能地对内容进行分类、归纳、总结，逐步沉淀为结构化的 markdown 知识库。

## 用户背景

- 28 岁，男性，已婚未育
- 大厂 Java 后端程序员
- 学习中：黄佳《Claude Code 工程化实战》（极客时间课程，进行中）
- 阅读中：马兆远《世界的逻辑》（2026-05-14 起，引言阶段）
- 已读完：李飞飞《我看见的世界》

## 知识库结构

```
ans-ai-auto-notes/
├── kb/                          ← 知识库主目录（按主题分类）
│   ├── 技术/                    ← 技术领域
│   │   ├── AI/                  ← AI/机器学习（基础/大模型/Claude-Code/AI-Coding/应用 五子目录）
│   │   ├── Java/                ← Java 技术栈
│   │   └── 计算机基础/          ← 图灵机、贝叶斯等基础理论
│   ├── 实战/                    ← 排查记录、好文摘要、技巧
│   ├── 读书笔记/                ← 读书相关，一本书一个文件
│   └── 课程笔记/                ← 课程相关，一门课一个 hub 文件（+ 该课程的方法论沉淀），通用机制知识不放这里
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
4. 详细的沉淀纪律见下方"自动沉淀纪律"章节。

> 文件拆分、章节编号、"严禁口头沉淀"等内容质量规则统一收敛到 [kb-content-style skill](.claude/skills/kb-content-style/SKILL.md)，写入 kb/ 时由 AI 助手自动加载。

### 自动沉淀纪律（高优先级）

**核心原则：对话中产生的技术内容，直接写入 kb/，绝不询问用户"要不要沉淀"。**

#### 违规模式黑名单

以下表达**禁止出现在回复中**（包括变体和同义句）：

| 违规模式 | 示例 |
|---|---|
| "要不要沉淀" | "要不要沉淀到知识库？"、"要不要帮你沉淀？" |
| "需要沉淀" | "需要我沉淀一下吗？"、"这个需要沉淀吗？" |
| "是否沉淀" | "是否沉淀到知识库？"、"是否需要沉淀？" |
| "要记录到" | "要记录到知识库吗？"、"要帮你记录吗？" |
| "要写入知识库" | "要写入知识库吗？"、"要加到 KB 吗？" |

#### 唯一例外

**仅当**以下情况出现时，才可以询问用户：
- 涉及文件**拆分、合并、重组**
- 涉及**目录结构变更**（新增子目录、调整分类）
- 内容**跨多个主题**，不确定应该归入哪个文件

其他所有情况（包括不确定"这算不算知识点"的情况），**默认直接写入**。

#### 判断算法

```
对话产生了技术内容？
  ├── 否 → 不沉淀，正常回复
  └── 是 → 用户贴入了长文 / URL / 大段文本？
              ├── 是 → 先 spawn idea-extractor 识别候选，再按建议写入
              └── 否 → 涉及文件拆分/合并/目录变更？
                          ├── 是 → 提案后执行（询问用户）
                          └── 否 → 直接写入 kb/（不询问）
```

**存疑时的默认行为是写入，不是询问。** 宁可写了一篇不需要的笔记，也不要问一句"要不要沉淀"。

#### 长文 / URL 输入走 idea-extractor

当用户**贴入长文章、URL、课程笔记全文**时，先 spawn `idea-extractor` subagent 识别沉淀候选，再按 `EXTRACT-VERDICT` 的 candidates 逐项处理。**不要**跳过 extractor 直接写——长文里可能有多个独立知识点，extractor 帮你查重、分段、排优先级。

### Subagent 调度纪律

项目已注册 3 个 subagent（定义在 `.claude/agents/`），使用时遵循以下调度规则：

| Subagent | 触发条件 | 关键约束 |
|---|---|---|
| **kb-auditor** | 写完深度笔记（≥300 行新内容）或单文件 ≥800 行后主动 spawn | spawn 时**必须把 `kb-content-style` 核心规则摘要传入 prompt**（Mermaid-first、§N 连续、demo 优先、文件名=标题），否则审计标准与写作标准脱节 |
| **idea-extractor** | 用户贴入长文/URL/大段文本 | 识别候选后由主 agent 按建议写入，extractor 自己不写 kb/ |
| **plan-executor** | 用户说 "run plan X" / "执行 plan X" | 端到端跑 plan，task-by-task 嵌套 implementer |

**通用纪律**：
- dispatch 后**立即 patch agent-log**（`feedback-agent-log-patch`）：补 title/summary/outcome
- **不要**把 subagent 返回的完整报告复制到主对话，引用 `logs/` 路径即可
- kb-auditor 同一文件 24h 内不重复 spawn

详见 [`.claude/agents/README.md`](.claude/agents/README.md) 的完整调度手册。

### 跨文件关联规则

1. 当一个知识点涉及多个维度时（如读了《我看见的世界》提到 RNN），需要分别记录：
   - 读书笔记文件：侧重阅读上下文和感悟
   - 技术文件：侧重纯技术干货
2. 两处内容各有侧重，**不是复制**。
3. 两处互相留链接：`相关: ../技术/ai/rnn.md` ↔ `相关: ../../读书笔记/我看见的世界.md`

### 决策先例（ADR）

遇到分类歧义或重大架构决策时，先看 [`docs/decisions.md`](docs/decisions.md)。如果是新的争议点，决策后追加 ADR（编号单调递增）。这帮助 AI 在分类摇摆时有先例可循，避免目录漂移。

### Timeline 规则

1. 按周生成：`timeline/YYYY-WXX.md`
2. 每周文件内记录当周所有对话的摘要，附链接指向 kb 中对应主题文件的具体段落。
3. INDEX.md 实时更新，作为总目录。

### 笔记风格 & 拆分 & 章节规则

详见 [.claude/skills/kb-content-style/SKILL.md](.claude/skills/kb-content-style/SKILL.md) —— AI 助手在写入 kb/ 时自动加载。核心要点：

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

详见 [.claude/skills/kb-tdd-discipline/SKILL.md](.claude/skills/kb-tdd-discipline/SKILL.md) —— AI 助手在修改 scripts/ 或 tests/ 时自动加载。核心要点：

- 错误趋向区域（marked 渲染、路径解析、frontmatter、lint 脚本）必须 TDD：先红后绿
- Bug 修复必须先在 tests/ 加复现 case
- 测试入口：`bash test.sh`
- pre-push hook 兜底：`bash scripts/install-hooks.sh` 安装

### Skill 开发纪律（SDD）

Skill 开发遵循 **SDD（Skill Development Discipline）**——本质是把 TDD 应用到文档领域。完整方法论由 superpowers 插件的 `writing-skills` skill 提供，核心要点：

- **RED-GREEN-REFACTOR 循环**：先用 subagent 跑压力场景观察基线行为（RED），再写最小 Skill 解决特定合理化借口（GREEN），最后堵新漏洞（REFACTOR）
- **Iron Law**：`NO SKILL WITHOUT A FAILING TEST FIRST`——写 Skill 前没观察过 agent 失败行为，说明你不知道该教什么
- **Description 写作**：只写触发条件（Use when...），不总结 workflow（否则 Claude 会走捷径跳过读 body）
- **Token 效率**：频繁加载的 skill 控制在 200 words 以内，其他 <500 words
- **Rationalization Table**：每个纪律型 Skill 必须包含"借口 vs 现实"对照表

**Skill 类型定位**：

| 类型 | 特征 | 本项目示例 |
|------|------|-----------|
| **参考型**（Reference） | Claude 自动触发，塑造行为方式 | kb-content-style、arch-lint-fix-guide |
| **任务型**（Task） | 用户手动 `/name` 触发，有副作用 | build-index |
| **纪律型**（Discipline） | 每次对话都加载，约束行为 | kb-tdd-discipline、auto-commit-discipline |

详见黄佳课程[§19 两类 Skill](kb/技术/AI/Claude-Code/Skills%20渐进式披露架构.md)和 superpowers `writing-skills` skill。

### Git 规则

详见 [.claude/skills/auto-commit-discipline/SKILL.md](.claude/skills/auto-commit-discipline/SKILL.md) —— AI 助手会按 skill 触发条件自动加载完整规则。核心要点：

- 完成一批文件变更立即 commit（不等用户提醒）
- Conventional Commits 格式
- ≥3 commits 未 push 时 Stop hook 自动 push（含 pull --rebase 重试）
- 永不 amend 已 push 的 commit、永不 --no-verify

### 会话退出检查（重要）

**自动化 Hook 体系**（`.claude/settings.local.json` + `.claude/settings.json`，基于 Harness Engineering 三层模型）：

| 层级 | Hook | 配置来源 | 脚本 | 检查内容 |
|------|------|---------|------|---------|
| **约束层** | SessionStart | settings.local.json | `scripts/preflight.sh` → `scripts/arch-lint.sh` | 15 项机械检查（frontmatter、元信息头、交叉链接、重复标题、磁盘一致性、大小写、行数限制、memory 格式、零依赖、脚本引用、标题 ID 契约、章节编号、anchor 存活、内容具象度）+ memory 过期 + 遗留变更 + manifest 过期 + session 摘要 |
| **约束层** | Stop | settings.local.json | `exit-check.sh` → `lint.sh` + `check-overview.js` + `session-log.sh` + `permission-audit.sh` + 未 push 检查 | 11 项退出检查：markdown 格式、git 状态、INDEX 一致性、overview 健康、session 日志、权限审计、未 push commit（≥3 自动 push，含 pull --rebase 重试）、沉淀声明审计、plans 状态、agent-log patch 合规、内容质量 fast-path |
| **约束层** | Stop | settings.json | `node scripts/agent-log-hook.js main` | 主 agent 工作日志记录（有实质工作时写入 `logs/agent-runs/` JSONL） |
| **约束层** | PostToolUse（Write/Edit） | settings.local.json | `scripts/verify-claim.sh` | 每次 Write/Edit kb/ 或 memory/ 文件时验证文件确实存在，写入 `.claude/claim-ledger.log`（exit-check [8/11] 消费） |
| **约束层** | SubagentStop | settings.json | `node scripts/agent-log-hook.js subagent` | subagent 工作日志记录（写入 `logs/agent-runs/` JSONL，后续由 AI patch title/summary/outcome） |
| **文档层** | — | — | `.claude/session-logs/` | 每日 session 日志存档（同日多次 Stop 累加 append） |
| **文档层** | — | — | `memory/*.md` | 记忆文件优先用 frontmatter 内 `lastUpdated`（任意缩进），无此字段时 fallback 到文件 mtime，>14 天告警 |

> 注：Stop hook 来自两个配置文件叠加（settings.local.json 跑 exit-check.sh，settings.json 跑 agent-log-hook.js），两者都会执行。**Stop hook 在每次模型回复结束后触发**（不仅是用户退出时），所以自动 push 检查在每轮对话后都会运行。但 hook 输出只回传给模型，用户终端看不到——模型应在回复中主动报告 push 结果。

> 注：UserPromptSubmit hook 已移除（commit-reminder.sh 已淘汰）——由 AI 主动 auto-commit 替代机械提醒。AI 每完成一批文件变更后立即 `git add -A && git commit`，不等用户提醒。

> 所有 settings.local.json 中的 hook 通过 `scripts/hook-logger.sh` 包装执行，执行结果（耗时、exit code）记录到 `logs/hook-runs.jsonl`（.gitignore 中）。

当用户说"准备退出"、"不聊了"、"下次再继续"或类似结束语时，**除了 Stop hook 已经在跑的自动化检查**，AI 还需主动完成：

1. **文件格式检查**：运行 `./lint.sh` 做自动格式校验（heading、空行等），然后人工扫描本次变动的 md 文件，确认元信息头（`> 最后整理: YYYY-MM-DD | 来源: xxx`）符合规范。发现格式不一致的文件立即修正。
2. **交叉链接检查**：确认新增/修改的文件有指向关联文件的双向链接（`[[./xxx]]` 或 `> 关联:` 格式）。
3. **Memory 检查**：确认本次会话中用户的新偏好、新反馈、新项目上下文已写入 `memory/` 目录并更新 `MEMORY.md` 索引。
4. **Git 检查**：确认所有变更已提交（AI 应在变更发生后立即 auto-commit，无需等退出），`git status` 显示 clean。同时检查是否有未 push 的 commit，如有则提醒用户 `git push`（≥3 时 Stop hook 会自动 push（含 pull --rebase 重试），pre-push 的 test + mermaid 守恒兜底）。
5. **INDEX 一致性**：若新增/删除了 md 文件，确认 `node scripts/build-index.js` 已跑过，INDEX.md 条目数 = kb/ 实际 md 数（INDEX.md 自身不再包含动态日期，避免 git noise）。

上述检查全部通过后，向用户报告检查结果，确认可以安全退出。

### Plan 系统

长期任务（跨多个 session 的实施项目）的 plan 位于 [`docs/superpowers/plans/`](docs/superpowers/plans/)。新 plan 通过 superpowers `writing-plans` skill 生成。Plan 文件 frontmatter 中 `status:` 字段或 `> 状态: xxx` 段标记进度（已完成 / completed / done / closed 视为关闭，其他视为开放）。Stop hook 的 `[9/11]` 自动列出未完成 plan。

## 重要提醒

- 知识库内容和维护规则是分开的：规则在 CLAUDE.md 中维护，知识内容在 kb/ 中沉淀。
- 会话可以不连续，每次进入项目时先读取 CLAUDE.md 和 INDEX.md 了解当前状态。
