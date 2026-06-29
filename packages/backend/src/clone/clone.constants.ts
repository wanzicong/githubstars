/** 并发数选项（用户可选） */
export const CLONE_CONCURRENCY_OPTIONS = [5, 10, 20, 50, 80] as const;

/** 默认并发数 */
export const DEFAULT_CONCURRENCY = 5;

/** 单个仓库克隆超时（毫秒）：15 分钟
 * 大仓库（如 DrKLO/Telegram 40GB+）浅克隆仍需 >10 分钟
 * simple-git timeout.block 时间内无 stdout 输出即视为超时
 */
export const CLONE_TIMEOUT_MS = 15 * 60 * 1000;

/** 单个子项处理超时（毫秒）：30 分钟（含克隆 + 网络重试 + DB 写入） */
export const ITEM_TIMEOUT_MS = 30 * 60 * 1000;

/** 整体任务超时（毫秒）：90 分钟
 * 200仓库/50并发，最坏情况 4 批 × 20min(大仓库含重试) = 80分钟
 * STUCK_TASK_THRESHOLD 应大于 TASK_TIMEOUT
 */
export const TASK_TIMEOUT_MS = 90 * 60 * 1000;

/** 信号量获取超时（毫秒）：60 分钟
 * 200个仓库/50并发下，最后一批需等待 3 × ITEM_TIMEOUT(30min) = 90分钟
 * 设置为60分钟折中，极端大仓库可手动重试
 */
export const SEMAPHORE_TIMEOUT_MS = 60 * 60 * 1000;

/** 卡住任务检测阈值（毫秒）：100 分钟（超过 TASK_TIMEOUT_MS=90min） */
export const STUCK_TASK_THRESHOLD_MS = 100 * 60 * 1000;

/** 锁超时阈值（毫秒）：110 分钟（超过 STUCK_TASK_THRESHOLD_MS）
 * 用于检测 running 锁是否卡住，如果锁持有超过此时间，强制释放
 */
export const LOCK_TIMEOUT_MS = 110 * 60 * 1000;

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
 * URL 格式因源而异：
 * - keepProtocol=true:  {proxyUrl}/{完整原始URL(含https://)}
 *   → gh-proxy.com:     https://gh-proxy.com/https://github.com/user/repo
 * - keepProtocol=false: {proxyUrl}/{去掉https://的原始URL}
 *   → gitclone.com:     https://gitclone.com/github.com/user/repo
 */
export const GITHUB_MIRROR_SOURCES = [
    {
        name: 'ghproxy',
        label: 'ghproxy.net',
        url: 'https://ghproxy.net',
        description: '国内最稳定的 GitHub 代理，推荐',
        keepProtocol: true,
    },
    {
        name: 'gh-proxy',
        label: 'gh-proxy.com',
        url: 'https://gh-proxy.com',
        description: '国内快速代理，支持大文件',
        keepProtocol: true,
    },
    {
        name: 'gitclone',
        label: 'gitclone.com',
        url: 'https://gitclone.com',
        description: '知名镜像服务，长期维护',
        keepProtocol: false,
    },
    {
        name: 'direct',
        label: '直连（不加速）',
        url: '',
        description: '直接连接 GitHub，需要网络通畅',
        keepProtocol: false,
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
    'Unable to create', // Windows 上 git clone --depth 1 的 .git 目录创建竞态 (shallow.lock 等)
    'not a git repository', // 目录中有残留的损坏 .git
    'could not lock config file', // Windows 上 .git/config 文件锁竞态
    'RPC failed', // 传输中断（curl 18/56），网络不稳定导致
    'early EOF', // 连接提前关闭，网络不稳定导致

    // 网络连接错误（最常见的失败原因）
    'Failed to connect to github.com', // GitHub 连接失败
    'Could not connect to server', // 无法连接到服务器
    'Could not resolve host', // DNS 解析失败（国内环境常见，可恢复）
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
    'Could not resolve host',
    'Connection timed out',
    'SSL_ERROR_SYSCALL',
    'RPC failed',
    'early EOF',
    'OpenSSL SSL_read: Connection was reset',
    'The requested URL returned error: 429',
    'The requested URL returned error: 503',
    'Network is unreachable',
    'No route to host',
    'Connection refused',
] as const;

/** 重试次数（网络错误可重试更多次） */
export const MAX_NETWORK_RETRY_ATTEMPTS = 5;

/** 重试基础延迟（毫秒），用于指数退避 */
export const RETRY_BASE_DELAY_MS = 5000;

/** 重试最大延迟（毫秒） */
export const RETRY_MAX_DELAY_MS = 30000;
