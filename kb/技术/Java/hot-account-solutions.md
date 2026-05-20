---
title: "热点账户高并发记账方案"
description: "单账户高并发写入场景下的 6 种解决方案对比与选型"
---

# 热点账户高并发记账方案

> 最后整理: 2026-05-20 | 来源: 对话讲解

> 关联: [分布式事务](./distributed-transaction.md) — 热点账户方案常与分布式事务结合使用

---

## §1 问题本质

### 1.1 什么是热点账户

当大量并发请求集中操作**同一个账户的余额**时，由于数据库行锁机制，对同一行的 UPDATE 操作被迫串行化，吞吐量急剧下降。

```
正常账户:  每个账户 QPS < 10，无竞争
热点账户:  单个账户 QPS >> 100，行锁排队

典型场景:
- B端收单商户账户（大量买家同时付款给同一商家）
- 平台中间户/备付金账户
- 红包活动账户（春节红包入账）
- 大促期间的营销补贴账户
```

### 1.2 性能瓶颈量化

```
假设单次记账事务耗时:
- 获取分布式锁:     ~20ms
- 开启事务:         ~5ms
- 更新余额(行锁):   ~30ms
- 写流水:           ~20ms
- 提交事务:         ~10ms
- 释放锁:           ~5ms
───────────────────────────────
总计:               ~90-120ms

理论 QPS = 1000ms / 110ms ≈ 9 笔/秒（单账户天花板）
```

**核心矛盾**：行锁的串行化 + 事务的原子性要求 → 单行写入天然是串行的。

### 1.3 三类热点账户

| 类型 | 特征 | 典型场景 | 难度 |
|------|------|----------|------|
| **加频账户** | 只加钱，不关心实时余额 | 收单商户入账、红包到账 | ★☆☆ 最简单 |
| **减频账户** | 只扣钱，需要实时余额校验 | 用户消费扣款 | ★★★ 最难 |
| **双频账户** | 加减都高频 | 平台中间户 | ★★☆ 分别处理 |

> **为什么"加频"简单？** 因为加钱不需要判断余额够不够，天然可以延迟入账。
> **为什么"减频"难？** 因为每次扣钱都要实时确认余额充足，不能延迟。

---

## §2 方案全景

```mermaid
graph TB
    Problem["热点账户并发瓶颈<br/>单账户 QPS ≈ 9"]

    Problem --> A["方案1: 限流降级"]
    Problem --> B["方案2: 缓冲记账/汇总记账"]
    Problem --> C["方案3: 子账户拆分"]
    Problem --> D["方案4: 内存记账"]
    Problem --> E["方案5: 排队合并"]
    Problem --> F["方案6: 数据库层优化"]

    A -->|"最简单<br/>牺牲可用性"| A1["限制并发数<br/>超出直接拒绝/重试"]
    B -->|"异步批量<br/>牺牲实时性"| B1["先记流水<br/>定时批量入账"]
    C -->|"空间换时间<br/>通用性最强"| C1["1个逻辑户→N个子户<br/>余额分散"]
    D -->|"Redis 主导<br/>牺牲强一致"| D1["Redis 原子操作做余额<br/>异步落库"]
    E -->|"攒批执行<br/>适合纯入账"| E1["请求进内存队列<br/>一次 DB 操作"]
    F -->|"通用优化<br/>效果有限"| F1["减小事务/乐观锁/<br/>热点行优化"]
```

---

## §3 方案1：限流降级（最简单）

### 原理

对单账户加并发控制，超出阈值的请求直接返回"系统繁忙请稍后重试"。

```java
// Guava RateLimiter 或 Redis 令牌桶
String key = "rate:account:" + accountId;
if (!rateLimiter.tryAcquire(key, 10, TimeUnit.MILLISECONDS)) {
    throw new BusinessException("系统繁忙，请稍后重试");
}
```

### 适用与局限

- **适用**：临时方案、兜底保护（防止把 DB 打挂）
- **局限**：本质上没解决问题，只是把问题转嫁给调用方；失败率高，用户体验差

---

