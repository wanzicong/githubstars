import { Module } from '@nestjs/common';
import { TagModule } from '../tag/tag.module';
import { PromptService } from './prompt.service';

/**
 * 提示词管理模块
 *
 * 集中管理所有 AI/Agent 提示词的构建逻辑。
 * 依赖 TagModule 以从数据库动态加载标签体系信息。
 *
 * 当前功能:
 * - 标签维度提示词动态构建（从 DB 加载维度+标签）
 * - Agent 打标签完整系统提示词生成
 * - 维度简称/全名映射
 */
@Module({
    imports: [TagModule],
    providers: [PromptService],
    exports: [PromptService],
})
export class PromptModule {}
