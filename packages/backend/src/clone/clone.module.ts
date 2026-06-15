import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { GithubModule } from '../github/github.module';
import { CloneService } from './services/clone.service';
import { CloneTaskService } from './services/clone-task.service';
import { CloneController } from './controllers/clone.controller';

/**
 * 批量克隆模块
 *
 * 提供 GitHub 仓库批量克隆功能，包含：
 * - 任务管理（创建、查询、取消、删除、置顶）
 * - 并发控制与重试机制
 * - 克隆脚本生成（Windows PowerShell / Linux Bash）
 * - 磁盘空间检查
 * - 代理 URL 支持
 * 依赖 ConfigModule（配置读取）和 GithubModule（仓库查询）。
 */
@Module({
    imports: [ConfigModule, GithubModule],
    controllers: [CloneController],
    providers: [CloneService, CloneTaskService],
    exports: [CloneService, CloneTaskService],
})
export class CloneModule {}