## §4 方案2：缓冲记账 / 汇总记账

### 4.1 核心思想

**不实时变更余额，先记录变更意图，再定时批量入账。**

### 4.2 流程

```mermaid
sequenceDiagram
    participant Client as 调用方
    participant Svc as 账户服务
    participant Buffer as 缓冲流水表
    participant Cache as Redis缓存
    participant Timer as 定时任务
    participant DB as 账户主表

    Client->>Svc: 入账请求(+100)
    Svc->>Buffer: 写缓冲流水(同一事务)
    Svc->>Cache: INCRBY pending_amount 100 (Lua原子)
    Svc-->>Client: 成功

    Note over Timer,DB: 每N秒/分钟执行
    Timer->>Buffer: 捞取待处理流水
    Timer->>Timer: 汇总同账户金额
    Timer->>DB: 一次UPDATE余额 + 批量写流水
    Timer->>Buffer: 标记已处理
    Timer->>Cache: 修正缓存
```

### 4.3 关键设计点

**缓冲流水表结构**：
```sql
CREATE TABLE account_buffer (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL,
    amount DECIMAL(18,2) NOT NULL,      -- 正数加/负数减
    biz_no VARCHAR(128) NOT NULL,        -- 业务流水号(幂等键)
    status TINYINT DEFAULT 0,            -- 0:待处理 1:已入账 2:异常
    create_time DATETIME NOT NULL,
    process_time DATETIME,
    batch_no VARCHAR(64),                -- 所属批次号
    UNIQUE KEY uk_biz_no(biz_no),
    INDEX idx_status_time(status, create_time)
);
```

**定时任务核心逻辑**：
```java
@Scheduled(fixedRate = 5000)  // 每5秒
public void batchSettle() {
    String batchNo = generateBatchNo();  // 如: "BATCH-20260520-223000-001"
    
    // 1. 抢占一批待处理记录（CAS 更新 batch_no，防止多实例重复处理）
    int claimed = bufferMapper.claimBatch(batchNo, BATCH_SIZE);
    if (claimed == 0) return;
    
    // 2. 查询本批次数据并按账户汇总
    Map<String, BigDecimal> sumMap = bufferMapper.sumByAccount(batchNo);
    
    // 3. 加锁 → 一次性更新余额 + 批量写入正式流水
    for (Map.Entry<String, BigDecimal> entry : sumMap.entrySet()) {
        String accountId = entry.getKey();
        BigDecimal totalAmount = entry.getValue();
        
        try (DistributedLock lock = lockService.lock("account:" + accountId)) {
            accountMapper.updateBalance(accountId, totalAmount);
            flowMapper.batchInsert(batchNo, accountId);
            bufferMapper.markProcessed(batchNo, accountId);
        }
    }
}
```

**claimBatch 的 SQL 实现（CAS 抢占，防止多实例重复处理）**：

```sql
-- claimBatch: 通过 CAS 方式抢占一批未处理记录
-- 关键：WHERE 条件限定 status=0 且 batch_no IS NULL，SET batch_no 实现"占位"
-- 多个实例同时执行时，MySQL 行锁保证同一行只会被一个实例抢到
UPDATE account_buffer
SET batch_no = #{batchNo},
    status = 1  -- 1:处理中
WHERE status = 0
  AND batch_no IS NULL
  AND create_time <= DATE_SUB(NOW(), INTERVAL 1 SECOND)  -- 至少1秒前的数据（避免抢走刚写入的）
ORDER BY create_time ASC
LIMIT #{batchSize};

-- 返回值 = affected rows，即本次抢占到的记录数
```

```sql
-- sumByAccount: 按账户汇总本批次金额
SELECT account_id, SUM(amount) AS total_amount, COUNT(*) AS cnt
FROM account_buffer
WHERE batch_no = #{batchNo}
GROUP BY account_id;
```

```sql
-- markProcessed: 标记本批次已处理完成
UPDATE account_buffer
SET status = 2,  -- 2:已入账
    process_time = NOW()
WHERE batch_no = #{batchNo}
  AND account_id = #{accountId};
```

