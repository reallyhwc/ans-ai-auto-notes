# 知识库索引

> 由 build-index.js 自动生成（基于 kb/ 目录扫描），勿手改

## 实战 (4 篇)

- [GitHub 项目创建与同步](kb/实战/GitHub 项目创建与同步.md) — SSH key 配置、仓库初始化、CI 基础
- [overview.html 踩坑记录](kb/实战/overview.html 踩坑记录.md) — overview.html 维护过程中踩过的坑 & 解决方案
- [外部参考链接](kb/实战/外部参考链接.md) — 优质外部技术文章、博客、演讲的链接汇总，附带核心要点
- [知识管理工具对比](kb/实战/知识管理工具对比.md) — Obsidian/Notion/本项目方案 对比分析

## 技术 (59 篇)

- [Go 与 TypeScript 快速对比](kb/技术/Go 与 TypeScript 对比.md) — Go 和 TypeScript 语言特性、生态、典型用例对比，含 Qoder CLI 从 Go 重构到 TypeScript 的动机推测

### AI (48 篇)

#### AI-Coding (5 篇)

- [AI Coding 团队治理：从个人提效到团队工程化](kb/技术/AI/AI-Coding/AI Coding 团队治理：从个人提效到团队工程化.md) — 美团31万行代码AI重构实践：人人对齐→人机对齐方法论、Pre-PR机制、零排期重构、高阶模型审查低阶模型
- [AI 时代的开发者角色进化：2026 年市场全景与职业重塑](kb/技术/AI/AI-Coding/AI 时代的开发者角色进化：2026 年市场全景与职业重塑.md) — 2026年AI开发范式四档市场全景（辅助编码→任务Agent→Spec驱动→全流程平台），Java开发者经验如何从'写代码'迁移到'质量把关+系统设计+Agent判断框架构建'，以及'还有多少Agent需要开发'的诚实回答
- [AI 编程工具：CLI Agent 与 GUI IDE 全景对比](kb/技术/AI/AI-Coding/AI 编程工具：CLI Agent 与 GUI IDE 全景对比.md) — AI 编程工具全景对比：终端 Agent (Claude Code / Codex CLI / DeepSeek-TUI) 三方对比，以及 GUI IDE (Cursor / Windsurf) 的两种交互哲学
- [AI 编程的递进路径：从古法编程到多 Agent 协作](kb/技术/AI/AI-Coding/AI 编程的递进路径：从古法编程到多 Agent 协作.md) — 从古法编程到多Agent协作6个Level、程序员未来展望
- [从 Vibe Coding 到 Spec-Driven 到驾驭工程](kb/技术/AI/AI-Coding/从 Vibe Coding 到 Spec-Driven 到驾驭工程.md) — AI 编程三阶段演进：Vibe Coding（放马跑，爽但危险）→ Spec-Driven Development（契约约束）→ 驾驭工程/Harness Engineering（系统级自动约束），附本项目 Harness 实践拆解

#### Claude-Code (17 篇)

