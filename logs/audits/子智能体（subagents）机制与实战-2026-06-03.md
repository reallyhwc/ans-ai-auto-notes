---
audit_target: kb/技术/AI/Claude-Code/子智能体（subagents）机制与实战.md
audit_date: 2026-06-03
verdict: minor
---
# Audit: 子智能体（subagents）机制与实战.md

> 本轮重点：新增 §4.1（项目级 vs 用户级）+ §15（skills 预加载 vs 嵌套 spawn）+ §16（permissionMode 风险与降险）+ §17（subagent 配方），共 ~233 行。文件 785 行，接近 long-form 上限但仍可读。

## 1. 深度与具象度 [✓]
- 新章节具象度优秀，远超教科书定义层面：§16.2 用 mermaid `Done --> Disaster` 直接画出"自动修复假绿 → 20 commit 后才发现"的真实灾难链；§16.2 给了 5 条具体风险（含"改 .github/workflows 让 CI 通过"、"改 tests 让它绿"），不是"要小心权限"那种空话。
- §17.1 数据库查询分析器是完整可粘贴的 YAML + body，把 `$DB_RO_URL` 只读账号当"防御纵深的硬保障"明确写出，比单纯"prompt 防线"高一档；§17.2 speed sheet 顺便把本项目 kb-auditor 自身列进去，self-referential 加分。
- §15 决策三问（懂规范 vs 独立判断 / 静态文档 vs 动态推理 / 能否一段 prompt 替代）把抽象选择转成具体可问的问题，配反例（"代码 style 检查器做成嵌套 → 完全可以 skills 解决"）落地。
- §4.1 4 行决策表覆盖团队/通用/个人偏好/敏感信息四种场景 + 陷阱 + 本项目实际选择（3 个 agent 全在 .claude/agents/），从抽象 scope 落到具体决策。

## 2. 论述流畅性 + 章节逻辑 [✓]
- §1-§17 编号连续无跳号；§4.1、§15.1-15.4、§16.1-16.4、§17.1-17.2 子编号也连续。
- 新增章节位置合理：§4.1 紧跟 §4 的 scope 优先级表，作为决策延伸；§15-§17 排在 §14 hooks 联动之后，承接"高阶设计权衡"主题，不冲撞 §9 高级用法（§9 偏单字段说明，§15-§17 偏多字段组合的设计模式）。
- 轻微重复：§15 开头再次提"subagent 不能 spawn subagent"——§1 line 95 和 §8 line 319 已说过两次。这次重提是为强调"嵌套不可行→才需要 skills 预加载"的对比铺垫，可接受但偏冗。
- §17.1 工具配置理由表与上方 YAML 互相印证，没堆砌；speed sheet 列出 kb-auditor 自身做收尾，闭环漂亮。

## 3. 链接与双向关联语义 [⚠]
- 文件头 4 条关联（Skills/Hooks/Plugins/整体架构）齐全，且新章节内容确实跨这些文件主题（§15 跨 Skills、§16 跨 Hooks、§17 隐含跨 MCP）。
- 但新章节内 inline 跨文件链接缺失：§15 整章讨论 skills 预加载机制，body 内未 inline 引 [Skills 渐进式披露架构]；§16.3 第 (4) 项 PreToolUse hook 示例未 inline 引 [Hooks 事件全景与拦截机制]。读者读到这里需要自己回顶部找关联。
- §17.1 数据库查询分析器与 [MCP 集成实战] 主题相关（MCP 也能做 DB 集成），但既未在 frontmatter 顶部关联也未 inline 链接。考虑该跳是"用 subagent 做 DB 分析"vs "用 MCP server 做 DB 集成"的设计选项对比，值得加一行 `> 关联:` 或在 §17.1 末尾加一句"也可比较 [MCP 集成实战] 中的 DB 集成方案"。
- 反向链接：[Skills 渐进式披露架构] 是否提及 subagent 的 skills 预加载？若没有，本轮 §15 加进来后该文件应有反向 mention。需要主 agent 后续核查。

## 4. 视觉化 + Frontmatter 质量 [⚠]
- Mermaid 6 张（§1/§2/§8/§13/§15.1/§16.2）每张都做信息密度活儿，不是凑数；尤其 §16.2 用流程图把"测试造假→灾难"链路具象化，是教学加分项。
- 表格 16 张全部做维度对比（如 §15.1 路径 A/B 6 维对比、§16.4 任务类型 → permissionMode + tools 双轴决策卡），不是简单清单。
- frontmatter title 与文件名一致 ✓。
- **frontmatter description 已严重落后于内容**：当前 description 列出"定位/与 skill 区分/scope/frontmatter/调用/context/协作/fork-worktree-memory"，但新增的 **permissionMode 风险、skills 预加载 vs 嵌套、subagent 配方/speed sheet** 这三块（占新增 233 行的 90%）完全没在 description 里出现。用户搜 "permissionMode" 或 "subagent 配方" 时，全文搜索会命中但 manifest/index 描述命中不到。

## 行动建议（按优先级）

1. **Important: 补 frontmatter description**。建议追加："permissionMode 风险与降险配套、skills 预加载 vs 嵌套 spawn 取舍、常见 subagent 配方（数据库查询分析器/code-reviewer/test-runner）"。description 当前 ~110 字符，扩到 200 字符仍 OK。
2. **Minor: §15 加 inline 链接**。开头"想让 implementer 懂 TDD"段或 §15.2 配置示例上方加一句 "skills 预加载机制详见 [Skills 渐进式披露架构](<./Skills 渐进式披露架构.md>)"。
3. **Minor: §16.3 加 inline 链接**。第 (4) 项 PreToolUse hook 示例下方加 "更多 hook 模式见 [Hooks 事件全景与拦截机制](<./Hooks 事件全景与拦截机制.md>)"。
4. **Minor: §17.1 顶部或末尾**加一句"也可对比 [MCP 集成实战] 中的 DB server 方案"——subagent + 只读账号 vs MCP server 是两种 DB 集成思路，值得交叉引。
5. **Minor: §15 开头**可删掉"subagent 不能再 spawn subagent"那句重提，依赖 §1/§8 已存声明，本节集中讲设计取舍。
6. **可选: 反向 mention 核查**。请主 agent 后续检查 [Skills 渐进式披露架构] 是否需要补一句"subagent 可通过 skills 字段预加载 SKILL.md（详见 子智能体 §15）"形成双向链接闭环。
