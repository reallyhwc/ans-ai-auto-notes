---
name: project-knowledge-base
description: 通过AI对话自动构建个人知识库，git+md形式，主题分类+时间线双轨制
type: project
lastUpdated: 2026-05-17originSessionId: ff641dae-a73b-4600-9f28-4c7bd678dcac
---
项目 `ans-ai-auto-notes` 旨在通过与 AI 对话逐步沉淀个人知识库。
采用 git + markdown 形式，主题分类（技术/读书笔记/日常思考/action）和时间线按周归档双轨并行。
已有入口文件：INDEX.md（总目录）、overview.html（可视化导览，支持右侧 TOC 目录）。

**更新策略**：混合模式 — 小知识点自动追加，大改动（重组/合并）主动提案待确认；**拆分决策权归用户，AI 不擅自提案**（见 [[feedback-no-auto-split]]）。

**文件拆分规则**（已写入 kb-content-style skill）：
- 行数 >1000 只提示关注，**不提案拆分**（>1500 也不再"必须拆"）
- 结构违规（日期戳混合/章节跳号/单节过大/主题分散）可提案重组，但判定保守
- 拆分（一变多）：永不擅自提案，除非用户主动要求

**已拆分经验**：llm.md（1143 行 → llm.md + llm-prompt-rag.md + llm-agent-mcp.md，3 文件，用户主动要求）。

**Why:** 用户希望在不打断对话流的情况下自动积累结构化知识，同时保留对重大改动的掌控权。

**How to apply:** 每次对话后自动提取知识点写入对应文件；发现文件过大或结构需调整时主动提案。笔记风格必须是带 Demo 的对话式讲解，不是教科书定义。
