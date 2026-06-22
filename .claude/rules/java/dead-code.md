---
trigger: always_on
---

# Java 死代码管理

> 本文件基于 [common/dead-code.md](../common/dead-code.md) 扩展，包含 Java 特定内容。

## 自动检测工具

### IntelliJ IDEA 检查

在 IDE 中运行死代码检测：

* **路径**：`Code` > `Inspect Code` > 选择范围 > 运行
* **关键检查项**：
  * `Unused declaration` — 未使用的类、方法、字段
  * `Unused import` — 未使用的导入语句
  * `Unreachable code` — 不可达代码
  * `Constant conditions & exceptions` — 恒为 true/false 的条件

### SpotBugs / Spotless

在 Maven 或 Gradle 中集成静态分析：

```xml
<!-- pom.xml -->
<plugin>
    <groupId>com.github.spotbugs</groupId>
    <artifactId>spotbugs-maven-plugin</artifactId>
    <version>4.8.6.0</version>
    <configuration>
        <effort>Max</effort>
        <threshold>Low</threshold>
    </configuration>
</plugin>
```

```bash
# 运行检测
mvn spotbugs:check
```

### PMD

```xml
<!-- pom.xml -->
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-pmd-plugin</artifactId>
    <version>3.23.0</version>
    <configuration>
        <rulesets>
            <ruleset>/rulesets/java/unusedcode.xml</ruleset>
        </rulesets>
    </configuration>
</plugin>
```

```bash
mvn pmd:check
```

## 常见死代码模式

### 未使用的导入

```java
// BAD — 未使用的导入
import java.util.List;
import java.util.Map;     // 未使用
import java.util.Set;     // 未使用
import java.util.stream.Collectors; // 未使用

// GOOD — 仅导入需要的
import java.util.List;
```

### 未使用的字段和方法

```java
// BAD — 未使用的私有方法
public class UserService {
    private final UserRepository userRepository;

    // 从未被调用的私有方法
    private String formatUserName(String firstName, String lastName) {
        return firstName + " " + lastName;
    }

    // 从未被引用的常量
    private static final int MAX_RETRY_COUNT = 3;

    public User findById(Long id) {
        return userRepository.findById(id).orElse(null);
    }
}

// GOOD — 移除未使用的代码
public class UserService {
    private final UserRepository userRepository;

    public User findById(Long id) {
        return userRepository.findById(id).orElse(null);
    }
}
```

### 被注释掉的代码

```java
// BAD — 被注释掉的大段代码
// public Order createOrder(CreateOrderRequest request) {
//     Order order = new Order();
//     order.setCustomerName(request.getCustomerName());
//     order.setTotal(request.getTotal());
//     order.setStatus(OrderStatus.PENDING);
//     return orderRepository.save(order);
// }

// BAD — 被注释掉的字段
// private final PaymentGateway legacyPaymentGateway;

// ACCEPTABLE — 有追踪编号和恢复计划的注释
// TODO(#1234): 迁移完成后移除旧支付网关引用
// 当前保留以确保灰度期间可以通过配置回退
```

### 不可达代码

```java
// BAD — return 后的不可达代码
public String getStatus(String code) {
    if (code == null) {
        return "UNKNOWN";
    }
    return code.toUpperCase();
    // log.debug("Processed status: {}", code); // 永远不会执行
}

// BAD — 恒为 false 的条件
public void process(int value) {
    if (false) { // 恒为 false
        System.out.println("never runs");
    }
    // 实际逻辑...
}

// BAD — switch 中的不可达分支
public String describe(int code) {
    switch (code) {
        case 0: return "ZERO";
        case 1: return "ONE";
        default: return "OTHER";
        // 以下分支永远不会执行
        // case 2: return "TWO";
    }
}
```

### @Deprecated 代码的处理

```java
// ACCEPTABLE — 已标记为废弃但仍在过渡期使用的代码
/**
 * @deprecated 自 v2.1 起，使用 {@link #findById(Long)} 替代。
 *             计划在 v3.0 中移除。
 */
@Deprecated(forRemoval = true)
public User getUserById(Long id) {
    return findById(id);
}
```

废弃代码在过渡期后必须删除。

## CI/CD 集成

```yaml
# .github/workflows/ci.yml
- name: Run SpotBugs
  run: mvn spotbugs:check

- name: Run PMD dead code check
  run: mvn pmd:check
```

## 参考

有关通用死代码管理原则，请参见 [common/dead-code.md](../common/dead-code.md)。
有关 Java 编码标准，请参见技能：`java-coding-standards`。
