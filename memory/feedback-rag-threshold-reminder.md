---
lastUpdated: 2026-05-19
trigger: SessionStart 时检查 kb/ 文件数量
---

# RAG 接入阈值提醒

## 背景

用户在 2026-05-19 讨论了知识库是否需要接入 RAG，结论是"现在不需要，但达到阈值后主动提醒"。

## 提醒规则

**在每次 SessionStart 时，如果 `find kb -name "*.md" | wc -l` 的结果满足以下条件，主动提醒用户：**

### 阈值 1：>50 篇 → 提醒启动 BM25 索引

提醒语：
> "知识库已有 X 篇文件，达到了之前规划的 BM25 索引建设阈值。详见 `kb/技术/AI/应用/rag-for-personal-kb.md` §3 第一步。是否要启动？"

### 阈值 2：>80 篇 → 提醒启动 MCP Server

提醒语：
> "知识库已有 X 篇文件，接近全量读入 context 的极限。之前规划了 MCP Server 方案，详见 `kb/技术/AI/应用/rag-for-personal-kb.md` §3 第二步。是否要启动？"

## 相关文件

- 规划文档：`kb/技术/AI/应用/rag-for-personal-kb.md`
- 当前文件数（2026-05-19）：34 篇