- [Agent Teams 多会话协作架构](kb/技术/AI/Claude-Code/Agent Teams 多会话协作架构.md) — Claude Code Agent Teams 实验性特性：从 Sub-Agents 的树状委托到 Teams 的网状协作、四大设计模式的本质区分、选型决策的核心判据、成本与收益的权衡框架
- [Claude Code 2026 上半年新特性与项目实践](kb/技术/AI/Claude-Code/Claude Code 2026 上半年新特性与项目实践.md) — 2026 年 1-6 月 Claude Code 新增的架构级能力（Agent View/Teams/Auto Mode/Dynamic Workflows）、模型升级（Opus 4.8）、工具增强（fallbackModel/Plugin 生态/Worktree 增强），及在 ans-ai-auto-notes 项目中的落地分析
- [Claude Code 整体架构 & 工作流程](kb/技术/AI/Claude-Code/Claude Code 整体架构 & 工作流程.md) — 整体架构、REPL循环、工具链、Hooks、上下文管理、完整数据流
- [Claude Code 进阶工作流：从能用到高效](kb/技术/AI/Claude-Code/Claude Code 进阶工作流：从能用到高效.md) — 四阶段成熟度模型（裸聊→文件化→自动化→生态化）、约束>文档>对话三层模型、hooks/memory/plan/manifest/dev-log实战配置
- [Claude Code 远程操控：Remote Control 与 cc-connect](kb/技术/AI/Claude-Code/Claude Code 远程操控：Remote Control 与 cc-connect.md) — Claude Code远程操控：官方Remote Control vs cc-connect消息桥接、手机编程工作流、微信/飞书接入
- [Harness Engineering：AI Agent 时代的工程范式](kb/技术/AI/Claude-Code/Harness Engineering：AI Agent 时代的工程范式.md) — Harness Engineering(驾驭工程)：Agent=Model+Harness、六项核心能力、四阶段成长路径、双LLM交叉校验四种实现方式
- [Headless 模式与 Agent SDK](kb/技术/AI/Claude-Code/Headless 模式与 Agent SDK.md) — Claude Code 非交互模式：-p 参数全清单、--bare 启动模式、output-format 结构化输出、stream-json 事件类型、CI 集成模式、Agent SDK 关系、headless vs 自建 Agent 选型
- [Hooks 事件全景与拦截机制](kb/技术/AI/Claude-Code/Hooks 事件全景与拦截机制.md) — Claude Code 全部 30+ hook 事件按类别清单、阻断三档机制、配置层级合并、PreToolUse 完整示例、subagent/skill 内的 hook
- [MCP 集成实战（含 Spring AI）](kb/技术/AI/Claude-Code/MCP 集成实战（含 Spring AI）.md) — MCP 协议在 Claude Code 中的接入：四种 transport 对比、三级 scope 优先级、配置命令、Spring AI MCP server 实战接入、OAuth、Tool Search 优化、调试与坑
- [Plugins 插件体系](kb/技术/AI/Claude-Code/Plugins 插件体系.md) — Claude Code plugin 系统：与 standalone 配置的边界、目录结构、manifest schema、能打包的资源、安装方式、marketplace 机制、版本管理、迁移路径
- [Skills 渐进式披露架构](kb/技术/AI/Claude-Code/Skills 渐进式披露架构.md) — Skills 的三层渐进式披露机制、token 经济学、frontmatter 全字段、生命周期、动态 context 注入、与 commands/subagent 的边界
- [Superpowers TDD Skill 工作流拆解](kb/技术/AI/Claude-Code/Superpowers TDD Skill 工作流拆解.md) — TDD 是什么、Superpowers 在其中的角色、LLM 工具调用链详细拆解
- [从 Sub-Agent 到 Multi-Agent 的工程指南](kb/技术/AI/Claude-Code/从 Sub-Agent 到 Multi-Agent 的工程指南.md) — Multi-Agent 四种设计模式（Sub-Agents/Skills/Handoffs/Router）、升级决策阶梯、Supervisor 模式详解、生产环境部署实例、Claude Code 本地 sub-agent 与生产 agent 的本质区别、知识库项目选型分析
- [任务型 Skills（斜杠命令）实战](kb/技术/AI/Claude-Code/任务型 Skills（斜杠命令）实战.md) — 任务型 Skill 的核心机制、参数传递、!command 动态注入、Skill 内 Hooks、七步设计清单、命名空间组织，以及与参考型/SubAgent 的边界
- [子代理专题总结与综合案例](kb/技术/AI/Claude-Code/子代理专题总结与综合案例.md) — 子代理六讲知识体系的两层能力模型（Sub-Agents 结构化分工 vs Agent Teams 认知协作）、四种子代理使用模式、电商大促支付超时五阶段综合案例、贯穿始终的工程方法论、假期思考题
- [子智能体（subagents）机制与实战](kb/技术/AI/Claude-Code/子智能体（subagents）机制与实战.md) — subagent 的定位、与 skill/Agent SDK 的区分、四级 scope 优先级、frontmatter 全字段、三种调用方式、独立 context 机制、协作链路、fork/worktree/persistent memory 进阶、permissionMode 风险与降险配套、skills 预加载 vs 嵌套 spawn 取舍、常见 subagent 配方（数据库查询分析器/code-reviewer/test-runner）
- [并行探索与流水线编排](kb/技术/AI/Claude-Code/并行探索与流水线编排.md) — 子代理的两种编排模式——并行探索（Fan-out/Fan-in）与流水线编排（Pipeline），含独立性判定、交接契约设计、失败回退策略、混合模式决策树、编排者四种介入形式

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

