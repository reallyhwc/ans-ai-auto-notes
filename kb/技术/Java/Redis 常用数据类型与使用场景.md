---
title: Redis 常用数据类型与使用场景
description: Redis 五大基本类型（String/List/Set/Hash/ZSet）的底层实现、使用场景、常用命令，ZSet 跳表原理及双结构设计，含 Bitmap/HyperLogLog/GEO/Stream 简表
---

> 最后整理: 2026-06-07 | 来源: 与 Claude Code 对话

## 1. 五大基本类型概览

```mermaid
flowchart TD
    Redis[Redis 数据类型] --> String["String<br/>───<br/>最基础，SDS 实现"]
    Redis --> List["List<br/>───<br/>quicklist（3.2+）"]
    Redis --> Set["Set<br/>───<br/>hashtable / intset"]
    Redis --> Hash["Hash<br/>───<br/>ziplist → hashtable"]
    Redis --> ZSet["ZSet（Sorted Set）<br/>───<br/>skiplist + hashtable"]

    String --> S1[计数器 / 分布式锁 / 缓存]
    List --> L1[消息队列 / 最新N条]
    Set --> SE1[去重 / 共同好友 / 标签]
    Hash --> H1[对象存储 / 购物车]
    ZSet --> Z1[排行榜 / 延迟队列]
```

---

## 2. String — SDS 实现

底层是 **SDS**（Simple Dynamic String），不是 C 的 `char*`。特点：O(1) 取长度、二进制安全、预分配空间防频繁扩容。

```bash
SET user:1001:name "张三"
GET user:1001:name              # → "张三"
INCR article:42:views           # → 1, 2, 3...（原子自增）
SET lock:order:1001 1 NX EX 10  # 分布式锁（NX=不存在才设，EX=10秒过期）
```

### 使用场景

| 场景 | 命令 | 为什么用 Redis |
|------|------|---------------|
| 缓存 JSON | `SET key json EX 3600` | 替代 DB 查询，设置过期自动淘汰 |
| 计数器 | `INCR page:uv` | 原子操作，单线程无竞争 |
| 分布式锁 | `SET lock:xxx uuid NX EX 30` | 单线程 + NX 保证互斥 |
| 限流 | `INCR + EXPIRE` | 滑动窗口计数 |

### 内部实现细节

- **SDS vs C 字符串**：SDS 有 len 字段记录长度，`STRLEN` 是 O(1)；C 字符串要遍历到 `\0`，O(n)
- **编码**：`int`（整数且能用 long 表示）、`embstr`（≤44 字节的短字符串，一次内存分配）、`raw`（长字符串）
- **SDS 扩容**：小于 1MB 时翻倍扩容，超过 1MB 每次加 1MB，减少重新分配次数

---

## 3. List — quicklist 实现

底层在 **Redis 3.2 后统一为 quicklist**（`linkedlist` + `ziplist` 的混合体）。一个 quicklist 节点里挂一个 ziplist——兼顾内存紧凑和双向遍历性能。

```bash
LPUSH queue:tasks "task1" "task2"   # 左边进
RPOP queue:tasks                     # 右边出 → FIFO 队列
LRANGE news:latest 0 9              # 取最新 10 条
LTRIM news:latest 0 99              # 只保留最近 100 条
BLPOP queue:tasks 5                 # 阻塞等待，超时 5 秒
```

### 使用场景

| 场景 | 命令 | 说明 |
|------|------|------|
| 消息队列 | `LPUSH + RPOP` / `BLPOP` | `BLPOP` 支持阻塞等待，避免空轮询 |
| 最新动态/Timeline | `LPUSH + LTRIM` | 固定长度，自动淘汰旧数据 |
| 栈 | `LPUSH + LPOP` | 后进先出 |

### quicklist 设计思想

```
[quicklist]
   │
   ├── quicklistNode[0] → ziplist (存多个元素，连续内存)
   ├── quicklistNode[1] → ziplist
   └── quicklistNode[2] → ziplist
```

- **ziplist** 是紧凑的连续内存，元素少时节省指针开销
- **linkedlist** 双向指针，插入删除 O(1)
- quicklist 两者结合：每个节点是 ziplist，节点之间用指针相连
- `list-max-ziplist-size` 控制每个 ziplist 最多存多少元素

---

## 4. Set — hashtable / intset

底层：元素全为整数且数量少时用 **intset**（有序整数数组，二分查找），否则用 **hashtable**（value 全为 NULL 的字典）。

```bash
SADD user:1001:tags "java" "spring" "redis"
SADD user:1002:tags "java" "python" "redis"
SINTER user:1001:tags user:1002:tags  # → {"java", "redis"}  共同标签
SUNION user:1001:tags user:1002:tags  # → 全部标签
SDIFF user:1001:tags user:1002:tags   # → {"spring"} 差集
```

### 使用场景

| 场景 | 命令 | 说明 |
|------|------|------|
| 标签系统 | `SADD / SREM` | 一个用户多个标签 |
| 共同好友 | `SINTER` | 交集 O(N*M)，最坏 O(N²) 注意数据量 |
| 抽奖去重 | `SADD + SPOP` | `SPOP` 随机弹出一个，不重复 |
| 点赞用户列表 | `SADD / SCARD` | 记录谁点了赞，集合大小=点赞数 |

### 编码切换条件

- **intset → hashtable**：元素数量 > `set-max-intset-entries`（默认 512）或出现非整数元素
- intset 查询是二分 O(log N)，但插入要移动数组 O(N)，所以小集合用 intset

---

