/**
 * 分页结果构建工具
 *
 * 统一 `{ records, total, size, current, pages }` 的构建逻辑，
 * 消除 github-repo.service.ts、author.service.ts、sync.service.ts 中的重复代码。
 */

/** 标准分页结果 */
export interface PaginatedResult<T> {
    records: T[];
    total: number;
    size: number;
    current: number;
    pages: number;
}

/**
 * 构建标准分页结果
 *
 * @param records 当前页数据
 * @param total 总记录数
 * @param page 当前页码（从 1 开始）
 * @param size 每页数量
 * @returns 标准分页结果对象
 */
export function buildPaginationResult<T>(records: T[], total: number, page: number, size: number): PaginatedResult<T> {
    return {
        records,
        total,
        size,
        current: page,
        pages: Math.ceil(total / size),
    };
}
