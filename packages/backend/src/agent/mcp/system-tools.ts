import { z } from 'zod';
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { GithubRepoService } from '../../github/github-repo.service';
import { CategoryService } from '../../category/category.service';
import { StatsService } from '../../stats/stats.service';
import { CloneService } from '../../clone/clone.service';
import { DownloadService } from '../../download/download.service';
import { SyncService } from '../../sync/sync.service';
import { TrendingService } from '../../trending/trending.service';
import { AuthorService } from '../../author/author.service';
import { ConfigService } from '../../config/config.service';
import { ExportService } from '../../export/export.service';
import { LoggingService } from '../../logging/logging.service';
import { GithubSearchService } from '../../github/github-search.service';
import { RepositoryLocalizationService } from '../../localization/repository-localization.service';

/** 通用过滤器 shape（与 FilterSchema 对齐，但放宽必填约束供 Agent 灵活使用） */
const filterShape = {
    keyword: z.string().optional().describe('关键词搜索（仓库名/描述）'),
    language: z.string().optional().describe('编程语言筛选，如 TypeScript、Python'),
    sortBy: z.string().optional().describe('排序字段，如 stars_count、updated_at、created_at'),
    sortOrder: z.enum(['asc', 'desc']).optional().describe('排序方向'),
    dateField: z.string().optional().describe('日期字段，如 created_at、updated_at'),
    startDate: z.string().optional().describe('开始日期 YYYY-MM-DD'),
    endDate: z.string().optional().describe('结束日期 YYYY-MM-DD'),
    untranslatedOnly: z.boolean().optional().describe('仅显示未翻译的仓库'),
};

/** 分页 shape */
const paginationShape = {
    page: z.number().int().min(1).optional().describe('页码，默认 1'),
    size: z.number().int().min(1).max(100).optional().describe('每页数量，默认 12，最大 100'),
};

function ok(data: unknown) {
    return {
        content: [
            {
                type: 'text' as const,
                text: JSON.stringify(
                    data,
                    (_key: string, value: unknown): unknown => (typeof value === 'bigint' ? Number(value) : value),
                    2,
                ),
            },
        ],
    };
}

function err(message: string) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message }) }] };
}

/** README 字段截断长度（防止完整 README 灌进 Agent 上下文导致 token 爆炸） */
export const README_TRUNCATE_LENGTH = 8000;

/** 截断单个 README 文本，超长时截断并标注 */
function truncateReadmeText(text: string): string {
    if (text.length <= README_TRUNCATE_LENGTH) return text;
    return `${text.slice(0, README_TRUNCATE_LENGTH)}\n\n…（README 过长已截断，仅展示前 ${README_TRUNCATE_LENGTH} 字符）`;
}

/**
 * 截断仓库对象（或对象数组）的 README 字段，防止单点灌爆上下文。
 * 覆盖 DB 实际的 readmeOriginal / readmeCn，以及兼容别名 readme；其他字段原样保留。
 */
export function truncateRepoReadme<T>(input: T): T {
    if (Array.isArray(input)) {
        return input.map((item: unknown) => truncateRepoReadme(item)) as T;
    }
    if (input === null || typeof input !== 'object') return input;
    const record = input as Record<string, unknown>;
    const out: Record<string, unknown> = { ...record };
    for (const key of ['readme', 'readmeOriginal', 'readmeCn'] as const) {
        const value = record[key];
        if (typeof value === 'string') out[key] = truncateReadmeText(value);
    }
    return out as T;
}

/** 将 since 字符串映射为天数（与 trending.controller.ts 保持一致） */
function sinceToDays(since: string): number {
    if (since === 'weekly') return 7;
    if (since === 'monthly') return 30;
    return 1;
}

/** 构建 GitHub Search 查询字符串和日期范围（与 trending.controller.ts 保持一致） */
function buildTrendingQuery(since: string, language?: string): { query: string; dateStr: string } {
    const days = sinceToDays(since);
    const sinceDate = new Date(Date.now() - days * 86400000);
    const dateStr = sinceDate.toISOString().split('T')[0];
    let query = `created:>=${dateStr}`;
    if (language) query += ` language:${language}`;
    return { query, dateStr };
}