#### 应用 (15 篇)

- [Agent Observability：调用链追踪与排障](kb/技术/AI/应用/Agent Observability：调用链追踪与排障.md) — Agent 系统的可观测性——为什么 agent 比传统服务更难排障；span/parent_id 数据模型；LangSmith / Helicone / OTel / 自建 jsonl 方案对比；本项目 agent-runs.jsonl 落地详解；升级路径
- [Agent 四大设计范式（深度展开）](kb/技术/AI/应用/Agent 四大设计范式（深度展开）.md) — 意图路由 / ReAct / Plan-and-Execute / Multi-Agent 四种范式的架构图、Prompt 模板、典型案例与对比
- [Agent 应用运维与韧性：架构之外的生存指南](kb/技术/AI/应用/Agent 应用运维与韧性：架构之外的生存指南.md) — 可观测性、成本、安全、评估、延迟、状态、数据隐私 8 维度对比传统 Java，流量激增多层限流与缓存，线上问题熔断与回放，工程实践与开源项目推荐
- [Agent 开发实战：选型、框架与思维转换](kb/技术/AI/应用/Agent 开发实战：选型、框架与思维转换.md) — 四范式选型、Spring AI/LangChain/CrewAI 框架速查、学习路径四阶段、Agent vs 传统 Java 应用六维对比与工具设计要点
- [AI Agent 工具生态](kb/技术/AI/应用/AI Agent 工具生态.md) — Hermes Agent（养马）vs OpenClaw（养龙虾）对比、微信 AI 机器人接入
- [AI 工作流平台：Dify、Coze 与 Claude Code 的组合](kb/技术/AI/应用/AI 工作流平台：Dify、Coze 与 Claude Code 的组合.md) — AI工作流平台(Dify/Coze)：低代码编排多模型协作、与Claude Code的关系和组合方式、MCP多模型调度方案
- [CLI Coding Agent 系统架构：从 REPL 到自主编程](kb/技术/AI/应用/CLI Coding Agent 系统架构：从 REPL 到自主编程.md) — 拆解 Claude Code / Aider / Codex CLI 等 CLI 编程 Agent 的分层架构、启动流程、Agent Loop、工具系统、权限模型、上下文管理，附可运行 demo
- [LangChain Agent 开发指南：是什么、怎么用、与 Spring AI 对比](kb/技术/AI/应用/LangChain Agent 开发指南：是什么、怎么用、与 Spring AI 对比.md) — LangChain 核心六件套（Model I/O/Chain/Tool/Memory/Agent/Callbacks）、ReAct Agent 完整代码、与 Spring AI 架构对比、LangGraph 进化版、Java 开发者路线建议
- [LLM 应用设计](kb/技术/AI/应用/LLM 应用设计.md) — 大模型应用 vs 传统 MySQL/ES 检索：确定性、Tool Calling、幻觉、上下文管理
- [LLM 智能客服实战](kb/技术/AI/应用/LLM 智能客服实战.md) — 从零到一搭建客服系统：知识整理→RAG→LLM接入→Tool Calling→防幻觉→部署运维
- [OpenAI Agents SDK 与多角色协作](kb/技术/AI/应用/OpenAI Agents SDK 与多角色协作.md) — 多角色协作、Handoff机制、Agent编排、与Claude Code对比
- [Spring AI vs LangChain 深度对比：从 Java 后端视角彻底搞懂](kb/技术/AI/应用/Spring AI vs LangChain 深度对比：从 Java 后端视角彻底搞懂.md) — JPA vs JdbcTemplate 类比、同一场景 Spring AI(20行) vs LangChain(40行) 并排代码、黑盒 vs 白盒架构图、设计哲学（约定优于配置 vs 显式优于隐式）、选型决策指南、对照学习映射表
- [个人知识库接入 RAG 的规划](kb/技术/AI/应用/个人知识库接入 RAG 的规划.md) — 何时需要 RAG、渐进式实现路径、架构全景
- [主流 Agent 产品技术栈解剖：自研循环 vs 框架之争](kb/技术/AI/应用/主流 Agent 产品技术栈解剖：自研循环 vs 框架之争.md) — Claude Code/OpenClaw/Hermes Agent 技术栈拆解，为什么顶级 Agent 产品都不用 LangChain/Spring AI，Agent 循环对比（TAOR/Hub-and-Spoke/run_conversation）
- [跨语言 Agent + MCP 架构：Python Agent ↔ Java MCP 混合开发](kb/技术/AI/应用/跨语言 Agent + MCP 架构：Python Agent ↔ Java MCP 混合开发.md) — LangChain 双语言支持(Python/JS)、Python写Agent+Java写MCP的正反两种方案、MCP协议抹平语言差异的配置示例、推荐架构

