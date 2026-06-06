package com.github.stars.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.github.stars.dto.AuthorDTO;
import com.github.stars.entity.GithubRepo;
import com.github.stars.mapper.AuthorMapper;
import com.github.stars.mapper.GithubRepoMapper;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.ArrayList;
import java.util.List;

/**
 * 作者中心业务逻辑
 */
@Service
public class AuthorService {

    @Resource
    private AuthorMapper authorMapper;

    @Resource
    private GithubRepoMapper githubRepoMapper;

    /**
     * 分页查询作者列表
     * @param page    页码
     * @param size    每页大小
     * @param keyword 作者名搜索关键词（可选）
     * @return 分页结果（records 为 AuthorDTO 列表）
     */
    public Page<AuthorDTO> getAuthorPage(int page, int size, String keyword) {
        // 手动查询总数（GROUP BY 查询 MyBatis-Plus 自动 count 不准确）
        Long total = authorMapper.countAuthors(keyword);

        // 构建分页对象（禁用自动 count 查询）
        Page<AuthorDTO> pageParam = new Page<>(page, size, false);
        pageParam.setTotal(total != null ? total : 0L);

        List<AuthorDTO> records = authorMapper.selectAuthorPage(pageParam, keyword);
        if (records != null) {
            pageParam.setRecords(records);
        } else {
            pageParam.setRecords(new ArrayList<>());
        }

        return pageParam;
    }

    /**
     * 查询某作者的所有仓库（分页 + 排序）
     */
    public Page<GithubRepo> getAuthorRepos(String ownerName, int page, int size,
                                           String sortBy, String sortOrder) {
        Page<GithubRepo> pageParam = new Page<>(page, size);

        LambdaQueryWrapper<GithubRepo> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(GithubRepo::getOwnerName, ownerName);

        // 排序
        boolean isAsc = "asc".equalsIgnoreCase(sortOrder);
        if ("stars_count".equals(sortBy)) {
            wrapper.orderBy(true, isAsc, GithubRepo::getStarsCount);
        } else if ("forks_count".equals(sortBy)) {
            wrapper.orderBy(true, isAsc, GithubRepo::getForksCount);
        } else if ("repo_updated_at".equals(sortBy)) {
            wrapper.orderBy(true, isAsc, GithubRepo::getRepoUpdatedAt);
        } else if ("repo_created_at".equals(sortBy)) {
            wrapper.orderBy(true, isAsc, GithubRepo::getRepoCreatedAt);
        } else if ("repo_pushed_at".equals(sortBy)) {
            wrapper.orderBy(true, isAsc, GithubRepo::getRepoPushedAt);
        } else {
            // 默认按 starred_at 排序
            wrapper.orderBy(true, isAsc, GithubRepo::getStarredAt);
        }

        return githubRepoMapper.selectPage(pageParam, wrapper);
    }

    /**
     * 查询某作者所有仓库的 URL 列表（导出用）
     */
    public List<String> getAuthorAllRepoUrls(String ownerName, String sortBy, String sortOrder) {
        LambdaQueryWrapper<GithubRepo> wrapper = new LambdaQueryWrapper<>();
        wrapper.select(GithubRepo::getHtmlUrl)
                .eq(GithubRepo::getOwnerName, ownerName);

        // 排序
        boolean isAsc = "asc".equalsIgnoreCase(sortOrder);
        if ("stars_count".equals(sortBy)) {
            wrapper.orderBy(true, isAsc, GithubRepo::getStarsCount);
        } else {
            wrapper.orderBy(true, isAsc, GithubRepo::getStarredAt);
        }

        List<GithubRepo> repos = githubRepoMapper.selectList(wrapper);
        List<String> urls = new ArrayList<>();
        for (GithubRepo repo : repos) {
            if (repo.getHtmlUrl() != null && !repo.getHtmlUrl().isEmpty()) {
                urls.add(repo.getHtmlUrl());
            }
        }
        return urls;
    }

    /**
     * 获取某作者的仓库总数（用于详情页概览）
     */
    public long getAuthorRepoCount(String ownerName) {
        LambdaQueryWrapper<GithubRepo> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(GithubRepo::getOwnerName, ownerName);
        return githubRepoMapper.selectCount(wrapper);
    }
}
