"""
OpenAI Agents SDK 多角色协作 Demo

演示 Agent 之间的 Handoff 机制：
  架构师 → 工程师 → 审查员 → (有问题打回) → 工程师 → 审查员 → 完成

使用前请:
  1. pip install openai-agents
  2. 设置 OPENAI_API_KEY 环境变量
  3. python demo.py

支持 OpenAI 兼容 API，可以接入 Claude/Gemini/本地模型等。
"""
import os
import asyncio

from agents import Agent, Runner, handoff, trace

# ============================================================
# 模型配置（通过环境变量切换 provider）
# ============================================================
# 默认使用环境变量，你也可以在这里硬编码：
#
# 方式 A: OpenAI 官方 API
#   export OPENAI_API_KEY="sk-..."
#
# 方式 B: OpenAI 兼容 API（Claude、Gemini、通义等）
#   export OPENAI_API_KEY="your-key"
#   export OPENAI_BASE_URL="https://your-provider.com/v1"
#
# 方式 C: Ollama 本地模型
#   export OPENAI_BASE_URL="http://localhost:11434/v1"
#   export OPENAI_API_KEY="ollama"

MODEL_NAME = os.environ.get("MODEL_NAME", "gpt-4o")

# ============================================================
# 角色定义
# ============================================================

# 架构师：只出方案，不写代码
architect = Agent(
    name="架构师",
    model=MODEL_NAME,
    instructions="""你是一位资深软件架构师。

你的职责：
1. 分析用户需求，设计系统架构
2. 说明技术选型、核心组件、数据流
3. 输出清晰的架构方案

约束：
- 只出方案，不写实现代码
- 方案确定后，将工作移交给工程师""",
    handoff_description="负责分析需求并设计系统架构，输出架构方案后移交给工程师",
)

# 工程师：按架构方案实现代码
engineer = Agent(
    name="工程师",
    model=MODEL_NAME,
    instructions="""你是一位资深全栈工程师。

你的职责：
1. 根据架构师的方案编写实现代码
2. 代码要包含核心业务逻辑
3. 注明依赖和运行方式

约束：
- 严格按照架构方案实现，不要自行改变架构
- 实现完成后，将代码移交给审查员""",
    handoff_description="根据架构方案编写代码，完成后移交给审查员",
)

# 审查员：审查代码，有问题打回工程师
reviewer = Agent(
    name="审查员",
    model=MODEL_NAME,
    instructions="""你是一位严格的代码审查员。

你的职责：
1. 检查代码质量：命名、结构、错误处理
2. 检查安全性：注入、越权、敏感信息
3. 检查是否完整实现了架构方案的要求

审查规则：
- 如果发现问题：明确指出问题，将工作打回给工程师要求修改
- 如果没有问题：输出最终审查通过的结果，工作流结束
- 同一问题连续两轮未修复，直接标记 FAIL 并说明原因

约束：
- 审查必须严格但不吹毛求疵
- 通过后不要再 handoff 给任何人，直接输出最终结论""",
    handoff_description="审查代码质量，有问题打回工程师，通过则结束工作",
    handoffs=[handoff(engineer, tool_name="send_back_to_engineer")],
)

# 工程师和架构师也可以 handoff，形成完整流程
engineer.handoffs = [handoff(reviewer, tool_name="request_review")]
architect.handoffs = [handoff(engineer, tool_name="implement_architecture")]


# ============================================================
# 运行
# ============================================================

async def main():
    # 自定义需求描述，或者用默认的
    user_input = input("描述你的需求（直接回车使用默认需求）: ").strip()
    if not user_input:
        user_input = "设计并实现一个简易的用户注册登录系统，包含密码加密存储"

    print(f"\n{'='*60}")
    print(f"需求: {user_input}")
    print(f"{'='*60}\n")

    # 运行多 Agent 工作流
    result = await Runner.run(
        starting_agent=architect,
        input=user_input,
        max_turns=15,  # 防止 reviewer ↔ engineer 无限循环
    )

    # 输出最终结果
    print(f"\n{'='*60}")
    print("最终结果:")
    print(f"{'='*60}")
    print(result.final_output)

    # 打印完整的对话轨迹（可选，方便调试）
    print(f"\n{'='*60}")
    print(f"对话轮次: {len(result.turns)}")
    print(f"{'='*60}")
    for i, turn in enumerate(result.turns, 1):
        agent_name = turn.last_agent.name if hasattr(turn, 'last_agent') else 'unknown'
        print(f"  Round {i}: {agent_name}")


if __name__ == "__main__":
    asyncio.run(main())
