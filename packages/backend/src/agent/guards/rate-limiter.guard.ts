import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';

/**
 * Agent API 限流守卫。
 *
 * 基于滑动窗口的简单限流器，限制每个 IP 在一定时间窗口内的请求次数。
 * 生产环境建议替换为 Redis 分布式限流器（如 @nestjs/throttler + Redis）。
 *
 * @callers
 *   - AgentController — 应用于所有 Agent API 端点
 */
@Injectable()
export class RateLimiterGuard implements CanActivate {
    private readonly logger = new Logger(RateLimiterGuard.name);

    /** IP → 请求时间戳数组 */
    private readonly requestLog = new Map<string, number[]>();

    /** 默认时间窗口（毫秒） */
    private readonly windowMs = 60_000; // 1 minute

    /** 默认窗口内最大请求数 */
    private readonly maxRequests = 30;

    /** 清理间隔 */
    private readonly cleanupIntervalMs = 300_000; // 5 minutes
    private lastCleanup = Date.now();

    constructor(private readonly config: ConfigService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const ip = request.ip || request.connection?.remoteAddress || 'unknown';
        const now = Date.now();

        // 定期清理过期记录
        if (now - this.lastCleanup > this.cleanupIntervalMs) {
            this.cleanup(now);
            this.lastCleanup = now;
        }

        // 获取或初始化该 IP 的请求记录
        let timestamps = this.requestLog.get(ip);
        if (!timestamps) {
            timestamps = [];
            this.requestLog.set(ip, timestamps);
        }

        // 移除窗口外的旧记录
        const windowStart = now - this.windowMs;
        const recentTimestamps = timestamps.filter(t => t > windowStart);
        this.requestLog.set(ip, recentTimestamps);

        // 检查是否超限
        if (recentTimestamps.length >= this.maxRequests) {
            const resetMs = recentTimestamps[0] + this.windowMs - now;
            this.logger.warn(`[RateLimiter] Rate limit exceeded for IP=${ip} requests=${recentTimestamps.length}`);

            throw new HttpException(
                {
                    error: 'Too Many Requests',
                    message: `请求过于频繁，请在 ${Math.ceil(resetMs / 1000)} 秒后重试`,
                    retryAfter: Math.ceil(resetMs / 1000),
                },
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        // 记录本次请求
        recentTimestamps.push(now);
        return true;
    }

    /** 清理所有过期记录 */
    private cleanup(now: number): void {
        let cleaned = 0;
        for (const [ip, timestamps] of this.requestLog) {
            const recent = timestamps.filter(t => t > now - this.windowMs);
            if (recent.length === 0) {
                this.requestLog.delete(ip);
                cleaned++;
            } else {
                this.requestLog.set(ip, recent);
            }
        }
        if (cleaned > 0) {
            this.logger.debug(`[RateLimiter] Cleaned up ${cleaned} expired IP entries`);
        }
    }
}
