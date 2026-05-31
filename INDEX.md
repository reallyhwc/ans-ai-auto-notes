# 知识库索引

> 由 build-index.js 自动生成（基于 kb/ 目录扫描），勿手改

## 实战 (4 篇)

- [GitHub 项目创建与同步](kb/实战/GitHub 项目创建与同步.md) — SSH key 配置、仓库初始化、CI 基础
- [overview.html 踩坑记录](kb/实战/overview.html 踩坑记录.md) — overview.html 维护过程中踩过的坑 & 解决方案
- [外部参考链接](kb/实战/外部参考链接.md) — 优质外部技术文章、博客、演讲的链接汇总，附带核心要点
- [知识管理工具对比](kb/实战/知识管理工具对比.md) — Obsidian/Notion/本项目方案 对比分析

## 技术 (41 篇)

### AI (34 篇)

#### AI-Coding (5 篇)

- [AI Coding 团队治理：从个人提效到团队工程化](kb/技术/AI/AI-Coding/AI Coding 团队治理：从个人提效到团队工程化.md) — 美团31万行代码AI重构实践：人人对齐→人机对齐方法论、Pre-PR机制、零排期重构、高阶模型审查低阶模型
- [AI 时代的开发者角色进化：2026 年市场全景与职业重塑](kb/技术/AI/AI-Coding/AI 时代的开发者角色进化：2026 年市场全景与职业重塑.md) — 2026年AI开发范式四档市场全景（辅助编码→任务Agent→Spec驱动→全流程平台），Java开发者经验如何从'写代码'迁移到'质量把关+系统设计+Agent判断框架构建'，以及'还有多少Agent需要开发'的诚实回答
- [AI 编程工具：CLI Agent 与 GUI IDE 全景对比](kb/技术/AI/AI-Coding/AI 编程工具：CLI Agent 与 GUI IDE 全景对比.md) — AI 编程工具全景对比：终端 Agent (Claude Code / Codex CLI / DeepSeek-TUI) 三方对比，以及 GUI IDE (Cursor / Windsurf) 的两种交互哲学
- [AI 编程的递进路径：从古法编程到多 Agent 协作](kb/技术/AI/AI-Coding/AI 编程的递进路径：从古法编程到多 Agent 协作.md) — 从古法编程到多Agent协作6个Level、程序员未来展望
- [从 Vibe Coding 到 Spec-Driven 到驾驭工程](kb/技术/AI/AI-Coding/从 Vibe Coding 到 Spec-Driven 到驾驭工程.md) — AI 编程三阶段演进：Vibe Coding（放马跑，爽但危险）→ Spec-Driven Development（契约约束）→ 驾驭工程/Harness Engineering（系统级自动约束），附本项目 Harness 实践拆解

#### Claude-Code (5 篇)

- [Claude Code 整体架构 & 工作流程](kb/技术/AI/Claude-Code/Claude Code 整体架构 & 工作流程.md) — 整体架构、REPL循环、工具链、Hooks、上下文管理、完整数据流
- [Claude Code 进阶工作流：从能用到高效](kb/技术/AI/Claude-Code/Claude Code 进阶工作流：从能用到高效.md) — 四阶段成熟度模型（裸聊→文件化→自动化→生态化）、约束>文档>对话三层模型、hooks/memory/plan/manifest/dev-log实战配置
- [Claude Code 远程操控：Remote Control 与 cc-connect](kb/技术/AI/Claude-Code/Claude Code 远程操控：Remote Control 与 cc-connect.md) — Claude Code远程操控：官方Remote Control vs cc-connect消息桥接、手机编程工作流、微信/飞书接入
- [Harness Engineering：AI Agent 时代的工程范式](kb/技术/AI/Claude-Code/Harness Engineering：AI Agent 时代的工程范式.md) — Harness Engineering(驾驭工程)：Agent=Model+Harness、六项核心能力、四阶段成长路径、双LLM交叉校验四种实现方式
- [Superpowers TDD Skill 工作流拆解](kb/技术/AI/Claude-Code/Superpowers TDD Skill 工作流拆解.md) — TDD 是什么、Superpowers 在其中的角色、LLM 工具调用链详细拆解

