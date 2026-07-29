import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
    LocalizeBatchSchema,
    type LocalizeBatchDto,
    LocalizeRepositorySchema,
    type LocalizeRepositoryDto,
    LocalizationTaskSchema,
    type LocalizationTaskDto,
} from './dto/localization.dto';
import { RepositoryLocalizationService } from './repository-localization.service';

@ApiTags('仓库中文化')
@Controller('api/localization')
export class LocalizationController {
    constructor(private readonly localization: RepositoryLocalizationService) {}

    @Post('repository')
    @ApiOperation({ summary: '中文化单个 Star 仓库的描述和/或 README' })
    localizeRepository(@Body(new ZodValidationPipe(LocalizeRepositorySchema)) body: LocalizeRepositoryDto) {
        return this.localization.localizeRepository(body.repoId, body.fields, body.force);
    }

    @Post('batch')
    @ApiOperation({ summary: '创建批量仓库中文化任务' })
    createBatch(@Body(new ZodValidationPipe(LocalizeBatchSchema)) body: LocalizeBatchDto) {
        return this.localization.createBatch(body.repoIds, body.fields, body.force, body.concurrency);
    }

    @Post('task')
    @ApiOperation({ summary: '查询仓库中文化任务进度和有限异常明细' })
    getTask(@Body(new ZodValidationPipe(LocalizationTaskSchema)) body: LocalizationTaskDto) {
        return this.localization.getTask(body.taskId, body.itemLimit);
    }

    @Post('retry')
    @ApiOperation({ summary: '重试仓库中文化任务中的失败项' })
    retryTask(@Body(new ZodValidationPipe(LocalizationTaskSchema)) body: LocalizationTaskDto) {
        return this.localization.retryTask(body.taskId);
    }
}
