---
title: "AI Agent 工具生态"
description: "Hermes Agent（养马）vs OpenClaw（养龙虾）对比、微信 AI 机器人接入"
---

# AI Agent 工具生态：Hermes vs OpenClaw

> 最后整理: 2026-05-05 | 来源: 多轮对话 + Web 检索

## 一句话定位

2025-2026 年 AI Agent 工具爆发。Hermes Agent（"养马"）和 OpenClaw（"养龙虾"）是最火的两个开源 Agent 框架。前者像"会自我进化的数字员工"，后者像"能操作系统的高级工具"。本章记录它们的工作原理、Mac 安装方式和程序员最佳实践。

> 关联: [llm-agent-mcp](../大模型/Agent 与 MCP.md) — Agent 基础概念、MCP 协议、Function Calling 机制 | [ai-coding-tools](../AI-Coding/AI 编程工具：CLI Agent 与 GUI IDE 全景对比.md) — AI 编程 IDE 与 CLI Agent 对比 | [知识管理工具对比](../../../实战/知识管理工具对比.md) — Obsidian vs AI 知识库方案

---

## 1. Hermes Agent（"养马"）

### 1.1 是什么

Nous Research 于 2026 年 2 月开源，2 个月 10 万+ GitHub Star。核心理念：**"The agent that grows with you."** —— 越用越懂你，越用越聪明。

### 1.2 工作原理：闭环自进化

```
┌──────────────────────────────────────────────┐
│              闭环学习飞轮                       │
│                                              │
│  环境感知 → 经验编码 → 技能生成 → 策略优化      │
│      ↑                                ↓      │
│      └────────── 复用反馈 ─────────────┘      │
└──────────────────────────────────────────────┘
```

**五层架构**：

| 层级 | 作用 | 程序员视角的关键细节 |
|------|------|---------------------|
| 入口与编排层 | CLI + Gateway 多平台入口 | 同步对话循环，`ThreadPoolExecutor` 显式控制并行（最多 8 worker） |
| Agent 核心层 | `run_conversation()` 循环 | LLM → 工具调用 → 结果追加 → 重复；子 Agent 隔离，最大委托深度 2 |
| 工具与注册层 | ToolRegistry 单例 | 运行时可用性检查——无 API Key 的工具自动隐藏，防止 LLM "幻觉调用" |
| 状态与持久化层 | SQLite + WAL + FTS5 | 有界策展式记忆，MEMORY.md / USER.md 分离设计 |
| 平台适配层 | 15+ 消息平台 | Telegram、Discord、微信、飞书、WhatsApp、Signal 等 |

**为什么选择同步而非异步？** AI Agent 的瓶颈是 LLM API 延迟（秒级），不是 I/O 并发。异步框架的收益在这场景下微乎其微，同步代码反而调试更友好。需要并行时显式用 `ThreadPoolExecutor`。

### 1.3 三层记忆系统（核心差异化）

```
第一层 持久记忆  →  MEMORY.md (~800 Token) + USER.md (~500 Token)
                   类比：你入职时填的员工档案 + 同事对你的了解

第二层 Skill记忆 →  ~/.hermes/skills/ 目录
                   类比：你积累的工作 SOP 文档，下次直接复用

第三层 会话记忆  →  SQLite + FTS5 全文索引
                   类比：你的工作日记，能全文搜索历史对话
```

**关键设计**：会话开始时把记忆快照注入 system prompt，运行中写入的新记忆立即持久化但**不影响当前 prompt**——这保证了 Anthropic 等提供商的前缀缓存持续命中，不会因为记忆更新而每次都重新计算整个上下文。

### 1.4 Mac 安装（三条路径）

```bash
# 路径一：一键脚本（快速体验）
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
# 国内镜像：curl -fsSL https://res1.hermesagent.org.cn/install.sh | bash

# 路径二：原生 macOS 桌面应用（日常高频使用推荐）
git clone https://github.com/nesquena/hermes-webui.git ~/hermes-webui-public
cd ~/hermes-webui-public && bash start.sh
# 服务跑在 http://localhost:8787，再下载 DMG 拖入 Applications

# 路径三：手动安装（需要完全控制时）
git clone https://github.com/NousResearch/hermes-agent.git
cd hermes-agent
python -m venv hermes_env && source hermes_env/bin/activate
pip install -r requirements.txt
python -m hermes
```

