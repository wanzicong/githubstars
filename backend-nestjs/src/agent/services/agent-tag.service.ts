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
export interface RunningTask {
    taskId: string;
    repoCount: number;
    processedCount: number;
    currentBatch: number;
    totalBatches: number;
    status: string;
    startedAt: number;
}

@Injectable()
export class AgentTagService {
    private readonly logger = new Logger(AgentTagService.name);
    /** 运行中的分析任务注册表（内存级，用于刷新页面后恢复） */
    private readonly runningTasks = new Map<string, RunningTask>();

    constructor(private readonly prisma: PrismaService, private readonly tagService: TagService) {}

    /** 获取当前运行中的任务列表 */
    getRunningTasks(): RunningTask[] {
        return Array.from(this.runningTasks.values());
    }

    /**
     * 流式执行智能标签分析
     */
    async *streamAutoTag(repoIds: number[], signal: AbortSignal): AsyncGenerator<AgentTagStreamEvent> {
        const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        this.logger.log(`[${taskId}] 开始分析 ${repoIds.length} 个仓库`);
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

        // ── 第二步：分批处理（每批 50 个，3 批并发）──
        const BATCH_SIZE = 50;
        const CONCURRENCY = 3;
        const batches: Array<typeof allRepos> = [];
        for (let i = 0; i < allRepos.length; i += BATCH_SIZE) {
            batches.push(allRepos.slice(i, i + BATCH_SIZE));
        }

        // 注册运行任务
        const task: RunningTask = {
            taskId, repoCount: allRepos.length, processedCount: 0,
            currentBatch: 0, totalBatches: batches.length,
            status: '已加载仓库，启动并发分析...', startedAt: Date.now(),
        };
        this.runningTasks.set(taskId, task);
        yield { type: 'status', message: `[${taskId}] 共 ${batches.length} 批，每批 ${BATCH_SIZE} 个，${CONCURRENCY} 批并发` };

        // 将 generator 转为收集事件的 Promise
        const collectBatchEvents = async (batch: typeof allRepos, bi: number): Promise<{
            bi: number; events: AgentTagStreamEvent[]; result: { tagCount: number; error?: string };
        }> => {
            const events: AgentTagStreamEvent[] = [];
            try {
                const gen = this.processBatch(batch, tagSystem, signal);
                let resultValue: { tagCount: number; error?: string } = { tagCount: 0, error: '无结果' };
                while (true) {
                    const { value, done } = await gen.next();
                    if (done) { resultValue = value; break; }
                    if (value) events.push(value);
                }
                return { bi, events, result: resultValue ?? { tagCount: 0, error: '无结果' } };
            } catch (e: any) {
                return { bi, events, result: { tagCount: 0, error: e?.message || String(e) } };
            }
        };

        let totalTagCount = 0;
        let failedBatches = 0;
        // 按并发组执行
        for (let gi = 0; gi < batches.length; gi += CONCURRENCY) {
            if (signal.aborted) break;
            const group = batches.slice(gi, gi + CONCURRENCY);
            const startIdx = gi;
            yield { type: 'status', message: `━━━ 并发处理第 ${gi + 1}-${Math.min(gi + CONCURRENCY, batches.length)}/${batches.length} 批 ━━━` };

            task.currentBatch = gi + 1;
            task.processedCount = gi * BATCH_SIZE;
            task.status = `并发处理第 ${gi + 1} 组...`;

            const groupResults = await Promise.all(
                group.map((batch, i) => collectBatchEvents(batch, startIdx + i)),
            );

            for (const { bi, events, result } of groupResults) {
                // 输出该批的所有事件
                for (const e of events) yield e;
                // 输出结果
                if (result.tagCount > 0) {
                    totalTagCount += result.tagCount;
                    yield { type: 'status', message: `✅ 第 ${bi + 1} 批完成: ${result.tagCount} 个标签` };
                } else {
                    failedBatches++;
                    yield { type: 'status', message: `⚠️ 第 ${bi + 1} 批跳过: ${result.error || '无结果'}` };
                }
            }
        }

        if (signal.aborted) {
            task.status = '已中止';
        } else {
            task.processedCount = allRepos.length;
            task.status = '完成';
        }
        this.runningTasks.delete(taskId);

        const summary = `全部完成！${allRepos.length} 个仓库 → ${totalTagCount} 个标签` +
            (failedBatches > 0 ? `（${failedBatches} 批失败）` : '');
        yield { type: 'result', content: summary };
    }

