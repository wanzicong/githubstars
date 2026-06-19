---
trigger: always_on
---
# 代码注释与日志规范

## 核心原则

注释的目的是解释**为什么**（WHY），而不是**做了什么**（WHAT）。代码本身应该清晰地表达"做什么"，注释应该补充"为什么这样做"。

日志和注释是代码可维护性的基石，不是"有空再补"的可选项。

## 强制性注释要求

在**任何**提交之前，确保：

### 函数与方法

* \[ ] 所有公共函数/方法都有文档注释（描述用途、参数、返回值、异常）
* \[ ] 注释中必须包含依赖关系：`@callers`（谁依赖我）、`@depends`（我依赖谁）、移除的依赖也需同步更新
* \[ ] 参数包含非显而易见约束时，在注释中说明（如范围、格式、null 允许性）
* \[ ] 返回值含义不直观时，在注释中阐明
* \[ ] 可能抛出的异常类型及触发条件在注释中列出

**方法注释格式：**

```java
/**
 * 根据用户 ID 计算订单总额并更新账户余额。
 * 计算逻辑：取近 30 天已支付订单，扣除已退款金额，按会员等级应用折扣。
 *
 * @param userId   用户 ID，不能为空
 * @param discount 手动折扣率（0.0-1.0），为 null 时使用会员默认折扣
 * @return 更新后的账户余额（单位：分）
 * @throws IllegalArgumentException userId 为空时抛出
 * @throws DataAccessException      数据库连接失败时抛出
 *
 * @callers
 *   - OrderController.confirmOrder()  — 用户确认下单时调用
 *   - AdminController.manualAdjust()  — 后台手动调账
 *
 * @depends
 *   - OrderMapper.selectPaidOrders(userId, 30) — 查询近 30 天已支付订单
 *   - MemberService.getLevel(userId)            — 获取会员等级以确定折扣率
 *   - AccountMapper.updateBalance()             — 最终写入 account 表
 */
```

### 类与接口

* \[ ] 每个导出的类/接口都有用途描述注释
* \[ ] 注释中必须包含：类的职责定位、在架构中的层级归属、依赖关系（`@callers` / `@depends` / `@see`）
* \[ ] POJO/DTO 类可简化注释，但核心业务类不可省略

**类注释格式：**

```java
/**
 * 订单核心服务 —— 负责订单的创建、支付状态同步、退款处理。
 *
 * 架构层级：Service 层（业务逻辑层），介于 Controller 与 Mapper 之间。
 *
 * @callers
 *   - OrderController（用户下单、查询订单）
 *   - AdminOrderController（后台退款、订单审核）
 *   - OrderScheduler（定时取消超时未支付订单）
 *
 * @depends
 *   - UserService.getUser()        — 校验用户状态
 *   - InventoryService.deduct()    — 扣减库存
 *   - PaymentGateway.charge()      — 调用第三方支付
 *   - OrderMapper（order 表）      — 订单持久化
 *   - RedisClient（order:lock:*）  — 防重复提交分布式锁
 *
 * @see OrderValidator    — 订单参数校验
 * @see OrderEventPublisher — 订单状态变更事件发布
 */
```

### 复杂逻辑

* \[ ] 算法实现、业务规则、性能优化必须在代码旁注释说明
* \[ ] 使用非显而易见的技术或变通方案时必须解释原因
* \[ ] 正则表达式、位运算、复杂数学公式必须附带解释
* \[ ] 依赖外部副作用或时序的代码必须显式注释

### 配置与常量

* \[ ] 魔法数字和硬编码字符串必须定义为命名常量，并附带注释
* \[ ] 配置值（超时时间、阈值、限制）必须在定义处注释说明其选取依据

## 日志规范（P1）

### 日志级别限制

**仅允许使用 INFO 和 ERROR 两个级别。** 禁止使用 DEBUG、WARN、TRACE 等其他级别。

| 级别 | 使用场景 | 示例 |
|------|----------|------|
| **INFO** | 关键业务节点：请求入口/出口、核心操作完成、状态变更、外部服务调用、定时任务执行 | `log.info("订单创建成功 orderId={} userId={}", id, uid)` |
| **ERROR** | 异常与错误：catch 块中记录异常堆栈、业务失败原因、数据不一致、第三方调用失败 | `log.error("支付回调验签失败 orderId={}", id, e)` |

### 日志内容要求

* 必须包含**关键业务标识**（如 orderId、userId、requestId），方便问题追踪
* 必须包含**足够的上下文**让读者理解发生了什么（禁止 `log.info("success")` 这种无意义日志）
* ERROR 日志必须附带**异常对象**（即 `log.error(msg, exception)`，不可只打 `e.getMessage()`）
* 禁止在循环中打印 INFO 日志（避免日志刷屏）
* 禁止打印敏感信息（密码、Token、身份证号、手机号需脱敏）

### 日志位置要求

* **方法入口/出口**：对外 API、核心 Service 方法入口打 INFO，记录入参和最终结果
* **关键分支**：if-else 中走不同业务路径时，每个分支应有 INFO 记录
* **异常捕获**：每个 catch 块必须有 ERROR 日志（禁止空 catch 或只 `e.printStackTrace()`）
* **外部调用**：调用第三方 API、数据库事务提交、消息队列投递前后应有 INFO 记录

## 注释质量要求

* **保持同步**：代码变更时，必须同步更新注释。过时的注释比没有注释更危险
* **简洁清晰**：注释应简洁但不失精确性。避免冗余和显而易见的描述
* **使用标准格式**：遵循所在语言的文档注释标准（JSDoc、JavaDoc、docstring 等）
* **语言一致**：同一项目中注释语言保持一致（推荐使用英文，中文项目可用中文）

## 禁止事项

* \[ ] 禁止提交被注释掉的大段代码（应删除或使用版本控制回溯）
* \[ ] 禁止仅为满足要求而添加无意义的占位注释（如 `// 遍历列表` 写在 `for` 循环上方）
* \[ ] 禁止注释与代码实际行为不一致——修改代码时必须同步更新注释
* \[ ] 禁止在注释中使用模糊或不确定的表述
* \[ ] 禁止公开类和方法无注释——任何 public class/method 都不得裸奔
* \[ ] 禁止注释缺少依赖关系——类和方法的 `@callers` / `@depends` 不可省略

## 注释审查检查清单

在代码审查时，检查以下内容：

1. 公共 API 是否有完整的文档注释（含 @callers / @depends）？
2. 复杂算法/业务逻辑是否有解释性注释？
3. 是否有被注释掉的代码块需要清理？
4. 注释是否与代码实际行为一致？依赖关系是否已同步更新？
5. 新增的配置值/常量是否有注释说明？
6. 关键业务节点是否有 INFO 日志？异常处理是否有 ERROR 日志？

## 与其他规则的集成

此规则与以下规则配合：

- [coding-style.md](coding-style.md) - 代码可读性与组织
- [code-review.md](code-review.md) - 代码审查标准
- [dead-code.md](dead-code.md) - 死代码（含被注释掉的代码）管理
- [performance.md](performance.md) - 日志对性能的影响考量