**多实例竞争安全性说明**：
- `UPDATE ... WHERE status=0 AND batch_no IS NULL LIMIT N` 在 MySQL InnoDB 下，多个实例并发执行时，行锁保证同一行不会被两个事务同时更新
- 即使两个实例同时执行，各自拿到的是不同的行（先到先得）
- `batch_no` 作为每次执行的唯一标识，后续 SUM 和 markProcessed 都通过 batch_no 隔离

### 4.4 优缺点

| 优点 | 缺点 |
|------|------|
| 实现相对简单 | 余额非实时（有时间窗口） |
| 对加款场景极其友好 | **扣款场景有透支风险** |
| 并发能力大幅提升 | 对账链路变长 |
| 不依赖复杂中间件 | 定时任务本身需要高可用设计 |

### 4.5 扣款场景的透支难题

```
场景：账户余额 1000 元，定时任务间隔 5 秒

T=0s: 扣款请求A -800（Redis: pending=-800，判断 1000-800=200 ≥ 0 ✓）
T=1s: 扣款请求B -300（Redis: pending=-1100，判断 1000-1100=-100 < 0 ✗ 拒绝）

看似没问题？但如果 Redis 故障重启，pending 归零：
T=2s: Redis 恢复，pending=0
T=3s: 扣款请求C -500（Redis: pending=-500，判断 1000-500=500 ≥ 0 ✓）

实际：A(-800) + C(-500) = -1300 > 1000 → 透支！
```

**解法**：
1. Redis 持久化 + Sentinel/Cluster 保高可用
2. 定时任务频率拉高（缩短窗口）
3. 扣款前双重校验（Redis + DB 余额）
4. 对扣款场景不用缓冲记账，改用子账户拆分

---

## §5 方案3：子账户拆分（通用性最强）

### 5.1 核心思想

将一个逻辑账户拆成 N 个物理子账户，余额分散到各子账户。N 个子账户可以并行操作，并发度从 1 提升到 N。

```mermaid
graph TB
    Main["逻辑账户A<br/>总余额=10000"]

    Main --> Sub1["子账户A-1<br/>余额=2500"]
    Main --> Sub2["子账户A-2<br/>余额=2500"]
    Main --> Sub3["子账户A-3<br/>余额=2500"]
    Main --> Sub4["子账户A-4<br/>余额=2500"]

    Request["扣款请求"]
    Request -->|"hash(bizNo)%4=2"| Sub3
```

### 5.2 入账流程（加钱）

```java
// 入账：随机选一个子账户加钱
public void credit(String accountId, BigDecimal amount, String bizNo) {
    int subIndex = Math.abs(bizNo.hashCode()) % subAccountCount;
    String subAccountId = accountId + "_" + subIndex;
    
    subAccountMapper.addBalance(subAccountId, amount);
    flowMapper.insert(accountId, subAccountId, amount, bizNo);
}
```

### 5.3 扣款流程（减钱 — 难点）

```java
// 扣款：选子账户扣钱（可能单个子账户余额不足）
public void debit(String accountId, BigDecimal amount, String bizNo) {
    // 策略1: 随机选一个，余额不足则换下一个
    List<SubAccount> subs = subAccountMapper.listByAccountId(accountId);
    Collections.shuffle(subs);
    
    for (SubAccount sub : subs) {
        // 乐观锁扣款：UPDATE SET balance = balance - #{amount}
        //              WHERE id = #{sub.id} AND balance >= #{amount}
        int affected = subAccountMapper.debit(sub.getId(), amount);
        if (affected > 0) {
            flowMapper.insert(accountId, sub.getId(), amount.negate(), bizNo);
            return;  // 成功
        }
    }
    
    // 所有子账户单独余额都不够，但总余额可能够 → 跨子账户调拨
    if (getTotalBalance(accountId).compareTo(amount) >= 0) {
        mergeAndDebit(accountId, amount, bizNo);
    } else {
        throw new InsufficientBalanceException();
    }
}
```

**跨子账户调拨扣款（mergeAndDebit）实现**：

