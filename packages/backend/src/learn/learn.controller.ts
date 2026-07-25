import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { LearnService } from './learn.service';
import { LearnTagService } from './learn-tag.service';
import {
    LearnCheckReposSchema,
    LearnCreateSchema,
    LearnDeleteSchema,
    LearnDetailSchema,
    LearnListSchema,
    LearnQuickAddSchema,
    LearnTagCreateSchema,
    LearnTagDeleteSchema,
    LearnTagUpdateSchema,
    LearnUpdateSchema,
    type LearnCheckReposDto,
    type LearnCreateDto,
    type LearnDeleteDto,
    type LearnDetailDto,
    type LearnListDto,
    type LearnQuickAddDto,
    type LearnTagCreateDto,
    type LearnTagDeleteDto,
    type LearnTagUpdateDto,
    type LearnUpdateDto,
} from './learn.dto';

/**
 * 学习记录控制器
 *
 * 所有端点使用 POST + @Body 传递参数（项目规范）。
 * 路径前缀 /api/learn
 */
@ApiTags('learn')
@Controller('api/learn')
export class LearnController {
    constructor(private readonly service: LearnService) {}

    @Post('list')
    @ApiOperation({ summary: '学习记录分页查询', description: '支持状态/优先级/分类/标签/关键字筛选，分页返回' })
    list(@Body(new ZodValidationPipe(LearnListSchema)) body: LearnListDto) {
        return this.service.findPage(body);
    }

    @Post('detail')
    @ApiOperation({ summary: '学习记录详情', description: '返回单条学习记录（含仓库摘要 + 标签 + 笔记）' })
    detail(@Body(new ZodValidationPipe(LearnDetailSchema)) body: LearnDetailDto) {
        return this.service.findOne(body.id);
    }

    @Post('create')
    @ApiOperation({ summary: '创建学习记录', description: '把指定 repo 加入学习清单' })
    create(@Body(new ZodValidationPipe(LearnCreateSchema)) body: LearnCreateDto) {
        return this.service.create(body);
    }

    @Post('quick-add')
    @ApiOperation({ summary: '一键加入学习', description: 'StarList 卡片书签按钮调用，幂等' })
    quickAdd(@Body(new ZodValidationPipe(LearnQuickAddSchema)) body: LearnQuickAddDto) {
        return this.service.quickAdd(body.repoId);
    }

    @Post('check-repos')
    @ApiOperation({ summary: '批量检查 repo 是否已加入学习', description: '返回 map: repoId -> learnRecordId，用于卡片书签高亮' })
    checkRepos(@Body(new ZodValidationPipe(LearnCheckReposSchema)) body: LearnCheckReposDto) {
        return this.service.checkRepos(body.repoIds);
    }

    @Post('update')
    @ApiOperation({ summary: '更新学习记录', description: '更新状态/优先级/笔记/标签，状态变更自动维护时间戳' })
    update(@Body(new ZodValidationPipe(LearnUpdateSchema)) body: LearnUpdateDto) {
        return this.service.update(body);
    }

    @Post('delete')
    @ApiOperation({ summary: '删除学习记录', description: '把 repo 移出学习清单' })
    delete(@Body(new ZodValidationPipe(LearnDeleteSchema)) body: LearnDeleteDto) {
        return this.service.delete(body.id);
    }

    @Post('stats')
    @ApiOperation({ summary: '状态统计', description: '返回 WANT/LEARNING/DONE/SHELVED/ALL 各状态记录数' })
    stats() {
        return this.service.stats();
    }
}

/**
 * 学习标签控制器
 *
 * 路径前缀 /api/learn-tag
 */
@ApiTags('learn-tag')
@Controller('api/learn-tag')
export class LearnTagController {
    constructor(private readonly service: LearnTagService) {}

    @Post('list')
    @ApiOperation({ summary: '标签列表', description: '返回所有标签（按使用频次倒序）' })
    list() {
        return this.service.list();
    }

    @Post('create')
    @ApiOperation({ summary: '新建标签', description: '重名返回 400' })
    create(@Body(new ZodValidationPipe(LearnTagCreateSchema)) body: LearnTagCreateDto) {
        return this.service.create(body);
    }

    @Post('update')
    @ApiOperation({ summary: '更新标签', description: '改名/改色' })
    update(@Body(new ZodValidationPipe(LearnTagUpdateSchema)) body: LearnTagUpdateDto) {
        return this.service.update(body);
    }

    @Post('delete')
    @ApiOperation({ summary: '删除标签', description: '级联删除 learn_tag_link 关联' })
    delete(@Body(new ZodValidationPipe(LearnTagDeleteSchema)) body: LearnTagDeleteDto) {
        return this.service.delete(body.id);
    }
}
