import { Module } from '@nestjs/common';
import { AgentSimilarService } from './services/agent-similar.service';
import { AgentSimilarController } from './controllers/agent-similar.controller';

/**
 * Agent 功能模块
 *
 * 基于 Claude Agent SDK (@anthropic-ai/claude-agent-sdk) 提供智能代理能力。
 *
 * 当前功能:
 * - 相似项目搜索: 使用 Agent 的 WebSearch/WebFetch 工具在互联网上搜索相似开源项目
 *
 * 依赖:
 * - PrismaModule（全局模块，自动注入 PrismaService）
 * - Claude Agent SDK（需 ANTHROPIC_API_KEY 环境变量）
 *
 * 注意:
 * - PrismaModule 是 @Global() 全局模块，无需显式导入
 * - Agent SDK 通过 spawn Claude Code CLI 子进程运行
 * - 在生产环境中应设置 settingSources: [] 避免加载不必要的配置
 */
@Module({
    controllers: [AgentSimilarController],
    providers: [AgentSimilarService],
    exports: [AgentSimilarService],
})
export class AgentModule {}
