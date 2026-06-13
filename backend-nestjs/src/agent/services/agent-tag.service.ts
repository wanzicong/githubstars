import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TagService } from '../../tag/tag.service';
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

export interface AgentTagStreamEvent {
    type: 'status' | 'thinking' | 'tool_call' | 'tool_result' | 'result' | 'error';
    message?: string;
    content?: string;
    toolName?: string;
    toolInput?: Record<string, unknown>;
}

/**
 * Agent 智能标签服务
 *
 * 使用 Claude Agent SDK 自动分析仓库并打标签。
 * **核心思路：MCP 本地数据库查询替代 WebSearch**——
 * 分类任务需要的所有信息（描述/README/语言/Topics）已在数据库中，
 * Agent 通过 MCP 工具直接读取，毫秒级响应，零外部 Token 消耗。
 *
 * 核心流程：
 * 1. 加载标签体系 + 仓库索引列表
 * 2. 注入 MCP 工具（get_repo_details / search_tags）
 * 3. Agent 通过 MCP 逐项目读取详情 → 判断标签
 * 4. JSON 结果 → 保存到数据库
 */
@Injectable()
export class AgentTagService {
    private readonly logger = new Logger(AgentTagService.name);

    constructor(private readonly prisma: PrismaService, private readonly tagService: TagService) {}

    /**
     * 流式执行智能标签分析
     */
    async *streamAutoTag(repoIds: number[], signal: AbortSignal): AsyncGenerator<AgentTagStreamEvent> {
        if (!repoIds.length) {
            yield { type: 'error', message: '请提供仓库ID列表' };
            return;
        }

        // ── 第一步：获取仓库索引 + 标签体系（只加载一次）──
        const allRepos = await this.prisma.githubRepo.findMany({
            where: { id: { in: repoIds.map((id) => BigInt(id)) } },
            select: { id: true, fullName: true, language: true, starsCount: true },
            orderBy: { starsCount: 'desc' },
        });

        if (!allRepos.length) {
            yield { type: 'error', message: '未找到匹配仓库' };
            return;
        }

        const tagGroups = await this.tagService.listAll();
        const tagSystem = tagGroups
            .map((g) => `## ${(g as any).icon || '📌'} ${g.name}\n${(g as any).tags.map((t: any) => `- ${t.name}`).join('\n')}`)
            .join('\n\n');

        const totalTags = tagGroups.reduce((s: number, g: any) => s + g.tags.length, 0);
        yield { type: 'status', message: `已加载 ${allRepos.length} 个仓库 + ${totalTags} 个标签` };

        // ── 第二步：分批处理（每批 25 个，避免 maxTurns 超限）──
        const BATCH_SIZE = 25;
        const batches: Array<typeof allRepos> = [];
        for (let i = 0; i < allRepos.length; i += BATCH_SIZE) {
            batches.push(allRepos.slice(i, i + BATCH_SIZE));
        }

        let totalTagCount = 0;
        for (let bi = 0; bi < batches.length; bi++) {
            if (signal.aborted) break;
            const batch = batches[bi];
            yield { type: 'status', message: `处理第 ${bi + 1}/${batches.length} 批 (${batch.length} 个仓库)...` };

            const result = yield* this.processBatch(batch, tagSystem, signal);
            if (result) {
                totalTagCount += result;
                yield { type: 'status', message: `第 ${bi + 1} 批完成，${result} 个标签` };
            }
        }

        yield { type: 'result', content: `全部完成！共 ${allRepos.length} 个仓库，${totalTagCount} 个标签` };
    }

