import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '../../config/config.service';

const MAX_REPOS = 30;

@Injectable()
export class AiAnalyzeService implements OnModuleInit {
    private readonly logger = new Logger(AiAnalyzeService.name);
    private counter = 0;

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) {}

    /**
     * 模块初始化 — 从数据库恢复 counter 计数器（避免应用重启后任务 ID 冲突）
     *
     * 查询最新的 analyze_ 前缀任务，从中解析序号并设置 counter。
     */
    async onModuleInit() {
        const latest = await this.prisma.aiAnalyzeTask.findFirst({
            where: { taskId: { startsWith: 'analyze_' } },
            orderBy: { createdAt: 'desc' },
            select: { taskId: true },
        });
        if (latest) {
            const match = latest.taskId.match(/analyze_(\d+)/);
            if (match) this.counter = parseInt(match[1], 10);
        }
    }

    /**
     * 根据筛选条件查询仓库列表（最多 {MAX_REPOS} 条）
     *
     * 支持按分类 ID、关键词、语言筛选，按 star 数 / fork 数 / starredAt 排序。
     *
     * @param params.keyword 关键词（模糊匹配仓库名、描述、所有者、全名）
     * @param params.language 编程语言（逗号分隔）
     * @param params.categoryIds 分类 ID（逗号分隔）
     * @param params.sortBy 排序字段（stars_count / forks_count / 其他）
     * @param params.sortOrder 排序方向（asc / desc）
     * @returns 匹配的仓库列表
     */
    private async queryRepos(params: { keyword?: string; language?: string; categoryIds?: string; sortBy?: string; sortOrder?: string }) {
        const AND: any[] = [];
        if (params.categoryIds) {
            const ids = params.categoryIds
                .split(',')
                .map(Number)
                .filter((n) => !isNaN(n))
                .map(BigInt);
            AND.push({ repoCategories: { some: { categoryId: { in: ids } } } });
        }
        if (params.keyword) {
            const kw = params.keyword;
            AND.push({
                OR: [
                    { repoName: { contains: kw } },
                    { description: { contains: kw } },
                    { ownerName: { contains: kw } },
                    { fullName: { contains: kw } },
                ],
            });
        }
        if (params.language) {
            const langs = params.language.split(',').filter(Boolean);
            if (langs.length) AND.push({ language: { in: langs } });
        }
        const where: any = AND.length ? { AND } : {};
        const sortField = params.sortBy === 'stars_count' ? 'starsCount' : params.sortBy === 'forks_count' ? 'forksCount' : 'starredAt';
        const sortDir = params.sortOrder === 'asc' ? 'asc' : 'desc';
        return this.prisma.githubRepo.findMany({ where, orderBy: { [sortField]: sortDir }, take: MAX_REPOS });
    }

    /**
     * 构建 AI 分析提示词
     *
     * 将仓库列表拼接为结构化文本，包含序号、名称、语言、star/fork 数、描述和 README 摘要。
     *
     * @param repos 仓库列表
     * @returns 分析提示词字符串
     */
    private buildAnalyzePrompt(repos: any[]) {
        let list = '';
        repos.forEach((r, i) => {
            const desc = String(r.descriptionCn || r.description || '').substring(0, 200);
            const readme = String(r.readmeCn || r.readmeOriginal || '').substring(0, 200);
            list += `${i + 1}. **${r.repoName || r.fullName}** (${r.language || '未知'}, ⭐${r.starsCount}, Fork:${r.forksCount})\n`;
            list += `   描述: ${desc}\n`;
            if (readme) list += `   README: ${readme}\n`;
            list += '\n';
        });
        return `请分析以下 GitHub 项目集合：

${list}

请输出结构化报告：1.总体概览 2.技术栈分析 3.应用场景分类 4.热门项目TOP5 5.趋势与洞察 6.总结建议

【重要】用中文输出，直接开始正文，不要加开头语（如"好的"）或结尾语（如"以上是分析"）。`;
    }

    /**
     * 调用 DeepSeek API 执行 AI 分析
     *
     * 从系统配置中读取 API Key、URL、模型名，发送 chat completions 请求。
     * 返回 AI 回复的文本内容，若失败则返回错误描述字符串。
     *
     * @param prompt 用户提示词
     * @returns AI 生成的文本内容，或错误描述（不为 null）
     */
    private async callDeepSeek(prompt: string): Promise<string | null> {
        const apiKey = await this.config.getValue('deepseek.api_key');
        const apiUrl = await this.config.getValueDefault('deepseek.api_url', 'https://api.deepseek.com/v1/chat/completions');
        const model = await this.config.getValueDefault('deepseek.model', 'deepseek-chat');
        if (!apiKey) return 'DeepSeek API Key 未配置';
        try {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model,
                    temperature: 0.3,
                    max_tokens: 32768,
                    messages: [
                        { role: 'system', content: '你是专业的代码分析师。' },
                        { role: 'user', content: prompt },
                    ],
                }),
            });
            if (!res.ok) return `AI 服务异常 (${res.status})`;
            const data = await res.json();
            return data.choices?.[0]?.message?.content?.trim() || null;
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.error('DeepSeek AI 分析调用失败: ' + msg);
            return msg.includes('timeout') ? '分析超时' : 'AI 异常: ' + msg;
        }
    }

    /**
     * 执行分析任务的内部方法（异步，不阻塞 API 响应）
     *
     * 流程：查询仓库 → 构建提示词 → 调用 DeepSeek → 更新任务结果。
     * 无论成功或失败，都会将任务状态更新为 COMPLETED。
     *
     * @param taskId 任务 ID
     * @param keyword 关键词筛选
     * @param language 语言筛选
     * @param categoryIds 分类筛选
     * @param sortBy 排序字段
     * @param sortOrder 排序方向
     */
    private async executeAnalyze(
        taskId: string,
        keyword: string,
        language: string,
        categoryIds: string,
        sortBy: string,
        sortOrder: string,
    ) {
        try {
            this.logger.log('分析任务开始: taskId=' + taskId);
            const repos = await this.queryRepos({ keyword, language, categoryIds, sortBy, sortOrder });
            if (!repos.length) {
                this.logger.log('分析任务完成（无数据）: taskId=' + taskId);
                await this.prisma.aiAnalyzeTask.update({
                    where: { taskId },
                    data: { status: 'COMPLETED', content: '没有找到任何项目', finishedAt: new Date() },
                });
                return;
            }
            const prompt = this.buildAnalyzePrompt(repos);
            const result = await this.callDeepSeek(prompt);
            await this.prisma.aiAnalyzeTask.update({
                where: { taskId },
                data: { status: 'COMPLETED', content: result || 'AI 返回空结果', finishedAt: new Date() },
            });
            this.logger.log('分析任务完成: taskId=' + taskId);
        } catch (e) {
            this.logger.error('分析任务执行异常: taskId=' + taskId + ', 错误=' + (e instanceof Error ? e.message : String(e)));
            await this.prisma.aiAnalyzeTask.update({
                where: { taskId },
                data: { status: 'COMPLETED', content: '分析失败: ' + (e instanceof Error ? e.message : String(e)), finishedAt: new Date() },
            });
        }
    }

    /**
     * 创建 AI 分析任务
     *
     * 创建一条 PROCESSING 状态的分析任务记录，然后异步执行分析（不阻塞 HTTP 响应）。
     *
     * @param keyword 关键词筛选
     * @param language 语言筛选
     * @param categoryIds 分类 ID 筛选
     * @param sortBy 排序字段
     * @param sortOrder 排序方向
     * @returns 任务 ID
     */
    async createAnalyzeTask(keyword: string, language: string, categoryIds: string, sortBy: string, sortOrder: string) {
        const taskId = 'analyze_' + ++this.counter;
        this.logger.log('创建分析任务: taskId=' + taskId);
        await this.prisma.aiAnalyzeTask.create({
            data: {
                taskId,
                type: 'analyze',
                status: 'PROCESSING',
                params: JSON.stringify({ keyword, language, categoryIds, sortBy, sortOrder }),
                createdAt: new Date(),
            },
        });
        this.executeAnalyze(taskId, keyword, language, categoryIds, sortBy, sortOrder).catch((e) =>
            this.logger.error('分析任务执行失败', e),
        );
        return taskId;
    }

    /**
     * 创建 Trending 趋势分析任务
     *
     * 对 GitHub Trending 爬取结果进行 AI 分析，生成趋势报告。
     * 若无数据则直接标记为 COMPLETED；否则异步执行分析。
     *
     * @param since 时间范围（daily / weekly / monthly）
     * @param language 语言筛选
     * @param repos Trending 仓库列表
     * @returns 任务 ID
     */
    async createTrendingAnalyzeTask(since: string, language: string, repos: any[]) {
        const taskId = 'trending_' + ++this.counter;
        const period = { daily: '今日', weekly: '本周', monthly: '本月' }[since] || since;
        this.logger.log('创建趋势分析任务: taskId=' + taskId + ', since=' + since + ', reposCount=' + repos.length);

        if (!repos.length) {
            await this.prisma.aiAnalyzeTask.create({
                data: { taskId, type: 'trending', status: 'COMPLETED', content: '暂无数据', createdAt: new Date(), finishedAt: new Date() },
            });
            return taskId;
        }

        await this.prisma.aiAnalyzeTask.create({
            data: {
                taskId,
                type: 'trending',
                status: 'PROCESSING',
                params: JSON.stringify({ since, language }),
                createdAt: new Date(),
            },
        });

        const list = repos
            .map((r: any, i: number) => `${i + 1}. **${r.fullName}** (⭐${r.starsCount}, ${r.language || '未知'})`)
            .join('\n');
        const prompt = `分析 GitHub ${period}趋势：\n\n${language ? '语言: ' + language + '\n' : ''}${list}\n\n分析热门方向、用途分类、最值得关注的3个项目、趋势洞察。\n\n【重要】直接开始正文，不要加开头语或结尾语。`;

        (async () => {
            try {
                const r = await this.callDeepSeek(prompt);
                await this.prisma.aiAnalyzeTask.update({
                    where: { taskId },
                    data: { status: 'COMPLETED', content: r || '分析失败', finishedAt: new Date() },
                });
                this.logger.log('趋势分析任务完成: taskId=' + taskId);
            } catch (e) {
                this.logger.error('趋势分析任务异常: taskId=' + taskId + ', 错误=' + (e instanceof Error ? e.message : String(e)));
                await this.prisma.aiAnalyzeTask.update({
                    where: { taskId },
                    data: { status: 'COMPLETED', content: '分析失败', finishedAt: new Date() },
                });
            }
        })().catch((e) => this.logger.error('趋势分析任务失败', e));

        return taskId;
    }

    /**
     * 查询任务状态（P0 FIX: 从数据库读取，非内存）
     *
     * @param taskId 任务 ID
     * @returns 任务状态信息，包含 status、content（完成时）等
     */
    async getTaskStatus(taskId: string) {
        const task = await this.prisma.aiAnalyzeTask.findUnique({ where: { taskId } });
        if (!task) return { success: false, taskId, status: 'NOT_FOUND' };
        return {
            success: true,
            taskId: task.taskId,
            status: task.status,
            content: task.status === 'COMPLETED' ? task.content : undefined,
        };
    }
}
