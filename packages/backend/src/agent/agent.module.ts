import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentQueueModule } from './queue/agent-queue.module';
import { AgentQueueProcessor } from './queue/agent-queue.processor';
import { GithubModule } from '../github/github.module';
import { ExportModule } from '../export/export.module';
import { CloneModule } from '../clone/clone.module';

// 编排层
import { StreamEmitterService } from './orchestration/stream-emitter.service';
import { SessionManagerService } from './orchestration/session-manager.service';
import { WorkflowEngineService } from './orchestration/workflow-engine.service';

// 执行层
import { AgentExecutorService } from './execution/agent-executor.service';
import { ToolInvokerService } from './execution/tool-invoker.service';

// 守卫
import { RateLimiterGuard } from './guards/rate-limiter.guard';

// 监控
import { CircuitBreakerService } from './monitoring/circuit-breaker.service';
import { AgentTelemetryService } from './monitoring/agent-telemetry.service';

// 工具层
import { ToolRegistryService } from './tools/tool-registry.service';
import { McpAdapterService } from './tools/mcp-adapter.service';

// 内置工具
import { DataQueryStarsTool } from './tools/builtin/data-query.tool';
import { DataRepoDetailTool } from './tools/builtin/data-repo-detail.tool';
import { GithubSearchReposTool } from './tools/builtin/github-search.tool';
import { GithubReadmeTool } from './tools/builtin/github-readme.tool';
import { TranslateTextTool } from './tools/builtin/translate-text.tool';
import { ExportMarkdownTool } from './tools/builtin/export-markdown.tool';
import { CategorizeRepoTool } from './tools/builtin/categorize-repo.tool';
import { CloneRepoTool } from './tools/builtin/clone-repo.tool';

/**
 * 智能体底座模块。
 *
 * 提供 Agent 对话、异步任务、工具注册、流式 SSE 等全部智能体能力。
 *
 * 注意：PrismaService 和 ConfigService 由各自的 @Global() 模块全局注入，
 * 无需在此 imports 中显式引入。
 *
 * @callers
 *   - AppModule — 根模块注册
 *
 * @depends
 *   - PrismaModule (@Global) — 数据持久化
 *   - ConfigModule (@Global) — agent.* 配置读取
 */
@Module({
    imports: [
        // AgentQueueModule — 需要 Redis 连接，如未配置 Redis 请暂时注释
        // 配置方法: 在 .env 中添加 REDIS_URL=redis://:password@127.0.0.1:6379
        // AgentQueueModule,
        GithubModule,
        ExportModule,
        CloneModule,
    ],
    controllers: [AgentController],
    providers: [
        // 编排层
        StreamEmitterService,
        SessionManagerService,
        WorkflowEngineService,
        // 执行层
        AgentExecutorService,
        ToolInvokerService,
        // 守卫
        RateLimiterGuard,
        // 监控
        CircuitBreakerService,
        AgentTelemetryService,
        // 队列处理器（在父模块注册以访问 AgentExecutorService）
        // 需要 AgentQueueModule 启用时取消注释
        // AgentQueueProcessor,
        // 工具层
        ToolRegistryService,
        McpAdapterService,
        // 8 个内置工具
        DataQueryStarsTool,
        DataRepoDetailTool,
        GithubSearchReposTool,
        GithubReadmeTool,
        TranslateTextTool,
        ExportMarkdownTool,
        CategorizeRepoTool,
        CloneRepoTool,
    ],
    exports: [
        StreamEmitterService,
        AgentExecutorService,
        ToolRegistryService,
        SessionManagerService,
        WorkflowEngineService,
    ],
})
export class AgentModule implements OnModuleInit {
    private readonly logger = new Logger(AgentModule.name);

    constructor(
        private readonly toolRegistry: ToolRegistryService,
        private readonly sessionManager: SessionManagerService,
        private readonly workflowEngine: WorkflowEngineService,
        private readonly toolInvoker: ToolInvokerService,
        // 注入所有工具实例以确保 NestJS 初始化它们
        private readonly dataQuery: DataQueryStarsTool,
        private readonly dataDetail: DataRepoDetailTool,
        private readonly githubSearch: GithubSearchReposTool,
        private readonly githubReadme: GithubReadmeTool,
        private readonly translateText: TranslateTextTool,
        private readonly exportMarkdown: ExportMarkdownTool,
        private readonly categorizeRepo: CategorizeRepoTool,
        private readonly cloneRepo: CloneRepoTool,
    ) {}

    onModuleInit(): void {
        this.logger.log('[AgentModule] Registering builtin tools...');

        this.toolRegistry.registerTools([
            this.dataQuery,
            this.dataDetail,
            this.githubSearch,
            this.githubReadme,
            this.translateText,
            this.exportMarkdown,
            this.categorizeRepo,
            this.cloneRepo,
        ]);

        this.logger.log(`[AgentModule] ${this.toolRegistry.toolCount} tools registered`);
    }
}
