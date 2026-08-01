import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
    LocalizationPendingQuerySchema,
    type LocalizationPendingQueryDto,
    LocalizationUpdateSchema,
    type LocalizationUpdateDto,
} from './dto/localization.dto';
import { RepositoryLocalizationService } from './repository-localization.service';

@ApiTags('仓库中文化')
@Controller('api/localization')
export class LocalizationController {
    constructor(private readonly localization: RepositoryLocalizationService) {}

    @Post('pending')
    @ApiOperation({ summary: '查询未中文化的仓库原文（描述/README），供智能体翻译' })
    findPending(@Body(new ZodValidationPipe(LocalizationPendingQuerySchema)) body: LocalizationPendingQueryDto) {
        return this.localization.findPending(body.limit, body.includeDescription, body.includeReadme);
    }

    @Post('update')
    @ApiOperation({ summary: '批量写入译文（只更新，不做翻译）' })
    updateTranslations(@Body(new ZodValidationPipe(LocalizationUpdateSchema)) body: LocalizationUpdateDto) {
        return this.localization.updateTranslations(body.items);
    }
}
