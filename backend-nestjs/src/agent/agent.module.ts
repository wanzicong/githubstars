import { Module } from '@nestjs/common';
import { TagModule } from '../tag/tag.module';
import { PromptModule } from '../prompt/prompt.module';
import { AgentSimilarService } from './services/agent-similar.service';
import { AgentSimilarController } from './controllers/agent-similar.controller';
import { AgentTagService } from './services/agent-tag.service';
import { AgentTagController } from './controllers/agent-tag.controller';

/**
 * Agent 功能模块
 *
 * 基于 Claude Agent SDK (@anthropic-ai/claude-agent-sdk) 提供智能代理能力。
 *
 * 当前功能:
 * - 相似项目搜索: 使用 Agent 的 WebSearch/WebFetch 工具搜索相似开源项目
 * - 智能标签分析: 自动分析仓库特征并匹配/创建标签（提示词由 PromptModule 动态生成）
 */
@Module({
    imports: [TagModule, PromptModule],
    controllers: [AgentSimilarController, AgentTagController],
    providers: [AgentSimilarService, AgentTagService],
    exports: [AgentSimilarService, AgentTagService],
})
export class AgentModule {}