#### 基础 (3 篇)

- [CNN（卷积神经网络）](kb/技术/AI/基础/CNN（卷积神经网络）.md) — 图像处理专用网络，卷积+池化
- [RNN（循环神经网络）](kb/技术/AI/基础/RNN（循环神经网络）.md) — 序列数据处理，LSTM/GRU
- [Transformer](kb/技术/AI/基础/Transformer.md) — 自注意力机制，现代大模型底座

#### 大模型 (8 篇)

- [Agent 与 MCP](kb/技术/AI/大模型/Agent 与 MCP.md) — Agent循环、MCP协议、FC机制、Skill定位、五者关系
- [LLM（大语言模型）](kb/技术/AI/大模型/LLM（大语言模型）.md) — 核心原理：架构、因果推理、逐字生成、KV Cache
- [MCP 协议：AI 界的 USB-C](kb/技术/AI/大模型/MCP 协议：AI 界的 USB-C.md) — MCP协议实现内幕：JSON-RPC通信、stdio OS层细节、服务发现、Spring AI集成、@Tool注解机制
- [Prompt 与 RAG](kb/技术/AI/大模型/Prompt 与 RAG.md) — Prompt工程、RAG、向量数据库/Milvus、Embedding、LangChain
- [多模态 LLM](kb/技术/AI/大模型/多模态 LLM.md) — LLM+视觉编码器，图片/音频输入理解
- [微调与 LoRA：让通用模型学你的领域](kb/技术/AI/大模型/微调与 LoRA：让通用模型学你的领域.md) — LLM微调基础：全量微调vs LoRA、具体客服案例、成本对比
- [本地部署 LLM](kb/技术/AI/大模型/本地部署 LLM.md) — Ollama安装使用+进阶玩法(API/Embedding/Modelfile/Web UI)、小模型推荐
- [生成式 AI](kb/技术/AI/大模型/生成式 AI.md) — 扩散模型：图片/视频/音频生成原理

#### 应用 (13 篇)

