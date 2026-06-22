import { Injectable, Logger } from '@nestjs/common';

/**
 * 熔断器状态。
 */
export enum CircuitState {
    CLOSED = 'CLOSED',       // 正常通行
    OPEN = 'OPEN',           // 熔断拒绝
    HALF_OPEN = 'HALF_OPEN', // 半开探测
}

/**
 * 熔断器配置。
 */
interface CircuitBreakerConfig {
    /** 失败阈值：连续失败次数达到此值时打开熔断器 */
    failureThreshold: number;
    /** 恢复超时（毫秒）：OPEN 状态持续此时间后进入 HALF_OPEN */
    recoveryTimeoutMs: number;
    /** 半开状态探测成功次数阈值：达到后关闭熔断器 */
    halfOpenSuccessThreshold: number;
}

/**
 * 熔断器。
 *
 * 保护 Agent 执行免受级联故障影响。
 * 当连续工具调用失败次数达到阈值时，自动熔断并拒绝后续请求，
 * 等待恢复超时后进入半开状态进行探测。
 *
 * @callers
 *   - AgentExecutorService — 包装工具调用
 *   - ToolInvokerService — 包装外部 API 调用
 */
@Injectable()
export class CircuitBreakerService {
    private readonly logger = new Logger(CircuitBreakerService.name);

    private readonly breakers = new Map<string, {
        state: CircuitState;
        failureCount: number;
        successCount: number;
        lastFailureTime: number;
        config: CircuitBreakerConfig;
    }>();

    private readonly defaultConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        recoveryTimeoutMs: 30_000, // 30 seconds
        halfOpenSuccessThreshold: 2,
    };

    /**
     * 注册熔断器。
     */
    register(name: string, config?: Partial<CircuitBreakerConfig>): void {
        this.breakers.set(name, {
            state: CircuitState.CLOSED,
            failureCount: 0,
            successCount: 0,
            lastFailureTime: 0,
            config: { ...this.defaultConfig, ...config },
        });
    }

    /**
     * 在熔断器保护下执行操作。
     *
     * @param name — 熔断器名称
     * @param fn — 受保护的异步函数
     * @returns 函数返回值
     * @throws 如果熔断器 OPEN 时被调用
     */
    async executeWithBreaker<T>(name: string, fn: () => Promise<T>): Promise<T> {
        let breaker = this.breakers.get(name);
        if (!breaker) {
            this.register(name);
            breaker = this.breakers.get(name)!;
        }

        // 检查状态
        if (breaker.state === CircuitState.OPEN) {
            const elapsed = Date.now() - breaker.lastFailureTime;
            if (elapsed >= breaker.config.recoveryTimeoutMs) {
                // 进入半开状态
                breaker.state = CircuitState.HALF_OPEN;
                breaker.successCount = 0;
                this.logger.log(`[CircuitBreaker] "${name}" → HALF_OPEN`);
            } else {
                const remainingMs = breaker.config.recoveryTimeoutMs - elapsed;
                this.logger.warn(`[CircuitBreaker] "${name}" is OPEN, retry in ${Math.ceil(remainingMs / 1000)}s`);
                throw new Error(`Circuit breaker "${name}" is OPEN`);
            }
        }

        try {
            const result = await fn();

            // 成功回调
            if (breaker.state === CircuitState.HALF_OPEN) {
                breaker.successCount++;
                if (breaker.successCount >= breaker.config.halfOpenSuccessThreshold) {
                    breaker.state = CircuitState.CLOSED;
                    breaker.failureCount = 0;
                    this.logger.log(`[CircuitBreaker] "${name}" → CLOSED (recovered)`);
                }
            } else {
                // CLOSED 状态成功：重置失败计数
                breaker.failureCount = 0;
            }

            return result;
        } catch (error) {
            // 失败回调
            breaker.failureCount++;
            breaker.lastFailureTime = Date.now();

            if (breaker.state === CircuitState.HALF_OPEN) {
                breaker.state = CircuitState.OPEN;
                this.logger.warn(`[CircuitBreaker] "${name}" → OPEN (half-open failed)`);
            } else if (breaker.failureCount >= breaker.config.failureThreshold) {
                breaker.state = CircuitState.OPEN;
                this.logger.warn(`[CircuitBreaker] "${name}" → OPEN (${breaker.failureCount} consecutive failures)`);
            }

            throw error;
        }
    }

    /**
     * 获取所有熔断器状态。
     */
    getStatus(): Array<{ name: string; state: CircuitState; failureCount: number }> {
        return Array.from(this.breakers.entries()).map(([name, b]) => ({
            name,
            state: b.state,
            failureCount: b.failureCount,
        }));
    }

    /**
     * 手动重置熔断器。
     */
    reset(name: string): void {
        const breaker = this.breakers.get(name);
        if (breaker) {
            breaker.state = CircuitState.CLOSED;
            breaker.failureCount = 0;
            breaker.successCount = 0;
            this.logger.log(`[CircuitBreaker] "${name}" manually reset`);
        }
    }
}
