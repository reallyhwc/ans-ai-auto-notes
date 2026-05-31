---
title: "本地部署 LLM"
description: "Ollama安装使用+进阶玩法(API/Embedding/Modelfile/Web UI)、小模型推荐"
---

# 本地部署 LLM：小模型 + Ollama 实践

> 最后整理: 2026-05-07 | 来源: 对话

## 一句话定位

本地跑大模型不需要高配显卡——小参数模型（0.5B-3B）量化后在消费级 CPU 上就能跑，Ollama 把部署简化成一条命令。

---

## 1. 小模型能做什么

| 能做好 | 能做但一般 | 做不好 |
|--------|-----------|--------|
| 简单 QA | 写邮件/短文 | 复杂逻辑推理 |
| 翻译短文本 | 代码生成（简单） | 多步推理 |
| 摘要短文本 | 对话聊天 | 数学/编程难题 |

**核心限制**：小模型的问题不是"跑不跑得动"（都跑得动），而是"智能程度"。0.5B 基本只能说正确的废话，1.5B 能应付日常，3B 才开始有"像个正经助手"的感觉。

---

## 2. 推荐的小模型清单

| 模型 | 参数量 | 量化后大小 | 中文能力 | 推荐场景 |
|------|--------|-----------|----------|----------|
| **Qwen2.5:0.5b** | 0.5B | ~350 MB | 优秀 | 最简单，树莓派都能跑 |
| **Qwen2.5:1.5b** | 1.5B | ~1 GB | 优秀 | 中文小模型首选 |
| **llama3.2:1b** | 1B | ~700 MB | 一般 | 英文好，中文弱 |
| **llama3.2:3b** | 3B | ~2 GB | 一般 | 性能/体积平衡 |
| **phi3:mini** | 3.8B | ~2.3 GB | 中上 | 微软出品，逻辑推理强 |

**中文场景推荐 Qwen2.5:1.5b**，0.5B 太弱（只能做简单 QA），1.5B 是中文小模型甜点。

---

## 3. 配置要求

```
0.9B 参数量 × 2 bytes (FP16) = ~1.8 GB 显存/内存

最低配置:
  CPU:  任何 4 核以上的 x86/ARM
  内存: 8 GB
  显卡: 不需要
  硬盘: 留 3 GB 空间放模型文件

实际体验:
  CPU 推理: ~5-10 tokens/s（能用但不快）
  有 GPU: ~50-100 tokens/s（飞起）
```

### 性能预期

```
0.5B 模型 (Apple M1/M2 CPU):
  推理速度: ~30-50 tokens/s
  启动时间: ~2 秒
  内存占用: ~400 MB

1.5B 模型 (Apple M1/M2 CPU):
  推理速度: ~15-30 tokens/s
  启动时间: ~3 秒
  内存占用: ~1 GB

3B 模型 (Apple M1/M2 CPU):
  推理速度: ~8-15 tokens/s
  启动时间: ~5 秒
  内存占用: ~2 GB

注：Intel CPU 大概是以上速度的 1/3 到 1/2
```

---

## 4. 量化精度

Ollama 仓库里的模型已经是量化好的 GGUF 格式，无需手动操作。

| 精度 | 大小比例 | 说明 | Ollama 默认使用 |
|------|----------|------|-----------------|
| Q2_K | 原始 / 16 | 便宜但质量下降明显 | 不用 |
| **Q4_K_M** | 原始 / 8 | **精度损失极小** | ✅ 默认 |
| Q5_K_M | 原始 / 6 | 几乎无损 | 偶尔用 |
| Q8_0 | 原始 / 4 | 接近无损 | 高配场景 |

**需要手动量化的场景**：从 HuggingFace 下载的原始 FP16 模型、自己微调训练出来的模型、想自定义量化精度。

> 关联: [llm.md 量化章节](./LLM（大语言模型）.md) — 量化原理详解

---

## 5. Ollama 详解

### 是什么

Ollama 就是一个本地 LLM 运行器（Runner）。类比：