## 5. Hash — ziplist / hashtable

底层：字段少 + 值短时用 **ziplist**（连续内存，field-value 交替存），超出阈值转 **hashtable**。

```bash
HSET user:1001 name "张三" age 28 city "杭州"
HGET user:1001 name           # → "张三"
HINCRBY user:1001 age 1       # → 29（原子自增）
HGETALL user:1001             # 取全部字段
```

### 使用场景

| 场景 | 命令 | 说明 |
|------|------|------|
| 用户信息缓存 | `HSET / HGET` | 比 `String(JSON)` 省内存（ziplist），且支持按字段读写 |
| 购物车 | `HSET cart:1001 sku:123 2` | 用户→商品→数量 |
| 计数器分组 | `HINCRBY stats:20260607 pv 1` | 当天 PV/UV 存在同一个 key 下 |

### 内存优势

```
String 方式:  user:1001:name → "张三"    (一个 key 一个 value，元数据开销大)
              user:1001:age  → "28"
              user:1001:city → "杭州"

Hash 方式:    user:1001 → {name:"张三", age:28, city:"杭州"}  (一个 key，ziplist 紧凑)
```

小对象用 Hash 比 String 可节省 30-50% 内存。

### 编码切换条件

- **ziplist → hashtable**：字段数 > `hash-max-ziplist-entries`（默认 512）或单个 field/value 长度 > `hash-max-ziplist-value`（默认 64 字节）

---

## 6. ZSet（Sorted Set）— skiplist + hashtable

**底层双结构：skiplist（跳表）+ hashtable（字典）**，两者指向同一份节点对象。

```bash
ZADD leaderboard 100 "玩家A" 85 "玩家B" 92 "玩家C"
ZRANGE leaderboard 0 -1 WITHSCORES     # 按分数升序
ZREVRANGE leaderboard 0 2 WITHSCORES   # Top 3
ZRANK leaderboard "玩家A"              # 排名（升序）
ZSCORE leaderboard "玩家B"             # 查分 → "85"
```

### 使用场景

| 场景 | 命令 | 说明 |
|------|------|------|
| 排行榜 | `ZADD + ZREVRANGE` | 实时更新分数，按排名查询 |
| 延迟队列 | `ZADD delay_queue <时间戳> <任务ID>` | 按执行时间排序，轮询 `ZRANGEBYSCORE` 取到期任务 |
| 优先级队列 | 同延迟队列 | 分数=优先级 |
| 滑动窗口限流 | `ZADD + ZREMRANGEBYSCORE` | 用时间戳当 score，移除窗口外记录 |

### 跳表（skiplist）原理

#### 为什么用跳表而不是红黑树？

Redis 作者 antirez：跳表和红黑树性能都是 O(log N)，但**跳表实现简单、代码量少**，且天然支持范围查询（`ZRANGEBYSCORE`）。

#### 跳表结构

```
Level 2:  1 ───────────────────→ 9 ──────→ NULL
Level 1:  1 ─────→ 5 ──────────→ 9 ──────→ NULL
Level 0:  1 → 3 → 5 → 7 → 8 → 9 → 12 → NULL
```

- Level 0 是完整的有序链表
- Level 1 从每两个节点抽一个上来，组成"快车道"
- Level 2 进一步抽样

**查 7 的过程**：Level 2 从 1 跳到 9（> 7，过头了）→ 降一层 → Level 1 从 1 跳到 5（≤ 7，前进）→ 到 9（> 7，过头）→ 降一层 → Level 0 从 5 走到 7。3 步 vs 原始链表 5 步，数据量大时受益指数级放大。

**插入**：随机生成节点层数（每层 50% 概率升级，类似抛硬币），复杂度 O(log N)。

#### ZSet 的双结构设计

```mermaid
flowchart TD
    ZSet["ZSet<br/>member → score"] --> Skiplist["skiplist<br/>───<br/>按 score 排序<br/>支持范围查询<br/>ZRANGE / ZRANGEBYSCORE<br/>O(log N + M)"]
    ZSet --> Dict["hashtable<br/>───<br/>按 member 查 score<br/>O(1)<br/>ZSCORE"]

    Skiplist -->|"节点存 member + score"| Node["skiplistNode<br/>score: 89.5<br/>member: '玩家B'"]
    Dict -->|"key=member → value=score"| Node
```

**两个数据结构指向同一个节点对象**，不浪费额外内存：
- 查分数 → 字典 O(1)
- 范围查询 / 排名 → 跳表 O(log N + M)，M 为返回元素数
- 查排名 → 跳表每个节点维护 span（跨度），累加得到 O(log N)

### 跳表 vs B+ 树（MySQL InnoDB 索引）

**一句话结论：B+ 树为磁盘设计，跳表为内存设计。** 两者都是 O(log N)，但优化方向完全不同。

```mermaid
flowchart TD
    subgraph B加树["B+ 树（MySQL InnoDB）"]
        direction TB
        B1["目标：减少磁盘 IO"] --> B2["一个节点 16KB 存几百个 key<br/>高度极矮（千万行 ~3 层）"]
        B2 --> B3["一次查询 1-3 次磁盘 IO"]
        B3 --> B4["叶子双向链表 → 范围扫描"]
        B4 --> B5["插入可能触发页分裂<br/>维护成本高"]
    end

    subgraph 跳表["跳表（Redis ZSet）"]
        direction TB
        S1["目标：实现简单 + 内存操作"] --> S2["每个节点一个值<br/>层数随机（抛硬币）"]
        S2 --> S3["比较全在内存，极快"]
        S3 --> S4["层级指针天然有序"]
        S4 --> S5["插入只改相邻指针<br/>无页分裂"]
    end
```

