---
title: "Spring AI"
description: "Spring 生态 LLM 集成，流式/非流式调用"
---

# Spring AI

> 最后整理: 2026-05-04 | 来源: 多轮对话

## 一句话定位

Spring AI 是 Spring 生态的 LLM 集成框架，用熟悉的 Spring 范式接入各种大模型——`ChatClient` 统一调用、`Function Calling` 注册为 Bean、`Flux` 支持流式输出。

---

## 1. ChatClient：流式 vs 非流式

Spring AI 的 `ChatClient` 同时支持两种模式，底层切换只需要改一个方法名：

```java
// 非流式（默认）—— 等大模型全部生成完才返回
String reply = chatClient.prompt("介绍一下 Java 21 虚拟线程")
    .call()
    .content();  // 阻塞等待完整回复

// 流式 —— 一个 token 一个 token 往外吐
Flux<String> replyFlux = chatClient.prompt("介绍一下 Java 21 虚拟线程")
    .stream()
    .content();  // 返回 Flux<String>，实时推送
```

- **非流式** `call().entity()` / `call().content()`：底层发 `stream: false`，服务端一次返回完整 JSON，Spring 解析后返回。
- **流式** `stream().content()`：底层发 `stream: true`，服务端返回 SSE（Server-Sent Events）流，`WebClient` 原生支持读取 `Flux`。

本质：两种模式用的是**同一个 HTTP POST 请求**，只是响应体的传输方式不同（一次性 JSON vs 分块 SSE）。
