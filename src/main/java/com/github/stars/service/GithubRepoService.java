package com.github.stars.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.github.stars.entity.GithubRepo;
import com.github.stars.mapper.GithubRepoMapper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.annotation.Resource;
import java.util.List;

@Service
public class GithubRepoService {

    @Resource
    private GithubRepoMapper githubRepoMapper;

    /**
     * 分页查询Star仓库列表
     *
     * @param page      当前页码
     * @param size      每页条数
     * @param keyword   搜索关键词（仓库名、描述、作者模糊搜索）
     * @param language  语言筛选
     * @param sortBy    排序字段（stars_count, forks_count, repo_updated_at, starred_at）
     * @param sortOrder 排序方向（asc, desc）
     * @return 分页结果
     */
    public IPage<GithubRepo> findPage(int page, int size, String keyword, String language,
                                      String sortBy, String sortOrder) {
        Page<GithubRepo> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<GithubRepo> wrapper = new LambdaQueryWrapper<>();

        // 关键词搜索：仓库名、描述、作者模糊匹配
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w
                    .like(GithubRepo::getRepoName, keyword)
                    .or().like(GithubRepo::getDescription, keyword)
                    .or().like(GithubRepo::getOwnerName, keyword)
                    .or().like(GithubRepo::getFullName, keyword)
            );
        }

        // 语言筛选
        if (StringUtils.hasText(language)) {
            wrapper.eq(GithubRepo::getLanguage, language);
        }

        // 排序
        boolean isAsc = "asc".equalsIgnoreCase(sortOrder);
        switch (sortBy != null ? sortBy : "starred_at") {
            case "stars_count":
                wrapper.orderBy(true, isAsc, GithubRepo::getStarsCount);
                break;
            case "forks_count":
                wrapper.orderBy(true, isAsc, GithubRepo::getForksCount);
                break;
            case "repo_updated_at":
                wrapper.orderBy(true, isAsc, GithubRepo::getRepoUpdatedAt);
                break;
            default:
                wrapper.orderBy(true, isAsc, GithubRepo::getStarredAt);
                break;
        }

        return githubRepoMapper.selectPage(pageParam, wrapper);
    }

    /**
     * 根据ID获取仓库详情
     */
    public GithubRepo findById(Long id) {
        return githubRepoMapper.selectById(id);
    }

    /**
     * 获取所有不重复的编程语言列表（用于筛选下拉框）
     */
    public List<String> findAllLanguages() {
        LambdaQueryWrapper<GithubRepo> wrapper = new LambdaQueryWrapper<>();
        wrapper.select(GithubRepo::getLanguage)
                .isNotNull(GithubRepo::getLanguage)
                .ne(GithubRepo::getLanguage, "")
                .groupBy(GithubRepo::getLanguage)
                .orderByAsc(GithubRepo::getLanguage);
        List<GithubRepo> repos = githubRepoMapper.selectList(wrapper);
        return repos.stream()
                .map(GithubRepo::getLanguage)
                .distinct()
                .collect(java.util.stream.Collectors.toList());
    }

    /**
     * 获取Star仓库总数
     */
    public long count() {
        return githubRepoMapper.selectCount(null);
    }
}