逐项对比：

| 维度 | B+ 树 | 跳表 |
|------|-------|------|
| **设计目标** | 为磁盘优化，减少 I/O | 为内存优化，实现简单 |
| **节点结构** | 一页 16KB 含几百个 key + 子节点指针 | 一个节点一个值 + 多层 forward 指针 |
| **树高度** | 极矮（千万行 ~3 层） | 约 log N（内存中无所谓） |
| **查询过程** | 根→非叶→叶，每层二分 | 最高层开始，逐层向右+下降 |
| **范围查询** | 到叶子后沿双向链表扫 | 找到起点沿 Level 0 链表扫 |
| **插入成本** | 可能页分裂 + 调整父节点 | 改相邻指针 + 随机生成层数 |
| **空间占用** | 页内 ~15/16 填充（InnoDB 默认） | 每节点多存 level 个指针 |
| **代码量** | ~几千行 C | ~几百行 C（t_zset.c） |
| **适用场景** | 磁盘 DB 索引、文件系统 | 内存数据结构、缓存、排行榜 |

**为什么 MySQL 不用跳表、Redis 不用 B+ 树？**

- **MySQL 场景**：数据在磁盘，一次 IO 读 16KB。B+ 树一个节点恰好一页，一次 IO 过滤掉几百个 key。跳表一个节点一个值，跨页查询 = 大量随机 IO，在磁盘上是灾难。
- **Redis 场景**：数据全在内存，没有磁盘 IO 概念。跳表比 B+ 树实现简单太多，出 bug 好排查。antirez：_"All the operations are O(log N), the code is simple, and the data structure is easy to debug."_

### 编码切换

- **ziplist → skiplist+hashtable**：元素数 > `zset-max-ziplist-entries`（默认 128）或 member 长度 > `zset-max-ziplist-value`（默认 64 字节）
- 少量元素时直接用 ziplist 省内存

---

## 7. Java 开发中的 Redis 实战

### 7.1 全景图

```mermaid
flowchart TD
    Java["Java 后端 Redis 使用场景"] --> Cache[缓存]
    Java --> Lock[分布式锁]
    Java --> Bloom[布隆过滤器]
    Java --> Limit[限流]
    Java --> Queue[延迟队列]
    Java --> Session[分布式 Session]
    Java --> Counter[计数器/统计]

    Cache --> C1["Cache-Aside 旁路缓存"]
    Cache --> C2["穿透/击穿/雪崩"]
    Lock --> L1["Redisson + 看门狗"]
    Lock --> L2["RedLock 争议"]
    Bloom --> B1["穿透防护"]
    Bloom --> B2["去重判断"]
```

### 7.2 缓存 — Cache-Aside 模式

最推荐的缓存模式：读时先查 Redis → 未命中查 DB → 写回 Redis；写时先更新 DB → 再删除缓存。

```java
// 读
public User getUser(Long id) {
    String key = "user:" + id;
    User user = (User) redisTemplate.opsForValue().get(key);
    if (user != null) return user;                  // 命中

    user = userMapper.selectById(id);                // 未命中 → 查 DB
    if (user != null) {
        redisTemplate.opsForValue().set(key, user, 30, TimeUnit.MINUTES);
    }
    return user;
}

// 写：先 DB 后删缓存（不是更新缓存！）
@Transactional
public void updateUser(User user) {
    userMapper.updateById(user);
    redisTemplate.delete("user:" + user.getId());
}
```

**为什么不直接更新缓存而是删除？** 并发写场景下两个写请求时序可能乱掉，直接 SET 会导致缓存是旧值。删除让下次读重建，避免"双写不一致"。

#### 缓存三大问题

```mermaid
flowchart TD
    subgraph Penetration["穿透"]
        P1["查 DB 里不存在的 key"] --> P2["Redis 没命中 → 打 DB"]
        P2 --> P3["DB 也查不到 → 攻击者可构造大量不存在 ID 打垮 DB"]
    end

    subgraph Breakdown["击穿"]
        B1["一个热点 key 过期"] --> B2["瞬间大量请求同时查 DB"]
    end

    subgraph Avalanche["雪崩"]
        A1["大量 key 同时过期 或 Redis 宕机"] --> A2["所有请求打 DB → DB 崩溃"]
    end
```

| 问题 | 解决方案 | 示例 |
|------|---------|------|
| **穿透** | 布隆过滤器提前拦截 或 缓存空值 | `SET user:9999 null EX 60` |
| **击穿** | 互斥锁（一个线程查 DB，其他等待） 或 逻辑过期 | `SETNX lock:user:1 1 EX 10` |
| **雪崩** | 过期时间加随机偏移 + Redis 集群 | `EX random(300, 600)` |

#### 击穿的两种主流方案

```java
// 方案 A：互斥锁（简单但有短暂阻塞）
public User getUserWithLock(Long id) {
    String key = "user:" + id;
    User user = (User) redisTemplate.opsForValue().get(key);
    if (user != null) return user;

    String lockKey = "lock:user:" + id;
    Boolean locked = redisTemplate.opsForValue()
        .setIfAbsent(lockKey, "1", 10, TimeUnit.SECONDS);
    if (Boolean.TRUE.equals(locked)) {
        try {
            user = userMapper.selectById(id);
            redisTemplate.opsForValue().set(key, user, 30, TimeUnit.MINUTES);
        } finally {
            redisTemplate.delete(lockKey);
        }
    } else {
        Thread.sleep(50);
        return getUserWithLock(id);  // 重试
    }
    return user;
}

// 方案 B：逻辑过期（不阻塞，可能短暂返回旧值）
// value 里包一层过期时间字段，物理 key 永不过期
// 发现逻辑过期 → 开异步线程重建 → 期间返回旧值
```

