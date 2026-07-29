import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentClientService } from './agent-client.service';
import { AgentSessionService } from './agent-session.service';
import { AgentCredentialService } from './agent-credential.service';
import { GithubModule } from '../github/github.module';
import { CategoryModule } from '../category/category.module';
import { StatsModule } from '../stats/stats.module';
import { CloneModule } from '../clone/clone.module';
import { DownloadModule } from '../download/download.module';
import { SyncModule } from '../sync/sync.module';
import { TrendingModule } from '../trending/trending.module';
import { AuthorModule } from '../author/author.module';
import { ConfigModule } from '../config/config.module';
import { ExportModule } from '../export/export.module';
import { LoggingModule } from '../logging/logging.module';

/**
 * AI Agent 模块（自 packages/github-agent 合并）
 *
 * 基于 Claude Agent SDK 的智能仓库浏览与搜索代理。
 * 会话持久化复用全局 PrismaService（agent_sessions/agent_messages 表），
 * 凭据统一通过 ConfigService 从 system_config 表读取，
 * ConfigModule/PrismaModule 均为全局模块无需显式导入。
 *
 * 通过 imports 引入全部业务 Module，使 AgentClientService 可以注入各业务 Service，
 * 进而通过 createSystemMcpServer 将系统 API 以 MCP 工具形式暴露给 Agent。
 */
@Module({
    imports: [
        GithubModule,
        CategoryModule,
        StatsModule,
        CloneModule,
        DownloadModule,
        SyncModule,
        TrendingModule,
        AuthorModule,
        ConfigModule,
        ExportModule,
        LoggingModule,
    ],
    controllers: [AgentController],
    providers: [AgentClientService, AgentSessionService, AgentCredentialService],
})
export class AgentModule {}
