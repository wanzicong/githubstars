import { Test } from '@nestjs/testing';
import { SessionManagerService } from '../../src/agent/orchestration/session-manager.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('SessionManagerService', () => {
    let service: SessionManagerService;
    let prisma: any;

    const mockPrisma = {
        agentMessage: {
            create: jest.fn(),
            findMany: jest.fn(),
        },
        agentSession: {
            update: jest.fn(),
            findUnique: jest.fn(),
        },
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        const module = await Test.createTestingModule({
            providers: [
                SessionManagerService,
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();
        service = module.get(SessionManagerService);
        prisma = mockPrisma;
    });

    describe('appendUserMessage', () => {
        it('应创建用户消息并增加消息计数', async () => {
            await service.appendUserMessage(1, 'Hello');
            expect(prisma.agentMessage.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    sessionId: 1n,
                    role: 'user',
                    content: 'Hello',
                }),
            });
            expect(prisma.agentSession.update).toHaveBeenCalledWith({
                where: { id: 1n },
                data: { messageCount: { increment: 1 } },
            });
        });
    });

    describe('appendAssistantMessage', () => {
        it('应创建助手消息并增加计数和 token', async () => {
            await service.appendAssistantMessage(1, 'Hi there', 100);
            expect(prisma.agentMessage.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    sessionId: 1n,
                    role: 'assistant',
                    content: 'Hi there',
                    tokenCount: 100,
                }),
            });
            expect(prisma.agentSession.update).toHaveBeenCalledWith({
                where: { id: 1n },
                data: { messageCount: { increment: 1 }, tokenUsed: { increment: 100 } },
            });
        });

        it('无 token 时不增加 token 计数', async () => {
            await service.appendAssistantMessage(1, 'Ok');
            expect(prisma.agentSession.update).toHaveBeenCalledWith({
                where: { id: 1n },
                data: { messageCount: { increment: 1 }, tokenUsed: undefined },
            });
        });
    });

    describe('appendToolMessage', () => {
        it('应创建工具消息', async () => {
            await service.appendToolMessage(1, 'call-1', 'search', 'result');
            expect(prisma.agentMessage.create).toHaveBeenCalledWith({
                data: {
                    sessionId: 1n,
                    role: 'tool',
                    content: 'result',
                    toolCallId: 'call-1',
                    metadata: { toolName: 'search' },
                    createdAt: expect.any(Date),
                },
            });
        });
    });

    describe('getMessages', () => {
        it('应返回分页消息', async () => {
            prisma.agentMessage.findMany.mockResolvedValue([
                { id: 1n, role: 'user', content: 'Hi', toolCallId: null, tokenCount: null, createdAt: new Date() },
                { id: 2n, role: 'assistant', content: 'Hello', toolCallId: null, tokenCount: 50, createdAt: new Date() },
            ]);

            const msgs = await service.getMessages(1, 20);
            expect(msgs).toHaveLength(2);
            expect(msgs[0].id).toBe(1);
            expect(msgs[0].role).toBe('user');
        });
    });

    describe('getContextMessages', () => {
        it('应返回最近 N 条消息（正序）', async () => {
            // findMany 按 desc 排序返回，service 内部 reverse() 后应为正序
            prisma.agentMessage.findMany.mockResolvedValue([
                { role: 'assistant', content: 'A1' },
                { role: 'user', content: 'Q1' },
            ]);

            const msgs = await service.getContextMessages(1, 10);
            expect(msgs).toHaveLength(2);
            expect(msgs[0]).toEqual({ role: 'user', content: 'Q1' });
            expect(msgs[1]).toEqual({ role: 'assistant', content: 'A1' });
        });
    });

    describe('updateTitle', () => {
        it('应截断过长标题', async () => {
            const longTitle = 'a'.repeat(300);
            await service.updateTitle(1, longTitle);
            expect(prisma.agentSession.update).toHaveBeenCalledWith({
                where: { id: 1n },
                data: { title: 'a'.repeat(255) },
            });
        });
    });

    describe('getTokenUsage', () => {
        it('应返回 token 用量', async () => {
            prisma.agentSession.findUnique.mockResolvedValue({ tokenUsed: 500, messageCount: 10 });
            const usage = await service.getTokenUsage(1);
            expect(usage.totalTokens).toBe(500);
            expect(usage.messageCount).toBe(10);
        });

        it('会话不存在时应返回 0', async () => {
            prisma.agentSession.findUnique.mockResolvedValue(null);
            const usage = await service.getTokenUsage(99);
            expect(usage.totalTokens).toBe(0);
            expect(usage.messageCount).toBe(0);
        });
    });
});
