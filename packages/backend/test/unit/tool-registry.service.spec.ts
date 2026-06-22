import { ToolRegistryService } from '../../src/agent/tools/tool-registry.service';
import { ITool, ToolRiskLevel } from '../../src/agent/tools/tool.interface';

describe('ToolRegistryService', () => {
    let service: ToolRegistryService;

    function makeTool(name: string, overrides?: Partial<ITool>): ITool {
        return {
            name,
            displayName: `Display ${name}`,
            description: `Description for ${name}`,
            inputSchema: { type: 'object', properties: {} },
            source: 'builtin',
            riskLevel: ToolRiskLevel.LOW,
            execute: async () => `result-${name}`,
            ...overrides,
        };
    }

    beforeEach(() => {
        service = new ToolRegistryService();
    });

    describe('registerTool', () => {
        it('应注册新工具', () => {
            const tool = makeTool('test');
            service.registerTool(tool);
            expect(service.has('test')).toBe(true);
            expect(service.toolCount).toBe(1);
        });

        it('重复注册应抛出异常', () => {
            service.registerTool(makeTool('dup'));
            expect(() => service.registerTool(makeTool('dup'))).toThrow('already registered');
        });
    });

    describe('registerTools', () => {
        it('应批量注册工具', () => {
            service.registerTools([makeTool('a'), makeTool('b'), makeTool('c')]);
            expect(service.toolCount).toBe(3);
        });
    });

    describe('unregisterTool', () => {
        it('应注销已注册的工具', () => {
            service.registerTool(makeTool('temp'));
            expect(service.unregisterTool('temp')).toBe(true);
            expect(service.has('temp')).toBe(false);
        });

        it('注销不存在的工具应返回 false', () => {
            expect(service.unregisterTool('ghost')).toBe(false);
        });
    });

    describe('get', () => {
        it('应返回工具实例', () => {
            const tool = makeTool('query');
            service.registerTool(tool);
            expect(service.get('query')).toBe(tool);
        });

        it('不存在的工具应返回 undefined', () => {
            expect(service.get('nope')).toBeUndefined();
        });
    });

    describe('getAll', () => {
        it('应返回所有工具', () => {
            service.registerTools([makeTool('x'), makeTool('y')]);
            expect(service.getAll()).toHaveLength(2);
        });
    });

    describe('getToolList', () => {
        it('应返回简化工具列表', () => {
            service.registerTool(makeTool('api'));
            const list = service.getToolList();
            expect(list).toHaveLength(1);
            expect(list[0]).toMatchObject({ name: 'api', displayName: 'Display api', riskLevel: 'low', source: 'builtin' });
        });
    });

    describe('getSdkTools', () => {
        it('应返回 SDK 格式工具列表', () => {
            service.registerTool(makeTool('sdk'));
            const sdkTools = service.getSdkTools();
            expect(sdkTools).toHaveLength(1);
            expect(sdkTools[0]).toHaveProperty('name', 'sdk');
            expect(sdkTools[0]).toHaveProperty('inputSchema');
        });
    });

    describe('invoke', () => {
        it('应执行工具并返回结果', async () => {
            service.registerTool(makeTool('exec'));
            const result = await service.invoke('exec', {}, { taskId: 1 });
            expect(result).toBe('result-exec');
        });

        it('不存在的工具应抛出异常', async () => {
            await expect(
                service.invoke('unknown', {}, { taskId: 1 }),
            ).rejects.toThrow('Unknown tool: unknown');
        });

        it('工具抛出异常时应向上传递', async () => {
            service.registerTool(makeTool('failing', { execute: async () => { throw new Error('boom'); } }));
            await expect(
                service.invoke('failing', {}, { taskId: 1 }),
            ).rejects.toThrow('boom');
        });
    });
});