export interface SystemMcpDeps {
    githubRepo: GithubRepoService;
    category: CategoryService;
    stats: StatsService;
    clone: CloneService;
    download: DownloadService;
    sync: SyncService;
    trending: TrendingService;
    author: AuthorService;
    config: ConfigService;
    exportService: ExportService;
    logging: LoggingService;
    githubSearch: GithubSearchService;
    localization: RepositoryLocalizationService;
}

/**
 * 创建系统 MCP Server —— 将 GitHub Stars 管理系统的全部业务能力暴露给 Agent。
 *
 * 覆盖 11 个领域：stars / category / stats / clone / download /
 * sync / trending / author / config / export / logging。
 *
 * @callers AgentClientService.stream() — 每次 Agent 会话启动时挂载
 * @depends 各业务 Service（通过构造函数注入）
 */
export function createSystemMcpServer(deps: SystemMcpDeps) {
    const {
        githubRepo,
        category,
        stats,
        clone,
        download,
        sync,
        trending,
        author,
        config,
        exportService,
        logging,
        githubSearch,
        localization,
    } = deps;

    return createSdkMcpServer({
        name: 'system',
        version: '1.0.0',
        tools: [
            // ==================== Stars 星标仓库 ====================
            tool(
                'stars_list',
                '分页查询星标仓库列表，支持关键词/语言/日期/翻译状态筛选和排序',
                { ...paginationShape, ...filterShape },
                async (args) => {
                    try {
                        const result = await githubRepo.findPage({
                            page: args.page ?? 1,
                            size: args.size ?? 12,
                            keyword: args.keyword,
                            language: args.language,
                            sortBy: args.sortBy,
                            sortOrder: args.sortOrder,
                            dateField: args.dateField,
                            startDate: args.startDate,
                            endDate: args.endDate,
                            untranslatedOnly: args.untranslatedOnly,
                        });
                        return ok(result);
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool(
                'stars_detail',
                '获取单个星标仓库的完整详情（含 README、分类、翻译）',
                { id: z.number().int().positive().describe('仓库 ID') },
                async (args) => {
                    try {
                        const repo = await githubRepo.findById(args.id);
                        if (!repo) return err('仓库不存在');
                        return ok(truncateRepoReadme(repo));
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool(
                'stars_star',
                '按仓库 ID Star 仓库（通过数据库 ID 查找 full_name 后调用 GitHub API）',
                { id: z.number().int().positive().describe('仓库 ID') },
                async (args) => {
                    try {
                        const repo = await githubRepo.findById(args.id);
                        if (!repo?.fullName) return err('仓库不存在或全名为空');
                        const [owner, repoName] = repo.fullName.split('/');
                        if (!owner || !repoName) return err('仓库全名格式异常');
                        const starred = await githubSearch.starRepo(owner, repoName);
                        return ok({ starred, message: starred ? `已 Star ${repo.fullName}` : 'Star 失败' });
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool(
                'stars_unstar',
                '按仓库 ID 取消 Star 仓库（通过数据库 ID 查找 full_name 后调用 GitHub API）',
                { id: z.number().int().positive().describe('仓库 ID') },
                async (args) => {
                    try {
                        const repo = await githubRepo.findById(args.id);
                        if (!repo?.fullName) return err('仓库不存在或全名为空');
                        const [owner, repoName] = repo.fullName.split('/');
                        if (!owner || !repoName) return err('仓库全名格式异常');
                        const unstarred = await githubSearch.unstarRepo(owner, repoName);
                        return ok({ unstarred, message: unstarred ? `已取消 Star ${repo.fullName}` : '取消 Star 失败' });
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool(
                'stars_check_starred',
                '按仓库 ID 检查 Star 状态（通过数据库 ID 查找 full_name 后调用 GitHub API）',
                { id: z.number().int().positive().describe('仓库 ID') },
                async (args) => {
                    try {
                        const repo = await githubRepo.findById(args.id);
                        if (!repo?.fullName) return err('仓库不存在或全名为空');
                        const [owner, repoName] = repo.fullName.split('/');
                        if (!owner || !repoName) return err('仓库全名格式异常');
                        const starred = await githubSearch.checkStarred(owner, repoName);
                        return ok({ starred, fullName: repo.fullName });
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool('stars_ids', '按筛选条件获取所有仓库 ID 列表（用于批量操作）', { ...filterShape }, async (args) => {
                try {
                    const ids = await githubRepo.findAllIds({
                        keyword: args.keyword,
                        language: args.language,
                        sortBy: args.sortBy,
                        sortOrder: args.sortOrder,
                        dateField: args.dateField,
                        startDate: args.startDate,
                        endDate: args.endDate,
                        untranslatedOnly: args.untranslatedOnly,
                    });
                    return ok({ success: true, ids, total: ids.length });
                } catch (e) {
                    return err(e instanceof Error ? e.message : String(e));
                }
            }),
            tool(
                'stars_by_ids',
                '根据 ID 列表批量获取仓库详情',
                { ids: z.array(z.number().int().positive()).min(1).describe('仓库 ID 列表') },
                async (args) => {
                    try {
                        const repos = await githubRepo.findByIds(args.ids);
                        return ok({ success: true, data: truncateRepoReadme(repos), total: repos.length });
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),

            // ==================== Localization 仓库中文化（纯数据接口：取原文 / 写译文） ====================
            tool(
                'localization_pending',
                '查询未中文化的仓库原文（描述/README），供智能体翻译。返回的字段为 null 表示该字段无需翻译',
                {
                    limit: z.number().int().min(1).max(200).optional().describe('返回数量上限，默认 50，最大 200'),
                    includeDescription: z.boolean().optional().describe('是否包含描述，默认 true'),
                    includeReadme: z.boolean().optional().describe('是否包含 README，默认 true'),
                },
                async (args) => {
                    try {
                        const pending = await localization.findPending(
                            args.limit ?? 50,
                            args.includeDescription ?? true,
                            args.includeReadme ?? true,
                        );
                        return ok(truncateRepoReadme(pending));
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool(
                'localization_update',
                '批量写入智能体产出的译文（只更新，不做翻译）。每项需 repoId 及 descriptionCn/readmeCn 至少其一',
                {
                    items: z
                        .array(
                            z.object({
                                repoId: z.number().int().positive().describe('仓库 ID'),
                                descriptionCn: z.string().max(20000).optional().describe('中文描述'),
                                readmeCn: z.string().max(2000000).optional().describe('中文 README'),
                            }),
                        )
                        .min(1)
                        .max(500)
                        .describe('译文列表，单次最多 500 条'),
                },
                async (args) => {
                    try {
                        return ok(await localization.updateTranslations(args.items));
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),

            // ==================== Category 分类管理 ====================
            tool('category_tree', '获取完整分类树（两级树形结构，一级分类含子分类列表）', {}, async () => {
                try {
                    return ok(await category.getCategoryTree());
                } catch (e) {
                    return err(e instanceof Error ? e.message : String(e));
                }
            }),
            tool(
                'category_list',
                '分页获取一级分类列表，支持关键字搜索',
                { ...paginationShape, keyword: z.string().optional().describe('分类名搜索关键词') },
                async (args) => {
                    try {
                        return ok(await category.getCategoryList(args.page ?? 1, args.size ?? 12, args.keyword ?? ''));
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool(
                'category_create',
                '创建新分类，支持设置父分类、排序、图标、描述',
                {
                    name: z.string().min(1).max(100).describe('分类名称'),
                    parentId: z.number().int().positive().optional().nullable().describe('父分类 ID（创建子分类时传入）'),
                    sortOrder: z.number().int().min(0).optional().describe('排序值，默认 0'),
                    icon: z.string().max(100).optional().nullable().describe('图标标识'),
                    description: z.string().max(1000).optional().nullable().describe('分类描述'),
                },
                async (args) => {
                    try {
                        return ok(
                            await category.createCategory({
                                name: args.name,
                                parentId: args.parentId ?? null,
                                sortOrder: args.sortOrder ?? 0,
                                icon: args.icon ?? null,
                                description: args.description ?? null,
                            }),
                        );
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool(
                'category_update',
                '更新分类信息（名称/父分类/排序/图标/描述）',
                {
                    id: z.number().int().positive().describe('分类 ID'),
                    name: z.string().min(1).max(100).optional().describe('新分类名称'),
                    parentId: z.number().int().positive().optional().nullable().describe('新父分类 ID'),
                    sortOrder: z.number().int().min(0).optional().describe('新排序值'),
                    icon: z.string().max(100).optional().nullable().describe('新图标'),
                    description: z.string().max(1000).optional().nullable().describe('新描述'),
                },
                async (args) => {
                    try {
                        return ok(
                            await category.updateCategory({
                                id: args.id,
                                name: args.name,
                                parentId: args.parentId,
                                sortOrder: args.sortOrder,
                                icon: args.icon,
                                description: args.description,
                            }),
                        );
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool(
                'category_delete',
                '删除指定分类（存在子分类时删除失败）',
                { id: z.number().int().positive().describe('分类 ID') },
                async (args) => {
                    try {
                        return ok(await category.deleteCategory(args.id));
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool(
                'category_sort',
                '批量更新分类排序（拖拽排序）',
                {
                    items: z
                        .array(
                            z.object({
                                id: z.number().int().positive().describe('分类 ID'),
                                sortOrder: z.number().int().min(0).describe('排序值'),
                            }),
                        )
                        .min(1)
                        .describe('排序项列表'),
                },
                async (args) => {
                    try {
                        return ok(await category.sortCategories({ items: args.items }));
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool(
                'category_repos',
                '查询某分类下的仓库列表（分页 + 筛选）',
                {
                    ...paginationShape,
                    categoryId: z.number().int().positive().describe('分类 ID'),
                    keyword: z.string().optional().describe('关键词'),
                    language: z.string().optional().describe('语言筛选'),
                    sortBy: z.string().optional().describe('排序字段'),
                    sortOrder: z.enum(['asc', 'desc']).optional().describe('排序方向'),
                },
                async (args) => {
                    try {
                        return ok(
                            await category.getCategoryRepos({
                                categoryId: args.categoryId,
                                page: args.page ?? 1,
                                size: args.size ?? 12,
                                keyword: args.keyword ?? '',
                                language: args.language ?? '',
                                sortBy: args.sortBy ?? 'stars_count',
                                sortOrder: args.sortOrder ?? 'desc',
                            }),
                        );
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool(
                'category_bind',
                '批量绑定仓库到指定分类',
                {
                    categoryId: z.number().int().positive().describe('分类 ID'),
                    repoIds: z.array(z.number().int().positive()).min(1).describe('仓库 ID 列表'),
                },
                async (args) => {
                    try {
                        return ok(await category.bindReposToCategory({ categoryId: args.categoryId, repoIds: args.repoIds }));
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool(
                'category_unbind',
                '批量解绑仓库从指定分类',
                {
                    categoryId: z.number().int().positive().describe('分类 ID'),
                    repoIds: z.array(z.number().int().positive()).min(1).describe('仓库 ID 列表'),
                },
                async (args) => {
                    try {
                        return ok(await category.unbindReposFromCategory({ categoryId: args.categoryId, repoIds: args.repoIds }));
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool(
                'category_batch_ids',
                '获取分类下所有仓库 ID（用于批量克隆/下载），支持递归包含子分类',
                {
                    categoryId: z.number().int().positive().describe('分类 ID'),
                    includeChildren: z.boolean().optional().describe('是否包含子分类的仓库，默认 true'),
                },
                async (args) => {
                    try {
                        const result = await category.getCategoryRepoIds(args.categoryId, args.includeChildren ?? true);
                        return ok({ success: true, data: result });
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),

            // ==================== Stats 统计分析 ====================
            tool('stats_languages', '获取编程语言分布统计（各语言仓库数量及占比）', {}, async () => {
                try {
                    return ok(await stats.getLanguageStats());
                } catch (e) {
                    return err(e instanceof Error ? e.message : String(e));
                }
            }),
            tool(
                'stats_owners',
                '获取仓库所有者排名（按 Star 总数降序）',
                { topN: z.number().int().min(1).max(100).optional().describe('返回前 N 名，默认 15') },
                async (args) => {
                    try {
                        return ok(await stats.getOwnerStats(args.topN ?? 15));
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool('stats_timeline', '获取 Star 时间线统计（按月份聚合的增长趋势）', {}, async () => {
                try {
                    return ok(await stats.getTimelineStats());
                } catch (e) {
                    return err(e instanceof Error ? e.message : String(e));
                }
            }),
            tool('stats_overview', '获取整体概览统计（仓库总数、Star/Fork 总数、语言/所有者种类数）', {}, async () => {
                try {
                    return ok(await stats.getOverviewStats());
                } catch (e) {
                    return err(e instanceof Error ? e.message : String(e));
                }
            }),
            tool(
                'stats_top_starred',
                '获取 Star 数量排行榜（按 starsCount 降序）',
                { topN: z.number().int().min(1).max(100).optional().describe('返回前 N 名，默认 10') },
                async (args) => {
                    try {
                        return ok(await stats.getTopStarred(args.topN ?? 10));
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool(
                'stats_recent_active',
                '获取最近活跃仓库列表（按 repoUpdatedAt 降序）',
                { topN: z.number().int().min(1).max(100).optional().describe('返回前 N 名，默认 10') },
                async (args) => {
                    try {
                        return ok(await stats.getRecentActive(args.topN ?? 10));
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),

            // ==================== Clone 克隆 ====================
            tool(
                'clone_create',
                '创建 Git 克隆任务，批量克隆仓库到本地目录',
                {
                    repoIds: z.array(z.number().int().positive()).min(1).describe('仓库 ID 列表'),
                    targetDir: z.string().min(1).max(1000).describe('目标目录绝对路径'),
                    concurrency: z.number().optional().describe('并发数，可选 5/10/20/50/80，默认 5'),
                    shallow: z.boolean().optional().describe('是否浅克隆（--depth 1），默认 true'),
                    mirrorSource: z.string().optional().describe('镜像代理源，默认 direct（直连）'),
                },
                async (args) => {
                    try {
                        return ok(
                            await clone.createTask({
                                repoIds: args.repoIds,
                                targetDir: args.targetDir,
                                concurrency: args.concurrency ?? 5,
                                shallow: args.shallow ?? true,
                                mirrorSource: args.mirrorSource ?? 'direct',
                            }),
                        );
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool('clone_tasks_list', '获取最近的克隆任务列表', {}, async () => {
                try {
                    return ok(await clone.getRecentTasks());
                } catch (e) {
                    return err(e instanceof Error ? e.message : String(e));
                }
            }),
            tool('clone_directories', '获取常用的克隆目标目录列表', {}, async () => {
                try {
                    return ok(await clone.getRecentDirectories());
                } catch (e) {
                    return err(e instanceof Error ? e.message : String(e));
                }
            }),
            tool('clone_task_detail', '查询克隆任务进度详情', { id: z.number().int().positive().describe('任务 ID') }, async (args) => {
                try {
                    return ok(await clone.getTaskProgress(args.id));
                } catch (e) {
                    return err(e instanceof Error ? e.message : String(e));
                }
            }),
            tool('clone_task_retry', '重试克隆任务中的失败项', { id: z.number().int().positive().describe('任务 ID') }, async (args) => {
                try {
                    return ok(await clone.retryFailed(args.id));
                } catch (e) {
                    return err(e instanceof Error ? e.message : String(e));
                }
            }),
            tool(
                'clone_task_reset',
                '重置整个克隆任务（清空状态重新开始）',
                { id: z.number().int().positive().describe('任务 ID') },
                async (args) => {
                    try {
                        return ok(await clone.resetTask(args.id));
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool(
                'clone_task_retry_item',
                '重试克隆任务中的单个失败项',
                {
                    id: z.number().int().positive().describe('任务 ID'),
                    fullName: z.string().min(1).describe('仓库全名，格式 owner/repo'),
                },
                async (args) => {
                    try {
                        return ok(await clone.retryItem(args.id, args.fullName));
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool('clone_task_delete', '删除克隆任务及其关联数据', { id: z.number().int().positive().describe('任务 ID') }, async (args) => {
                try {
                    return ok(await clone.deleteTask(args.id));
                } catch (e) {
                    return err(e instanceof Error ? e.message : String(e));
                }
            }),

            // ==================== Download 下载 ====================
            tool(
                'download_create',
                '创建下载任务，批量下载仓库压缩包到本地目录',
                {
                    repoIds: z.array(z.number().int().positive()).min(1).describe('仓库 ID 列表'),
                    targetDir: z.string().min(1).max(1000).describe('目标目录绝对路径'),
                    concurrency: z.number().optional().describe('并发数，可选 3/5/10/20/50，默认 5'),
                    mirrorSources: z.array(z.string()).optional().describe('镜像源列表，按优先级排序，默认 [direct]'),
                    extractArchive: z.boolean().optional().describe('下载后是否自动解压，默认 true'),
                    deleteAfterExtract: z.boolean().optional().describe('解压后是否删除原压缩包，默认 true'),
                },
                async (args) => {
                    try {
                        return ok(
                            await download.createTask({
                                repoIds: args.repoIds,
                                targetDir: args.targetDir,
                                concurrency: args.concurrency ?? 5,
                                mirrorSources: args.mirrorSources ?? ['direct'],
                                extractArchive: args.extractArchive ?? true,
                                deleteAfterExtract: args.deleteAfterExtract ?? true,
                            }),
                        );
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool('download_tasks_list', '获取最近的下载任务列表', {}, async () => {
                try {
                    return ok(await download.getRecentTasks());
                } catch (e) {
                    return err(e instanceof Error ? e.message : String(e));
                }
            }),
            tool('download_directories', '获取常用的下载目标目录列表', {}, async () => {
                try {
                    return ok(await download.getRecentDirectories());
                } catch (e) {
                    return err(e instanceof Error ? e.message : String(e));
                }
            }),
            tool('download_task_detail', '查询下载任务进度详情', { id: z.number().int().positive().describe('任务 ID') }, async (args) => {
                try {
                    return ok(await download.getTaskProgress(args.id));
                } catch (e) {
                    return err(e instanceof Error ? e.message : String(e));
                }
            }),
            tool(
                'download_estimate_sizes',
                '预估多个仓库的下载大小（HEAD 请求获取 Content-Length）',
                { repoIds: z.array(z.number().int().positive()).min(1).describe('仓库 ID 列表') },
                async (args) => {
                    try {
                        return ok(await download.estimateSizes(args.repoIds));
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool('download_task_retry', '重试下载任务中的失败项', { id: z.number().int().positive().describe('任务 ID') }, async (args) => {
                try {
                    return ok(await download.retryFailed(args.id));
                } catch (e) {
                    return err(e instanceof Error ? e.message : String(e));
                }
            }),
            tool('download_task_reset', '重置整个下载任务', { id: z.number().int().positive().describe('任务 ID') }, async (args) => {
                try {
                    return ok(await download.resetTask(args.id));
                } catch (e) {
                    return err(e instanceof Error ? e.message : String(e));
                }
            }),
            tool(
                'download_task_retry_item',
                '重试下载任务中的单个失败项',
                {
                    id: z.number().int().positive().describe('任务 ID'),
                    fullName: z.string().min(1).describe('仓库全名，格式 owner/repo'),
                },
                async (args) => {
                    try {
                        return ok(await download.retryItem(args.id, args.fullName));
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool(
                'download_task_delete',
                '删除下载任务及其关联数据',
                { id: z.number().int().positive().describe('任务 ID') },
                async (args) => {
                    try {
                        return ok(await download.deleteTask(args.id));
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool(
                'download_task_extract',
                '手动解压下载任务中某个仓库的压缩包',
                {
                    taskId: z.number().int().positive().describe('任务 ID'),
                    fullName: z.string().min(1).describe('仓库全名，格式 owner/repo'),
                },
                async (args) => {
                    try {
                        return ok(await download.extractItemFile(args.taskId, args.fullName));
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool(
                'download_task_delete_item',
                '手动删除下载任务中某个仓库的压缩包',
                {
                    taskId: z.number().int().positive().describe('任务 ID'),
                    fullName: z.string().min(1).describe('仓库全名，格式 owner/repo'),
                },
                async (args) => {
                    try {
                        return ok(await download.deleteItemZipFile(args.taskId, args.fullName));
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool(
                'download_task_extract_all',
                '一键解压下载任务中所有已完成项的压缩包',
                { taskId: z.number().int().positive().describe('任务 ID') },
                async (args) => {
                    try {
                        return ok(await download.extractAllItems(args.taskId));
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool('download_task_extract_progress', '查询批量解压进度', { id: z.number().int().positive().describe('任务 ID') }, (args) => {
                try {
                    const result = ok(download.getExtractAllProgress(args.id));
                    return Promise.resolve(result);
                } catch (e) {
                    return Promise.resolve(err(e instanceof Error ? e.message : String(e)));
                }
            }),

            // ==================== Sync 同步 ====================
            tool('sync_manual', '手动触发 Star 数据同步（从 GitHub API 全量拉取并同步到数据库）', {}, async () => {
                try {
                    if (sync.isSyncing()) return err('已有同步任务在执行中');
                    sync.startManualSync();
                    return await Promise.resolve(ok({ success: true, message: '同步任务已启动' }));
                } catch (e) {
                    return err(e instanceof Error ? e.message : String(e));
                }
            }),
            tool('sync_status', '获取当前同步状态（是否在同步中、仓库总数、上次同步时间）', {}, async () => {
                try {
                    return ok(await sync.getSyncStatus());
                } catch (e) {
                    return err(e instanceof Error ? e.message : String(e));
                }
            }),
            tool(
                'sync_logs',
                '分页获取历史同步日志',
                {
                    pageNum: z.number().int().min(1).optional().describe('页码，默认 1'),
                    pageSize: z.number().int().min(1).max(100).optional().describe('每页数量，默认 10'),
                },
                async (args) => {
                    try {
                        return ok(await sync.getSyncLogs(args.pageNum ?? 1, args.pageSize ?? 10));
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),

            // ==================== Trending 趋势 ====================
            tool(
                'trending_list',
                '获取 GitHub Trending 仓库列表（通过 Search API 查询指定时间段内创建的高星仓库）',
                {
                    since: z.string().optional().describe('时间范围：daily / weekly / monthly，默认 daily'),
                    language: z.string().optional().describe('编程语言筛选'),
                    perPage: z.number().int().min(1).max(100).optional().describe('返回数量，默认 20'),
                },
                async (args) => {
                    try {
                        const { query, dateStr } = buildTrendingQuery(args.since ?? 'daily', args.language ?? '');
                        const result = await githubSearch.searchRepos(query, '', 'stars', 1, args.perPage ?? 20);
                        const enrichedRepos = await trending.enrichWithCachedTranslations(result.repos);
                        return ok({
                            success: true,
                            since: args.since ?? 'daily',
                            total: result.total,
                            repos: enrichedRepos,
                            dateRange: `${dateStr} ~ ${new Date().toISOString().split('T')[0]}`,
                        });
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            // ==================== Author 作者中心 ====================
            tool(
                'author_list',
                '分页获取作者列表（按 Star 仓库数量降序）',
                { ...paginationShape, keyword: z.string().optional().describe('作者名搜索关键词') },
                async (args) => {
                    try {
                        return ok(await author.findAuthorPage(args.page ?? 1, args.size ?? 12, args.keyword ?? ''));
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool(
                'author_repos',
                '分页获取指定作者的所有 Star 仓库',
                {
                    ownerName: z.string().min(1).describe('作者名（GitHub 用户名）'),
                    ...paginationShape,
                    sortBy: z.string().optional().describe('排序字段，默认 stars_count'),
                    sortOrder: z.enum(['asc', 'desc']).optional().describe('排序方向，默认 desc'),
                },
                async (args) => {
                    try {
                        return ok(
                            await author.findAuthorRepos({
                                ownerName: args.ownerName,
                                page: args.page ?? 1,
                                size: args.size ?? 12,
                                sortBy: args.sortBy ?? 'stars_count',
                                sortOrder: args.sortOrder ?? 'desc',
                            }),
                        );
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),
            tool(
                'author_export_urls',
                '导出指定作者的所有 Star 仓库 URL 列表',
                {
                    ownerName: z.string().min(1).describe('作者名（GitHub 用户名）'),
                    sortBy: z.string().optional().describe('排序字段'),
                    sortOrder: z.enum(['asc', 'desc']).optional().describe('排序方向'),
                },
                async (args) => {
                    try {
                        const urls = await author.findAllAuthorRepoUrls({
                            ownerName: args.ownerName,
                            sortBy: args.sortBy ?? 'stars_count',
                            sortOrder: args.sortOrder ?? 'desc',
                        });
                        return ok({ success: true, urls, total: urls.length });
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),

            // ==================== Config 系统配置 ====================
            tool('config_list', '获取所有系统配置项（敏感字段自动脱敏）', {}, async () => {
                try {
                    return ok(await config.listAll());
                } catch (e) {
                    return err(e instanceof Error ? e.message : String(e));
                }
            }),
            tool(
                'config_update',
                '批量更新系统配置项（键值对）',
                {
                    configs: z
                        .record(z.string(), z.string())
                        .describe('配置键值对，如 { "github.token": "xxx", "clone.http_proxy": "http://127.0.0.1:7897" }'),
                },
                async (args) => {
                    try {
                        await config.batchUpdate(args.configs);
                        return ok({ success: true, message: '保存成功' });
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),

            // ==================== Export 导出 ====================
            tool(
                'export_markdown',
                '按筛选条件将仓库列表导出为 Markdown 文本',
                {
                    ...filterShape,
                    maxCount: z.number().int().min(1).max(2000).optional().describe('最大导出数量，默认 50，上限 2000'),
                },
                async (args) => {
                    try {
                        const md = await exportService.generateMarkdown(
                            {
                                keyword: args.keyword ?? '',
                                language: args.language ?? '',
                                sortBy: args.sortBy ?? 'stars_count',
                                sortOrder: args.sortOrder ?? 'desc',
                                dateField: args.dateField ?? '',
                                startDate: args.startDate ?? '',
                                endDate: args.endDate ?? '',
                                untranslatedOnly: args.untranslatedOnly ?? false,
                            },
                            args.maxCount ?? 50,
                        );
                        return ok({ success: true, markdown: md, length: md.length });
                    } catch (e) {
                        return err(e instanceof Error ? e.message : String(e));
                    }
                },
            ),

            // ==================== Logging 日志 ====================
            tool('logs_files', '获取日志文件列表（名称、大小、修改时间）', {}, () => {
                try {
                    return Promise.resolve(ok({ success: true, files: logging.getLogFiles() }));
                } catch (e) {
                    return Promise.resolve(err(e instanceof Error ? e.message : String(e)));
                }
            }),
            tool(
                'logs_view',
                '读取指定日志文件的最后 N 行内容',
                {
                    file: z.string().min(1).describe('日志文件名'),
                    lines: z.number().int().min(1).max(10000).optional().describe('读取行数，默认全部'),
                },
                (args) => {
                    try {
                        const content = logging.readLogFile(args.file, args.lines);
                        return Promise.resolve(ok({ success: true, content, file: args.file }));
                    } catch (e) {
                        return Promise.resolve(err(e instanceof Error ? e.message : String(e)));
                    }
                },
            ),
            tool('logs_clear', '清空指定日志文件（不可恢复）', { file: z.string().min(1).describe('日志文件名') }, (args) => {
                try {
                    const okResult = logging.clearLogFile(args.file);
                    return Promise.resolve(ok({ success: okResult, message: okResult ? '已清空' : '清空失败' }));
                } catch (e) {
                    return Promise.resolve(err(e instanceof Error ? e.message : String(e)));
                }
            }),
        ],
    });
}
