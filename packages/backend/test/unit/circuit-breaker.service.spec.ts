import { CircuitBreakerService, CircuitState } from '../../src/agent/monitoring/circuit-breaker.service';

describe('CircuitBreakerService', () => {
    let service: CircuitBreakerService;

    beforeEach(() => {
        service = new CircuitBreakerService();
    });

    describe('register', () => {
        it('应注册新熔断器', () => {
            service.register('test-breaker');
            const status = service.getStatus();
            expect(status.find(s => s.name === 'test-breaker')).toBeDefined();
        });

        it('应支持自定义配置', () => {
            service.register('custom', { failureThreshold: 3, recoveryTimeoutMs: 10000 });
            // 注册后应出现在状态列表中
            const status = service.getStatus();
            expect(status.find(s => s.name === 'custom')).toBeDefined();
        });
    });

    describe('executeWithBreaker', () => {
        it('成功执行应返回结果', async () => {
            const result = await service.executeWithBreaker('test1', async () => 'success');
            expect(result).toBe('success');
        });

        it('自动注册未注册的熔断器', async () => {
            const result = await service.executeWithBreaker('auto-register', async () => 42);
            expect(result).toBe(42);
            expect(service.getStatus().find(s => s.name === 'auto-register')).toBeDefined();
        });

        it('连续成功应保持在 CLOSED 状态', async () => {
            for (let i = 0; i < 3; i++) {
                await service.executeWithBreaker('stable', async () => 'ok');
            }
            const status = service.getStatus().find(s => s.name === 'stable');
            expect(status?.state).toBe(CircuitState.CLOSED);
            expect(status?.failureCount).toBe(0);
        });

        it('连续失败超过阈值应触发 OPEN', async () => {
            const failFn = async () => { throw new Error('fail'); };

            for (let i = 0; i < 5; i++) {
                try { await service.executeWithBreaker('fragile', failFn); } catch {}
            }

            const status = service.getStatus().find(s => s.name === 'fragile');
            expect(status?.state).toBe(CircuitState.OPEN);
        });

        it('OPEN 状态应拒绝请求', async () => {
            service.register('open-test', { failureThreshold: 1, recoveryTimeoutMs: 60000 });

            try { await service.executeWithBreaker('open-test', async () => { throw new Error('fail'); }); } catch {}

            // 应该进入 OPEN 状态
            const status = service.getStatus().find(s => s.name === 'open-test');
            expect(status?.state).toBe(CircuitState.OPEN);

            // 再次调用应被拒绝
            await expect(
                service.executeWithBreaker('open-test', async () => 'should not run'),
            ).rejects.toThrow('Circuit breaker "open-test" is OPEN');
        });

        it('HALF_OPEN 成功后应恢复 CLOSED', async () => {
            // 使用极短的恢复超时
            service.register('recovery', { failureThreshold: 1, recoveryTimeoutMs: 1, halfOpenSuccessThreshold: 1 });

            try { await service.executeWithBreaker('recovery', async () => { throw new Error('fail'); }); } catch {}
            expect(service.getStatus().find(s => s.name === 'recovery')?.state).toBe(CircuitState.OPEN);

            // 等待超过 recoveryTimeout
            await new Promise(r => setTimeout(r, 10));

            // HALF_OPEN → 成功 → CLOSED
            const result = await service.executeWithBreaker('recovery', async () => 'recovered');
            expect(result).toBe('recovered');
            expect(service.getStatus().find(s => s.name === 'recovery')?.state).toBe(CircuitState.CLOSED);
        });

        it('HALF_OPEN 失败应回到 OPEN', async () => {
            service.register('half-fail', { failureThreshold: 1, recoveryTimeoutMs: 1, halfOpenSuccessThreshold: 2 });

            try { await service.executeWithBreaker('half-fail', async () => { throw new Error('fail'); }); } catch {}
            await new Promise(r => setTimeout(r, 10));

            // HALF_OPEN → 失败 → OPEN
            try {
                await service.executeWithBreaker('half-fail', async () => { throw new Error('fail again'); });
            } catch {}

            expect(service.getStatus().find(s => s.name === 'half-fail')?.state).toBe(CircuitState.OPEN);
        });
    });

    describe('reset', () => {
        it('应重置熔断器到 CLOSED 状态', () => {
            service.register('to-reset');
            service.reset('to-reset');
            const status = service.getStatus().find(s => s.name === 'to-reset');
            expect(status?.state).toBe(CircuitState.CLOSED);
            expect(status?.failureCount).toBe(0);
        });

        it('不存在的熔断器 reset 不应报错', () => {
            expect(() => service.reset('nonexistent')).not.toThrow();
        });
    });

    describe('getStatus', () => {
        it('应返回所有熔断器状态', () => {
            service.register('a');
            service.register('b');
            const status = service.getStatus();
            expect(status).toHaveLength(2);
            expect(status.every(s => 'name' in s && 'state' in s && 'failureCount' in s)).toBe(true);
        });

        it('空时应返回空数组', () => {
            const s = new CircuitBreakerService();
            expect(s.getStatus()).toEqual([]);
        });
    });
});
