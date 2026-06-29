/** 并发数选项（用户可选） */
export const DOWNLOAD_CONCURRENCY_OPTIONS = [3, 5, 10, 20, 50] as const;

/** 默认并发数 */
export const DEFAULT_CONCURRENCY = 5;

/** 单个文件下载超时（毫秒）：10 分钟
 * GitHub 源码归档通常较小（<100MB），10 分钟足够
 */
export const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;

/** 单个子项处理超时（毫秒）：30 分钟（含下载 + 解压 + DB 写入） */
export const ITEM_TIMEOUT_MS = 30 * 60 * 1000;

/** 整体任务超时（毫秒）：120 分钟
 * 200仓库/50并发，最坏情况 4 批 × 25min(含重试) = 100分钟
 */
export const TASK_TIMEOUT_MS = 120 * 60 * 1000;

/** 信号量获取超时（毫秒）：60 分钟 */
export const SEMAPHORE_TIMEOUT_MS = 60 * 60 * 1000;

/** 卡住任务检测阈值（毫秒）：130 分钟 */
export const STUCK_TASK_THRESHOLD_MS = 130 * 60 * 1000;

/** 锁超时阈值（毫秒）：140 分钟 */
export const LOCK_TIMEOUT_MS = 140 * 60 * 1000;

/** 长时间 PENDING 任务阈值（毫秒）：5 分钟 */
export const LONG_PENDING_THRESHOLD_MS = 5 * 60 * 1000;

/** 最大重试次数 */
export const MAX_RETRY_ATTEMPTS = 3;

/** 网络错误最大重试次数 */
export const MAX_NETWORK_RETRY_ATTEMPTS = 5;

/** 重试基础延迟（毫秒） */
export const RETRY_BASE_DELAY_MS = 5000;

/** 重试最大延迟（毫秒） */
export const RETRY_MAX_DELAY_MS = 30000;

/** 历史任务保留数量 */
export const MAX_HISTORY_TASKS = 10;

/**
 * GitHub 下载镜像代理源配置
 *
 * 用于加速国内访问 GitHub 的压缩包下载。
 * URL 格式因源而异，通过 keepProtocol 控制：
 * - keepProtocol=true:  {proxyUrl}/{完整原始URL(含https://)}
 *   → ghproxy.net:      https://ghproxy.net/https://github.com/user/repo/...
 * - keepProtocol=false: {proxyUrl}/{去掉https://的原始URL}
 *   → gitclone.com 仅支持此格式
 */
export const DOWNLOAD_MIRROR_SOURCES = [
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
export type MirrorSourceName = (typeof DOWNLOAD_MIRROR_SOURCES)[number]['name'];

/**
 * 获取真实的 GitHub 归档 URL（去掉镜像代理前缀）
 * 用于多镜像回退时从镜像 URL 还原为原始 URL
 */
export function getOriginalArchiveUrl(mirroredUrl: string): string {
    for (const source of DOWNLOAD_MIRROR_SOURCES) {
        if (source.url && mirroredUrl.startsWith(source.url + '/')) {
            return mirroredUrl.substring(source.url.length + 1);
        }
    }
    return mirroredUrl;
}

/**
 * 构建镜像代理 URL
 *
 * URL 格式因源而异，通过 keepProtocol 控制：
 * - keepProtocol=true:  {proxyUrl}/{完整原始URL(含https://)}
 *   → ghproxy.net 官方格式: https://ghproxy.net/https://github.com/user/repo
 * - keepProtocol=false: {proxyUrl}/{去掉https://的原始URL}
 *   → gitclone.com 仅支持此格式
 *
 * @param originalUrl - 原始 GitHub URL（如 https://github.com/owner/repo/archive/refs/heads/main.zip）
 * @param mirrorSource - 镜像源名称
 */
export function getMirrorUrl(originalUrl: string, mirrorSource: MirrorSourceName = 'direct'): string {
    if (mirrorSource === 'direct' || !mirrorSource) {
        return originalUrl;
    }
    const source = DOWNLOAD_MIRROR_SOURCES.find((s) => s.name === mirrorSource);
    if (!source || !source.url) {
        return originalUrl;
    }
    if (source.keepProtocol) {
        // ghproxy.net / gh-proxy.com 官方格式：保留完整原始 URL（含 https://）
        return `${source.url}/${originalUrl}`;
    }
    // gitclone.com 不支持双协议头：去掉 https://
    const strippedUrl = originalUrl.replace(/^https:\/\//i, '');
    return `${source.url}/${strippedUrl}`;
}

/**
 * 根据多个镜像源列表，按顺序返回完整的镜像 URL 列表
 * @param originalUrl - 原始 GitHub 归档 URL
 * @param mirrorSources - 镜像源名称列表（按优先级排序）
 * @returns 待尝试的 URL 列表（原始 URL 作为最终兜底）
 */
export function getOrderedMirrorUrls(originalUrl: string, mirrorSources: MirrorSourceName[]): string[] {
    const urls: string[] = [];
    for (const source of mirrorSources) {
        const url = getMirrorUrl(originalUrl, source);
        if (!urls.includes(url)) {
            urls.push(url);
        }
    }
    if (!urls.includes(originalUrl)) {
        urls.push(originalUrl);
    }
    return urls;
}

/** ZIP 魔术字节（用于验证下载的文件是否为 zip） */
export const ZIP_MAGIC_BYTES = [0x50, 0x4b, 0x03, 0x04];

/** 默认重试的 HTTP 状态码 */
export const RETRYABLE_HTTP_STATUSES = [429, 500, 502, 503, 504];

/** 网络错误模式（用于判断是否需要等待后重试） */
export const NETWORK_ERROR_PATTERNS = [
    'Failed to connect',
    'Could not connect',
    'Could not resolve host',
    'ENOTFOUND',
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'Connection timed out',
    'SSL_ERROR_SYSCALL',
    'OpenSSL SSL_read',
    'Network is unreachable',
    'No route to host',
    'Connection refused',
    'socket hang up',
    'read ECONNRESET',
    'fetch failed',
    'aborted',
] as const;