- [Agent 四大设计范式（深度展开）](kb/技术/AI/应用/Agent 四大设计范式（深度展开）.md) — 意图路由 / ReAct / Plan-and-Execute / Multi-Agent 四种范式的架构图、Prompt 模板、典型案例与对比
- [Agent 应用运维与韧性：架构之外的生存指南](kb/技术/AI/应用/Agent 应用运维与韧性：架构之外的生存指南.md) — 可观测性、成本、安全、评估、延迟、状态、数据隐私 8 维度对比传统 Java，流量激增多层限流与缓存，线上问题熔断与回放，工程实践与开源项目推荐
- [Agent 开发实战：选型、框架与思维转换](kb/技术/AI/应用/Agent 开发实战：选型、框架与思维转换.md) — 四范式选型、Spring AI/LangChain/CrewAI 框架速查、学习路径四阶段、Agent vs 传统 Java 应用六维对比与工具设计要点
- [AI Agent 工具生态](kb/技术/AI/应用/AI Agent 工具生态.md) — Hermes Agent（养马）vs OpenClaw（养龙虾）对比、微信 AI 机器人接入
- [AI 工作流平台：Dify、Coze 与 Claude Code 的组合](kb/技术/AI/应用/AI 工作流平台：Dify、Coze 与 Claude Code 的组合.md) — AI工作流平台(Dify/Coze)：低代码编排多模型协作、与Claude Code的关系和组合方式、MCP多模型调度方案
- [LangChain Agent 开发指南：是什么、怎么用、与 Spring AI 对比](kb/技术/AI/应用/LangChain Agent 开发指南：是什么、怎么用、与 Spring AI 对比.md) — LangChain 核心六件套（Model I/O/Chain/Tool/Memory/Agent/Callbacks）、ReAct Agent 完整代码、与 Spring AI 架构对比、LangGraph 进化版、Java 开发者路线建议
- [LLM 应用设计](kb/技术/AI/应用/LLM 应用设计.md) — 大模型应用 vs 传统 MySQL/ES 检索：确定性、Tool Calling、幻觉、上下文管理
- [LLM 智能客服实战](kb/技术/AI/应用/LLM 智能客服实战.md) — 从零到一搭建客服系统：知识整理→RAG→LLM接入→Tool Calling→防幻觉→部署运维
- [OpenAI Agents SDK 与多角色协作](kb/技术/AI/应用/OpenAI Agents SDK 与多角色协作.md) — 多角色协作、Handoff机制、Agent编排、与Claude Code对比
- [Spring AI vs LangChain 深度对比：从 Java 后端视角彻底搞懂](kb/技术/AI/应用/Spring AI vs LangChain 深度对比：从 Java 后端视角彻底搞懂.md) — JPA vs JdbcTemplate 类比、同一场景 Spring AI(20行) vs LangChain(40行) 并排代码、黑盒 vs 白盒架构图、设计哲学（约定优于配置 vs 显式优于隐式）、选型决策指南、对照学习映射表
- [个人知识库接入 RAG 的规划](kb/技术/AI/应用/个人知识库接入 RAG 的规划.md) — 何时需要 RAG、渐进式实现路径、架构全景
- [主流 Agent 产品技术栈解剖：自研循环 vs 框架之争](kb/技术/AI/应用/主流 Agent 产品技术栈解剖：自研循环 vs 框架之争.md) — Claude Code/OpenClaw/Hermes Agent 技术栈拆解，为什么顶级 Agent 产品都不用 LangChain/Spring AI，Agent 循环对比（TAOR/Hub-and-Spoke/run_conversation）
- [跨语言 Agent + MCP 架构：Python Agent ↔ Java MCP 混合开发](kb/技术/AI/应用/跨语言 Agent + MCP 架构：Python Agent ↔ Java MCP 混合开发.md) — LangChain 双语言支持(Python/JS)、Python写Agent+Java写MCP的正反两种方案、MCP协议抹平语言差异的配置示例、推荐架构

### Java (5 篇)

- [Dubbo 与 RPC 框架横评](kb/技术/Java/Dubbo 与 RPC 框架横评.md) — Dubbo 核心架构、调用链路、3.x 新特性，以及 gRPC/OpenFeign/Thrift/Kitex 等主流 RPC 框架对比选型
- [RocketMQ 底层实现原理](kb/技术/Java/RocketMQ 底层实现原理.md) — 从 Producer 到 Broker 存储到 Consumer 的全链路底层机制
- [Spring AI](kb/技术/Java/Spring AI.md) — Spring 生态 LLM 集成，流式/非流式调用
- [分布式事务全景](kb/技术/Java/分布式事务全景.md) — Java 后端程序员视角下的分布式事务方案对比与选型实践
- [热点账户高并发记账方案](kb/技术/Java/热点账户高并发记账方案.md) — 单账户高并发写入场景下的 7 种解决方案对比、选型及异步一致性设计

### 计算机基础 (2 篇)

- [图灵机与冯诺依曼结构](kb/技术/计算机基础/图灵机与冯诺依曼结构.md) — 计算机科学两大基石：图灵机（可计算性理论）vs 冯诺依曼结构（工程实现蓝图），以及两者的关系
- [贝叶斯统计与AI的关系](kb/技术/计算机基础/贝叶斯统计与AI的关系.md) — 贝叶斯定理直觉理解、先验/后验/证据、HIV检测经典例子、与AI的四处交集（朴素贝叶斯/贝叶斯深度学习/概率图模型/生成模型）

## 读书笔记 (2 篇)

- [世界的逻辑 — 马兆远](kb/读书笔记/世界的逻辑 — 马兆远.md) — 马兆远《世界的逻辑》：图灵机、冯诺依曼结构、计算思维等相关概念梳理
- [我看见的世界 — 李飞飞](kb/读书笔记/我看见的世界 — 李飞飞.md) — AI 女神李飞飞自传：ImageNet、斯坦福 AI Lab、人文与技术交汇

