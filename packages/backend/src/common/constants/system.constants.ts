/**
 * 系统关键目录前缀列表
 *
 * 用于目录安全校验，禁止将下载/克隆输出写入系统目录。
 * 兼容 Windows 和 Linux：
 * - Windows: c:/windows, c:/program files
 * - Linux: /bin, /etc, /dev, /proc 等
 *
 * @callers
 *   - CloneService.createTask — 克隆任务创建
 *   - DownloadService.createTask — 下载任务创建
 */
export const SYSTEM_FORBIDDEN_PREFIXES = [
    'c:/windows',
    'c:/program files',
    'c:/program files (x86)',
    '/bin',
    '/boot',
    '/dev',
    '/etc',
    '/lib',
    '/lib64',
    '/proc',
    '/root',
    '/sbin',
    '/sys',
    '/usr',
    '/var',
] as const;
