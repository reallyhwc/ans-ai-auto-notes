---
title: "本地部署 LLM"
description: "Ollama安装使用+进阶玩法(API/Embedding/Modelfile/Web UI)、小模型推荐；含 §8 Mac 微调可行性与成本（M4/M5 Pro·Max 统一内存带宽对比、MPS 三个坑与芯片代际无关、云 GPU 租用 vs Mac 训练的时间账）、§9 Mac 上能玩的 14 个项目 + M4/M5 实测 tok/s 基准与硬边界"
---

# 本地部署 LLM：小模型 + Ollama 实践

> 最后整理: 2026-09-11 | 来源: 对话

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
| **qwen3:0.6b** | 0.6B | ~400 MB | 优秀 | 最小可用，树莓派都能跑 |
| **qwen3:1.7b** | 1.7B | ~1.1 GB | 优秀 | 中文小模型首选 |
| **qwen3:4b** | 4B | ~2.5 GB | 优秀 | 1.7B 不够聪明时的下一档 |
| **gemma3:1b** | 1B | ~800 MB | 中上 | Google 出品，英文/多语言均衡 |
| **phi4-mini** | 3.8B | ~2.5 GB | 中上 | 微软出品，逻辑推理强 |

**中文场景推荐 qwen3:1.7b**，0.6B 太弱（只能做简单 QA），1.7B 是中文小模型甜点。

> **模型迭代很快**，上表的版本号（qwen3 / gemma3 / phi4-mini）以 2026-09 为准，实际部署前请以 [Ollama 模型库](https://ollama.com/library) 的当前 tag 为准；清单里的"哪一档参数"比"哪一代版本"更稳定。

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
ollama run qwen3:1.7b
>>> 你好
>>> 什么是机器学习？

# 方式2: 一次性提问（问完就退）
ollama run qwen3:1.7b "帮我解释什么是 transformer"

# 方式3: API 服务（给其他程序调用）
curl http://localhost:11434/api/generate \
  -d '{"model":"qwen3:1.7b","prompt":"你好"}'
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
OLLAMA_KEEP_ALIVE=5m ollama run qwen3:1.7b    # 5 分钟
OLLAMA_KEEP_ALIVE=0 ollama run qwen3:1.7b      # 永久驻留
OLLAMA_KEEP_ALIVE=-1 ollama run qwen3:1.7b     # 用完即走
```

### 退出方式

```bash
# 交互式对话中:
>>> /bye           # 退出交互
# 或者 Ctrl+D

# 停止 ollama server:
ollama stop qwen3:1.7b    # 卸载指定模型
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
ollama run qwen3:1.7b
# 首次运行会自动下载模型文件（~1 GB），之后即可对话

# 3. 对话示例
>>> 你好，请帮我解释一下什么是机器学习

# 4. 其他可选模型
ollama run qwen3:0.6b         # 更小更快
ollama run gemma3:1b         # Google 出品，多语言均衡
ollama run phi4-mini         # 微软出品，逻辑推理强
```

### llama.cpp 方式（不用 Ollama，更灵活）

```bash
# 1. 安装
brew install llama.cpp

# 2. 下载模型（HuggingFace GGUF 格式）
huggingface-cli download Qwen/Qwen3-1.7B-GGUF \
  --include "*q4_k_m.gguf" \
  --local-dir ./models

# 3. 启动交互式对话
llama-cli --model ./models/qwen3-1.7b-q4_k_m.gguf \
  --ctx-size 4096 \
  --interactive \
  --prompt "你好"

# 4. 或者启动 API 服务器（给其他程序调用）
llama-server --model ./models/qwen3-1.7b-q4_k_m.gguf \
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
    model="qwen3:1.7b",
    messages=[{"role": "user", "content": "解释一下 Python 的装饰器"}]
)
print(resp.choices[0].message.content)
```

也可以直接用 `curl`：

```bash
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3:1.7b","messages":[{"role":"user","content":"你好"}]}'
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
FROM qwen3:1.7b

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
ollama rm qwen3:0.6b         # 删除不用的模型（省磁盘）
ollama cp qwen3:1.7b my-qa   # 复制模型（方便改 Modelfile）
ollama show qwen3:1.7b       # 查看模型详情（参数量、架构等）
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
  OLLAMA_MODELS=/Volumes/外置硬盘/ollama-models ollama run qwen3:1.7b
  # 或永久设置: echo 'export OLLAMA_MODELS="..."' >> ~/.zshrc
