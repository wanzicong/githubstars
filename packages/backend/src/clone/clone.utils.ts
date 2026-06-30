import { randomBytes } from 'crypto';
import { RETRY_BASE_DELAY_MS, RETRY_MAX_DELAY_MS, GITHUB_MIRROR_SOURCES, NETWORK_ERROR_PATTERNS, type MirrorSourceName } from './clone.constants';
import * as path from 'path';

/**
 * 为 Promise 添加超时包装
 *
 * @param promise   原始 Promise
 * @param ms        超时时间（毫秒）
 * @param errorMsg  超时错误消息
 * @returns 原始 Promise 的结果，或超时后抛出错误
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
    return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))]);
}

/**
 * 延迟指定毫秒（用于重试间隔）
 */
export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 计算指数退避延迟时间
 *
 * @param attempt  当前重试次数（从 0 开始）
 * @param baseMs   基础延迟（毫秒）
 * @param maxMs    最大延迟（毫秒）
 * @returns 延迟时间（毫秒），加上随机抖动防止雷鸣效应
 */
export function calculateBackoffDelay(attempt: number, baseMs: number = RETRY_BASE_DELAY_MS, maxMs: number = RETRY_MAX_DELAY_MS): number {
    const exponentialDelay = Math.min(baseMs * Math.pow(2, attempt), maxMs);
    const randomFraction = randomBytes(4).readUInt32BE(0) / 0xffffffff;
    const jitter = exponentialDelay * randomFraction * 0.5;
    return Math.floor(exponentialDelay + jitter);
}

/**
 * 判断错误是否为网络错误（需要等待后重试）
 */
export function isNetworkError(errorMsg: string): boolean {
    return NETWORK_ERROR_PATTERNS.some((pattern) => errorMsg.includes(pattern));
}

/**
 * 获取镜像代理 URL
 *
 * 将 GitHub URL 转换为镜像代理 URL，加速国内访问。
 *
 * @param originalUrl   原始 GitHub URL（含 https://）
 * @param mirrorSource  镜像源名称
 * @returns 转换后的 URL（如果是直连则返回原 URL）
 */
export function getMirrorUrl(originalUrl: string, mirrorSource: MirrorSourceName = 'direct'): string {
    if (mirrorSource === 'direct' || !mirrorSource) return originalUrl;
    const source = GITHUB_MIRROR_SOURCES.find((s) => s.name === mirrorSource);
    if (!source || !source.url) return originalUrl;
    if (source.keepProtocol) return `${source.url}/${originalUrl}`;
    const strippedUrl = originalUrl.replace(/^https:\/\//i, '');
    return `${source.url}/${strippedUrl}`;
}

/**
 * 校验路径是否在目标目录内
 *
 * @param targetPath  待校验的路径
 * @param targetDir   目标目录（可选，默认通过调用方传入）
 * @returns true 表示路径安全
 */
export function isPathWithinTargetDir(targetPath: string, targetDir?: string): boolean {
    if (!targetDir) return true;
    const resolved = path.resolve(targetPath);
    const target = path.resolve(targetDir);
    return resolved.startsWith(target + path.sep) || resolved === target;
}