### 7.3 分布式锁 — Redisson

#### 自己手写的问题

```java
// 初版漏洞百出：
// 问题 1：SETNX + EXPIRE 不是原子操作 → 死锁
redisTemplate.opsForValue().setIfAbsent(lockKey, "1");  // 刚执行完，机器挂了
redisTemplate.expire(lockKey, 30, TimeUnit.SECONDS);    // 没执行到 → 永不过期

// 问题 2：删了别人的锁
// 线程 A 拿锁 → 执行超时锁过期 → 线程 B 拿到锁 → A 执行完把 B 的锁删了

// 问题 3：单点故障 → Redis 宕机锁全没
```

#### 正确姿势：Redisson

```java
RLock lock = redissonClient.getLock("lock:order:" + orderId);
try {
    if (lock.tryLock(10, 30, TimeUnit.SECONDS)) {  // 等 10s，锁 30s
        doSomething();
    }
} finally {
    lock.unlock();  // 只删自己的锁（UUID + 线程 ID 校验）
}
```

**Redisson 做了什么：**

```mermaid
flowchart TD
    subgraph Redisson["Redisson 分布式锁"]
        Guard["看门狗 Watch Dog<br/>Netty Timer 每 10s 续期<br/>业务没完锁不过期"] --> Check["解锁校验 UUID+线程ID<br/>Lua 脚本原子执行"]
        Check --> RedLock["RedLock<br/>多节点过半加锁"]
    end
```

#### 看门狗（Watch Dog）实现原理

看门狗不是一个独立的"看门狗服务"，而是一个 **Netty HashedWheelTimer 定时任务**，线程级别，只在锁被成功持有期间运行。

```mermaid
sequenceDiagram
    participant Thread as 业务线程
    participant RLock as RedissonLock
    participant Redis
    participant Timer as Netty HashedWheelTimer

    Thread->>RLock: tryLock()
    RLock->>Redis: Lua 加锁脚本
    Redis-->>RLock: OK
    RLock->>Timer: 启动续期任务<br/>首次触发 = 30000/3 = 10s 后

    loop 每 10s 一次
        Timer->>Redis: Lua 续期脚本<br/>if hexists → pexpire 30000
        Redis-->>Timer: OK → 续期成功
        Timer->>Timer: 递归调度下次续期
    end

    Thread->>RLock: unlock()
    RLock->>Timer: 取消续期任务
    RLock->>Redis: Lua 解锁脚本
```

**加锁 Lua 脚本**（注意：锁在 Redis 里是 Hash 结构，不是 String）：

```lua
-- KEYS[1] = lock key, 如 "lock:order:1001"
-- ARGV[1] = internalLockLeaseTime, 默认 30000ms
-- ARGV[2] = UUID:threadId

if (redis.call('exists', KEYS[1]) == 0) then
    redis.call('hincrby', KEYS[1], ARGV[2], 1);
    redis.call('pexpire', KEYS[1], ARGV[1]);
    return nil;  -- 加锁成功
end;

if (redis.call('hexists', KEYS[1], ARGV[2]) == 1) then
    redis.call('hincrby', KEYS[1], ARGV[2], 1);    -- 重入计数 +1
    redis.call('pexpire', KEYS[1], ARGV[1]);
    return nil;  -- 重入成功
end;

return redis.call('pttl', KEYS[1]);  -- 锁被他人持有，返回剩余时间
```

Redis 中锁的实际结构：

```
Key: lock:order:1001 (Hash)
  field: "a3f8c2d1-...-1" → value: 1 (重入次数)
```

用 Hash 而不是 String 的原因：**支持可重入**——同一线程多次加锁，field 相同，value 递增。

**看门狗续期的 Java 核心逻辑**（`RedissonBaseLock.renewExpiration()`）：

```java
// 启动：tryAcquire 成功后调用
private void renewExpiration() {
    ExpirationEntry ent = new ExpirationEntry();
    ent.setThreadId(threadId);
    EXPIRATION_RENEWAL_MAP.put(getEntryName(), ent);

    // 用 Netty HashedWheelTimer，首次 10s 后触发
    Timeout task = connectionManager.getServiceManager()
        .newTimeout(new TimerTask() {
            @Override
            public void run(Timeout timeout) throws Exception {
                renewExpirationAsync(threadId)
                    .thenAccept(res -> {
                        if (res) {
                            renewExpiration();  // 续期成功 → 递归调度
                        }
                        // 续期失败 → 锁已不在了，自然停止
                    });
            }
        }, internalLockLeaseTime / 3, TimeUnit.MILLISECONDS);
    //  ↑ 30000/3 = 10000ms = 10s

    ent.setTimeout(task);
}
```

**续期 Lua 脚本**：

```lua
-- KEYS[1] = lock key
-- ARGV[1] = 30000
-- ARGV[2] = UUID:threadId

if (redis.call('hexists', KEYS[1], ARGV[2]) == 1) then
    redis.call('pexpire', KEYS[1], ARGV[1]);
    return 1;
end;
return 0;
```

**解锁 Lua 脚本**：

