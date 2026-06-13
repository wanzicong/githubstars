import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingService } from './logging/logging.service';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
    });
    app.useLogger(app.get(LoggingService));

    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    console.log(`[Bootstrap] 服务已启动: http://localhost:${port}`);
}
bootstrap();
