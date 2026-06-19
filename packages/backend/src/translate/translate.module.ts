import { Module } from '@nestjs/common';
import { TranslateService } from './translate.service';
import { TranslateTaskService } from './translate-task.service';
import { SseManagerService } from './sse-manager.service';
import { TranslateController } from './translate.controller';
import { TranslateLegacyController } from './translate-legacy.controller';
import { GithubModule } from '../github/github.module';

/**
 * 翻译功能模块
 *
 * 负责 GitHub 仓库描述和 README 的 AI 翻译，基于 DeepSeek API。
 * 支持同步/异步翻译、批量翻译、任务进度查询（SSE）、失败重试等功能。
 * 依赖于 GithubModule（GitHub API 交互），ConfigModule 已全局化无需显式导入。
 */
@Module({
    imports: [GithubModule],
    controllers: [TranslateController, TranslateLegacyController],
    providers: [TranslateService, TranslateTaskService, SseManagerService],
    exports: [TranslateService, TranslateTaskService, SseManagerService],
})
export class TranslateModule {}