```

**不需要切换到特殊目录**，Ollama 在任何工作目录下行为一致。

---

## 8. Mac 能不能拿来微调？48G 够不够？

**结论：48GB 统一内存"装得下"8B 模型的 LoRA，但"跑得动"是另一回事——实际不建议在 Mac 上训 8B。**

### 8.1 先分清两件事：容量 vs 带宽

ROI 最高的认知：**微调瓶颈不是"内存够不够"，是"内存带宽 + 后端算子覆盖"。**

| 设备 | 统一内存/显存带宽 | 相对 4090 |
|------|-----------------|----------|
| M4 Pro（48GB 档） | 273 GB/s | 0.27× |
| **M5 Pro（48GB 档，20 核 GPU）** | **307 GB/s** | 0.30× |
| M4 Max（48GB 档） | 546 GB/s（满配 40 核 GPU；14 核 CPU 版本 410 GB/s） | 0.54× |
| **M5 Max（48GB 档）** | **614 GB/s** | 0.61× |
| RTX 4090（24GB） | 1008 GB/s | 1× |
| A100 80GB | 1555~2039 GB/s | 1.5~2× |
| H100 80GB | ~3350 GB/s | 3.3× |

> 数据来源：[Apple M4 Pro/Max 规格](https://support.apple.com/en-nz/121553)（273/410/546 GB/s 三档）、[Apple M5 Pro/Max 规格](https://support.apple.com/en-za/126319)（307 GB/s / 460 GB/s / 614 GB/s 三档）。

**换代带来的真实提升：换带宽，不是换级别。**

```
M4 Pro → M5 Pro:  273 → 307 GB/s  (+12%)   ← 同一档位内的迭代，追不上 4090
M4 Max → M5 Max:  546 → 614 GB/s  (+12%)   ← 同上
M5 Pro → M5 Max:  307 → 614 GB/s  (2×)     ← 跨档才有意义，翻倍
```

> **结论：M5 Pro 48G 依然是"准 4090 的三分之一"这一档。** 想靠换 M5 Pro 解决微调问题，是买错了方向——要跳档得跳到 **M5 Max**（还得是满配 GPU 那档）。

**M5 新增的 Neural Accelerators 值得单独说一句**：Apple 宣称 M5 Pro/Max 的 GPU 内神经加速器带来 **4× 于 M4 Pro/Max 的峰值 AI 算力**，且首次采用 **Fusion Architecture**（把两颗第三代 3nm 裸片用先进封装拼成一颗，M5 Pro 为 18 核 CPU + 20 核 GPU）。但要清醒：

- 那是**峰值算力**，微调是**显存带宽敏感**任务，两者不是一回事
- 能不能吃到，取决于 **PyTorch MPS / MLX 是否用上新的 Neural Accelerator API**——框架跟进通常滞后半年到一年
- 参考来源：[MacRumors 发布报道](https://www.macrumors.com/2026/03/03/apple-unveils-macbook-pro-with-m5-pro-and-m5-max-chips-with-neural-accelerators/)、[Electronic Specifier 架构分析](https://www.electronicspecifier.com/news/analysis/apples-m5-chips-whats-actually-new/)

**算一下显存账**（8B 音乐理解模型）：

```
底座权重 bf16:      8B × 2B = 16 GB
+ 音频编码器(32层):          ~1.5 GB
+ LoRA 参数(r=16):           ~0.1 GB（可忽略）
+ 梯度 + Adam 状态:          ~0.5 GB
+ 激活值(batch=1, 序列 4k):  5~10 GB   ← 变量最大的一项
─────────────────────────────────────
合计约 23~28 GB → 48GB 内存**装得下**
```

### 8.2 但 MPS 后端有三个真实的坑

| 坑 | 后果 |
|----|------|
| **bitsandbytes 在 MPS 上基本不可用** | ❌ **QLoRA 走不通**，只能 bf16 LoRA（好在 PyTorch 新版 macOS 支持 bf16 混合精度了） |
| **FlashAttention 2 无 MPS 实现** | 退化成朴素 attention，长序列显存和速度都吃亏 |
| **自定义多模态代码路径** | 音频编码器 + DeepStack forward hook 这类非标准算子，MPS 很容易缺算子 → **静默回退 CPU** → 慢到不可用 |

第三点最致命：它不会报错，只会让你以为"Mac 就是慢"。

> ⚠️ **这三个坑跟芯片代数无关。** M5 Pro 在这三件事上和 M4 Pro 处境相同——`bitsandbytes` 不会因为 M5 就支持 MPS，`FlashAttention` 不会因为你换了芯片就多出 Metal 实现，第三方多模态代码里的自定义算子也不会自动补全。**换芯片解决不了后端生态问题。**

### 8.3 时间账：为什么 Mac 训练不划算

假设 2000 条 30 秒片段（约 375 audio token/条）：

| 设备 | 单步耗时（估） | 3 epoch 总时长 |
|------|--------------|---------------|
| RTX 4090 | ~1-2 s | **约 1.5~3 小时** |
| A100 | ~0.5-1 s | 约 1 小时 |
| M5 Max（若算子全支持） | ~9-18 s | 约 9~22 小时 |
| M5 Pro（若算子全支持） | ~18-36 s | **约 18~45 小时** |
| M4 Max（若算子全支持） | ~10-20 s | 约 10~25 小时 |
| 任一 Mac（部分回退 CPU） | 不可估 | 天数级，别试 |

> 单步耗时的估算口径：按 `M4 Max 基线 × (546 / 本机带宽)` 缩放。M5 Pro 307 GB/s → 约 1.8× M4 Max 的耗时。

**租云 GPU 的成本对比**（[RunPod 公开价](https://toolchase.com/tool/runpod/) 4090 $0.69/hr，A100 $1.39~2.34/hr；国内平台 4090/A100 档位价量级接近）：

```
4090 跑 3 小时 ≈ $2 ≈ ¥15        ← 一次性训练的真实成本
A100 跑 1.5 小时 ≈ $2.5 ≈ ¥18
```

**结论：训练花 ¥15~30 租卡，比在 Mac 上耗 20 小时（还未必跑得起来）划算得多。** 换 M5 Pro 只把 20 小时压到 18~45 小时区间里的某一点，**没有改变结论**。

### 8.4 Mac 到底该怎么用（三分法）

| 阶段 | Mac 48GB 合适吗 | 说明 |
|------|---------------|------|
| **数据准备 / 标注 / 听样本** | ✅ 非常合适 | 你的主力工作机 |
| **推理 / 试 Prompt / 验证效果** | ✅ 可以（8B bf16 能跑，慢） | 先用小样本验证 Prompt 够不够，再决定要不要微调 |
| **训练 8B 级模型** | ❌ 不划算（M4/M5 都一样） | 租云 GPU |
| **训练小模型（分类头 / 4B 以下）** | ✅ 可行 | 冻结底座 + 只训分类头，10~30 分钟 |

> 一句话记住：**Mac 是"数据 + 推理 + 验证"的机器，不是"训练 8B"的机器。** 换 M4 Pro → M5 Pro 在这个判断上不动分毫；真要推高训练能力，得跳到 M5 Max（614 GB/s）甚至独立 GPU 服务器，而且还得等框架把 Neural Accelerator 吃进去。

### 8.5 一个更省的选择：别微调 8B，训个小分类头

情绪识别这类**分类任务**，真正划算的做法是：

```
冻结的音频编码器（如 MERT，95M/330M）
        ↓ 输出 embedding（不训练）
   一层线性分类头（几千个参数）
        ↓
     情绪标签