当单个子账户余额不足以支撑扣款金额，但所有子账户总余额充足时，需要"归集再扣"：

```java
/**
 * 跨子账户调拨扣款：先将多个子账户余额归集到一个目标子账户，再执行扣款
 * 此操作需要加全局锁（因为涉及多个子账户的余额变动）
 */
@Transactional
public void mergeAndDebit(String accountId, BigDecimal amount, String bizNo) {
    // 1. 加账户级别的分布式锁（此时退化为串行，但此场景出现频率低）
    try (DistributedLock lock = lockService.lock("merge:" + accountId)) {
        
        List<SubAccount> subs = subAccountMapper.listByAccountIdForUpdate(accountId);
        
        // 2. 再次校验总余额（锁内二次确认）
        BigDecimal total = subs.stream()
            .map(SubAccount::getBalance)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (total.compareTo(amount) < 0) {
            throw new InsufficientBalanceException();
        }
        
        // 3. 选择一个目标子账户作为归集目标（选余额最大的）
        SubAccount target = subs.stream()
            .max(Comparator.comparing(SubAccount::getBalance))
            .orElseThrow();
        
        // 4. 从其他子账户向目标子账户调拨，直到目标子账户余额 >= amount
        BigDecimal need = amount.subtract(target.getBalance());  // 还差多少
        for (SubAccount donor : subs) {
            if (donor.getId().equals(target.getId())) continue;
            if (need.compareTo(BigDecimal.ZERO) <= 0) break;
            
            BigDecimal transfer = donor.getBalance().min(need);  // 取能转的最大值
            subAccountMapper.debit(donor.getId(), transfer);     // donor 减
            subAccountMapper.credit(target.getId(), transfer);   // target 加
            need = need.subtract(transfer);
            
            // 记录内部调拨流水（不对外暴露，仅用于对账）
            internalFlowMapper.insertTransfer(accountId, donor.getId(), 
                target.getId(), transfer);
        }
        
        // 5. 目标子账户现在余额充足，执行扣款
        subAccountMapper.debit(target.getId(), amount);
        flowMapper.insert(accountId, target.getId(), amount.negate(), bizNo);
    }
}
```

**调拨策略选择**：

| 策略 | 实现 | 适用 |
|------|------|------|
| **归集再扣**（如上） | 多个子户余额合并到一个子户再扣 | 通用，调拨流水清晰 |
| **拆单扣款** | 将一笔扣款拆成多笔分别从不同子户扣 | 避免资金搬运，但流水复杂 |
| **定时再平衡** | 低峰期自动均衡各子账户余额 | 减少运行时调拨概率 |

> **性能说明**：调拨操作需要加全局锁（退化为串行），但该场景仅在"单个子户余额不足"时触发。通过定时再平衡策略，可以大幅降低调拨频率。

### 5.4 子账户数量动态调整

**热点检测指标**：

| 监控指标 | 阈值建议 | 含义 |
|----------|----------|------|
| 单账户锁等待时间 | > 200ms（P99） | 锁竞争严重 |
| 单账户 QPS | > 当前子户数 × 9 | 已逼近当前并发天花板 |
| 调拨频率 | > 10次/分钟 | 子户余额分布不均 |

**动态扩缩容流程**：