```lua
-- ARGV[3] = UUID:threadId

if (redis.call('hexists', KEYS[1], ARGV[3]) == 0) then
    return nil;  -- 不是你的锁，解不了
end;

local counter = redis.call('hincrby', KEYS[1], ARGV[3], -1);
if (counter > 0) then
    redis.call('pexpire', KEYS[1], ARGV[2]);  -- 还有重入层数，不释放
    return 0;
else
    redis.call('del', KEYS[1]);  -- 重入归零，真正释放
    return 1;
end;
```

unlock 同时调用 `cancelExpirationRenewal()` 从 `EXPIRATION_RENEWAL_MAP` 移除并取消 Timer。

**关键设计细节：**

| 设计点 | 做法 | 原因 |
|--------|------|------|
| 定时器选型 | Netty HashedWheelTimer | Redisson 本身就基于 Netty，无需额外线程池 |
| 续期间隔 | 30s / 3 = 10s | 留容错空间，网络抖动几秒也不怕 |
| 锁持有者标识 | `UUID:threadId` | UUID 区分 JVM，threadId 区分线程 |
| 可重入 | Hash value 计数 | 加锁 +1，解锁 -1，归零才 DEL |
| JVM 崩溃兜底 | 看门狗是 JVM 内线程 → 崩了自然停 → 30s 后过期 | 无需"停止看门狗"这个动作 |
| 不启动看门狗的条件 | 显式指定了 `leaseTime` | 用户说"60s 够了"就不再续期 |

**RedLock 争议**：Redis 作者提出多节点过半加锁，但 Martin Kleppmann 指出缺乏 fencing token、时钟跳跃会导致两个客户端同时持锁。实践中：一致性要求极高时用 ZooKeeper/etcd，一般场景 Redisson 足够。

#### 看门狗的性能开销：为什么单线程 Timer 扛得住

直觉上"每个锁一个递归 Timer"听起来很重，但实际上 Netty HashedWheelTimer 是**单线程时间轮**，不是每个锁开一个线程：

```mermaid
flowchart TD
    subgraph Wheel["HashedWheelTimer 时间轮"]
        direction LR
        B0["槽 0<br/>[task1, task4, task9]"]
        B1["槽 1<br/>[task7]"]
        B2["槽 2<br/>[]"]
        B3["槽 3<br/>[task2, task5]"]
        B4["槽 4<br/>[]"]
        B5["槽 5<br/>[task3, task6, task8]"]
    end

    Tick["Worker 单线程<br/>每 tick ≈100ms 走一个槽"] -->|"顺序执行当前槽所有 task"| B0
```

**为什么开销极低**：每个续期 task 在 worker 线程里的真实耗时是**微秒级**——组装 Lua 命令发出，真正执行是 Redis 在干。线程不阻塞等结果，Netty I/O 线程收到 Redis 响应后再回调。

**数量级推演**：10,000 个锁 × 每 10s 续期 = 约 1,000 次调度/s。每次几微秒 → CPU 占用 < 1%。一个 HashedWheelTimer 可以管理几十万个定时任务。再加上实际业务中锁生命周期都很短（毫秒到秒级），不会出现海量长锁同时续期的场景。真正的瓶颈是 Redis 能不能扛住续期 QPS——单体 Redis 10 万 QPS 是日常，续期这点量不算什么。

### 7.4 布隆过滤器（Bloom Filter）

**概率型数据结构**：回答"绝对不存在"（100% 准确）或"可能存在"（有误判但可控）。

```
布隆过滤器说 "没有" → 100% 确定没有（不会漏）
布隆过滤器说 "有"   → 可能没有（1% 误判率可配置）
```

#### 原理（30 秒讲清）

```mermaid
flowchart LR
    Input["元素 'user123'"] --> H1["hash1 → 3"]
    Input --> H2["hash2 → 7"]
    Input --> H3["hash3 → 11"]
    H1 --> Bit
    H2 --> Bit
    H3 --> Bit

    subgraph BitArray["位数组（初始全 0）"]
        0["[0]=0"] --> 1["[1]=0"] --> 2["[2]=0"] --> 3["[3]=1"] --> 4["[4]=0"] --> 5["[5]=0"] --> 6["[6]=0"] --> 7["[7]=1"] --> 8["[8]=0"] --> 9["[9]=0"] --> 10["[10]=0"] --> 11["[11]=1"]
    end
```

1. 一个位数组，初始全 0
2. 插入：K 个哈希函数算 K 个位置，全部设 1
3. 查询：算 K 个位置，**全为 1 → 可能存在；任意 0 → 一定不存在**

#### Java 中使用

```java
// Guava 本地布隆过滤器
BloomFilter<String> filter = BloomFilter.create(
    Funnels.stringFunnel(Charset.defaultCharset()),
    100_0000, 0.01  // 100万元素，1% 误判率
);
filter.put("user123");
filter.mightContain("user123");  // → true
filter.mightContain("user999");  // → false（一定不存在）

// Redis 布隆过滤器（RedisBloom 模块 或 Redisson）
RBloomFilter<String> bloomFilter = redissonClient.getBloomFilter("user:bloom");
bloomFilter.tryInit(100_0000L, 0.01);
bloomFilter.add("user123");
bloomFilter.contains("user123");  // → true
```

#### 防缓存穿透实战

```java
public User getUserWithBloom(Long id) {
    // 第一层：布隆过滤器说"一定不存在"→ 直接返回
    if (!bloomFilter.contains("user:" + id)) return null;
    // 第二层：正常走 Redis + DB
    // ...
}
```