初始化配置：

```bash
hermes setup          # 交互式选择模型 + API Key
hermes gateway setup  # 配置消息平台（Telegram/微信/飞书）
hermes config list    # 查看当前配置
```

### 1.5 程序员最佳实践

**模型选择策略**：

```
日常任务（代码生成、问答） → DeepSeek V3（性价比之王）
复杂推理（架构设计、debug） → Claude Opus 4
离线/敏感数据场景           → Ollama + qwen2.5:7b 本地跑
国内稳定首选               → 阿里云百炼 qwen-max
```

**技能录制 —— 把重复操作变成可复用资产**：

```bash
# 录制一个"提交代码到 GitHub"的技能
hermes --teach "提交代码到GitHub" <<EOF
1. git add .
2. git commit -m "update"
3. git push origin main
EOF

# 以后直接调用
hermes --skill "提交代码到GitHub"
```

**安全底线**：
- API Key 用环境变量，绝不写进配置文件或提交到 Git
- Gateway 绑定 `127.0.0.1`，不暴露公网
- 开启文件系统快照（操作前自动创建恢复点）
- 始终用 `hermes --shutdown` 退出，不要 Ctrl+C（保护记忆数据）

---

## 2. OpenClaw（"养龙虾"）

### 2.1 是什么

奥地利工程师 Peter Steinberger 于 2025 年 11 月发布，原名 Clawdbot → Moltbot → OpenClaw。约 34 万 GitHub Star。

**核心定位**：能执行系统级任务的 AI 虚拟助理——读写文件、跑 Shell、操控浏览器、发邮件、管日历。

### 2.2 工作原理：四大模块

```
Gateway（网关）→ Agent（代理）→ Skills（技能）→ Memory（记忆）
   常驻进程        任务分解        插件化扩展      Markdown+SQLite
   WebSocket       工具调用循环    ClawHub市场      跨会话持久
```

关键创新：
- **Hub-and-Spoke 架构**：消息接口与 AI 推理层高度解耦
- **Lane Queue**：不依赖外部消息队列的会话级任务排队
- **SOUL.md**：用纯 Markdown 定义 Agent 的持久身份、性格与行为边界
- **可插拔上下文引擎**：插件自定义上下文压缩与组装策略

### 2.3 Mac 安装（开发者手动方式）

```bash
# 1. Node.js ≥ 22
brew install node@24
echo 'export PATH="/usr/local/opt/node@24/bin:$PATH"' >> ~/.zshrc

# 2. 配置 npm 全局目录（避坑：EACCES 权限报错）
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'

# 3. 国内镜像（Sharp 依赖必设！M芯片/国内网络不设会编译失败）
npm config set registry https://registry.npmmirror.com/
export SHARP_DIST_BASE_URL="https://npmmirror.com/mirrors/sharp-libvips/"

# 4. 安装
npm install -g openclaw@latest

# 5. 初始化
openclaw onboard --install-daemon
```

**常见坑**：

| 问题 | 原因 | 解决 |
|------|------|------|
| Sharp 编译失败 | 国内无法下载预编译二进制 | 设 `SHARP_DIST_BASE_URL` 镜像 |
| `EACCES` 权限错误 | npm 全局目录无写权限 | 配 `~/.npm-global` |
| Node 版本过低 | OpenClaw 要求 ≥ 22.16 | `brew install node@24` |
| M1/M2/M3 架构不匹配 | 下了 Intel 版 Node | 用 `darwin-arm64` 版本 |

### 2.4 安全警告（重要）