```java
// 热点检测 + 自动拆分（定时任务，每分钟执行）
@Scheduled(fixedRate = 60000)
public void hotAccountDetect() {
    // 1. 从监控系统拉取单账户 QPS Top N
    List<HotMetric> hotList = monitorService.getHotAccounts(threshold);
    
    for (HotMetric metric : hotList) {
        String accountId = metric.getAccountId();
        int currentSubs = subAccountMapper.countByAccountId(accountId);
        int needSubs = (int) Math.ceil(metric.getQps() / 9.0);  // 每个子户 QPS≈9
        
        if (needSubs > currentSubs) {
            // 扩容：新增子账户（初始余额=0，等再平衡分配）
            int toAdd = Math.min(needSubs - currentSubs, MAX_EXPAND_PER_ROUND);
            for (int i = 0; i < toAdd; i++) {
                subAccountMapper.createSubAccount(accountId, currentSubs + i);
            }
            // 触发再平衡
            rebalanceService.triggerAsync(accountId);
        }
    }
}

// 低峰期合并（凌晨执行）
@Scheduled(cron = "0 0 3 * * ?")
public void shrinkIdleSubAccounts() {
    // 查找过去24小时 QPS < 5 且子账户数 > 1 的账户
    List<String> idleAccounts = subAccountMapper.findOverProvisioned();
    
    for (String accountId : idleAccounts) {
        // 加全局锁 → 归集余额到第一个子户 → 删除多余子户
        try (DistributedLock lock = lockService.lock("merge:" + accountId)) {
            subAccountMapper.mergeBalanceToFirst(accountId);
            subAccountMapper.deleteExcessSubs(accountId, keepCount: 1);
        }
    }
}
```

**定时再平衡（均衡各子账户余额）**：

```java
// 再平衡：将总余额按子户数均分
@Transactional
public void rebalance(String accountId) {
    List<SubAccount> subs = subAccountMapper.listByAccountIdForUpdate(accountId);
    BigDecimal total = subs.stream()
        .map(SubAccount::getBalance).reduce(BigDecimal.ZERO, BigDecimal::add);
    BigDecimal avg = total.divide(BigDecimal.valueOf(subs.size()), 2, RoundingMode.DOWN);
    BigDecimal remainder = total.subtract(avg.multiply(BigDecimal.valueOf(subs.size())));
    
    for (int i = 0; i < subs.size(); i++) {
        BigDecimal target = (i == 0) ? avg.add(remainder) : avg;  // 余数给第一个
        subAccountMapper.setBalance(subs.get(i).getId(), target);
    }
}
```

### 5.5 优缺点

| 优点 | 缺点 |
|------|------|
| **扣款场景也适用**（核心优势） | 实现复杂度高 |
| 余额实时准确 | 单子账户余额不足时需要调拨 |
| 并发度线性扩展（N倍） | 查总余额需 SUM 所有子账户 |
| 对业务语义影响小 | 子账户间余额不均衡需要再平衡 |

### 5.6 蚂蚁/支付宝实践参考

蚂蚁 2021 年发布的新一代高性能记账引擎，单账户实时记账能力峰值达 **2万笔/秒**（性能提升约 700 倍），已应用于支付宝直付通直播业务。

**核心技术拆解**（根据公开信息推断）：

| 技术点 | 说明 |
|--------|------|
| **内存计算层** | 余额变更先在内存中完成（类似本文方案4 Redis 主导，但用自研内存结构替代 Redis），保证实时性 |
| **异步持久化** | 内存中的余额变更异步批量落到 OceanBase，利用 OceanBase 的分布式事务能力保证最终一致 |
| **热点自动检测** | 监控系统实时识别热点账户（基于 QPS、锁等待等指标），动态触发拆分策略 |
| **非热点自动合并** | 低峰期将不再热点的子账户余额归集合并，降低存储和查询开销 |
| **OceanBase 支撑** | 底层分布式数据库 OceanBase 提供跨分区事务能力，双 11 峰值达 6100 万次/秒处理 |

**与普通方案的差异**：蚂蚁方案本质是"子账户拆分 + 内存计算 + 异步持久化"三者的深度融合，在保证余额实时更新无延迟的同时达到极高并发。普通企业若无自研内存计算引擎，可用 Redis Cluster 近似替代内存计算层，配合子账户拆分落地。

---

## §6 方案4：内存记账（Redis 主导）

### 6.1 核心思想

把余额的"真相"从 DB 搬到 Redis，用 Redis 原子操作完成实时扣减，DB 退化为异步持久化层。

### 6.2 流程

```mermaid
sequenceDiagram
    participant Client as 调用方
    participant Svc as 账户服务
    participant Redis as Redis(余额主)
    participant MQ as 消息队列
    participant DB as MySQL(异步落库)

    Client->>Svc: 扣款请求(-100)
    Svc->>Redis: Lua: if balance >= 100 then DECRBY
    Redis-->>Svc: OK (余额=900)
    Svc-->>Client: 成功
    Svc->>MQ: 发送记账消息
    MQ->>DB: 异步更新DB余额 + 写流水
```