### Java (8 篇)

- [Dubbo 与 RPC 框架横评](kb/技术/Java/Dubbo 与 RPC 框架横评.md) — Dubbo 核心架构、调用链路、3.x 新特性，以及 gRPC/OpenFeign/Thrift/Kitex 等主流 RPC 框架对比选型
- [Redis 常用数据类型与使用场景](kb/技术/Java/Redis 常用数据类型与使用场景.md) — Redis 五大基本类型（String/List/Set/Hash/ZSet）的底层实现、使用场景、常用命令，ZSet 跳表原理及双结构设计，含 Bitmap/HyperLogLog/GEO/Stream 简表
- [RocketMQ 底层实现原理](kb/技术/Java/RocketMQ 底层实现原理.md) — 从 Producer 到 Broker 存储到 Consumer 的全链路底层机制
- [Spring AI](kb/技术/Java/Spring AI.md) — Spring 生态 LLM 集成，流式/非流式调用
- [Spring IOC、DI 与 AOP 核心原理](kb/技术/Java/Spring IOC、DI 与 AOP 核心原理.md) — Spring 核心机制详解：IoC（控制反转）设计思想、DI（依赖注入）三种方式、Bean 生命周期、AOP（面向切面编程）动态代理原理，含完整代码 Demo 和 Mermaid 图
- [主流消息队列对比与选型](kb/技术/Java/主流消息队列对比与选型.md) — Kafka / RocketMQ / RabbitMQ 三大 MQ 的架构原理、存储机制、HA 策略深度对比与选型决策
- [分布式事务全景](kb/技术/Java/分布式事务全景.md) — Java 后端程序员视角下的分布式事务方案对比与选型实践
- [热点账户高并发记账方案](kb/技术/Java/热点账户高并发记账方案.md) — 单账户高并发写入场景下的 7 种解决方案对比、选型及异步一致性设计

### 计算机基础 (2 篇)

- [图灵机与冯诺依曼结构](kb/技术/计算机基础/图灵机与冯诺依曼结构.md) — 计算机科学两大基石：图灵机（可计算性理论）vs 冯诺依曼结构（工程实现蓝图），以及两者的关系
- [贝叶斯统计与AI的关系](kb/技术/计算机基础/贝叶斯统计与AI的关系.md) — 贝叶斯定理直觉理解、先验/后验/证据、HIV检测经典例子、与AI的四处交集（朴素贝叶斯/贝叶斯深度学习/概率图模型/生成模型）

## 读书笔记 (2 篇)

- [世界的逻辑 — 马兆远](kb/读书笔记/世界的逻辑 — 马兆远.md) — 马兆远《世界的逻辑》阅读笔记：全书结构梳理、苏格拉底/柏拉图/亚里士多德、图灵机与冯诺依曼结构
- [我看见的世界 — 李飞飞](kb/读书笔记/我看见的世界 — 李飞飞.md) — AI 女神李飞飞自传：ImageNet、斯坦福 AI Lab、人文与技术交汇

## 课程笔记 (2 篇)

- [Claude Code 工程化实战 黄佳](kb/课程笔记/Claude Code 工程化实战 黄佳.md) — 极客时间黄佳《Claude Code 工程化实战》课程的学习导读：按章节记录学习节点、关键问题、对应专题文件链接、个人疑问与扩展阅读
- [识别自动化机会的方法论](kb/课程笔记/识别自动化机会的方法论.md) — 训练'看出哪些重复任务能 Commands/Skills/Hooks 自动化'的元能力：三次法则、复述检测、触发器分类、工具决策树、本项目候选清单