    /** 处理单批仓库的 Agent 打标签，返回 { tagCount, error? } */
    private async *processBatch(
        repoIndex: Array<{ id: bigint; fullName: string | null; language: string | null; starsCount: number }>,
        tagSystem: string,
        signal: AbortSignal,
    ): AsyncGenerator<AgentTagStreamEvent, { tagCount: number; error?: string }> {
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

        const prompt = `你是 GitHub 项目分类专家。为以下 ${repoIndex.length} 个项目打标签（每个项目 2-6 个标签）。

⚠️ 你只有 2 个工具可用，不要尝试 Read/Write/Grep/WebSearch/ToolSearch 等其他工具。

## 工具
- get_repo_details(repoIds): 批量获取项目描述/README/Topics/语言，一次传入所有ID
- search_tags(keyword): 搜索现有标签，匹配后优先复用

## 现有标签体系（供 search_tags 查询）
${tagSystem}

## 标签维度（每个标签格式: "维度简称:标签名"，维度简称用下表左列）
| 维度简称 | 含义 | 标签示例 |
|---------|------|---------|
| 技术栈 | 编程语言、框架、运行时、数据库 | Python, React, Docker, PostgreSQL |
| 领域 | 应用领域、行业方向 | AI/ML, 安全, 金融, DevOps, 游戏 |
| 用途 | 项目类型/形态 | CLI工具, 库/SDK, Web应用, 桌面应用, 爬虫 |
| 状态 | 关注程度/使用状态 | 活跃关注, 学习参考, 已归档, 待评估 |
| 服务人群 | 目标用户群体 | 开发者, 企业, 个人用户, 学生 |
| 解决问题 | 项目解决的核心痛点 | 自动化, 数据分析, 效率提升, 可视化 |
| 生态 | 所属平台/生态系统 | GitHub生态, 微信生态, 云原生 |
| 自定义 | 以上都不匹配时兜底 | 任意 2-6 字中文标签 |

## 项目列表（索引从 0 起）
${repoIndexText}

## 规则
1. **先查后判**：用 get_repo_details 一次性获取全部项目详情
2. **优先复用**：用 search_tags 按关键词搜索已有标签，匹配则复用，避免创建语义重复标签
3. **维度必标**：每个标签格式为 "维度简称:标签名"，如 "技术栈:Python"、"领域:AI/ML"
4. **覆盖≥3个维度**：每个项目至少覆盖 技术栈 + 领域 + 用途，其余维度按实际情况选填
5. **信息不足时**：描述/README 为空的项目，仅根据语言、Topics、项目名判断，标签宁少勿滥
6. **同维度上限**：同一项目的同一维度下标签 ≤ 2 个，避免标签堆砌
7. **只输出 JSON**，其他文字一律不要：
\`\`\`
{"0":["技术栈:Python","领域:AI/ML","用途:库/SDK"],"1":["技术栈:Rust","领域:系统工具","用途:CLI工具"]}
\`\`\`
8. **自查清单**（输出前逐项确认）：每个项目≥3个维度？格式是"简称:名称"？维度简称在8个之中？无多余文字？`;

        yield { type: 'status', message: 'Agent 开始通过 MCP 本地数据库分析项目...' };

        // ── 第五步：启动 Agent SDK（纯 MCP 模式，不访问外网）──
        const abortController = new AbortController();
        const onAbort = () => abortController.abort();
        signal.addEventListener('abort', onAbort, { once: true });

        try {
            const q = query({
                prompt,
                options: {
                    tools: [], // 禁用所有内置工具（Read/Write/Grep/WebSearch 等），仅 MCP 工具可用
                    disallowedTools: ['Read', 'Write', 'Edit', 'Grep', 'Glob', 'WebSearch', 'WebFetch', 'Bash', 'Task', 'TaskOutput', 'TodoWrite', 'NotebookEdit', 'Agent', 'Skill', 'ExitPlanMode', 'EnterPlanMode'],
                    mcpServers: { githubstars: mcpServer },
                    permissionMode: 'bypassPermissions',
                    allowDangerouslySkipPermissions: true,
                    maxTurns: 30,
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
                            // 展示工具返回的内容详情
                            const result = (msg as any).tool_use_result;
                            let preview = '';
                            try {
                                if (result.content && Array.isArray(result.content)) {
                                    for (const c of result.content) {
                                        if (c.type === 'text' && c.text) {
                                            const text = String(c.text);
                                            preview += text.length > 300 ? text.substring(0, 300) + '...(截断)' : text;
                                        }
                                    }
                                }
                            } catch { preview = '(工具返回)'; }
                            yield {
                                type: 'tool_result',
                                message: preview || '工具执行完成',
                                content: preview || undefined,
                            };
                        }
                        break;
                    case 'result':
                        if (msg.subtype === 'success') {
                            yield {
                                type: 'status',
                                message: `Agent 分析完成，耗时 ${(msg.duration_ms / 1000).toFixed(1)} 秒，正在解析结果...`,
                            };
                            // 解析并保存结果
                            const parsed = this.parseTagResult(fullResult, repoIndex.map((r) => Number(r.id)));
                            if (parsed && Object.keys(parsed).length > 0) {
                                await this.tagService.saveAiTagResult(
                                    repoIndex.map((r) => Number(r.id)),
                                    parsed,
                                );
                                const tc = Object.values(parsed).flat().length;
                                yield {
                                    type: 'status',
                                    message: `✅ 批次完成: ${repoIndex.length} 个仓库 → ${tc} 个标签`,
                                };
                                return { tagCount: tc };
                            } else {
                                this.logger.warn(`JSON解析失败，Agent输出前200字符: ${fullResult.substring(0, 200)}`);
                                yield {
                                    type: 'status',
                                    message: `⚠️ JSON 解析失败，Agent 可能未按格式输出，跳过本批`,
                                };
                                return { tagCount: 0, error: 'JSON解析失败' };
                            }
                        } else {
                            this.logger.error(`Agent 执行异常: ${msg.subtype}`);
                            yield {
                                type: 'status',
                                message: `⚠️ Agent 执行异常: ${msg.subtype}，跳过本批`,
                            };
                            return { tagCount: 0, error: `Agent异常: ${msg.subtype}` };
                        }
                        break;
                }
            }
        } catch (e) {
            if (!signal.aborted) {
                const errMsg = e instanceof Error ? e.message : String(e);
                this.logger.error('Agent 标签分析异常', errMsg);
                yield { type: 'status', message: `⚠️ Agent 异常: ${errMsg}` };
                return { tagCount: 0, error: errMsg };
            }
        } finally {
            signal.removeEventListener('abort', onAbort);
        }
        return { tagCount: 0, error: '未知错误' };
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
