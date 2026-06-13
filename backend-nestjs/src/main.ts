import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingService } from './logging/logging.service';

/**
 * 应用启动入口函数
 *
 * 创建 NestJS 应用实例，配置自定义日志服务，监听指定端口并输出启动日志。
 * 端口由环境变量 PORT 控制，默认 3000。
 */
async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
    });
    app.useLogger(app.get(LoggingService));

    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    console.log(`[Bootstrap] 服务已启动: http://localhost:${port}`);
}

/** 执行启动流程 */
bootstrap();