**Lua 脚本核心**：
```lua
-- 原子扣款
local balance = tonumber(redis.call('GET', KEYS[1]) or '0')
local amount = tonumber(ARGV[1])
if balance >= amount then
    redis.call('DECRBY', KEYS[1], amount)
    return 1  -- 成功
else
    return 0  -- 余额不足
end
```

### 6.3 Redis ↔ DB 对账补偿机制（关键）

内存记账方案中，Redis 是余额主，DB 是异步落库。两者之间必须有对账机制兜底：

```mermaid
sequenceDiagram
    participant Timer as 对账定时任务
    participant Redis as Redis(余额主)
    participant DB as MySQL(异步副本)
    participant Alert as 告警系统

    Note over Timer: 每分钟执行
    Timer->>Redis: GET balance:account_123
    Timer->>DB: SELECT balance FROM account WHERE id=123
    Timer->>Timer: 比对差额

    alt 差额=0
        Note over Timer: 一致，无需处理
    else 差额≠0 且 DB有未消费的MQ消息
        Note over Timer: 等待MQ消费完成（正常延迟）
    else 差额≠0 且 无待消费消息
        Timer->>Alert: 触发告警（疑似数据不一致）
        Note over Timer: 人工介入 or 自动以DB为准修正Redis
    end
```

**对账核心逻辑**：

```java
@Scheduled(fixedRate = 60000)  // 每分钟
public void reconcile() {
    // 1. 获取所有"内存记账模式"的账户列表
    List<String> accounts = accountConfigMapper.listMemoryModeAccounts();
    
    for (String accountId : accounts) {
        BigDecimal redisBalance = getRedisBalance(accountId);
        BigDecimal dbBalance = accountMapper.getBalance(accountId);
        
        // 2. 查询是否还有未消费的异步记账消息（MQ 消费延迟）
        int pendingMessages = mqAdminService.getPendingCount(
            "ACCOUNT_ASYNC_TOPIC", accountId);
        
        if (redisBalance.compareTo(dbBalance) != 0 && pendingMessages == 0) {
            // 3. 差异且无待处理消息 → 不一致
            BigDecimal diff = redisBalance.subtract(dbBalance);
            
            if (diff.abs().compareTo(ALERT_THRESHOLD) > 0) {
                // 大额差异 → 告警，人工介入
                alertService.fire("ACCOUNT_RECONCILE_FAIL", accountId, diff);
            } else {
                // 小额差异 → 自动修正（以流水汇总为准）
                BigDecimal flowSum = flowMapper.sumAfterLastReconcile(accountId);
                BigDecimal correctBalance = lastReconciledBalance.add(flowSum);
                redisTemplate.opsForValue().set(
                    "balance:" + accountId, correctBalance.toPlainString());
                accountMapper.updateBalance(accountId, correctBalance);
                
                reconcileLogMapper.insert(accountId, diff, "AUTO_FIX");
            }
        }
    }
}
```

**Redis 故障恢复策略**：

| 场景 | 恢复方式 |
|------|----------|
| Redis 单节点重启 | Sentinel 自动切主，无数据丢失（AOF持久化） |
| Redis Cluster 整体不可用 | 降级为"DB 直连模式"（走分布式锁+事务，性能退化但可用） |
| Redis 恢复后数据不一致 | 以 DB 流水 SUM 为准重建 Redis 余额（全量对账修正） |

```java
// Redis 不可用时的降级处理
public DebitResult debit(String accountId, BigDecimal amount) {
    if (redisAvailable()) {
        return debitViaRedis(accountId, amount);  // 正常路径：内存记账
    } else {
        // 降级路径：直接走 DB（串行化，但保证正确）
        return debitViaDatabaseWithLock(accountId, amount);
    }
}
```

### 6.4 优缺点