```

- **MERT** 是专门做音乐理解的自监督模型（95M / 330M，[论文](https://browse.arxiv.org/abs/2306.00107v2)），走 CQT + RVQ 路线，本来就是为音乐任务设计的
- 训练量：**Mac 上 10~30 分钟**就够，参数从几亿降到几千
- 而且分类任务上，**专用小模型经常比 8B 多模态模型更准**（它没有被通用能力分散容量）

**什么时候还是该用 8B 多模态底座**：你要的不只是标签，而是**能解释的理由**（"副歌转大调、BPM 128、加失真吉他 → 激昂"），或者要顺带产出歌词、和弦、曲式。

```mermaid
flowchart TD
    Q[情绪识别上线] --> A{要标签 还是要理由?}
    A -->|只要标签| B[MERT/CLAP + 线性分类头<br/>Mac 10-30 分钟训完 ⭐]
    A -->|要理由/多任务| C[MOSS-Music 8B 底座]
    C --> D{Prompt 逐 JSON 够吗?}
    D -->|够| E[Mac 本地跑推理验证 ⭐]
    D -->|不够，要改口径| F[租 4090 跑 LoRA<br/>¥15-30 / 1-3 小时]

    style B fill:#e8f5e9
    style E fill:#e8f5e9
    style F fill:#fff3e0
