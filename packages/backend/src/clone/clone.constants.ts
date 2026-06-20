/** 并发数选项（用户可选） */
export const CLONE_CONCURRENCY_OPTIONS = [5, 10, 20] as const;

/** 默认并发数 */
export const DEFAULT_CONCURRENCY = 5;

/** 单个仓库克隆超时（毫秒）：5 分钟 */
export const CLONE_TIMEOUT_MS = 5 * 60 * 1000;

/** 单个子项处理超时（毫秒）：6 分钟（含数据库操作） */
export const ITEM_TIMEOUT_MS = 6 * 60 * 1000;

/** 整体任务超时（毫秒）：30 分钟 */
export const TASK_TIMEOUT_MS = 30 * 60 * 1000;

/** 信号量获取超时（毫秒）：10 分钟 */
export const SEMAPHORE_TIMEOUT_MS = 10 * 60 * 1000;

/** 卡住任务检测阈值（毫秒）：35 分钟（超过 TASK_TIMEOUT_MS） */
export const STUCK_TASK_THRESHOLD_MS = 35 * 60 * 1000;

/** 锁超时阈值（毫秒）：40 分钟（超过 STUCK_TASK_THRESHOLD_MS）
 * 用于检测 running 锁是否卡住，如果锁持有超过此时间，强制释放
 */
export const LOCK_TIMEOUT_MS = 40 * 60 * 1000;

/** 长时间 PENDING 任务阈值（毫秒）：5 分钟
 * 任务创建超过此时间仍为 PENDING，说明可能卡住
 */
export const LONG_PENDING_THRESHOLD_MS = 5 * 60 * 1000;

/** 最大重试次数 */
export const MAX_RETRY_ATTEMPTS = 2;

/** 历史任务保留数量 */
export const MAX_HISTORY_TASKS = 10;