```
Java 程序:  Java 代码（.jar） + JVM → 运行
大模型:     模型文件（GGUF） + Ollama → 运行
```

本质上，Ollama 内部就是在用 llama.cpp 推理引擎 + GGUF 格式的量化模型文件，只是把这套流程包装成了一条命令。

### 架构

```
装 Ollama 后，实际上装了两部分:

1. ollama server（后台守护进程）
   - 一直跑在后台
   - 加载模型到内存/显存
   - 提供 HTTP API（localhost:11434）

2. ollama CLI（前端命令行）
   - 你敲的 ollama run xxx
   - 连接 localhost:11434 发请求
   - 展示输出

┌──────────┐    HTTP POST     ┌──────────────────┐
│ ollama   │ ───────────────→ │ ollama server    │
│ run xxx  │ ←── stream ───── │ (加载模型/推理)    │
└──────────┘                  └──────────────────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │ 模型文件加载    │
                              │ 到内存/显存     │
                              └──────────────┘
```

### 三种使用方式

```bash
# 方式1: 交互式对话
ollama run qwen2.5:1.5b
>>> 你好
>>> 什么是机器学习？

# 方式2: 一次性提问（问完就退）
ollama run qwen2.5:1.5b "帮我解释什么是 transformer"

# 方式3: API 服务（给其他程序调用）
curl http://localhost:11434/api/generate \
  -d '{"model":"qwen2.5:1.5b","prompt":"你好"}'
```

### 资源占用

| 状态 | CPU | 内存 | 磁盘 |
|------|-----|------|------|
| Ollama 没启动 | 0 | 0 | 模型文件占 ~1 GB |
| server 运行但没加载模型 | ~0 | ~100 MB | ~1 GB |
| 模型加载中（对话中） | 低（idle 时几乎 0） | ~1 GB | ~1 GB |
| 对话结束但 keepalive 还没到 | 低 | ~1 GB（模型在内存） | ~1 GB |
| keepalive 超时后 | ~0 | ~100 MB | ~1 GB |

**模型自动卸载**：Ollama 默认 5 分钟后自动卸载模型（内存释放，磁盘保留）。

```bash
# 自定义保持时间
OLLAMA_KEEP_ALIVE=5m ollama run qwen2.5:1.5b    # 5 分钟
OLLAMA_KEEP_ALIVE=0 ollama run qwen2.5:1.5b      # 永久驻留
OLLAMA_KEEP_ALIVE=-1 ollama run qwen2.5:1.5b     # 用完即走
```

### 退出方式

```bash
# 交互式对话中:
>>> /bye           # 退出交互
# 或者 Ctrl+D

# 停止 ollama server:
ollama stop qwen2.5:1.5b    # 卸载指定模型
# 或者:
brew services stop ollama   # 完全停止后台服务

# 暴力方案:
pkill ollama               # 杀进程
```

日常用法：问完直接 `/bye` 或 `Ctrl+D`，模型 5 分钟后自动释放，无需手动操作。

---

## 6. 安装步骤（macOS）

```bash
# 1. 安装 Ollama
brew install ollama
# 或者: curl -fsSL https://ollama.com/install.sh | sh

# 2. 启动并运行一个小模型
ollama run qwen2.5:1.5b
# 首次运行会自动下载模型文件（~1 GB），之后即可对话

# 3. 对话示例
>>> 你好，请帮我解释一下什么是机器学习

# 4. 其他可选模型
ollama run qwen2.5:0.5b      # 更小更快
ollama run llama3.2:1b       # Meta 出品，英文好
ollama run phi3:mini          # 微软出品，逻辑推理强
```

### llama.cpp 方式（不用 Ollama，更灵活）

