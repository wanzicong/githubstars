import { Controller, Get, Param } from '@nestjs/common';
import { SimilarRepoService } from '../services/similar-repo.service';

@Controller('api/similar')
export class SimilarRepoController {
    constructor(private readonly service: SimilarRepoService) {}

    /**
     * 查找与指定仓库相似的项目
     *
     * @param repoId 源仓库 ID
     * @returns 相似仓库列表和总数
     */
    @Get(':repoId')
    async findSimilar(@Param('repoId') repoId: string) {
        const repos = await this.service.findSimilar(parseInt(repoId));
        return { success: true, repos, count: repos.length };
    }
}
