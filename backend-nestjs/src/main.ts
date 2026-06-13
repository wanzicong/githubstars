import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LoggingService } from './logging/logging.service';

/**
 * 应用启动入口函数
 *
 * 创建 NestJS 应用实例，配置自定义日志服务、Swagger API 文档，监听指定端口并输出启动日志。
 * 端口由环境变量 PORT 控制，默认 3000。
 * Swagger 文档可通过 /api/docs 访问。
 */
async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
    });
    app.useLogger(app.get(LoggingService));

    // CORS — 允许前端开发服务器直连（SSE 流式端点需要绕过 Vite 代理缓冲）
    app.enableCors({
        origin: ['http://localhost:5173', 'http://localhost:5174'],
        credentials: true,
    });

    // Swagger API 文档配置
    const swaggerConfig = new DocumentBuilder()
        .setTitle('GitHub Stars 管理系统')
        .setDescription('对自己 Star 过的 GitHub 仓库进行管理、分类、翻译、统计、AI 分析和批量克隆的后端 API 文档')
        .setVersion('1.0.0')
        .addTag('stars', '星标仓库列表与详情')
        .addTag('sync', 'Star 数据同步')
        .addTag('config', '系统配置')
        .addTag('categories', '仓库分类管理（树形结构）')
        .addTag('translate', '翻译（DeepSeek AI）')
        .addTag('stats', '统计分析')
        .addTag('authors', '作者中心')
        .addTag('trending', 'GitHub Trending')
        .addTag('github', 'GitHub 搜索与 Star 操作')
        .addTag('clone', '批量克隆')
        .addTag('export', 'Markdown 导出')
        .addTag('analyze', 'AI 分析')
        .addTag('classify', 'AI 分类')
        .addTag('similar', '相似仓库')
        .addTag('logs', '日志管理')
        .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);

    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    console.log(`[Bootstrap] 服务已启动: http://localhost:${port}`);
    console.log(`[Bootstrap] Swagger 文档: http://localhost:${port}/api/docs`);
}

/** 执行启动流程 */
bootstrap();  
