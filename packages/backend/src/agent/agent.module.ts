import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentClientService } from './agent-client.service';
import { AgentSessionService } from './agent-session.service';
import { AgentCredentialService } from './agent-credential.service';

/**
 * AI Agent 模块（自 packages/github-agent 合并）
 *
 * 基于 Claude Agent SDK 的智能仓库浏览与搜索代理。
 * 会话持久化复用全局 PrismaService（agent_sessions/agent_messages 表），
 * 凭据统一通过 ConfigService 从 system_config 表读取，
 * ConfigModule/PrismaModule 均为全局模块无需显式导入。
 */
@Module({
    controllers: [AgentController],
    providers: [AgentClientService, AgentSessionService, AgentCredentialService],
})
export class AgentModule {}