注意事项：**不支持删除**（删一位可能影响其他元素），需要删除场景用布谷鸟过滤器（Cuckoo Filter）。初始化要预估容量，超量后误判率上升。

### 7.5 限流

```java
// 固定窗口（简单但有临界问题）
String key = "rate:api:" + userId;
Long count = redisTemplate.opsForValue().increment(key);
if (count == 1) redisTemplate.expire(key, 60, TimeUnit.SECONDS);
if (count > 100) throw new RuntimeException("限流");
// 问题：59 秒放 100，下一秒又是 100 → 临界 200 QPS

// 滑动窗口（ZSet 实现，精确）
String key = "rate:sliding:" + userId;
long now = System.currentTimeMillis();
long windowStart = now - 60_000;
redisTemplate.opsForZSet().removeRangeByScore(key, 0, windowStart);
Long count = redisTemplate.opsForZSet().count(key, windowStart, now);
if (count != null && count > 100) throw new RuntimeException("限流");
redisTemplate.opsForZSet().add(key, String.valueOf(now), now);
redisTemplate.expire(key, 60, TimeUnit.SECONDS);
```

### 7.6 一条完整的生产级读链路

```java
public User getUser(Long id) {
    // 第一层：布隆过滤器（防穿透）
    if (!bloomFilter.contains("user:" + id)) return null;

    // 第二层：Redis 缓存
    User user = (User) redisTemplate.opsForValue().get("user:" + id);
    if (user != null) return user;

    // 第三层：分布式锁（防击穿）
    RLock lock = redissonClient.getLock("lock:user:" + id);
    try {
        if (lock.tryLock(3, 30, TimeUnit.SECONDS)) {
            // 双重检查
            user = (User) redisTemplate.opsForValue().get("user:" + id);
            if (user != null) return user;
            // 查 DB
            user = userMapper.selectById(id);
            if (user != null) {
                redisTemplate.opsForValue().set("user:" + id, user,
                    30 + ThreadLocalRandom.current().nextInt(60), TimeUnit.MINUTES);
            }
        }
    } finally {
        lock.unlock();
    }
    return user;
}
```

布隆防穿透、互斥锁防击穿、随机过期防雪崩——三层防护覆盖了缓存三大问题。

---

## 8. 其他高频类型

| 类型 | 用途 | 典型场景 |
|------|------|---------|
| **Bitmap** | 位图，按位存 0/1，`SETBIT / BITCOUNT` | 用户签到（365 位=一年）、日活统计 |
| **HyperLogLog** | 基数统计，12KB 固定内存，`PFADD / PFCOUNT` | 页面 UV 去重计数（0.81% 标准误差） |
| **GEO** | 地理位置，底层=ZSet，`GEOADD / GEORADIUS` | 附近的人、门店搜索 |
| **Stream** | 持久化消息队列（5.0+），`XADD / XREAD / XACK` | 可靠消息队列，支持消费者组 + ACK，比 List 强在持久化 |

### Bitmap 示例

```bash
SETBIT sign:202606:1001 6 1   # 用户 1001 在 6 月 7 号签到
BITCOUNT sign:202606:1001     # 统计签到天数
```

### HyperLogLog 示例

```bash
PFADD uv:20260607 "user1" "user2" "user3"
PFCOUNT uv:20260607           # → 3（近似）
# 12KB 可以统计 2^64 个元素，适合亿级 UV
```

### GEO 示例

```bash
GEOADD shops 120.2 30.3 "星巴克杭州大厦"
GEORADIUS shops 120.2 30.3 5 km WITHDIST
# 底层：GEOADD 实际是把经纬度编码成 ZSet 的 score（Geohash），存入 ZSet
```

---

## 9. 选型速查

```
需要计数/缓存简单值？        → String
需要队列/最新列表？          → List
需要去重+集合运算？          → Set
需要存对象+按字段读写？      → Hash
需要排序+范围查询？          → ZSet（跳表）
需要统计大量用户的 UV？      → HyperLogLog
需要签到/在线状态？          → Bitmap
需要附近的人？               → GEO（底层 ZSet）
需要可靠消息队列？           → Stream
```

---

## 10. 底层实现速查表

| 数据类型 | 默认编码 | 内部编码（少量数据时） | 核心特点 |
|---------|---------|---------------------|---------|
| String | raw / embstr | int | SDS，二进制安全 |
| List | quicklist | — | ziplist + linkedlist 混合 |
| Set | hashtable | intset | 值全为 NULL 的字典 |
| Hash | hashtable | ziplist | field-value 交替存 |
| ZSet | skiplist + dict | ziplist | 双结构共享节点 |

---

## 11. Redis 集群方案对比与分布式锁安全分析

### 11.1 三种方案概览

```mermaid
flowchart TD
    subgraph MS["主从复制 Master-Slave"]
        M1[Master 读写] -->|"异步复制"| S1[Slave 只读]
        M1 -->|"异步复制"| S2[Slave 只读]
        Note1[手动故障切换<br/>有数据丢失风险<br/>读写分离可扩展读]
    end

    subgraph Sentinel["哨兵 Sentinel"]
        SM[Master] -->|"复制"| SS[Slave]
        Sent1[Sentinel-1] & Sent2[Sentinel-2] & Sent3[Sentinel-3] -->|"监控"| SM
        Sent1 & Sent2 & Sent3 -->|"监控"| SS
        Sent1 ---|"共识"| Sent2 ---|"共识"| Sent3
        Note2[自动故障切换<br/>依然异步复制，可能丢数据<br/>多哨兵共识防误判]
    end

    subgraph Cluster["Cluster 集群"]
        N1["Node 1<br/>Slot 0-5460<br/>Master + Slave"] <-->|"Gossip"| N2["Node 2<br/>Slot 5461-10922<br/>Master + Slave"]
        N2 <-->|"Gossip"| N3["Node 3<br/>Slot 10923-16383<br/>Master + Slave"]
        N1 <--> N3
        Note3[自动分片 + 自动故障切换<br/>16384 slot<br/>水平扩展]
    end
```