    /** 处理单批仓库的 Agent 打标签 */
    private async *processBatch(
        repoIndex: Array<{ id: bigint; fullName: string | null; language: string | null; starsCount: number }>,
        tagSystem: string,
        signal: AbortSignal,
    ): AsyncGenerator<AgentTagStreamEvent, number | null> {
        let tagCount = 0;
        // ── 创建 MCP 工具 ──
        const prisma = this.prisma;

        // MCP 工具 1: 获取仓库详情（描述/README/Topics/首页/许可证）
        const getRepoDetailsTool = tool(
            'get_repo_details',
            '获取指定仓库的详细信息，包括描述、中文翻译、README摘要、Topics标签、语言、项目主页、许可证等。' +
                '用于深入了解项目功能以便准确打标签。一次可查询多个仓库。',
            {
                repoIds: z.array(z.number()).describe('仓库 ID 列表，如 [1, 5, 10]'),
            },
            async ({ repoIds: ids }) => {
                try {
                    const repos = await prisma.githubRepo.findMany({
                        where: { id: { in: ids.map((id) => BigInt(id)) } },
                        select: {
                            id: true,
                            fullName: true,
                            description: true,
                            descriptionCn: true,
                            language: true,
                            topics: true,
                            starsCount: true,
                            forksCount: true,
                            ownerName: true,
                            homepage: true,
                            licenseName: true,
                            readmeCn: true,
                        },
                    });
                    const result = repos.map((r) => ({
                        id: Number(r.id),
                        fullName: r.fullName,
                        language: r.language,
                        stars: r.starsCount,
                        forks: r.forksCount,
                        owner: r.ownerName,
                        description: r.descriptionCn || r.description || '无',
                        topics: r.topics ? JSON.parse(r.topics) : [],
                        homepage: r.homepage || '无',
                        license: r.licenseName || '无',
                        readmeSummary: (r.readmeCn || '').substring(0, 500) || '无 README',
                    }));
                    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
                } catch (e) {
                    return { content: [{ type: 'text' as const, text: '查询失败: ' + (e instanceof Error ? e.message : String(e)) }] };
                }
            },
        );

        // MCP 工具 2: 搜索现有标签
        const searchTagsTool = tool(
            'search_tags',
            '搜索现有标签体系中的标签。支持按关键词模糊匹配。用于在建议标签前检查是否已有相似标签可以复用。',
            { keyword: z.string().describe('搜索关键词，如 "machine learning"') },
            async ({ keyword }) => {
                try {
                    const tags = await prisma.tag.findMany({
                        where: { name: { contains: keyword } },
                        include: { group: true },
                        take: 20,
                        orderBy: { repoCount: 'desc' },
                    });
                    if (!tags.length) return { content: [{ type: 'text' as const, text: '未找到匹配标签，可创建新标签。' }] };
                    const result = tags.map((t) => `${t.name} [维度:${t.group.name}] (${t.repoCount}个仓库)`);
                    return { content: [{ type: 'text' as const, text: result.join('\n') }] };
                } catch (e) {
                    return { content: [{ type: 'text' as const, text: '搜索失败: ' + (e instanceof Error ? e.message : String(e)) }] };
                }
            },
        );

        const mcpServer = createSdkMcpServer({
            name: 'githubstars-tag',
            version: '2.0.0',
            tools: [getRepoDetailsTool, searchTagsTool],
        });

        // ── 第四步：构建 Prompt ──
        const repoIndexText = repoIndex
            .map((r, i) => `${i}. ${r.fullName} (${r.language || '?'}, ⭐${r.starsCount}) [ID:${r.id}]`)
            .join('\n');

        const prompt = `你是 GitHub 项目分类专家。为以下 ${repoIndex.length} 个项目打标签（2-6个/项目）。

## 工具
- get_repo_details(ids): 批量获取项目描述/README/Topics/语言
- search_tags(keyword): 搜索现有标签

## 标签体系
${tagSystem}

## 项目列表
${repoIndexText}

## 规则
1. 用 get_repo_details 一次获取全部项目详情
2. 优先匹配现有标签，无匹配时才创建新标签（用中文命名，简洁准确）
3. 标签覆盖多维度：技术栈、领域、用途
4. 只输出 JSON：{"0":["标签1"],"1":["标签2"]}  (0~${repoIndex.length - 1})
5. 不输出任何其他文字`;

        yield { type: 'status', message: 'Agent 开始通过 MCP 本地数据库分析项目...' };

        // ── 第五步：启动 Agent SDK（纯 MCP 模式，不访问外网）──
        const abortController = new AbortController();
        const onAbort = () => abortController.abort();
        signal.addEventListener('abort', onAbort, { once: true });

        try {
            const q = query({
                prompt,
                options: {
                    allowedTools: [], // 只允许 MCP 工具，禁止文件/网络
                    mcpServers: { githubstars: mcpServer },
                    permissionMode: 'bypassPermissions',
                    allowDangerouslySkipPermissions: true,
                    maxTurns: 15,
                    model: 'sonnet',
                    abortController,
                },
            });

            let fullResult = '';

            for await (const msg of q) {
                if (signal.aborted) break;

                switch (msg.type) {
                    case 'assistant':
                        if (msg.message?.content) {
                            for (const block of msg.message.content) {
                                if (block.type === 'text' && 'text' in block) {
                                    const text = block.text as string;
                                    fullResult += text;
                                    yield { type: 'thinking', content: text };
                                } else if (block.type === 'tool_use') {
                                    yield {
                                        type: 'tool_call',
                                        toolName: (block as any).name,
                                        toolInput: (block as any).input,
                                    };
                                }
                            }
                        }
                        break;
                    case 'user':
                        if ((msg as any).tool_use_result) {
                            yield { type: 'tool_result', message: '工具执行完成' };
                        }
                        break;
                    case 'result':
                        if (msg.subtype === 'success') {
                            yield {
                                type: 'status',
                                message: `分析完成，耗时 ${(msg.duration_ms / 1000).toFixed(1)} 秒`,
                            };
                            // 解析并保存结果
                            const parsed = this.parseTagResult(fullResult, repoIndex.map((r) => Number(r.id)));
                            if (parsed && Object.keys(parsed).length > 0) {
                                await this.tagService.saveAiTagResult(
                                    repoIndex.map((r) => Number(r.id)),
                                    parsed,
                                );
                                tagCount = Object.values(parsed).flat().length;
                                yield {
                                    type: 'result',
                                    content: `自动标签完成！${repoIndex.length} 个仓库 → ${tagCount} 个标签`,
                                };
                            } else {
                                yield { type: 'error', message: '未能解析标签结果' };
                            }
                        } else {
                            yield { type: 'error', message: `Agent 执行异常: ${msg.subtype}` };
                        }
                        break;
                }
            }
        } catch (e) {
            if (!signal.aborted) {
                const errMsg = e instanceof Error ? e.message : String(e);
                this.logger.error('Agent 标签分析异常', errMsg);
                yield { type: 'error', message: `Agent 分析失败: ${errMsg}` };
            }
        } finally {
            signal.removeEventListener('abort', onAbort);
        }
        return tagCount;
    }

    /** 从 Agent 输出中提取 JSON 结果 */
    private parseTagResult(text: string, repoIds: number[]): Record<string, string[]> | null {
        try {
            // 尝试从文本中提取 JSON 块
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return null;
            const parsed = JSON.parse(jsonMatch[0]);
            // 将索引映射为实际仓库 ID
            const result: Record<string, string[]> = {};
            for (const [key, tags] of Object.entries(parsed)) {
                const idx = parseInt(key, 10);
                if (!isNaN(idx) && idx >= 0 && idx < repoIds.length && Array.isArray(tags)) {
                    result[String(idx)] = tags.filter((t: any) => typeof t === 'string') as string[];
                }
            }
            return Object.keys(result).length > 0 ? result : null;
        } catch {
            this.logger.error('标签JSON解析失败');
            return null;
        }
    }
}
