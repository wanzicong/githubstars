import { Injectable, Logger } from '@nestjs/common';
import { ITool, ToolRiskLevel, ToolExecutionContext } from '../tool.interface';
import { ExportService } from '../../../export/export.service';

/**
 * 导出 Markdown 工具。
 *
 * 高风险工具：Phase 3 需审批。
 */
@Injectable()
export class ExportMarkdownTool implements ITool {
    readonly name = 'export_markdown';
    readonly displayName = '导出 Markdown';
    readonly description = '将 GitHub Star 仓库列表导出为 Markdown 格式。';
    readonly source = 'builtin' as const;
    readonly riskLevel = ToolRiskLevel.HIGH;
    readonly inputSchema = {
        type: 'object',
        properties: {
            keyword: { type: 'string', description: '筛选关键词' },
            language: { type: 'string', description: '编程语言筛选' },
            maxCount: { type: 'number', description: '最大导出数', default: 100 },
        },
    };

    private readonly logger = new Logger(ExportMarkdownTool.name);

    constructor(private readonly exportService: ExportService) {}

    async execute(input: Record<string, unknown>, _context: ToolExecutionContext): Promise<unknown> {
        const keyword = (input.keyword as string) || '';
        const language = (input.language as string) || '';
        const maxCount = (input.maxCount as number) || 100;

        this.logger.log(`[export_markdown] keyword="${keyword}" language="${language}" maxCount=${maxCount}`);

        try {
            const markdown = await this.exportService.generateMarkdown(
                { keyword, language },
                Math.min(maxCount, 200),
            );
            return {
                success: true,
                markdown: markdown?.substring(0, 8000) || '(empty)',
            };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }
}
