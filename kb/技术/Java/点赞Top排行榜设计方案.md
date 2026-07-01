---
title: "点赞Top排行榜设计方案"
description: "点赞/热度排行榜的系统设计：Redis ZSet 直写 → 定时批量计算 → 分桶分片，海量数据下的分层架构与反作弊考量"
---

# 点赞Top排行榜设计方案

> 最后整理: 2026-07-01 | 来源: 面试题拆解

> 关联: [[./Redis 常用数据类型与使用场景.md]] — ZSet 底层实现

---

## 1. 问题拆解

"设计一个点赞 Top 排行榜"考察的是**从简单到复杂的演进能力**。核心矛盾：

```mermaid
flowchart LR
    RealTime["实时性<br/>点赞后立即反映"] vs Scale["扩展性<br/>亿级点赞"] vs Accuracy["准确性<br/>排名不丢失/不错"]
```

不同规模需要不同架构，面试的关键是**分层回答，展示递进思维**。

---

## 2. 方案一：Redis ZSet 直写（小规模，< 1 万篇文章）

```java
// 点赞
redis.zincrby("hot:articles", 1, "article:42");

// 取 Top 100
Set<ZSetOperations.TypedTuple<String>> top =
    redis.zrevrangeWithScores("hot:articles", 0, 99);
// → [{article:42=89320}, {article:17=78100}, ...]
```

```mermaid
sequenceDiagram
    participant User as 用户
    participant API as API 服务
    participant Redis as Redis ZSet

    User->>API: POST /like {articleId:42}
    API->>Redis: ZINCRBY hot:articles 1 "article:42"
    Redis-->>API: score = 89231
    API-->>User: OK

    User->>API: GET /top?n=100
    API->>Redis: ZREVRANGE hot:articles 0 99 WITHSCORES
    Redis-->>API: [...]
    API-->>User: Top 100 列表
```

- **优点**：实时、代码少、Redis 单线程天然无并发竞争
- **缺点**：大 key 问题（几十万文章的 ZSet = 上百 MB）；`ZINCRBY` 热点 key 瓶颈；数据全在内存，成本高

---

## 3. 方案二：Redis 存储 + 定时批量计算（中规模，< 100 万）

```mermaid
flowchart TD
    subgraph "写入链路"
        Like["用户点赞"] --> Counter["Redis String<br/>INCR article:42:likes<br/>→ 12345"]
        Counter --> MQ["（可选）MQ 削峰<br/>防大V瞬间万赞打崩"]
    end

    subgraph "计算链路（每 5 分钟）"
        Timer["定时任务"] --> Scan["SCAN 所有 article:*:likes"]
        Scan --> Sort["内存排序 → Top 100"]
        Sort --> Cache["ZADD hot:ranking:cache<br/>覆盖式写入"]
    end

    subgraph "读取链路"
        Client["客户端"] --> Read["API 直接读<br/>hot:ranking:cache<br/>O(1) 返回"]
    end
```

```java
// 定时任务伪代码
@Scheduled(fixedDelay = 300_000) // 每 5 分钟
void rebuildRanking() {
    // 1. 扫描所有文章点赞数
    Map<String, Long> scores = new HashMap<>();
    ScanParams params = new ScanParams().match("article:*:likes");
    String cursor = "0";
    do {
        ScanResult<String> result = redis.scan(cursor, params);
        for (String key : result.getResult()) {
            String articleId = extractId(key);
            Long likes = Long.parseLong(redis.get(key));
            scores.put(articleId, likes);
        }
        cursor = result.getCursor();
    } while (!cursor.equals("0"));

    // 2. 排序取 Top 100
    List<Map.Entry<String, Long>> top = scores.entrySet().stream()
        .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
        .limit(100)
        .toList();

    // 3. 写入缓存 ZSet
    redis.del("hot:ranking:cache");
    for (var e : top) {
        redis.zadd("hot:ranking:cache", e.getValue(), e.getKey());
    }
}
```

- **优点**：读路径 O(1)（拿缓存好的结果）、点赞不经过 ZSet 瓶颈
- **缺点**：排行榜有 5 分钟延迟；SCAN 全量计数可能耗时（百万 key 要几秒）

---

## 4. 方案三：热度公式 + 时间衰减（提升新鲜度）

**Hacker News 算法的简化版**：

```java
// score = 点赞数 / (发布时间 + 2)^1.5
double calculateScore(long likes, long publishTimeSeconds) {
    double hoursOld = (System.currentTimeMillis() / 1000.0 - publishTimeSeconds) / 3600.0;
    return likes / Math.pow(hoursOld + 2, 1.5);
}

// 每次点赞更新 score
redis.zincrby("hot:articles", deltaScore, "article:42");
```

```mermaid
graph LR
    A["1 小时前发, 100 赞<br/>score = 100/(3^1.5) = 19.2"] --> Compare["对比"]
    B["5 小时前发, 200 赞<br/>score = 200/(7^1.5) = 10.8"] --> Compare
    Compare --> Result["新文章排名更高 ✅ 新鲜度被体现"]
```