### 11.2 逐项对比

| 维度 | 主从复制 | 哨兵 Sentinel | Cluster 集群 |
|------|---------|-------------|-------------|
| **数据分片** | ❌ 全量数据 | ❌ 全量数据 | ✅ 16384 slot 自动分片 |
| **高可用** | ❌ 手动切换 | ✅ 自动故障转移 | ✅ 自动故障转移（每分片独立） |
| **水平扩展** | ❌ 只能垂直 | ❌ 只能垂直 | ✅ 加节点自动 rebalance |
| **客户端复杂度** | 低（单地址） | 低（哨兵自动发现） | 高（MOVED/ASK 重定向） |
| **运维复杂度** | 低 | 中（多跑哨兵进程） | 高（多节点 + Gossip 通信） |
| **数据一致性** | 异步复制，可能丢 | 异步复制，可能丢 | 异步复制，可能丢（Raft 仅用于 failover 决策） |
| **跨 slot 事务** | ✅ 支持 | ✅ 支持 | ❌ 不支持跨 slot multi-key |
| **典型规模** | 几十 GB | 几十 GB | 几百 GB ~ TB 级 |
| **最小节点数** | 2 | 5（3 哨兵 + 1M1S） | 6（3M + 3S，无单点） |

### 11.3 选型建议

```
数据量 < 几十 GB，只需要高可用        → Sentinel
数据量 > 几百 GB，需要水平扩展        → Cluster
开发/测试环境                         → 单机或主从
跨 slot 事务/批量操作为核心需求        → Sentinel（Cluster 不支持）
```

### 11.4 为什么 Sentinel 模式下分布式锁不安全

**你的理解是对的**：在 Redis Cluster/Sentinel 中，同一 key 始终路由到唯一节点。但安全漏洞不在路由——在**异步复制 + Failover**。

```mermaid
sequenceDiagram
    participant C1 as 客户端 A
    participant M as Redis Master
    participant S as Redis Slave
    participant C2 as 客户端 B

    C1->>M: SET lock:X UUID-A NX PX 30000
    M-->>C1: OK → A 拿到锁
    Note over M,S: ⚠️ 锁还没同步到 Slave<br/>Master 宕机！

    M-xM: 宕机

    Sentinel->>S: 提升 Slave 为新 Master
    Note over S: 新 Master 没有 lock:X！

    C2->>S: SET lock:X UUID-B NX PX 30000
    S-->>C2: OK → B 也拿到锁了！
    Note over C1,C2: 💥 A 和 B 同时认为自己持有锁
```

**这就是 Martin Kleppmann 指出的核心问题**——异步复制导致的锁丢失。Master 挂了之后 Slave 上可能还没有锁数据，新 Master 不认旧锁，其他客户端就能重新获取。

### 11.5 为什么 ZK/etcd 没这个问题

```mermaid
flowchart LR
    subgraph Redis["Redis Sentinel"]
        R1["Master 写成功 → 返回 OK<br/>→ 异步复制到 Slave"] --> RFail["Master 宕<br/>→ 新 Master 可能丢数据"]
    end

    subgraph ZK["ZooKeeper"]
        Z1["Leader 写 → 必须过半确认（ZAB）"] --> ZFail["Leader 宕<br/>→ 新 Leader 一定有全量数据"]
    end
```

**本质差异**：ZK/etcd 的共识协议保证已提交的数据不会丢失；Redis 的 Sentinel/Cluster 在 failover 时的 Raft 共识**只用于选主**，数据复制始终异步。这就是为什么 ZK 可以做严格互斥锁，而 Redis 只能做"性能优化级的锁"。

### 11.6 实际建议

| 场景 | 选型 |
|------|------|
| 防重复提交、限流、缓存击穿保护 | Redis 锁（单节点 + Sentinel 足够） |
| 库存扣减、转账、严格互斥 | DB 行锁（`SELECT ... FOR UPDATE`）或 ZK/etcd |
| RedLock 多节点加锁 | 绝大多数场景不需要，运维成本远大于收益 |

**一句话**：Redis 锁解决的是"大概率不出问题"的性能问题，不是"绝对不出问题"的安全问题。

### 11.7 Cluster 模式下的分布式锁要点

在 Cluster 模式下，如果必须用 Redis 锁，需要注意：

```bash
# 单 key 锁没问题：key 会路由到同一个 slot
SET lock:order:1001 UUID NX PX 30000

# 但如果锁 key 和业务 key 需要一起操作 → 必须保证同一个 slot
# 用 hash tag 强制路由：
SET {order:1001}:lock UUID NX PX 30000
SET {order:1001}:status "paid"
# {order:1001} 计算出的 slot 相同，两个 key 在同一节点
```

Hash tag `{...}` 让多个 key 落在同一 slot，保证 Lua 脚本的原子操作能跨 key 执行——这是 Cluster 模式下做分布式锁的关键 trick。

### 11.8 Cluster 大规模宕机时的故障行为

**Redis Cluster 不会自动重新分片**。slot 迁移只有一种触发方式：管理员手动执行 `redis-cli --cluster reshard`。