- **不要装在主力机上**：OpenClaw 需要较高系统权限（读写文件、操控浏览器）。建议用云服务器（阿里云 38 元/年）或独立 Apple ID
- **CVE-2026-25253**：CVSS 8.8 高危漏洞，可通过 WebSocket 注入实现远程代码执行
- **9.3 万+ 公网暴露实例**存在认证绕过
- **约 12% 的 ClawHub 技能**含有恶意代码（2026 年 3 月安全审计）
- Gateway 绑定 `127.0.0.1`，远程访问用 Tailscale/SSH 隧道，不要直接端口转发

### 2.5 程序员最佳实践

```bash
# 后台运行
openclaw gateway start --detach

# Web 控制台
openclaw dashboard    # http://127.0.0.1:18789

# 开机自启
sudo openclaw gateway install

# 健康检查
openclaw doctor
openclaw status

# 安装社区技能
clawhub install find-skills --force
```

---

## 3. Hermes vs OpenClaw 对比

| 维度 | Hermes（马） | OpenClaw（龙虾） |
|------|-------------|-----------------|
| **定位** | 自主思考型，像"员工" | 高级工具，需明确指令 |
| **核心能力** | 自我进化 + 三层记忆 + 自动技能生成 | 标准化流程执行 + 系统级操作 |
| **学习机制** | 在线持续学习，执行→反思→沉淀→复用 | 离线/手动配置，依赖社区技能 |
| **记忆系统** | 三层（持久+技能+会话），FTS5 全文搜索 | Markdown + SQLite，基础持久化 |
| **安全** | 高风险操作前主动确认 | 漏洞较多（2026 年 3-4 月 155 个） |
| **适合场景** | 跨场景复杂任务、长期使用 | 一次性标准化任务、系统自动化 |
| **Star** | ~10 万（2 个月） | ~34 万（5 个月） |
| **语言** | Python | Node.js（TypeScript） |
| **微信接入** | 原生支持，扫码即连 | 支持，需配置 |

**选型建议**：

```
你是 Java 后端程序员 →
  追求"越用越懂你"的长期伙伴 → Hermes
  想快速体验 Agent 边界能力     → OpenClaw（教程更多、社区更大）
  两个都装也不冲突              → 不同场景用不同工具
```

---

## 4. 微信 AI 自动对话机器人

### 4.1 实现原理

目前最主流方案基于**腾讯官方的微信 ClawBot API**（iLink 协议）：

```
微信扫码登录 → 获取 bot_token
      ↓
长轮询接收消息（35s hold）
      ↓
用户消息 → 调用 AI API（Claude/GPT/DeepSeek）
      ↓
发送前显示"正在输入"状态
      ↓
自动回复
```

- 协议：iLink，域名 `ilinkai.weixin.qq.com`（腾讯官方服务器）
- 开源实现：GitHub `SiverKing/weixin-ClawBot-API`
- 支持：Python / Node.js 双版本，兼容 Anthropic 格式接口

**核心 API 调用链**：

```
POST getupdates   → 长轮询接收消息（35s hold）
POST getconfig    → 获取 typing_ticket
POST sendtyping   → 显示/取消"正在输入"
POST sendmessage  → 发送 AI 回复
```

### 4.2 关键特性

- 24 小时自动重连（到期前预警 → 无缝切换）
- 梯度重试（AI 接口失败自动重试）
- 内置 Bot 指令：`/help`、`/time`、`/重新连接`
- 支持私聊 + 群聊，兼容图片、视频、文件、语音

### 4.3 三种接入方案

| 方案 | 优点 | 缺点 |
|------|------|------|
| **Hermes 原生微信接入** | 开箱即用，扫码即连 | Hermes 本身有学习曲线 |
| **腾讯 ClawBot API + 自建** | 完全控制，灵活接入任意模型 | 需要开发能力 |
| **OpenClaw 微信接入** | 社区成熟，教程多 | 安全漏洞多，不稳定 |

### 4.4 避坑指南

1. 必须遵守《微信 ClawBot 功能使用条款》，腾讯保留内容过滤和限速权利
2. 网上"养马部署教程"从 2 元到 500 元不等，**大部分是收割**——自己去 GitHub 免费装
3. 不要在微信机器人中处理敏感信息，消息经过腾讯服务器
4. API Key 用环境变量，不要硬编码在代码里