**核心原理**：`(hours + 2)^1.5`——分母随时间指数增长，旧文章的高赞数会被时间惩罚。不用物理删除旧文章，自然淘汰。

---

## 5. 方案四：大规模架构（千万~亿级）

```mermaid
flowchart TD
    subgraph "接入层"
        LB["负载均衡"]
    end

    subgraph "业务层"
        API1["点赞 API<br/>（写）"]
        API2["排行榜 API<br/>（读，纯缓存）"]
    end

    subgraph "数据层"
        direction TB
        subgraph "热数据（Redis）"
            ZSet_Hot["hot:today<br/>（当天热门）"]
            String["article:42:likes = 12345<br/>（原始计数）"]
        end
        subgraph "冷数据（MySQL）"
            DB_Like["likes 表<br/>article_id, user_id, created_at"]
            DB_Cache["ranking_snapshot 表<br/>rank, article_id, score, computed_at"]
        end
    end

    subgraph "离线计算（Flink/Spark）"
        Flink["实时流计算<br/>Kafka → Flink → Redis"]
    end

    LB --> API1 & API2
    API1 --> String
    API1 --> MQ["Kafka 消息队列<br/>削峰 + 异步"]
    MQ --> Flink
    Flink --> ZSet_Hot
    Flink --> DB_Cache
    API2 --> ZSet_Hot
    API2 --> DB_Cache
    DB_Like --> Flink
```

**各层职责**：

| 层 | 职责 | 技术选型 |
|----|------|---------|
| 接入层 | 限流 + 负载均衡 | Nginx + Sentinel |
| 写入 | 点赞去重 + 计数 | Redis（去重用 Set，计数用 String/INCR） |
| 削峰 | 缓冲突发流量 | Kafka 异步 + 批量写入 |
| 计算 | 实时热度排名 | Flink（窗口聚合 + 热度公式） |
| 缓存 | 排行榜查询 | Redis ZSet（Top 100-1000 预热） |
| 持久化 | 历史记录 + 对账 | MySQL（冷热分离，按时间分表） |

---

## 6. 点赞去重与反作弊

```mermaid
flowchart TD
    Like["用户点赞"] --> Check1{"同一用户<br/>已赞过？"}
    Check1 -->|"是"| Reject["拒绝（幂等）"]
    Check1 -->|"否"| Check2{"用户频率<br/>是否异常？<br/>（1分钟 >100次）"}
    Check2 -->|"是"| Block["风控拦截"]
    Check2 -->|"否"| Process["正常处理"]

    Process --> Set["Redis Set<br/>SADD article:42:liked_users user_1001<br/>(布隆过滤器辅助)"]
    Process --> Counter["INCR article:42:likes"]
    Process --> MQ["发送到 Kafka（异步）"]
```

```java
// 点赞去重（Redis Set + Lua 原子操作）
String lua = """
    local liked = redis.call('SISMEMBER', KEYS[1], ARGV[1])
    if liked == 1 then
        return 0  -- 已赞过
    end
    redis.call('SADD', KEYS[1], ARGV[1])
    redis.call('INCR', KEYS[2])
    return 1
    """;

Long result = redis.eval(lua,
    List.of("article:42:liked_users", "article:42:likes"),
    List.of("user_1001")
);
```

---

## 7. 边界 Case 自检

| 边界场景 | 影响 | 解决方案 |
|----------|------|---------|
| **文章被删除** | 排行榜出现无效文章 | 删除事件触发 `ZREM hot:articles article:42` |
| **大 V 瞬间万赞** | 单 key 并发竞争 + 带宽打满 | 批量聚合 + MQ 削峰 + 异步更新 |
| **定时任务执行超时** | 排行榜不更新 | 双 Buffer：`ranking:v1` 和 `ranking:v2` 交替写入，无锁切换 |
| **Redis 内存满** | 排行榜消失 | 设置淘汰策略 + 冷热分离（只缓存 Top 1000） |
| **刷赞脚本** | 排行榜失实 | 频率限制 + 设备指纹 + 图灵验证 + 风控规则 |
| **跨机房部署** | Redis Cluster slot 迁移 | 排行榜 key 加 hash tag 固定 slot |

---

## 8. 演进路径总结

```
10 篇文章 → 10 万 → 100 万 → 1 亿 → 10 亿
    │         │        │        │        │
    ▼         ▼        ▼        ▼        ▼
 SQL     Redis    Redis+    Redis+   Flink+
ORDER    ZSet     定时      Kafka    HBase
 BY      直写     批量     分桶     离线
```

**面试时的正确节奏**：
1. 先说最简单的 ZSet 方案（证明你能写代码）
2. 再说大规模时的瓶颈（证明你有架构思维）
3. 最后提边界 case 和反作弊（证明你有工程经验）