```

---

## 9. Mac 上能玩什么？14 个真实可做的项目

**先记住一句话区分：Mac 是极好的「推理 + 数据」玩具，是极差的「训练」机器。** §8 讲的是后者为什么不行，这一章讲前者有多好玩。

### 9.1 一图看全景

```mermaid
flowchart TD
    M[Mac 48GB] --> A[推理侧 ⭐ 主战场]
    M --> B[数据侧 ⭐ 主战场]
    M --> C[训练侧 ❌ 别指望]

    A --> A1[本地推理服务<br/>OpenAI 兼容端点]
    A --> A2[离线 RAG 知识库<br/>embedding+rerank+chat 全本地]
    A --> A3[编码助手<br/>Continue/Cline]
    A --> A4[多模态<br/>视觉/语音]
    A --> A5[本地 MCP Server]

    B --> B1[批量摘要/抽取]
    B --> B2[Whisper 转录]
    B --> B3[量化/Runtime 对比实验]

    C --> C1[小模型 LoRA<br/>1.5B-4B ✅]
    C --> C2[8B 以上<br/>租卡]

    style A fill:#e8f5e9
    style B fill:#e8f5e9
    style C fill:#ffebee
```

### 9.2 每个项目的难度与产出

| # | 玩法 | 难度 | 用到的能力 | 产出/学到什么 |
|---|------|------|-----------|--------------|
| 1 | **本地推理服务**：`ollama serve` / `mlx_lm.server` 起一个 OpenAI 兼容端点 | ⭐ | 统一内存 + 量化 | 整个局域网都能用，还能被你的 Agent 代码调用 |
| 2 | **多模型并行**：48GB 是"能同时跑好几个"的档位 | ⭐⭐ | 显存账 | 一个 chat 模型 + 一个 embedding + 一个 rerank 同时在线——这是 24GB 卡做不到的 |
| 3 | **离线 RAG 知识库**：embedding + 向量库 + 本地 LLM 全在机器上 | ⭐⭐⭐ | 全套 | 断网可用、数据不出机器；**可以拿你的 kb/ 做实验对象** |
| 4 | **量化对比实验**：同一模型 Q4/Q5/Q8 + 不同 runtime 跑同一批任务 | ⭐⭐ | 评测方法 | 得到"这个任务上多大模型 + 什么量化够用"的**实测结论**，不是别人说的 |
| 5 | **Runtime 横评**：MLX vs llama.cpp vs Ollama | ⭐⭐ | 基准测试 | §9.3 的表格你可以自己复现，顺便看 M5 神经加速器到底兑现了多少 |
| 6 | **编码助手本地化**：Continue.dev / Cline 指向本地端点 | ⭐⭐ | 上下文管理 | 代码不出机器；体感速度你会有判断 |
| 7 | **批量摘要/结构化抽取**：邮件、日志、PDF 批量过一遍本地模型出 JSON | ⭐⭐ | 结构化输出 | **零 API 成本**，跑一万条也不心疼 |
| 8 | **Whisper 本地转录**：会议录音、播客、视频 | ⭐⭐ | 音频栈 | Apple Silicon 上 Whisper 跑得很好，实用度极高 |
| 9 | **多模态试玩**：视觉模型看图/读图表 | ⭐⭐⭐ | VLM + MPS | 探索性强，但 Mac 上多模态算子覆盖不如纯文本成熟 |
| 10 | **本地 MCP Server**：自研 MCP 工具，后端接本地模型 | ⭐⭐⭐ | MCP 协议 | 真练手项目，跟你的 DSH 插件知识直接打通 |
| 11 | **小模型 LoRA 微调**：1.5B~4B | ⭐⭐⭐ | LoRA + MLX | **Mac 唯一能舒服训的规模**，10~30 分钟出 adapter |
| 12 | **长上下文实验**：4k / 32k / 128k 的显存与速度曲线、KV cache 量化 | ⭐⭐⭐ | KV Cache | 搞懂"上下文为什么贵"，直接反哺线上 Agent 设计 |
| 13 | **语音对话闭环**：Whisper 听 → 本地 LLM 想 → TTS 说 | ⭐⭐⭐⭐ | 全栈 | 完全离线的语音助手 |
| 14 | **模型格式转换/量化**：HF → GGUF / MLX 量化 | ⭐⭐⭐ | 工具链 | 顺手把你从 HF 下的模型变成 Mac 能跑的版本 |

### 9.3 性能基准：Mac 本地推理到底多快

**实测数据**（2026-05，[llm-benchpacks M4/M5 扫描](https://raw.githubusercontent.com/ephes/llm-benchpacks/b2b724cd3d1ce07bf57df60822cdc52cb140f1c6/docs/qwen36-m4-m5-benchmark-summary.md)，中位 total tok/s）：

| runtime | 模型 | M5 Max 64GB | M4 Max 128GB |
|---------|------|------------|-------------|
| **MLX** | **MoE**（35B-A3B 4bit） | **~105** | ~90 |
| **MLX** | dense（27B 4bit） | **~30** | ~26 |
| llama.cpp | MoE | ~92 | ~66 |
| llama.cpp | dense | ~25 | ~22 |
| Ollama | MoE | ~48 | ~40 |
| Ollama | dense | ~14 | ~13 |

**三个立刻可用的结论**：

1. **MLX 比 Ollama 快一倍以上**（dense：30 vs 14）。在 Mac 上，**runtime 的选择比模型的选择更影响体感**。
2. **MoE 是 Mac 的甜点**。35B-A3B 这种"总参数 35B、激活只 3B"的模型，速度是 dense 27B 的 **3.5 倍**，但质量接近 35B 档——**48GB 内存能让它跑 4bit**，这是 Mac 本地体验质变的关键。
3. **Ollama 0.19 已把 Apple Silicon 后端换成 MLX**（[报道](http://www.jimo.studio/blog/ollama-019-engine-switch-how-apple-m5-chip-doubles-local-llm-performance/)：prefill 1154→1810 tok/s +57%，decode 58→112 tok/s +93%）。所以上表的 Ollama 数字是**旧引擎时代**的，升级后应接近 MLX。**装了就升到最新版。**

**M5 Pro 48G 上的预期**（⚠️ 推算，非实测——按带宽比例缩放）：

| 模型类型 | M5 Pro 估算 | 体感 |
|---------|-----------|------|
| MoE（35B-A3B 4bit） | ~50-60 tok/s | 流畅，能当日常助手 |
| dense（27B 4bit） | ~15-18 tok/s | 能用，比人阅读快一点 |
| 小模型（7B/8B 4bit） | ~60-90 tok/s | 飞快 |

> 推算口径：MLX 数字 ÷ (614/307 = 2)，再考虑 MoE 的激活参数少、对带宽不敏感，放宽到 0.5~0.6×。**要真实数字就得自己跑一遍**（这正是玩法 5 的价值）。

### 9.4 硬边界（别浪费时间的地方）

| 别做的事情 | 为什么 |
|-----------|--------|
| 想跑 70B 密度模型 | 48GB 只能 Q2~Q3，质量崩了，速度也就 5 tok/s 级 |
| 想训 8B 以上 | §8 已结论：租卡 |
| 指望多模态像纯文本一样稳 | MPS 算子覆盖不均，容易静默回退 CPU |
| 用 Q4 量化模型做精细推理 | 量化损失在长链推理上会放大 |
| 不升级 runtime 就下结论 | 引擎迭代（如 Ollama 换 MLX）能差一倍 |

### 9.5 从哪个开始？——两个推荐起点

**起点 A：一次做完 1 + 4 + 5（一个下午）**
```
装 MLX（或升级 Ollama 到最新）
→ 下一对对比模型：MoE 35B-A3B 4bit  vs  dense 27B 4bit
→ 同一个 20 题的测试集跑两边，记录 tok/s 和正确率
→ 你会亲身体会到「运行时 + 模型形态」这两个变量有多重要
```

**起点 B：把 kb/ 变成离线 RAG（一个周末）**
```
本地 embedding 模型把 kb/ 的 md 切块向量化
→ 本地 chat 模型（MoE 4bit）做生成
→ 断网测试：它能不能回答「我 MOSS-Music 那篇笔记说了什么」
```
这套下来你会同时摸到：切块策略、向量检索、rerank、上下文拼接、prompt 设计——**全部零 API 成本地练一遍**。

> 通用原则：**先挑一个你真有数据的小场景**（自己的笔记、自己的代码、自己的录音），跑通闭环 >> 追新模型。

---

> 关联: [llm.md](./LLM（大语言模型）.md) — LLM 核心原理（架构、KV Cache、量化原理）
> 关联: [微调与 LoRA](<./微调与 LoRA：让通用模型学你的领域.md>) — §3-§5 的决策梯子、LoRA 数学与四步流水线（本章是它的"硬件篇"）
> 关联: [MCP 协议](<./MCP 协议：AI 界的 USB-C.md>) — 玩法 10「本地 MCP Server」的协议基础
