/**
 * 排序字段映射工具
 *
 * 将前端传入的 snake_case 排序字段映射为 Prisma 模型字段名（camelCase）。
 * 消除 github-repo.service.ts 和 author.service.ts 中的重复映射逻辑。
 */

/** 前端排序字段 → Prisma 模型字段映射表 */
export const SORT_FIELD_MAP: Record<string, string> = {
    stars_count: 'starsCount',
    forks_count: 'forksCount',
    repo_updated_at: 'repoUpdatedAt',
    repo_created_at: 'repoCreatedAt',
    repo_pushed_at: 'repoPushedAt',
    starred_at: 'starredAt',
};

/** 前端日期字段 → Prisma 模型字段映射表 */
export const DATE_FIELD_MAP: Record<string, string> = {
    starred_at: 'starredAt',
    repo_created_at: 'repoCreatedAt',
    repo_updated_at: 'repoUpdatedAt',
    repo_pushed_at: 'repoPushedAt',
};

/**
 * 将前端排序字段映射为 Prisma 模型字段名
 *
 * @param sortBy 前端排序字段名，如 'stars_count'
 * @param fallback 默认字段名，默认 'starredAt'
 * @returns Prisma 模型字段名
 */
export function resolveSortField(sortBy: string | undefined, fallback = 'starredAt'): string {
    return SORT_FIELD_MAP[sortBy || 'stars_count'] || fallback;
}

/**
 * 标准化排序方向
 *
 * @param sortOrder 排序方向字符串
 * @returns 'asc' 或 'desc'
 */
export function resolveSortDir(sortOrder: string | undefined): 'asc' | 'desc' {
    return sortOrder === 'asc' ? 'asc' : 'desc';
}

/**
 * 解析逗号分隔的语言字符串为数组
 *
 * @param language 逗号分隔的语言字符串，如 'JavaScript,TypeScript'
 * @returns 过滤后的语言数组，空时返回 undefined
 */
export function parseLanguages(language: string | undefined): string[] | undefined {
    const languages = language ? language.split(',').filter(Boolean) : [];
    return languages.length > 0 ? languages : undefined;
}
