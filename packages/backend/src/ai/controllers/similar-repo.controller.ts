import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { SimilarRepoService } from '../services/similar-repo.service';

@ApiTags('similar')
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
    @ApiOperation({ summary: '查找相似仓库', description: '基于仓库标签和语言查找与指定仓库相似的其他项目' })
    @ApiParam({ name: 'repoId', description: '源仓库 ID' })
    async findSimilar(@Param('repoId') repoId: string) {
        const repos = await this.service.findSimilar(parseInt(repoId));
        return { success: true, repos, count: repos.length };
    }
}