```bash
# 1. 安装
brew install llama.cpp

# 2. 下载模型（HuggingFace GGUF 格式）
huggingface-cli download Qwen/Qwen2.5-1.5B-Instruct-GGUF \
  --include "*q4_k_m.gguf" \
  --local-dir ./models

# 3. 启动交互式对话
llama-cli --model ./models/qwen2.5-1.5b-instruct-q4_k_m.gguf \
  --ctx-size 4096 \
  --interactive \
  --prompt "你好"

# 4. 或者启动 API 服务器（给其他程序调用）
llama-server --model ./models/qwen2.5-1.5b-instruct-q4_k_m.gguf \
  --host 127.0.0.1 \
  --port 8080 \
  --ctx-size 4096

# 然后: curl http://127.0.0.1:8080/v1/chat/completions \
#   -H "Content-Type: application/json" \
#   -d '{"messages":[{"role":"user","content":"你好"}]}'
```

**Ollama vs llama.cpp**：Ollama 一条命令搞定，llama.cpp 需要自己下载模型但灵活性更高（可自定义量化精度、上下文长度等参数）。

---

## 7. Ollama 进阶玩法

### 7.1 本地 API（给代码调用）

Ollama 自带 HTTP API（`localhost:11434`），兼容 OpenAI 格式。任何支持 OpenAI SDK 的代码都能直接切到本地模型：

```python
# pip install openai
from openai import OpenAI

client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")

resp = client.chat.completions.create(
    model="qwen2.5:1.5b",
    messages=[{"role": "user", "content": "解释一下 Python 的装饰器"}]
)
print(resp.choices[0].message.content)
```

也可以直接用 `curl`：

```bash
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen2.5:1.5b","messages":[{"role":"user","content":"你好"}]}'
```

**价值**：Python 脚本、AI 应用、IDE 插件都能用本地模型，不花钱、不联网、不限流。

### 7.2 跑多模态模型（看图说话）

Ollama 支持视觉模型，可以直接喂图片：

```bash
ollama run llava:7b         # LLaVA，能看懂图片
ollama run minicpm-v:8b     # MiniCPM-V，中文视觉理解更好
```

### 7.3 Embedding 模型（向量化）

做 RAG/相似度匹配时需要把文本转成向量：

```bash
ollama pull nomic-embed-text   # 专用 embedding 模型

curl http://localhost:11434/api/embed \
  -d '{"model":"nomic-embed-text","input":["你好","hello"]}'
```

返回两个向量，可以算余弦相似度。

### 7.4 自定义模型（Modelfile）

基于基础模型创建自定义"人格"：

```dockerfile
# Modelfile
FROM qwen2.5:1.5b

SYSTEM """
你是一个资深 Java 后端开发助手。
回答时要用简洁的技术语言，优先给代码示例。
不要说废话。
"""
```

```bash
# 构建自定义模型
ollama create my-assistant -f Modelfile

# 使用
ollama run my-assistant
```

**相当于给模型写了个 System Prompt 模板**，以后不用每次都重复设定。

### 7.5 常用模型管理命令

```bash
ollama list                    # 查看本地已下载的模型
ollama rm qwen2.5:0.5b         # 删除不用的模型（省磁盘）
ollama cp qwen2.5:1.5b my-qa   # 复制模型（方便改 Modelfile）
ollama show qwen2.5:1.5b       # 查看模型详情（参数量、架构等）
```

### 7.6 Web UI（图形界面）

```bash
# Open WebUI（最流行的 Ollama Web 界面，类 ChatGPT 体验）
docker run -d -p 3000:8080 \
  -v open-webui:/app/backend/data \
  --name open-webui \
  ghcr.io/open-webui/open-webui:main

# 浏览器访问 http://localhost:3000
```

### 7.7 模型存储路径

```
macOS 默认路径:  ~/.ollama/models/
├── manifests/     ← 模型元数据
└── blobs/         ← 模型权重文件（GGUF）

自定义路径:
  OLLAMA_MODELS=/Volumes/外置硬盘/ollama-models ollama run qwen2.5:1.5b
  # 或永久设置: echo 'export OLLAMA_MODELS="..."' >> ~/.zshrc
```

**不需要切换到特殊目录**，Ollama 在任何工作目录下行为一致。

---

> 关联: [llm.md](./LLM（大语言模型）.md) — LLM 核心原理（架构、KV Cache、量化原理）
