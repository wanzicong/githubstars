/**
 * 通用信号量并发控制工具。
 *
 * 从 TranslateTaskService 的私有 acquire/release 模式提取为独立类，
 * 供需要并发限制的模块复用。
 *
 * @callers
 *   - TranslateTaskService — 翻译并发控制（后续迁移至此）
 *   - CloneService — 克隆并发控制（后续迁移至此）
 */
export class Semaphore {
    private count = 0;
    private readonly waitQueue: Array<() => void> = [];

    constructor(private readonly maxConcurrent: number) {
        if (maxConcurrent < 1) {
            throw new Error('Semaphore maxConcurrent must be >= 1');
        }
    }

    /**
     * 获取信号量许可。
     *
     * 若当前并发数未达上限则立即放行，否则加入等待队列。
     * 返回 Promise，调用方需 await 等待可用许可。
     */
    acquire(): Promise<void> {
        return new Promise((resolve) => {
            if (this.count < this.maxConcurrent) {
                this.count++;
                resolve();
            } else {
                this.waitQueue.push(() => {
                    this.count++;
                    resolve();
                });
            }
        });
    }

    /**
     * 释放信号量许可。
     *
     * 递减并发计数，并安全唤醒队列中第一个等待的任务。
     * 使用 queueMicrotask 避免回调异常影响后续流程。
     */
    release(): void {
        if (this.count > 0) {
            this.count--;
        }
        const next = this.waitQueue.shift();
        if (next) queueMicrotask(next);
    }

    /** 当前并发数 */
    get currentCount(): number {
        return this.count;
    }

    /** 等待队列长度 */
    get waitingCount(): number {
        return this.waitQueue.length;
    }

    /**
     * 执行带并发控制的任务。
     *
     * 自动 acquire → 执行任务 → release，确保异常安全。
     *
     * @param fn 要执行的任务函数
     * @returns 任务返回值
     */
    async run<T>(fn: () => Promise<T>): Promise<T> {
        await this.acquire();
        try {
            return await fn();
        } finally {
            this.release();
        }
    }
}
