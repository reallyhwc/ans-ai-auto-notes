# 知识库索引

> 由 build-index.js 自动生成（基于 kb/ 目录扫描），勿手改

## 实战 (4 篇)

- [外部参考链接](kb/实战/external-references.md) — 优质外部技术文章、博客、演讲的链接汇总，附带核心要点
- [GitHub 项目创建与同步](kb/实战/github-repo-setup.md) — SSH key 配置、仓库初始化、CI 基础
- [知识管理工具对比](kb/实战/knowledge-management-tools.md) — Obsidian/Notion/本项目方案 对比分析
- [overview.html 踩坑记录](kb/实战/overview-html-pitfalls.md) — overview.html 维护过程中踩过的坑 & 解决方案

## 技术 (37 篇)

### AI (30 篇)

#### AI-Coding (4 篇)

- [AI 编程的递进路径：从古法编程到多 Agent 协作](kb/技术/AI/AI-Coding/ai-coding-levels.md) — 从古法编程到多Agent协作6个Level、程序员未来展望
- [AI Coding 团队治理：从个人提效到团队工程化](kb/技术/AI/AI-Coding/ai-coding-team-governance.md) — 美团31万行代码AI重构实践：人人对齐→人机对齐方法论、Pre-PR机制、零排期重构、高阶模型审查低阶模型
- [AI 编程工具：CLI Agent 与 GUI IDE 全景对比](kb/技术/AI/AI-Coding/ai-coding-tools.md) — AI 编程工具全景对比：终端 Agent (Claude Code / Codex CLI / DeepSeek-TUI) 三方对比，以及 GUI IDE (Cursor / Windsurf) 的两种交互哲学
- [从 Vibe Coding 到 Spec-Driven 到驾驭工程](kb/技术/AI/AI-Coding/vibe-coding-to-harness.md) — AI 编程三阶段演进：Vibe Coding（放马跑，爽但危险）→ Spec-Driven Development（契约约束）→ 驾驭工程/Harness Engineering（系统级自动约束），附本项目 Harness 实践拆解

#### Claude-Code (5 篇)

- [Claude Code 进阶工作流：从能用到高效](kb/技术/AI/Claude-Code/claude-code-advanced-workflow.md) — 四阶段成熟度模型（裸聊→文件化→自动化→生态化）、约束>文档>对话三层模型、hooks/memory/plan/manifest/dev-log实战配置
- [Claude Code 整体架构 & 工作流程](kb/技术/AI/Claude-Code/claude-code-architecture.md) — 整体架构、REPL循环、工具链、Hooks、上下文管理、完整数据流
- [Claude Code 远程操控：Remote Control 与 cc-connect](kb/技术/AI/Claude-Code/claude-code-remote-control.md) — Claude Code远程操控：官方Remote Control vs cc-connect消息桥接、手机编程工作流、微信/飞书接入
- [Harness Engineering：AI Agent 时代的工程范式](kb/技术/AI/Claude-Code/harness-engineering.md) — Harness Engineering(驾驭工程)：Agent=Model+Harness、六项核心能力、四阶段成长路径、双LLM交叉校验四种实现方式
- [Superpowers TDD Skill 工作流拆解](kb/技术/AI/Claude-Code/superpowers-tdd-workflow.md) — TDD 是什么、Superpowers 在其中的角色、LLM 工具调用链详细拆解

#### 基础 (3 篇)

- [CNN（卷积神经网络）](kb/技术/AI/基础/cnn.md) — 图像处理专用网络，卷积+池化
- [RNN（循环神经网络）](kb/技术/AI/基础/rnn.md) — 序列数据处理，LSTM/GRU
- [Transformer](kb/技术/AI/基础/transformer.md) — 自注意力机制，现代大模型底座

#### 大模型 (8 篇)

- [生成式 AI](kb/技术/AI/大模型/generative-ai.md) — 扩散模型：图片/视频/音频生成原理
- [Agent 与 MCP](kb/技术/AI/大模型/llm-agent-mcp.md) — Agent循环、MCP协议、FC机制、Skill定位、五者关系
- [微调与 LoRA：让通用模型学你的领域](kb/技术/AI/大模型/llm-finetuning.md) — LLM微调基础：全量微调vs LoRA、具体客服案例、成本对比
- [Prompt 与 RAG](kb/技术/AI/大模型/llm-prompt-rag.md) — Prompt工程、RAG、向量数据库/Milvus、Embedding、LangChain
- [LLM（大语言模型）](kb/技术/AI/大模型/llm.md) — 核心原理：架构、因果推理、逐字生成、KV Cache
- [本地部署 LLM](kb/技术/AI/大模型/local-llm-deployment.md) — Ollama安装使用+进阶玩法(API/Embedding/Modelfile/Web UI)、小模型推荐
- [MCP 协议：AI 界的 USB-C](kb/技术/AI/大模型/mcp-protocol.md) — MCP协议实现内幕：JSON-RPC通信、stdio OS层细节、服务发现、Spring AI集成、@Tool注解机制
- [多模态 LLM](kb/技术/AI/大模型/multimodal-llm.md) — LLM+视觉编码器，图片/音频输入理解

