/** 并发数选项（用户可选） */
export const CLONE_CONCURRENCY_OPTIONS = [5, 10, 20] as const;

/** 默认并发数 */
export const DEFAULT_CONCURRENCY = 5;

/** 单个仓库克隆超时（毫秒）：5 分钟 */
export const CLONE_TIMEOUT_MS = 5 * 60 * 1000;

/** 最大重试次数 */
export const MAX_RETRY_ATTEMPTS = 2;

/** 历史任务保留数量 */
export const MAX_HISTORY_TASKS = 10;
