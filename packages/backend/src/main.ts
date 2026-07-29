// 加载 .env（仅开发环境；打包环境由 spawn 传入环境变量）
try {
    const dotenv = require('dotenv');
    dotenv.config({ path: require('path').resolve(__dirname, '..', '.env') });
} catch {
    // dotenv 不可用 — 环境变量已通过父进程传入
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LoggingService } from './logging/logging.service';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * 应用启动入口函数
 *
 * 创建 NestJS 应用实例，配置自定义日志服务、Swagger API 文档，监听指定端口并输出启动日志。
 * 端口由环境变量 PORT 控制，默认 10002。
 * Swagger 文档可通过 /api/docs 访问。
 */
async function bootstrap() {
    // 确保数据库表结构存在（桌面端 SQLite 首次启动时创建，Web 端 MySQL 无影响）
    // 必须在 NestJS 初始化之前执行，否则 onModuleInit 中查询不存在的表会崩溃
    try {
        const dbUrl = process.env.DATABASE_URL || '';
        if (dbUrl.startsWith('file:')) {
            console.log('[Bootstrap] 同步 SQLite 数据库表结构...');
            const prismaCli = require.resolve('prisma/build/index.js');
            execSync(`"${process.execPath}" "${prismaCli}" db push --skip-generate`, {
                env: { ...process.env, DATABASE_URL: dbUrl },
                timeout: 30000,
                stdio: 'pipe',
            });
            console.log('[Bootstrap] SQLite 数据库表结构同步完成');
        }
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[Bootstrap] 数据库表结构同步失败（不阻塞启动）:', msg);
    }

    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
    });
    app.useLogger(app.get(LoggingService));

    // 全局验证管道：确保所有 DTO 经过白名单过滤和类型转换
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }));

    // CORS — 允许前端开发服务器直连（SSE 流式端点需要绕过 Vite 代理缓冲）
    const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:10001')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    app.enableCors({
        origin: corsOrigins,
        credentials: true,
    });

    // Swagger API 文档配置
    const swaggerConfig = new DocumentBuilder()
        .setTitle('GitHub Stars 管理系统')
        .setDescription('对自己 Star 过的 GitHub 仓库进行管理、分类、翻译、统计、AI 分析的后端 API 文档')
        .setVersion('1.0.0')
        .addTag('stars', '星标仓库列表与详情')
        .addTag('sync', 'Star 数据同步')
        .addTag('config', '系统配置')
        .addTag('categories', '仓库分类管理（树形结构）')
        .addTag('stats', '统计分析')
        .addTag('authors', '作者中心')
        .addTag('trending', 'GitHub Trending')
        .addTag('github', 'GitHub 搜索与 Star 操作')
        .addTag('export', 'Markdown 导出')
        .addTag('analyze', 'AI 分析')
        .addTag('classify', 'AI 分类')
        .addTag('similar', '相似仓库')
        .addTag('logs', '日志管理')
        .addTag('agent', 'AI Agent 对话')
        .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);

    const port = process.env.PORT ?? 10002;
    await app.listen(port);
    console.log(`[Bootstrap] 服务已启动: http://localhost:${port}`);
    console.log(`[Bootstrap] Swagger 文档: http://localhost:${port}/api/docs`);
}

/** 执行启动流程 */
bootstrap().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Bootstrap] 启动失败: ${msg}`);
    process.exit(1);
});