#### 应用 (10 篇)

- [Agent 开发实战：选型、框架与思维转换](kb/技术/AI/应用/agent-development-practice.md) — 四范式选型、Spring AI/LangChain/CrewAI 框架速查、学习路径四阶段、Agent vs 传统 Java 应用六维对比与工具设计要点
- [Agent 应用运维与韧性：架构之外的生存指南](kb/技术/AI/应用/agent-ops-and-resilience.md) — 可观测性、成本、安全、评估、延迟、状态、数据隐私 8 维度对比传统 Java，流量激增多层限流与缓存，线上问题熔断与回放，工程实践与开源项目推荐
- [Agent 四大设计范式（深度展开）](kb/技术/AI/应用/agent-patterns.md) — 意图路由 / ReAct / Plan-and-Execute / Multi-Agent 四种范式的架构图、Prompt 模板、典型案例与对比
- [AI Agent 工具生态](kb/技术/AI/应用/ai-agent-tools.md) — Hermes Agent（养马）vs OpenClaw（养龙虾）对比、微信 AI 机器人接入
- [AI 工作流平台：Dify、Coze 与 Claude Code 的组合](kb/技术/AI/应用/ai-workflow-platforms.md) — AI工作流平台(Dify/Coze)：低代码编排多模型协作、与Claude Code的关系和组合方式、MCP多模型调度方案
- [LangChain Agent 开发指南：是什么、怎么用、与 Spring AI 对比](kb/技术/AI/应用/langchain-agent-guide.md) — LangChain 核心六件套（Model I/O/Chain/Tool/Memory/Agent/Callbacks）、ReAct Agent 完整代码、与 Spring AI 架构对比、LangGraph 进化版、Java 开发者路线建议
- [LLM 应用设计](kb/技术/AI/应用/llm-app-design.md) — 大模型应用 vs 传统 MySQL/ES 检索：确定性、Tool Calling、幻觉、上下文管理
- [LLM 智能客服实战](kb/技术/AI/应用/llm-customer-service.md) — 从零到一搭建客服系统：知识整理→RAG→LLM接入→Tool Calling→防幻觉→部署运维
- [OpenAI Agents SDK 与多角色协作](kb/技术/AI/应用/openai-agents-sdk.md) — 多角色协作、Handoff机制、Agent编排、与Claude Code对比
- [个人知识库接入 RAG 的规划](kb/技术/AI/应用/rag-for-personal-kb.md) — 何时需要 RAG、渐进式实现路径、架构全景

### Java (5 篇)

- [分布式事务全景](kb/技术/Java/distributed-transaction.md) — Java 后端程序员视角下的分布式事务方案对比与选型实践
- [热点账户高并发记账方案](kb/技术/Java/hot-account-solutions.md) — 单账户高并发写入场景下的 7 种解决方案对比、选型及异步一致性设计
- [RocketMQ 底层实现原理](kb/技术/Java/rocketmq-internals.md) — 从 Producer 到 Broker 存储到 Consumer 的全链路底层机制
- [Dubbo 与 RPC 框架横评](kb/技术/Java/rpc-dubbo-comparison.md) — Dubbo 核心架构、调用链路、3.x 新特性，以及 gRPC/OpenFeign/Thrift/Kitex 等主流 RPC 框架对比选型
- [Spring AI](kb/技术/Java/spring-ai.md) — Spring 生态 LLM 集成，流式/非流式调用

### 计算机基础 (2 篇)

- [贝叶斯统计与AI的关系](kb/技术/计算机基础/bayesian-statistics.md) — 贝叶斯定理直觉理解、先验/后验/证据、HIV检测经典例子、与AI的四处交集（朴素贝叶斯/贝叶斯深度学习/概率图模型/生成模型）
- [图灵机与冯诺依曼结构](kb/技术/计算机基础/turing-von-neumann.md) — 计算机科学两大基石：图灵机（可计算性理论）vs 冯诺依曼结构（工程实现蓝图），以及两者的关系

## 读书笔记 (2 篇)

- [世界的逻辑 — 马兆远](kb/读书笔记/世界的逻辑.md) — 马兆远《世界的逻辑》：图灵机、冯诺依曼结构、计算思维等相关概念梳理
- [我看见的世界 — 李飞飞](kb/读书笔记/我看见的世界.md) — AI 女神李飞飞自传：ImageNet、斯坦福 AI Lab、人文与技术交汇

