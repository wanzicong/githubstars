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
 * 使用 Claude Agent SDK 自动分析仓库并建议标签。
 * 与 AgentSimilarService 共用相同的 Agent SDK 架构（SSE 流式 + MCP 工具 + WebSearch/WebFetch）。
 *
 * 核心流程：
 * 1. 获取源仓库信息 + 现有标签体系
 * 2. 构建 Prompt（包含标签体系说明和打标签规则）
 * 3. 注入自定义 MCP 工具（查询本地标签、查询仓库数据库）
 * 4. 启动 Agent SDK query() 流式执行
 * 5. Agent 自主使用 WebSearch 了解项目 + 判断应打哪些标签
 * 6. 返回 JSON 结果 → 保存到数据库
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

        // ── 第一步：获取仓库信息 ──
        const repos = await this.prisma.githubRepo.findMany({
            where: { id: { in: repoIds.map((id) => BigInt(id)) } },
            select: {
                id: true,
                fullName: true,
                repoName: true,
                description: true,
                descriptionCn: true,
                language: true,
                topics: true,
                starsCount: true,
                ownerName: true,
                htmlUrl: true,
                homepage: true,
                readmeCn: true,
                readmeOriginal: true,
            },
        });

        if (!repos.length) {
            yield { type: 'error', message: '未找到匹配仓库' };
            return;
        }

        yield { type: 'status', message: `已加载 ${repos.length} 个仓库，正在分析...` };

        // ── 第二步：获取现有标签体系 ──
        const tagGroups = await this.tagService.listAll();
        const tagSystem = tagGroups
            .map((g) => `## ${(g as any).icon || '📌'} ${g.name}\n${(g as any).tags.map((t: any) => `- ${t.name}`).join('\n')}`)
            .join('\n\n');

        yield { type: 'status', message: `标签体系已加载，共 ${tagGroups.reduce((s: number, g: any) => s + g.tags.length, 0)} 个标签` };

        // ── 第三步：创建 MCP 工具 ──
        const prisma = this.prisma;

        const searchTagsTool = tool(
            'search_tags',
            '搜索现有标签体系中的标签。支持按关键词模糊匹配。用于在建议标签前检查是否已有相似标签可以复用。',
            { keyword: z.string().describe('搜索关键词') },
            async ({ keyword }) => {
                try {
                    const tags = await prisma.tag.findMany({
                        where: { name: { contains: keyword } },
                        include: { group: true },
                        take: 20,
                        orderBy: { repoCount: 'desc' },
                    });
                    if (!tags.length) return { content: [{ type: 'text' as const, text: '未找到匹配标签。' }] };
                    const result = tags.map((t) => `${t.name} [${t.group.name}] (${t.repoCount}个仓库)`);
                    return { content: [{ type: 'text' as const, text: result.join('\n') }] };
                } catch (e) {
                    return { content: [{ type: 'text' as const, text: '搜索失败: ' + (e instanceof Error ? e.message : String(e)) }] };
                }
            },
        );

        const mcpServer = createSdkMcpServer({
            name: 'githubstars-tag',
            version: '1.0.0',
            tools: [searchTagsTool],
        });

        // ── 第四步：构建 Prompt ──
        const repoList = repos
            .map(
                (r, i) =>
                    `${i}. **${r.fullName}**\n   语言: ${r.language || '未知'} | Stars: ${r.starsCount}\n   描述: ${r.descriptionCn || r.description || '无'}\n   Topics: ${r.topics || '无'}`,
            )
            .join('\n\n');

        const prompt = `你是一位资深的 GitHub 项目分类专家。请为以下 ${repos.length} 个 GitHub 开源项目自动打上合适的标签。

## 现有标签体系

${tagSystem}

## 待分析项目

${repoList}

## 你的任务

### 第一步：逐项目分析
对每个项目，基于名称、描述、语言、Topics、homepage 等信息，判断它属于哪些标签。
如果项目信息不足，可使用 WebSearch 工具搜索项目了解更多。

### 第二步：选择标签
优先从现有标签体系中选择匹配的标签。
如果没有合适的标签，可以建议创建新标签（但标记为 new）。

### 第三步：输出 JSON 结果
只返回 JSON 格式（不要 markdown 代码块）：

\`\`\`
{
  "项目序号": ["标签名1", "标签名2", ...],
  ...
}
\`\`\`

每个项目至少打 2 个标签，至多 6 个。标签应覆盖技术栈、领域、用途等不同维度。

【重要】直接开始分析，用中文输出，不说开头语和结尾语。`;

        yield { type: 'status', message: 'Agent 正在分析项目特征并匹配标签...' };

        // ── 第五步：启动 Agent SDK ──
        const abortController = new AbortController();
        const onAbort = () => abortController.abort();
        signal.addEventListener('abort', onAbort, { once: true });

        try {
            const q = query({
                prompt,
                options: {
                    allowedTools: ['WebSearch', 'WebFetch'],
                    mcpServers: { githubstars: mcpServer },
                    permissionMode: 'bypassPermissions',
                    allowDangerouslySkipPermissions: true,
                    maxTurns: 10,
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
                            const parsed = this.parseTagResult(fullResult, repos.map((r) => Number(r.id)));
                            if (parsed && Object.keys(parsed).length > 0) {
                                await this.tagService.saveAiTagResult(
                                    repos.map((r) => Number(r.id)),
                                    parsed,
                                );
                                yield {
                                    type: 'result',
                                    content: `AI 自动标签完成！共为 ${repos.length} 个仓库打了 ${Object.values(parsed).flat().length} 个标签。`,
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