| 优点 | 缺点 |
|------|------|
| 性能极高（Redis 10万+ QPS） | **强依赖 Redis 可用性** |
| 余额判断实时 | Redis 宕机 → 需要降级方案 |
| 实现相对简单 | 需要 Redis 和 DB 的对账机制 |
| 扣款场景友好 | 审计合规场景难以接受"缓存是主" |

### 6.5 适用判断

- 对 Redis 集群高可用有足够信心（Sentinel / Cluster + AOF 持久化）
- 有完善的降级方案（Redis 不可用时回退到 DB 模式）
- 有定时对账 + 告警机制
- 能接受极端情况下（Redis 集群整体不可用）性能退化到 DB 模式

---

## §7 方案5：排队合并执行

### 7.1 核心思想

请求不直接执行，而是进入内存队列（或 MQ），攒一批后合并为一次 DB 操作。

### 7.2 与方案2的区别

| 维度 | 方案2 缓冲记账 | 方案5 排队合并 |
|------|---------------|---------------|
| 缓冲位置 | DB 缓冲表 + Redis | 内存队列 / MQ |
| 触发方式 | 定时任务扫描 | 攒够 N 条或到达时间窗口 |
| 响应方式 | 写缓冲表即返回 | 等待合并执行完才返回（或异步回调） |
| 数据安全 | 持久化（DB 表） | 内存队列有丢失风险 |

### 7.3 实现示例

```java
// 基于 Disruptor 或 BlockingQueue 的合并执行器
public class BatchAccountExecutor {
    private final BlockingQueue<AccountRequest> queue = new LinkedBlockingQueue<>(10000);
    
    // 提交请求
    public CompletableFuture<Result> submit(AccountRequest request) {
        CompletableFuture<Result> future = new CompletableFuture<>();
        request.setFuture(future);
        queue.offer(request);
        return future;
    }
    
    // 后台线程：攒批执行
    @Scheduled(fixedDelay = 50)  // 每50ms或攒够100条
    public void drain() {
        List<AccountRequest> batch = new ArrayList<>(100);
        queue.drainTo(batch, 100);
        if (batch.isEmpty()) return;
        
        // 按账户分组
        Map<String, List<AccountRequest>> grouped = batch.stream()
            .collect(Collectors.groupingBy(AccountRequest::getAccountId));
        
        for (Map.Entry<String, List<AccountRequest>> entry : grouped.entrySet()) {
            String accountId = entry.getKey();
            List<AccountRequest> requests = entry.getValue();
            BigDecimal totalAmount = requests.stream()
                .map(AccountRequest::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
            
            try {
                // 一次锁 + 一次DB操作
                accountService.batchSettle(accountId, totalAmount, requests);
                requests.forEach(r -> r.getFuture().complete(Result.success()));
            } catch (Exception e) {
                requests.forEach(r -> r.getFuture().completeExceptionally(e));
            }
        }
    }
}
```

### 7.4 适用场景

- 纯加款场景（不需要实时余额校验）
- 能接受 50-200ms 的额外延迟
- JVM 进程可靠（不频繁重启）

---

## §8 方案6：数据库层优化（通用底线）

不改架构，在数据库层面榨取性能：

### 8.1 减小事务粒度

```java
// 反模式：一个大事务包含所有操作
@Transactional
public void process(Request req) {
    validateBusiness(req);    // 可能耗时的校验
    updateBalance(req);       // 行锁
    insertFlow(req);          // 写流水
    notifyDownstream(req);    // RPC 调用（最不该放事务里！）
}

// 优化：事务只包裹必须原子的操作
public void process(Request req) {
    validateBusiness(req);  // 事务外
    doInTransaction(() -> {
        updateBalance(req);   // 行锁持有时间最短
        insertFlow(req);
    });
    notifyDownstream(req);  // 事务外
}
```

### 8.2 乐观锁替代分布式锁

```sql
-- 用 version 号做乐观锁，去掉分布式锁
UPDATE account 
SET balance = balance - #{amount}, version = version + 1
WHERE account_id = #{accountId} 
  AND balance >= #{amount} 
  AND version = #{expectedVersion};

-- 影响行数=0 → 冲突，重试
```

