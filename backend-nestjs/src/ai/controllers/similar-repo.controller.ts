import { Controller, Get, Param } from '@nestjs/common';
import { SimilarRepoService } from '../services/similar-repo.service';

@Controller('api/similar')
export class SimilarRepoController {
    constructor(private readonly service: SimilarRepoService) {}

    @Get(':repoId')
    async findSimilar(@Param('repoId') repoId: string) {
        const repos = await this.service.findSimilar(parseInt(repoId));
        return { success: true, repos, count: repos.length };
    }
}
