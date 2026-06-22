import { Module } from '@nestjs/common';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { GithubModule } from '../github/github.module';

/**
 * 导出功能模块
 *
 * 提供 Markdown 格式的仓库列表导出功能，支持按筛选条件生成文件下载。
 * 依赖于 GithubModule（仓库数据查询）。
 */
@Module({
    imports: [GithubModule],
    controllers: [ExportController],
    providers: [ExportService],
    exports: [ExportService],
})
export class ExportModule {}