**适用**：中等并发（冲突率 < 30%）。极端热点下乐观锁重试风暴反而更差。

### 8.3 热点行更新优化（MySQL 8.0+）

```sql
-- MySQL 8.0 的 SKIP LOCKED / NOWAIT
SELECT * FROM account WHERE id = 123 FOR UPDATE SKIP LOCKED;
-- 拿不到锁立即跳过，而不是排队等待
```

---

## §9 方案选型决策

```mermaid
graph TD
    Start{热点账户类型?}
    
    Start -->|纯加款| Add[加频账户]
    Start -->|纯扣款| Sub[减频账户]
    Start -->|加减都有| Both[双频账户]
    
    Add --> A1{实时性要求?}
    A1 -->|秒级延迟OK| Buf["方案2: 缓冲记账<br/>⭐ 首选"]
    A1 -->|毫秒级| Queue["方案5: 排队合并"]
    
    Sub --> S1{并发量级?}
    S1 -->|QPS<100| Opt["方案6: 数据库优化<br/>(乐观锁/缩小事务)"]
    S1 -->|QPS 100-1000| Split["方案3: 子账户拆分<br/>⭐ 首选"]
    S1 -->|QPS>1000| Redis["方案4: 内存记账<br/>(Redis主导)"]
    
    Both --> B1["加款用方案2/5<br/>扣款用方案3/4<br/>分别处理"]
```

### 极简选型表

| 场景 | 首选方案 | 理由 |
|------|----------|------|
| 商户收款入账（纯加） | 缓冲记账 | 不需要实时余额，延迟入账无影响 |
| 用户消费扣款（纯减） | 子账户拆分 | 需要实时余额判断，不能延迟 |
| 红包/营销入账（纯加，超高并发） | 排队合并 / 缓冲记账 | 海量写入，批量效率最高 |
| 平台中间户（加减都有） | 子账户拆分 + 缓冲记账组合 | 加款异步入账，扣款走子户 |
| 极端场景（万级 QPS） | 内存记账(Redis) | 突破 DB 瓶颈 |

---

## §10 方案组合：生产级架构

实际生产中，往往不是选一种方案，而是**组合使用**：

```mermaid
graph TB
    subgraph 请求层
        Req["记账请求"]
    end

    subgraph 路由层
        Router{热点检测}
        Router -->|非热点| Normal["常规记账<br/>(直接加锁+事务)"]
        Router -->|热点-加款| Buffer["缓冲记账"]
        Router -->|热点-扣款| SubAcc["子账户扣款"]
    end

    subgraph 兜底层
        Limit["单账户限流<br/>(保护DB)"]
        Reconcile["T+1 对账<br/>(发现不一致)"]
    end

    Req --> Router
    Normal --> Limit
    Buffer --> Limit
    SubAcc --> Limit
    Buffer --> Reconcile
    SubAcc --> Reconcile
```

**三层防线**：
1. **路由层**：识别热点 → 走对应的高并发方案
2. **兜底层**：即使高并发方案也要有限流（防止把方案本身打穿）
3. **对账层**：无论用哪种方案，T+1 对账是最后的安全网

---

## §11 核心认知

| 认知点 | 说明 |
|--------|------|
| **没有银弹** | 每种方案都有适用边界，要根据"加频/减频/双频"分别处理 |
| **一致性 vs 性能** | 缓冲记账牺牲实时性换性能；子账户拆分牺牲复杂度换性能；没有"既要又要" |
| **扣款比加款难得多** | 加款可以延迟、可以批量、无需余额校验；扣款必须实时、必须校验余额 |
| **缓存做主 ≠ 正确** | Redis 做余额主时，必须有完善的持久化 + 对账 + 降级方案 |
| **热点检测要自动化** | 不是所有账户都热点，为非热点账户增加复杂度是浪费；动态识别热点 + 动态路由 |
| **对账是最后一道防线** | 无论方案多优雅，异步场景必须有对账，发现不一致能自动/人工修复 |