#### 50 台节点同时宕机会发生什么

```mermaid
flowchart TD
    Before["宕机前<br/>100 个 Master，各管 ~164 个 slot<br/>每个 Master 有一个 Slave（同机房或跨机房）"]

    Before -->|"一个机房断网<br/>50 个 Master + 50 个 Slave 同时失联"| After

    subgraph After["宕机后"]
        Alive["存活 50 个 Master + 50 个 Slave<br/>继续服务自己的 slot<br/>正常运行 ✅"]
        Dead["故障节点对应的 slot<br/>如果 Master 和 Slave 都没了<br/>→ 这些 slot 永久 DOWN ❌"]
        NoRebalance["⚠️ 故障节点的 slot<br/>不会自动分配给存活节点"]
    end
```

具体过程：

```
1. 50 个 Master 同时失联
2. 存活节点通过 Gossip 协议在 cluster-node-timeout（默认 15s）后发现超时
3. 如果故障 Master 的 Slave 还活着 → Slave 发起选举 → 提升为新 Master
   → 自动接管 slot → 服务恢复 ✅
4. 如果故障 Master 的 Slave 也一起挂了 → 对应 slot 永久 DOWN
   → 客户端收到 CLUSTERDOWN 错误
   → 不会自动重新分配到存活节点 ❌
```

**为什么不做自动重分片？** 安全考虑。自动重分片等同于假设"故障节点永远不会回来了"。但如果只是网络抖动，30 秒后 50 个节点重新连上——它们带着旧数据回来，和自动分配了新 slot 持有者的节点之间就会**数据冲突和脑裂**。Redis Cluster 的原则：**宁可不可用，不可不一致**。

#### 配置关键项

| 参数 | 默认值 | 含义 |
|------|--------|------|
| `cluster-node-timeout` | 15000ms | 超时多久判定节点下线 |
| `cluster-require-full-coverage` | yes | 有 slot 不可用是否拒绝所有请求 |
| `cluster-slave-validity-factor` | 10 | Slave 与 Master 断连多久仍有选举资格 |

- `cluster-require-full-coverage yes` → 任何 slot 不可用，整个集群拒绝服务 → 强一致性偏好的选择
- `cluster-require-full-coverage no` → 存活的 slot 继续服务，故障 slot 报错 → 可用性偏好的选择

#### 生产最佳实践

```
每个 Master 至少 1 个 Slave，且 Slave 部署在不同物理机房/可用区
  → 任意单机房断网，Slave 自动接管，集群零中断

cluster-require-full-coverage no
  → 局部故障不影响正常 slot 的服务
```

**本质结论**：Cluster 的高可用靠的是每个分片配跨机房 Slave，不是靠"挂了自动重分片"。

### 11.9 RedLock vs Cluster：两个完全不同的方向

**Clarification**：RedLock 和 Cluster 不是一回事，它们解决完全不同的问题。

```mermaid
flowchart TD
    subgraph Cluster["Cluster 分片（为吞吐）"]
        C1["不同 key → 不同节点"]
        C2["lock:order:1001 → slot 8723 → Node-A"]
        C3["lock:order:1002 → slot 9105 → Node-B"]
        C4["单 key QPS = 单节点 QPS"]
        C5["多 key 总 QPS = N × 单机"]
        C6["单 key 锁安全性 = 单节点级别<br/>（异步复制风险）"]
    end

    subgraph RedLock["RedLock 多写（为安全）"]
        R1["同一 key → 所有独立节点"]
        R2["lock:X 同时写 Redis-1 到 Redis-5"]
        R3["锁安全 = N/2+1 节点同意"]
        R4["单 key QPS < 单节点 QPS"]
        R5["N 个节点不是分片关系<br/>而是独立的五台机器"]
    end
```

#### 回答核心困惑

> "搭建集群，加锁仍需半数以上同意，单机 QPS 没下降，集群起了啥意义？"

**RedLock 的多节点从来不是为了 QPS，是为了容错。** 分片（Cluster）和 多写（RedLock）是两个截然相反的方向：

| | Cluster 分片 | RedLock 多写 |
|---|---|---|
| **设计目的** | 水平扩展吞吐 | 分布式锁安全 |
| **不同 key** | 分布到不同节点 | 不相关 |
| **同一 key** | 只去一个节点 | 写到所有节点 |
| **QPS 效果** | 总 QPS = N × 单机 | 锁 QPS < 单机（每节点都处理同一 key） |
| **容错效果** | 单节点故障 = 部分数据不可用 | 少数节点故障 = 锁仍然安全 |
| **运维成本** | 中（分片 + 复制管理） | 高（N 台独立机器，无分片关系） |

**Redis Cluster 的意义**：缓存海量数据、扩展缓存吞吐——100 个节点意味着 ~100× 单机缓存容量和 ~100× 总 QPS（不同 key 分摊到不同节点）。加锁只是 Redis 的一个小功能，不是 Cluster 的核心价值。

**RedLock 的意义**：为了一把锁的安全，专门部署 N 台独立的 Redis，牺牲 QPS 换容错。这是一个昂贵的交易——实践中绝大多数业务不需要。需要的锁安全性用 DB 行锁更可靠，需要的锁性能用单机 Redis + Sentinel 就够。

**一句话**：Cluster 是让 100 个不同的 key 各忙各的（吞吐 ↑），RedLock 是让 5 台机器盯着同一个 key（安全 ↑）。两者方向相反，不可兼得。

---

相关：
- [[热点账户高并发记账方案.md]] — Redis 在高并发场景下的应用
