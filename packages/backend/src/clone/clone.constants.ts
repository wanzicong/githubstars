/** 并发数选项（用户可选） */
export const CLONE_CONCURRENCY_OPTIONS = [5, 10, 20] as const;

/** 默认并发数 */
export const DEFAULT_CONCURRENCY = 5;

/** 单个仓库克隆超时（毫秒）：15 分钟 */
export const CLONE_TIMEOUT_MS = 15 * 60 * 1000;

/** 单个子项处理超时（毫秒）：17 分钟（含数据库操作，留 2 分钟余量给 DB 写入） */
export const ITEM_TIMEOUT_MS = 17 * 60 * 1000;

/** 整体任务超时（毫秒）：1 小时 */
export const TASK_TIMEOUT_MS = 60 * 60 * 1000;

/** 信号量获取超时（毫秒）：15 分钟 */
export const SEMAPHORE_TIMEOUT_MS = 15 * 60 * 1000;

/** 卡住任务检测阈值（毫秒）：65 分钟（超过 TASK_TIMEOUT_MS） */
export const STUCK_TASK_THRESHOLD_MS = 65 * 60 * 1000;

/** 锁超时阈值（毫秒）：70 分钟（超过 STUCK_TASK_THRESHOLD_MS）
 * 用于检测 running 锁是否卡住，如果锁持有超过此时间，强制释放
 */
export const LOCK_TIMEOUT_MS = 70 * 60 * 1000;

/** 长时间 PENDING 任务阈值（毫秒）：5 分钟
 * 任务创建超过此时间仍为 PENDING，说明可能卡住
 */
export const LONG_PENDING_THRESHOLD_MS = 5 * 60 * 1000;

/** 最大重试次数 */
export const MAX_RETRY_ATTEMPTS = 2;

/** 历史任务保留数量 */
export const MAX_HISTORY_TASKS = 10;

/**
 * GitHub 镜像代理源配置
 *
 * 用于加速国内访问 GitHub，支持多个代理源自动轮询。
 * URL 格式：{proxyUrl}/{originalGithubUrl}
 */
export const GITHUB_MIRROR_SOURCES = [
    {
        name: 'gh-proxy',
        label: 'gh-proxy.com',
        url: 'https://gh-proxy.com',
        description: '国内快速代理，支持大文件',
    },
    {
        name: 'gitclone',
        label: 'gitclone.com',
        url: 'https://gitclone.com',
        description: '知名镜像服务，长期维护',
    },
    {
        name: 'direct',
        label: '直连（不加速）',
        url: '',
        description: '直接连接 GitHub，需要网络通畅',
    },
] as const;

/** 镜像代理源类型 */
export type MirrorSourceName = (typeof GITHUB_MIRROR_SOURCES)[number]['name'];

/**
 * 需要自动重试的 Git 错误模式
 *
 * 这些错误通常是瞬时性的（网络抖动、Git 内部竞态），删除目录后重新克隆即可恢复。
 * 在 executeClone catch 块中匹配，命中的错误会在删除目录后自动重试。
 */
export const RETRYABLE_CLONE_ERROR_PATTERNS = [
    // Git 内部错误
    'shallow file has changed since we read it', // 浅克隆过程中 shallow 文件被并发修改
    'BUG: refs/files-backend', // Git for Windows ref 事务 Bug
    'initial ref transaction called with existing refs', // 同上，refs 残留
    'remote did not send all necessary objects', // 传输不完整，通常是网络中断
    'index file corrupt', // 索引文件损坏

    // 网络连接错误（最常见的失败原因）
    'Failed to connect to github.com', // GitHub 连接失败
    'Could not connect to server', // 无法连接到服务器
    'Connection timed out', // 连接超时
    'SSL_ERROR_SYSCALL', // SSL 底层错误（通常是网络中断）
    'OpenSSL SSL_read: Connection was reset', // 连接被重置
    'The requested URL returned error: 429', // GitHub API 速率限制
    'The requested URL returned error: 503', // GitHub 服务暂时不可用
    'Network is unreachable', // 网络不可达
    'No route to host', // 无法路由到主机
    'Connection refused', // 连接被拒绝
] as const;

/** 网络错误模式（用于判断是否需要等待后重试） */
export const NETWORK_ERROR_PATTERNS = [
    'Failed to connect to github.com',
    'Could not connect to server',
    'Connection timed out',
    'SSL_ERROR_SYSCALL',
    'OpenSSL SSL_read: Connection was reset',
    'The requested URL returned error: 429',
    'The requested URL returned error: 503',
    'Network is unreachable',
    'No route to host',
    'Connection refused',
] as const;

/** 重试次数（网络错误可重试更多次） */
export const MAX_NETWORK_RETRY_ATTEMPTS = 3;

/** 重试基础延迟（毫秒），用于指数退避 */
export const RETRY_BASE_DELAY_MS = 5000;

/** 重试最大延迟（毫秒） */
export const RETRY_MAX_DELAY_MS = 30000;
