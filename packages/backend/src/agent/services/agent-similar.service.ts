import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

/**
 * Agent 流式事件类型
 *
 * 用于 SSE 推送，前端根据 type 渲染不同的 UI 组件：
 * - status: 状态更新（启动中、分析中、完成等）
 * - thinking: Agent 的推理文本流
 * - tool_call: Agent 正在调用某个工具
 * - result: 最终结果（包含完整的推荐报告）
 * - error: 错误信息
 */
export interface AgentStreamEvent {
    type: 'status' | 'thinking' | 'tool_call' | 'tool_result' | 'result' | 'error';
    message?: string;
    content?: string;
    toolName?: string;
    toolInput?: Record<string, unknown>;
}

/**
 * Agent 相似项目搜索服务
 *
 * 使用 Claude Agent SDK 替代原有的 DeepSeek + GitHub Search API 组合方案。
 * Agent 自主使用 WebSearch / WebFetch 工具搜索互联网上的相似开源项目，
 * 并通过自定义 MCP 工具查询本地数据库中的仓库信息作为上下文辅助。
 *
 * 核心流程：
 * 1. 从数据库获取源仓库信息
 * 2. 构建包含源仓库信息的 Prompt
 * 3. 创建自定义 MCP 工具（查询本地仓库数据库）
 * 4. 启动 Agent SDK query() 流式执行
 * 5. 将 SDK 消息转换为 AgentStreamEvent 供 SSE 推送
 *
 * @see https://code.claude.com/docs/en/agent-sdk/overview
 */
