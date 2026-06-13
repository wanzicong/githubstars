import { Injectable, LoggerService, OnModuleDestroy } from '@nestjs/common';
import * as winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = path.resolve(process.cwd(), 'logs');

@Injectable()
export class LoggingService implements LoggerService, OnModuleDestroy {
    private readonly winstonLogger: winston.Logger;
    private readonly contextCache = new Map<string, winston.Logger>();

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
    }

    onModuleDestroy() {
        this.winstonLogger.close();
    }

    /** 为指定上下文获取 logger（与 NestJS Logger API 兼容） */
    private getContextLogger(context?: string): winston.Logger {
        if (!context) return this.winstonLogger;
        const cached = this.contextCache.get(context);
        if (cached) return cached;
        const child = this.winstonLogger.child({ context });
        this.contextCache.set(context, child);
        return child;
    }

    log(message: any, context?: string) {
        this.getContextLogger(context).info(String(message));
    }

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

    warn(message: any, context?: string) {
        this.getContextLogger(context).warn(String(message));
    }

    debug(message: any, context?: string) {
        this.getContextLogger(context).debug(String(message));
    }

    verbose(message: any, context?: string) {
        this.getContextLogger(context).verbose(String(message));
    }

    // ---- 日志读取 API ----

    /** 获取日志文件列表 */
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

    /** 读取日志内容 */
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

    /** 清空日志文件 */
    clearLogFile(filename: string): boolean {
        const safe = path.basename(filename);
        if (!safe.endsWith('.log')) return false;
        const filePath = path.join(LOG_DIR, safe);
        if (!fs.existsSync(filePath)) return false;
        fs.writeFileSync(filePath, '');
        return true;
    }
}
