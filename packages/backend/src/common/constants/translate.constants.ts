/**
 * 翻译模块哨兵值常量
 *
 * 替代散落在代码中的字符串魔法值，集中管理翻译流程中的特殊状态标识。
 */

/** DeepSeek API 返回 429 限流时的哨兵值 */
export const RATE_LIMITED = '__RATE_LIMITED__';

/** 仓库没有 README 文件时的哨兵值 */
export const NO_README = '__NO_README__';

/** 翻译任务最大尝试次数（含首次） */
export const MAX_ATTEMPTS = 4;

/** 翻译任务最大并发数 */
export const MAX_CONCURRENT = 10;

/** API 限流时等待时间（毫秒） */
export const RATE_LIMIT_BACKOFF_MS = 60_000;
