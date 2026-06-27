import { Semaphore } from '../../src/common/utils/semaphore';

describe('Semaphore', () => {
    describe('constructor', () => {
        it('maxConcurrent=1 构建成功', () => {
            const s = new Semaphore(1);
            expect(s.currentCount).toBe(0);
            expect(s.waitingCount).toBe(0);
        });

        it('maxConcurrent=5 构建成功', () => {
            const s = new Semaphore(5);
            expect(s.currentCount).toBe(0);
        });

        it('maxConcurrent<1 抛出异常', () => {
            expect(() => new Semaphore(0)).toThrow('Semaphore maxConcurrent must be >= 1');
            expect(() => new Semaphore(-1)).toThrow('Semaphore maxConcurrent must be >= 1');
        });
    });

    describe('acquire / release', () => {
        it('并发未满时应立即获取许可', async () => {
            const s = new Semaphore(3);
            await s.acquire();
            expect(s.currentCount).toBe(1);
        });

        it('达到上限后应排队等待', async () => {
            const s = new Semaphore(2);
            await s.acquire();
            await s.acquire();
            expect(s.currentCount).toBe(2);

            // 第三个 acquire 会排队
            const p = s.acquire();
            expect(s.waitingCount).toBe(1);
            expect(s.currentCount).toBe(2);

            // release 后排队者被唤醒
            s.release();
            await p;
            expect(s.currentCount).toBe(2);
        });

        it('release 多余的调用不使计数变负', () => {
            const s = new Semaphore(2);
            s.release();
            s.release();
            expect(s.currentCount).toBe(0);
        });
    });

    describe('run', () => {
        it('应执行任务并自动释放许可', async () => {
            const s = new Semaphore(2);
            const result = await s.run(async () => 'done');
            expect(result).toBe('done');
            expect(s.currentCount).toBe(0);
        });

        it('异常时也应释放许可', async () => {
            const s = new Semaphore(2);
            await expect(
                s.run(async () => {
                    throw new Error('fail');
                }),
            ).rejects.toThrow('fail');
            expect(s.currentCount).toBe(0);
        });

        it('并发任务应受限制', async () => {
            const s = new Semaphore(1);
            let running = 0;
            let maxRunning = 0;

            const task = async () => {
                running++;
                maxRunning = Math.max(maxRunning, running);
                await new Promise((r) => setTimeout(r, 10));
                running--;
                return 'ok';
            };

            const results = await Promise.all([s.run(task), s.run(task), s.run(task)]);
            expect(maxRunning).toBe(1);
            expect(results).toEqual(['ok', 'ok', 'ok']);
        });
    });
});
