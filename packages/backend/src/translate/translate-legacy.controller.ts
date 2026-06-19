import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { TranslateService } from './translate.service';
import { TranslateTaskService } from './translate-task.service';
import { GithubRepoService } from '../github/github-repo.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { IdParamSchema } from '../common/dto/id-param.dto';
import type { IdParamDto } from '../common/dto/id-param.dto';

/**
 * 翻译旧接口兼容控制器
 *
 * 保留 v1 版本的端点路由，内部委托给新的 Service/TaskService 实现，
 * 确保前端旧调用方平滑迁移。
 */
@ApiTags('translate-legacy')
@Controller('api/translate')
export class TranslateLegacyController {
    private readonly logger = new Logger(TranslateLegacyController.name);

    constructor(
        private readonly service: TranslateService,
        private readonly taskService: TranslateTaskService,
        private readonly repoService: GithubRepoService,
    ) {}

    /**
     * POST /api/translate/description — 同步翻译描述（旧接口）
     */
    @Post('description')
    @ApiOperation({ summary: '[旧接口] 同步翻译描述', description: '对指定仓库的描述文本进行实时翻译' })
    @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } })
    async translateDesc(@Body(new ZodValidationPipe(IdParamSchema)) body: IdParamDto) {
        const result = await this.service.translateDescription(body.id);
        return { success: true, descriptionCn: result };
    }

    /**
     * POST /api/translate/readme — 同步翻译 README（旧接口）
     */
    @Post('readme')
    @ApiOperation({ summary: '[旧接口] 同步翻译 README', description: '对指定仓库的 README 进行实时翻译' })
    @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } })
    async translateReadme(@Body(new ZodValidationPipe(IdParamSchema)) body: IdParamDto) {
        const result = await this.service.translateReadme(body.id);
        return { success: true, readmeCn: result };
    }

    /**
     * POST /api/translate/readme-async — 异步翻译 README（旧接口）
     */
    @Post('readme-async')
    @ApiOperation({ summary: '[旧接口] 异步翻译 README', description: '创建异步 README 翻译任务，返回 taskId' })
    @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } })
    async translateReadmeAsync(@Body(new ZodValidationPipe(IdParamSchema)) body: IdParamDto) {
        const taskId = await this.taskService.createAndStartSingleReadme(body.id);
        if (!taskId) return { success: false, message: '仓库不存在' };
        return { success: true, taskId, message: '翻译任务已启动' };
    }

    /**
     * POST /api/translate/retranslate — 强制重新翻译 README（旧接口）
     */
    @Post('retranslate')
    @ApiOperation({ summary: '[旧接口] 强制重新翻译 README', description: '无视已有翻译结果，强制重新翻译指定仓库的 README' })
    @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } })
    async translateReadmeRetranslate(@Body(new ZodValidationPipe(IdParamSchema)) body: IdParamDto) {
        const taskId = await this.taskService.createAndStartSingleReadmeForce(body.id);
        if (!taskId) return { success: false, message: '仓库不存在' };
        return { success: true, taskId, message: '重新翻译任务已启动' };
    }

    /**
     * POST /api/translate/full — 同步翻译完整仓库（描述 + README）（旧接口）
     */
    @Post('full')
    @ApiOperation({ summary: '[旧接口] 同步翻译完整仓库', description: '同步翻译指定仓库的描述 + README（阻塞等待）' })
    @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } })
    async translateFull(@Body(new ZodValidationPipe(IdParamSchema)) body: IdParamDto) {
        const repo = await this.repoService.findById(body.id);
        if (!repo) return { success: false, message: '仓库不存在' };
        const desc = await this.service.translateDescription(body.id);
        const readme = await this.service.translateReadme(body.id);
        return { success: true, descriptionCn: desc, readmeCn: readme, readmeFetched: !!readme };
    }

    /**
     * POST /api/translate/repo-status — 查询单仓库翻译状态（旧接口）
     */
    @Post('repo-status')
    @ApiOperation({ summary: '[旧接口] 查询单仓库翻译状态', description: '查询指定仓库的描述和 README 翻译状态' })
    @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } })
    async status(@Body(new ZodValidationPipe(IdParamSchema)) body: IdParamDto) {
        const repo = await this.repoService.findById(body.id);
        if (!repo) return { success: false, message: '仓库不存在' };
        return {
            success: true,
            descriptionTranslated: !!repo.descriptionCn,
            readmeFetched: repo.readmeFetched,
            readmeTranslated: !!repo.readmeCn,
            descriptionCn: repo.descriptionCn,
            readmeCn: repo.readmeCn,
        };
    }
}
