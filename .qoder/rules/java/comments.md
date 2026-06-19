---
trigger: always_on
---

# Java 代码注释

> 本文件基于 [common/comments.md](../common/comments.md) 扩展，包含 Java 特定内容。

## JavaDoc 标准

所有公共类、接口、方法和字段必须使用 JavaDoc 注释：

```java
/**
 * 订单服务，负责订单的创建、查询和状态管理。
 *
 * <p>该服务协调 {@link OrderRepository} 和 {@link PaymentGateway} 之间的交互，
 * 确保订单操作的原子性和一致性。
 *
 * @see OrderRepository
 * @see PaymentGateway
 */
public class OrderService {

    private final OrderRepository orderRepository;
    private final PaymentGateway paymentGateway;

    /**
     * 创建订单服务实例。
     *
     * @param orderRepository 订单数据访问仓储（不可为 null）
     * @param paymentGateway  支付网关接口（不可为 null）
     * @throws NullPointerException 如果任一参数为 null
     */
    public OrderService(OrderRepository orderRepository, PaymentGateway paymentGateway) {
        this.orderRepository = Objects.requireNonNull(orderRepository, "orderRepository");
        this.paymentGateway = Objects.requireNonNull(paymentGateway, "paymentGateway");
    }

    /**
     * 根据请求创建并提交新订单。
     *
     * <p>此方法执行以下步骤：
     * <ol>
     *   <li>验证请求参数</li>
     *   <li>通过支付网关处理付款</li>
     *   <li>将订单持久化到数据库</li>
     * </ol>
     *
     * @param request 订单创建请求（不可为 null）
     * @return 包含订单摘要信息的响应
     * @throws IllegalArgumentException 如果请求参数无效
     * @throws PaymentFailedException   如果支付处理失败
     * @throws OrderCreationException   如果订单持久化失败
     */
    public OrderResponse placeOrder(CreateOrderRequest request) {
        // ...
    }
}
```

## Record 与 DTO 注释

```java
/**
 * 订单创建请求的数据传输对象。
 *
 * @param customerName 客户名称（1-100 个字符，不可为空白）
 * @param total        订单总金额（必须为正数）
 * @param items        订单中包含的商品列表（至少包含一项）
 */
public record CreateOrderRequest(
        String customerName,
        BigDecimal total,
        List<LineItem> items) {

    /**
     * 创建请求对象的紧凑构造函数，用于参数验证。
     */
    public CreateOrderRequest {
        Objects.requireNonNull(customerName, "customerName must not be null");
        Objects.requireNonNull(total, "total must not be null");
        Objects.requireNonNull(items, "items must not be null");
    }
}
```

## 复杂逻辑注释

```java
/**
 * 计算订单的折扣后金额。
 *
 * <p>折扣策略：
 * <ul>
 *   <li>VIP 客户始终享受 10% 折扣</li>
 *   <li>订单金额超过 1000 元时额外享受 5% 折扣</li>
 *   <li>折扣叠加上限为原价的 50%</li>
 * </ul>
 *
 * @param originalPrice 原始价格
 * @param isVip         是否为 VIP 客户
 * @return 折扣后的价格
 */
private BigDecimal calculateDiscount(BigDecimal originalPrice, boolean isVip) {
    BigDecimal discountRate = BigDecimal.ZERO;

    if (isVip) {
        // VIP 基础折扣 10%
        discountRate = discountRate.add(new BigDecimal("0.10"));
    }

    // 大额订单追加折扣：使用 compareTo 而非 equals，因为 BigDecimal 需要精确比较
    if (originalPrice.compareTo(new BigDecimal("1000")) > 0) {
        discountRate = discountRate.add(new BigDecimal("0.05"));
    }

    // 折扣上限保护：防止叠加折扣超过 50%
    BigDecimal maxDiscount = new BigDecimal("0.50");
    if (discountRate.compareTo(maxDiscount) > 0) {
        discountRate = maxDiscount;
    }

    return originalPrice.multiply(BigDecimal.ONE.subtract(discountRate));
}
```

## 自动化工具

* **Checkstyle**：配置 `JavadocMethod`、`JavadocType`、`JavadocVariable` 模块强制执行 JavaDoc
* **IntelliJ IDEA**：Settings > Editor > Inspections > Java > Javadoc 中启用 JavaDoc 检查
* **SpotBugs**：可检测缺少 JavaDoc 的公共 API

## 参考

有关通用注释原则，请参见 [common/comments.md](../common/comments.md)。
有关 Java 编码标准，请参见技能：`java-coding-standards`。
