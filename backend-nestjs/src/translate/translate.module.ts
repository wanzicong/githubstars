import { Module } from '@nestjs/common';
import { TranslateService } from './services/translate.service';
import { TranslateTaskService } from './services/translate-task.service';
import { TranslateController } from './controllers/translate.controller';
import { GithubModule } from '../github/github.module';
import { ConfigModule } from '../config/config.module';

/**
 * 翻译功能模块
 *
 * 负责 GitHub 仓库描述和 README 的 AI 翻译，基于 DeepSeek API。
 * 支持同步/异步翻译、批量翻译、任务进度查询（SSE）、失败重试等功能。
 * 依赖于 GithubModule（GitHub API 交互）和 ConfigModule（配置管理）。
 */
@Module({
    imports: [GithubModule, ConfigModule],
    controllers: [TranslateController],
    providers: [TranslateService, TranslateTaskService],
    exports: [TranslateService, TranslateTaskService],
})
export class TranslateModule {}
