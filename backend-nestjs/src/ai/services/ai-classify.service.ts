import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubRepoService } from '../../github/services/github-repo.service';
import { CategoryService } from '../../category/category.service';

@Injectable()
export class AiClassifyService {
    private readonly logger = new Logger(AiClassifyService.name);
    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
        private readonly githubRepo: GithubRepoService,
        private readonly categoryService: CategoryService,
    ) {}

    private async callDeepSeek(prompt: string, systemMsg?: string): Promise<string | null> {
        const apiKey = this.config.getValue('deepseek.api_key');
        const apiUrl = this.config.getValueDefault('deepseek.api_url', 'https://api.deepseek.com/v1/chat/completions');
        const model = this.config.getValueDefault('deepseek.model', 'deepseek-chat');
        if (!apiKey) return null;
        const msgs: any[] = [];
        if (systemMsg) msgs.push({ role: 'system', content: systemMsg });
        msgs.push({ role: 'user', content: prompt });
        try {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({ model, temperature: 0.3, max_tokens: 4096, messages: msgs }),
            });
            if (!res.ok) return null;
            const data = (await res.json()) as any;
            let content = data.choices?.[0]?.message?.content?.trim() || null;
            if (content)
                content = content
                    .replace(/^```json\s*/i, '')
                    .replace(/^```\s*/i, '')
                    .replace(/```$/i, '')
                    .trim();
            return content;
        } catch {
            return null;
        }
    }

    private parseResponse(jsonStr: string | null, repos: any[]): Record<string, number[]> {
        if (!jsonStr) return { 分类失败: [] };
        try {
            const parsed = JSON.parse(jsonStr) as Record<string, (number | string)[]>;
            const result: Record<string, number[]> = {};
            for (const [name, indices] of Object.entries(parsed)) {
                if (!Array.isArray(indices) || !indices.length) continue;
                const ids: number[] = [];
                for (const idx of indices) {
                    const i = typeof idx === 'number' ? idx : parseInt(String(idx), 10);
                    if (!isNaN(i) && i >= 0 && i < repos.length) ids.push(Number(repos[i].id));
                }
                if (ids.length) result[name] = ids;
            }
            if (!Object.keys(result).length) result['未能分类'] = repos.map((r) => Number(r.id));
            return result;
        } catch {
            return { 解析失败: [], 未能分类: repos.map((r) => Number(r.id)) };
        }
    }

    /** P1-13 FIX: 使用 repoName (从 fullName 提取) */
    private buildPrompt(repos: any[], topN: number): string {
        let list = repos
            .map((r, i) => {
                const name = r.repoName || (r.fullName ? r.fullName.split('/').pop() : '');
                const desc = String(r.descriptionCn || r.description || '').substring(0, 200);
                return `${i}. **${name}** | ${r.language || '未知'} | ${desc}${r.topics ? ' | Tags:' + r.topics : ''}`;
            })
            .join('\n');
        return `将以下项目归类到不超过 ${topN} 个分类。只返回 JSON（不要 markdown 代码块）：\n{"分类名1": [序号], "分类名2": [序号]}\n\n${list}`;
    }

    /** P1-9 FIX: 只收集 level===2 的分类名 */
    /** P1-10 FIX: 加入优先匹配强调 */
    private async buildSmartPrompt(repos: any[]): Promise<string> {
        const all = await this.categoryService.listAll();
        // P1-9: 仅 L2 分类
        const names: string[] = [];
        for (const cat of all) {
            if (cat.level === 2) names.push(cat.name);
            if (cat.children) for (const child of cat.children) if (child.level === 2) names.push(child.name);
        }
        let catsHint = names.length > 0 ? `\n现有分类（优先匹配）：${names.join('、')}\n` : '';
        const list = repos
            .map((r, i) => {
                const desc = String(r.descriptionCn || r.description || '').substring(0, 200);
                return `${i}. **${r.fullName}** | ${r.language || '未知'} | ${desc}`;
            })
            .join('\n');
        // P1-10: 优先匹配强调
        return `请对这些 GitHub 项目进行智能分类。${catsHint}\n
【重要】优先将项目归入现有分类。只有当前分类都不匹配时，才创建新分类。

只返回 JSON：\n{"分类名1": [序号], "分类名2": [序号]}\n\n${list}`;
    }

    async classify(repoIds: number[], topN = 8) {
        if (!repoIds?.length) return { success: false, message: '没有需要分类的仓库' };
        // FIX: 批量查询替代循环 N+1 查询
        const repos = await this.prisma.githubRepo.findMany({ where: { id: { in: repoIds.map(BigInt) } } });
        if (!repos.length) return { success: false, message: '没有找到仓库' };
        const prompt = this.buildPrompt(repos, topN);
        const result = await this.callDeepSeek(prompt, '你是GitHub项目推荐专家。只返回要求格式的JSON，不说任何废话。');
        const cats = this.parseResponse(result, repos);
        if (cats && !cats['分类失败']) {
            try {
                await this.categoryService.saveAiClassifyResult(cats);
            } catch (e) {
                return { success: false, message: '保存失败: ' + (e instanceof Error ? e.message : String(e)), categories: cats };
            }
        }
        return { success: true, categories: cats, totalClassified: Object.values(cats).reduce((s, ids) => s + ids.length, 0) };
    }

    async smartClassify(repoIds: number[]) {
        if (!repoIds?.length) return { success: false, message: '没有需要分类的仓库' };
        // FIX: 批量查询替代循环 N+1 查询
        const repos = await this.prisma.githubRepo.findMany({ where: { id: { in: repoIds.map(BigInt) } } });
        if (!repos.length) return { success: false, message: '没有找到仓库' };
        const prompt = await this.buildSmartPrompt(repos);
        const result = await this.callDeepSeek(prompt, '你是GitHub项目推荐专家。只返回要求格式的JSON，不说任何废话。');
        const assignments = this.parseResponse(result, repos);
        if (assignments && !assignments['分类失败']) {
            try {
                await this.categoryService.applySmartClassifyResult(assignments);
            } catch (e) {
                return { success: false, message: '保存失败: ' + (e instanceof Error ? e.message : String(e)), assignments };
            }
        }
        const allCats = await this.categoryService.listAll();
        const allNames = allCats.flatMap((c) => [c.name, ...(c.children || []).map((ch) => ch.name)]);
        let matchCount = 0,
            newCount = 0;
        for (const name of Object.keys(assignments)) {
            if (allNames.includes(name)) matchCount++;
            else newCount++;
        }
        return { success: true, assignments, matchCount, newCount };
    }
}
