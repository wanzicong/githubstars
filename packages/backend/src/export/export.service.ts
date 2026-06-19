import { Injectable, Logger } from '@nestjs/common';
import { GithubRepoService } from '../github/services/github-repo.service';

/** Markdown 导出的筛选条件描述 */
interface MarkdownFilters {
    keyword?: string;
    language?: string;
    sortBy?: string;
    sortOrder?: string;
    dateField?: string;
    startDate?: string;
    endDate?: string;
    untranslatedOnly?: boolean;
}

/** Markdown 导出所需的仓库字段 */
interface RepoForExport {
    fullName: string;
    starsCount: number;
    forksCount: number;
    language: string | null;
    htmlUrl: string;
    homepage: string | null;
    descriptionCn: string | null;
    description: string | null;
    readmeCn: string | null;
    readmeOriginal: string | null;
}

/**
 * 导出服务
 *
 * 负责将仓库数据渲染为 Markdown 文档，供 Controller 设置响应头后返回给客户端。
 */
@Injectable()
export class ExportService {
    private readonly logger = new Logger(ExportService.name);

    constructor(private readonly repoService: GithubRepoService) {}

    /**
     * 按筛选条件查询仓库并生成 Markdown 文档
     *
     * @param filters 筛选条件（关键词、语言、时间范围、翻译状态等）
     * @param maxCount 最大导出条数
     * @returns 完整的 Markdown 字符串
     */
    async generateMarkdown(filters: MarkdownFilters, maxCount: number): Promise<string> {
        this.logger.log(
            `开始导出Markdown: keyword=${filters.keyword || ''}, language=${filters.language || ''}, maxCount=${maxCount}`,
        );

        const result = await this.repoService.findPage({
            page: 1,
            size: maxCount,
            keyword: filters.keyword,
            language: filters.language,
            sortBy: filters.sortBy,
            sortOrder: filters.sortOrder,
            dateField: filters.dateField,
            startDate: filters.startDate,
            endDate: filters.endDate,
            untranslatedOnly: filters.untranslatedOnly,
        });
        const repos = result.records as RepoForExport[];
        this.logger.log(`查询到 ${repos.length} 个仓库，开始生成Markdown`);

        let md = '# GitHub Stars 导出\n\n';
        if (filters.keyword) md += `> 关键词: ${filters.keyword}\n`;
        if (filters.language) md += `> 语言: ${filters.language}\n`;
        if (filters.dateField && (filters.startDate || filters.endDate)) {
            md += `> 时间范围: ${filters.startDate || '不限'} ~ ${filters.endDate || '不限'}\n`;
        }
        if (filters.untranslatedOnly) md += `> 仅未翻译\n`;
        md += `> 导出时间: ${new Date().toISOString()}\n\n---\n\n`;

        const total = repos.length;
        for (let i = 0; i < repos.length; i++) {
            const repo = repos[i];
            md += `## ${i + 1}. ${repo.fullName}\n\n`;
            md += `> 📋 **第 ${i + 1} / ${total} 个项目**\n\n`;
            md += `- ⭐ ${repo.starsCount} | 🍴 ${repo.forksCount} | 语言: ${repo.language || '未知'}\n`;
            md += `- 🔗 [GitHub](${repo.htmlUrl})\n`;
            if (repo.homepage) md += `- 🏠 [主页](${repo.homepage})\n`;
            const desc = repo.descriptionCn || repo.description;
            if (desc) md += `\n${desc}\n`;
            if (repo.readmeCn) md += `\n### README 中文翻译\n\n${String(repo.readmeCn).substring(0, 5000)}\n`;
            else if (repo.readmeOriginal) md += `\n### README\n\n${String(repo.readmeOriginal).substring(0, 5000)}\n`;
            md += '\n---\n\n';
        }

        this.logger.log(`导出Markdown完成: ${repos.length} 个仓库`);
        return md;
    }
}
