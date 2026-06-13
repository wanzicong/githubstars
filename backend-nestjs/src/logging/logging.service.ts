import { Injectable, LoggerService, OnModuleDestroy } from '@nestjs/common';
import * as winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = path.resolve(process.cwd(), 'logs');

/**
 * 自定义日志服务 — 基于 Winston 的多通道日志系统
 *
 * 实现 NestJS LoggerService 接口，提供控制台 + 文件双输出：
 * - 控制台：带颜色，便于开发调试
 * - app.log：全量日志滚动文件（10MB / 5 个）
 * - error.log：仅错误级别滚动文件（5MB / 3 个）
 * - 支持按上下文（context）创建子 logger，兼容 NestJS 标准日志 API
 */
@Injectable()
export class LoggingService implements LoggerService, OnModuleDestroy {
    private readonly winstonLogger: winston.Logger;
    private readonly contextCache = new Map<string, winston.Logger>();

    /**
     * 初始化 Winston 日志服务
     *
     * 自动创建 logs 目录，配置控制台、全量文件和错误文件三个传输通道。
     */
    constructor() {
        // 确保日志目录存在
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }

        const customFormat = winston.format.printf(({ timestamp, level, context, message, stack, ...meta }) => {
            const ctx = context ? `[${context}] ` : '';
            const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
            return `${timestamp} ${level.toUpperCase().padEnd(7)} ${ctx}${message}${metaStr}${stack ? '\n' + stack : ''}`;
        });

        this.winstonLogger = winston.createLogger({
            level: 'debug',
            format: winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), winston.format.errors({ stack: true }), customFormat),
            transports: [
                // 控制台输出
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.timestamp({ format: 'HH:mm:ss' }),
                        winston.format.colorize({ all: true }),
                        winston.format.printf(({ timestamp, level, context, message, stack }) => {
                            const ctx = context ? `\x1b[33m[${context}]\x1b[0m ` : '';
                            return `${timestamp} ${level} ${ctx}${message}${stack ? '\n' + stack : ''}`;
                        }),
                    ),
                }),
                // 文件输出（所有级别）
                new winston.transports.File({
                    dirname: LOG_DIR,
                    filename: 'app.log',
                    maxsize: 10 * 1024 * 1024, // 10MB
                    maxFiles: 5,
                    format: customFormat,
                }),
                // 错误单独文件
                new winston.transports.File({
                    dirname: LOG_DIR,
                    filename: 'error.log',
                    level: 'error',
                    maxsize: 5 * 1024 * 1024, // 5MB
                    maxFiles: 3,
                    format: customFormat,
                }),
            ],
        });
        this.log('日志服务初始化完成 — 日志目录: ' + LOG_DIR, 'LoggingService');
    }

    /**
     * 模块销毁时优雅关闭 Winston logger，释放文件句柄
     */
    onModuleDestroy() {
        this.log('日志服务关闭', 'LoggingService');
        this.winstonLogger.close();
    }

    /**
     * 为指定上下文获取或创建子 logger
     *
     * 通过 Winston 的 child() 创建带有 context 元数据的子 logger，
     * 结果缓存以便复用。与 NestJS 标准 Logger API 兼容。
     *
     * @param context 上下文名称（通常为类名），为空时返回根 logger
     * @returns 带有 context 元数据的 Winston logger 实例
     */
    private getContextLogger(context?: string): winston.Logger {
        if (!context) return this.winstonLogger;
        const cached = this.contextCache.get(context);
        if (cached) return cached;
        const child = this.winstonLogger.child({ context });
        this.contextCache.set(context, child);
        return child;
    }

    /**
     * 记录 info 级别日志
     *
     * @param message 日志消息
     * @param context 上下文名称（可选，通常为类名）
     */
    log(message: any, context?: string) {
        this.getContextLogger(context).info(String(message));
    }

    /**
     * 记录 error 级别日志
     *
     * 支持多种错误格式：堆栈字符串、Error 对象或纯文本消息。
     *
     * @param message 错误消息或 Error 对象
     * @param trace 堆栈信息（可选）
     * @param context 上下文名称（可选，通常为类名）
     */
    error(message: any, trace?: string, context?: string) {
        const logger = this.getContextLogger(context);
        if (trace) {
            logger.error(String(message), { stack: trace });
        } else if (message instanceof Error) {
            logger.error(message.message, { stack: message.stack });
        } else {
            logger.error(String(message));
        }
    }

    /**
     * 记录 warn 级别日志
     *
     * @param message 警告消息
     * @param context 上下文名称（可选，通常为类名）
     */
    warn(message: any, context?: string) {
        this.getContextLogger(context).warn(String(message));
    }

    /**
     * 记录 debug 级别日志
     *
     * @param message 调试消息
     * @param context 上下文名称（可选，通常为类名）
     */
    debug(message: any, context?: string) {
        this.getContextLogger(context).debug(String(message));
    }

    /**
     * 记录 verbose 级别日志（最低优先级）
     *
     * @param message 详细信息
     * @param context 上下文名称（可选，通常为类名）
     */
    verbose(message: any, context?: string) {
        this.getContextLogger(context).verbose(String(message));
    }

    // ---- 日志读取 API ----

    /**
     * 获取日志目录下所有 .log 文件列表
     *
     * 按修改时间降序排列。
     *
     * @returns 日志文件信息数组，包含文件名、大小和最后修改时间
     */
    getLogFiles(): { name: string; size: number; mtime: string }[] {
        if (!fs.existsSync(LOG_DIR)) return [];
        return fs
            .readdirSync(LOG_DIR)
            .filter((f) => f.endsWith('.log'))
            .map((f) => {
                const stat = fs.statSync(path.join(LOG_DIR, f));
                return { name: f, size: stat.size, mtime: stat.mtime.toISOString() };
            })
            .sort((a, b) => b.mtime.localeCompare(a.mtime));
    }

    /**
     * 读取指定日志文件的内容
     *
     * 内置路径穿越防护（仅允许 .log 后缀文件）。
     * 不传 lines 参数时返回完整内容，否则返回最后 N 行。
     *
     * @param filename 日志文件名（仅文件名，不允许路径）
     * @param lines 返回最后 N 行（可选）
     * @returns 日志文件内容字符串，文件不存在时返回空字符串
     */
    readLogFile(filename: string, lines?: number): string {
        // 安全检查：防止路径穿越
        const safe = path.basename(filename);
        if (!safe.endsWith('.log')) return '';

        const filePath = path.join(LOG_DIR, safe);
        if (!fs.existsSync(filePath)) return '';

        if (!lines) {
            return fs.readFileSync(filePath, 'utf-8');
        }

        // 读取最后 N 行
        const content = fs.readFileSync(filePath, 'utf-8');
        const allLines = content.split('\n');
        const lastN = allLines.slice(-lines);
        return lastN.join('\n');
    }

    /**
     * 清空指定日志文件的内容
     *
     * 内置路径穿越防护（仅允许 .log 后缀文件）。清空成功时记录操作日志。
     *
     * @param filename 日志文件名（仅文件名，不允许路径）
     * @returns 清空成功返回 true，文件不存在或非法文件名返回 false
     */
    clearLogFile(filename: string): boolean {
        const safe = path.basename(filename);
        if (!safe.endsWith('.log')) return false;
        const filePath = path.join(LOG_DIR, safe);
        if (!fs.existsSync(filePath)) return false;
        fs.writeFileSync(filePath, '');
        this.log('日志文件已清空: ' + safe, 'LoggingService');
        return true;
    }
}
