# OpenAI Agents SDK 多角色协作 Demo

演示 Agent 之间的 **Handoff（移交）** 机制：架构师出方案 → 工程师写代码 → 审查员评审 → 有问题打回修改。

## 快速开始

```bash
# 1. 安装依赖
pip install openai-agents

# 2. 配置 API（三选一）

# 方式 A: 使用 OpenAI 官方 API
export OPENAI_API_KEY="sk-..."

# 方式 B: 使用 OpenAI 兼容 API（支持 Claude/Gemini/本地模型等）
export OPENAI_API_KEY="your-key"
export OPENAI_API_BASE="https://your-provider.com/v1"
export MODEL_NAME="claude-sonnet-4-6"  # 或其他模型名

# 方式 C: 使用 Ollama 本地模型
export OPENAI_API_BASE="http://localhost:11434/v1"
export OPENAI_API_KEY="ollama"
export MODEL_NAME="qwen2.5-coder"

# 3. 运行
python demo.py
```

## 工作流

```
用户提问
  │
  ▼
┌─────────────┐
│  架构师 Agent │  → 分析需求，输出架构方案
└──────┬──────┘
       │ handoff: "按方案实现代码"
       ▼
┌─────────────┐
│  工程师 Agent │  → 根据架构方案编写代码
└──────┬──────┘
       │ handoff: "审查代码质量"
       ▼
┌─────────────┐
│  审查员 Agent │  → 检查代码，发现问题则打回 engineer
└──────┬──────┘
       │ 通过 → 输出最终结果
       ▼
返回给用户
```

## 核心机制

| 概念 | 说明 |
|------|------|
| **Agent** | system prompt + tools + 可 handoff 的目标列表 |
| **Handoff** | 把完整对话上下文移交给下一个 Agent |
| **Runner** | 调度引擎，循环调用 LLM 直到没有 handoff |
| **循环控制** | reviewer 可以 handoff 回 engineer（打回重改），通过 `max_turns` 防止无限循环 |

## 自定义角色

编辑 `demo.py` 中的 Agent 定义，`instructions` 可以设为任意内容：

```python
cost_controller = Agent(
    name="成本管控",
    instructions="你是CFO派来的成本审核员，审查所有技术方案的成本...",
    handoff=[architect]
)
```

## 注意事项

- 模型需要具备较强的指令遵循能力，否则 handoff 可能不触发或触发时机不对
- `max_turns` 建议设为 8-12，防止 reviewer ↔ engineer 无限循环
- 非 OpenAI 模型通过 OpenAI 兼容 API 接入时，确保模型支持 Function Calling