@Injectable()
export class AgentSimilarService {
    private readonly logger = new Logger(AgentSimilarService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * 流式执行相似项目搜索
     *
     * 使用 AsyncGenerator 逐条产出 Agent 的执行事件，
     * 供 Controller 层通过 SSE 推送到前端。
     *
     * @param repoId 源仓库 ID
     * @param signal 用于客户端断开时中止 Agent 执行的信号
     * @yields AgentStreamEvent 流式事件
     */
    async *streamSimilarSearch(repoId: number, signal: AbortSignal): AsyncGenerator<AgentStreamEvent> {
        // ── 第一步：查询源仓库信息 ──
        const repo = await this.prisma.githubRepo.findUnique({
            where: { id: repoId },
            select: {
                fullName: true,
                description: true,
                descriptionCn: true,
                language: true,
                topics: true,
                starsCount: true,
                forksCount: true,
                ownerName: true,
                htmlUrl: true,
                homepage: true,
                licenseName: true,
                readmeCn: true,
                readmeOriginal: true,
            },
        });

        if (!repo) {
            yield { type: 'error', message: '仓库未找到' };
            return;
        }

        yield { type: 'status', message: `正在分析 ${repo.fullName} 的项目特征...` };

        // ── 第二步：创建自定义 MCP 工具 ──
        // 该工具让 Agent 可以查询用户已 Star 的本地仓库数据库，
        // 用于发现用户收藏中已有的相似项目，避免重复推荐。
        const prisma = this.prisma; // 闭包捕获

        const searchUserReposTool = tool(
            'search_user_repos',
            '在用户已 Star 的 GitHub 仓库数据库中搜索。支持按关键词模糊匹配仓库名/描述/全名。' +
                '用于检查用户是否已收藏过与候选项目相似的仓库，避免重复推荐。',
            { keyword: z.string().describe('搜索关键词，如 "react state management"') },
            async ({ keyword }) => {
                try {
                    const repos = await prisma.githubRepo.findMany({
                        where: {
                            OR: [
                                { fullName: { contains: keyword } },
                                { description: { contains: keyword } },
                                { descriptionCn: { contains: keyword } },
                                { repoName: { contains: keyword } },
                            ],
                        },
                        select: {
                            fullName: true,
                            description: true,
                            descriptionCn: true,
                            language: true,
                            starsCount: true,
                            topics: true,
                            htmlUrl: true,
                        },
                        take: 10,
                        orderBy: { starsCount: 'desc' },
                    });
                    if (!repos.length) {
                        return {
                            content: [{ type: 'text' as const, text: '未在本地数据库中找到匹配的仓库。' }],
                        };
                    }
                    const result = repos.map((r) => ({
                        fullName: r.fullName,
                        description: r.descriptionCn || r.description || '',
                        language: r.language,
                        starsCount: r.starsCount,
                        topics: r.topics,
                        htmlUrl: r.htmlUrl,
                    }));
                    return {
                        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
                    };
                } catch (e) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: '数据库查询出错: ' + (e instanceof Error ? e.message : String(e)),
                            },
                        ],
                    };
                }
            },
        );

        const mcpServer = createSdkMcpServer({
            name: 'githubstars',
            version: '1.0.0',
            tools: [searchUserReposTool],
        });

        // ── 第三步：构建 Agent Prompt ──
        const prompt = this.buildPrompt(repo);

        // ── 第四步：启动 Agent SDK ──
        const abortController = new AbortController();
        const onAbort = () => abortController.abort();
        signal.addEventListener('abort', onAbort, { once: true });

        yield { type: 'status', message: 'Agent 正在搜索相似项目（使用 WebSearch + WebFetch）...' };

        const q = query({
            prompt,
            options: {
                // 只允许 Agent 使用搜索类工具，不允许文件操作
                allowedTools: ['WebSearch', 'WebFetch'],
                // 注入自定义 MCP 工具
                mcpServers: { githubstars: mcpServer },
                // 非交互环境，跳过所有权限检查
                permissionMode: 'bypassPermissions',
                allowDangerouslySkipPermissions: true,
                // 限制最大轮次，避免无限循环
                maxTurns: 15,
                // 使用 Sonnet 模型（速度快、成本低）
                model: 'sonnet',
                // 不显式设置 settingSources，使用默认值（user + project + local）
                // 这样 ~/.claude/settings.json 中的 ANTHROPIC_AUTH_TOKEN 等配置会自动加载
                // 支持中断
                abortController,
            },
        });

        // ── 第五步：流式输出消息 ──
        try {
            for await (const msg of q) {
                if (signal.aborted) break;

                switch (msg.type) {
                    case 'assistant':
                        // 处理 Assistant 消息中的内容块
                        if (msg.message?.content) {
                            for (const block of msg.message.content) {
                                if (block.type === 'text' && 'text' in block) {
                                    yield {
                                        type: 'thinking',
                                        content: block.text as string,
                                    };
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
                        // user 消息通常是工具执行结果，可以透传
                        if ((msg as any).tool_use_result) {
                            yield { type: 'tool_result', message: '工具执行完成' };
                        }
                        break;

                    case 'result':
                        if (msg.subtype === 'success') {
                            yield {
                                type: 'result',
                                content: msg.result,
                            };
                            yield {
                                type: 'status',
                                message: `搜索完成，耗时 ${(msg.duration_ms / 1000).toFixed(1)} 秒，共 ${msg.num_turns} 轮`,
                            };
                        } else {
                            yield {
                                type: 'error',
                                message: `Agent 执行异常: ${msg.subtype}`,
                            };
                        }
                        break;

                    default:
                        // 忽略其他消息类型（system, partial 等）
                        break;
                }
            }
        } catch (e) {
            if (!signal.aborted) {
                const errMsg = e instanceof Error ? e.message : String(e);
                this.logger.error('Agent 搜索异常', errMsg);
                yield { type: 'error', message: `Agent 搜索失败: ${errMsg}` };
            }
        } finally {
            signal.removeEventListener('abort', onAbort);
        }
    }

    /**
     * 构建 Agent 的初始提示词
     *
     * 包含源仓库的完整信息和明确的搜索指令。
     * Agent 会基于这些信息自主决定搜索策略。
     */
    private buildPrompt(repo: {
        fullName: string | null;
        description: string | null;
        descriptionCn: string | null;
        language: string | null;
        topics: string | null;
        starsCount: number;
        forksCount: number;
        ownerName: string | null;
        htmlUrl: string | null;
        homepage: string | null;
        licenseName: string | null;
        readmeCn: string | null;
        readmeOriginal: string | null;
    }): string {
        const desc = repo.descriptionCn || repo.description || '无';
        const lang = repo.language || '未知';
        const topics = repo.topics || '无';
        const readme = (repo.readmeCn || repo.readmeOriginal || '').substring(0, 800);

        return `你是一位资深的 GitHub 开源项目推荐专家。用户正在使用 GitHub Stars 管理系统管理自己 Star 过的项目，现在希望找到与以下项目相似的其他开源项目。

## 源项目信息

- **项目全名**: ${repo.fullName}
- **描述**: ${desc}
- **编程语言**: ${lang}
- **主题标签**: ${topics}
- **Star 数**: ${repo.starsCount}
- **Fork 数**: ${repo.forksCount}
- **所有者**: ${repo.ownerName}
- **许可证**: ${repo.licenseName || '未知'}
- **项目主页**: ${repo.homepage || '无'}
- **README 摘要**: ${readme || '无'}

## 你的任务

请执行以下步骤：

### 第一步：分析项目特征
基于源项目的信息，总结该项目解决了什么问题、使用什么技术栈、属于哪个应用领域。

### 第二步：搜索相似项目
使用 WebSearch 工具在互联网上搜索功能相似或技术栈相近的 GitHub 开源项目。
- 尝试多种搜索策略：按功能关键词、按技术栈、按应用场景
- 用英文关键词搜索（GitHub 项目以英文为主）
- 建议搜索格式："<关键词> github similar to <项目名>" 或 "github <技术栈> <应用场景> alternatives"

### 第三步：深入了解候选项目
对找到的候选项目，使用 WebFetch 工具访问其 GitHub 页面，了解：
- 项目的实际功能和特色
- Star 数、最近更新时间
- 与源项目的相似点和差异点

### 第四步：去重检查
使用 search_user_repos 工具检查候选项目是否已在用户的 Star 收藏中，如果已存在则标记为"已收藏"。

### 第五步：输出推荐报告
最终输出格式：

## 📊 项目特征分析
（简要总结源项目的核心特征）

## 🔍 相似项目推荐

对每个推荐项目：
### N. 项目名称
- **GitHub**: https://github.com/xxx/xxx
- **相似度**: ⭐⭐⭐⭐⭐ (5星制)
- **Stars**: xxx | **语言**: xxx
- **相似原因**: (30-50字说明为什么相似)
- **差异点**: (与源项目的主要区别)
- **推荐理由**: (一句话推荐)
- **状态**: 已收藏 / 未收藏

## 📝 总结
（一句话总结推荐）

## 筛选标准
- 优先推荐 Star > 100 的活跃项目
- 优先推荐最近一年内有更新的项目
- 尽量覆盖不同类型的替代方案（轻量级 vs 全功能、同语言 vs 跨语言等）
- 目标推荐数量: 5-10 个

【重要】请直接开始分析搜索，用中文输出，不要加开头语（如"好的"）或结尾语。`;
    }
}
