package com.github.stars.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.github.stars.dto.LanguageStatsDTO;
import com.github.stars.dto.OverviewStatsDTO;
import com.github.stars.dto.OwnerStatsDTO;
import com.github.stars.dto.TimelineStatsDTO;
import com.github.stars.entity.GithubRepo;
import com.github.stars.mapper.GithubRepoMapper;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class StatsService {

    private final GithubRepoMapper githubRepoMapper;

    public StatsService(GithubRepoMapper githubRepoMapper) {
        this.githubRepoMapper = githubRepoMapper;
    }

    /**
     * 按编程语言统计仓库数量和占比
     */
    public List<LanguageStatsDTO> getLanguageStats() {
        QueryWrapper<GithubRepo> wrapper = new QueryWrapper<>();
        wrapper.select("IFNULL(language, '未知') AS language", "COUNT(*) AS count")
                .groupBy("language")
                .orderByDesc("count");

        List<Map<String, Object>> results = githubRepoMapper.selectMaps(wrapper);
        long total = githubRepoMapper.selectCount(null);

        List<LanguageStatsDTO> statsList = new ArrayList<>();
        for (Map<String, Object> row : results) {
            LanguageStatsDTO dto = new LanguageStatsDTO();
            Object lang = row.get("language");
            dto.setLanguage(lang != null ? lang.toString() : "未知");
            Object countObj = row.get("count");
            long count = countObj instanceof Number ? ((Number) countObj).longValue() : 0L;
            dto.setCount(count);
            dto.setPercentage(total > 0 ? Math.round(count * 10000.0 / total) / 100.0 : 0.0);
            statsList.add(dto);
        }
        return statsList;
    }

    /**
     * 按作者统计仓库数量，返回 Top N
     */
    public List<OwnerStatsDTO> getOwnerStats(int topN) {
        QueryWrapper<GithubRepo> wrapper = new QueryWrapper<>();
        wrapper.select("owner_name", "owner_avatar_url", "COUNT(*) AS count")
                .groupBy("owner_name", "owner_avatar_url")
                .orderByDesc("count")
                .last("LIMIT " + topN);

        List<Map<String, Object>> results = githubRepoMapper.selectMaps(wrapper);

        List<OwnerStatsDTO> statsList = new ArrayList<>();
        for (Map<String, Object> row : results) {
            OwnerStatsDTO dto = new OwnerStatsDTO();
            dto.setOwnerName(row.get("owner_name") != null ? row.get("owner_name").toString() : "");
            dto.setOwnerAvatarUrl(row.get("owner_avatar_url") != null ? row.get("owner_avatar_url").toString() : "");
            Object countObj = row.get("count");
            dto.setCount(countObj instanceof Number ? ((Number) countObj).longValue() : 0L);
            statsList.add(dto);
        }
        return statsList;
    }

    /**
     * 按年月统计Star数量趋势
     */
    public List<TimelineStatsDTO> getTimelineStats() {
        QueryWrapper<GithubRepo> wrapper = new QueryWrapper<>();
        wrapper.select("DATE_FORMAT(starred_at, '%Y-%m') AS month", "COUNT(*) AS count")
                .isNotNull("starred_at")
                .groupBy("month")
                .orderByAsc("month");

        List<Map<String, Object>> results = githubRepoMapper.selectMaps(wrapper);

        List<TimelineStatsDTO> statsList = new ArrayList<>();
        for (Map<String, Object> row : results) {
            TimelineStatsDTO dto = new TimelineStatsDTO();
            dto.setMonth(row.get("month") != null ? row.get("month").toString() : "");
            Object countObj = row.get("count");
            dto.setCount(countObj instanceof Number ? ((Number) countObj).longValue() : 0L);
            statsList.add(dto);
        }
        return statsList;
    }

    /**
     * 总体概览统计
     */
    public OverviewStatsDTO getOverviewStats() {
        OverviewStatsDTO dto = new OverviewStatsDTO();

        // 总仓库数
        dto.setTotalRepos(githubRepoMapper.selectCount(null));

        // 总Star数之和
        QueryWrapper<GithubRepo> starsWrapper = new QueryWrapper<>();
        starsWrapper.select("IFNULL(SUM(stars_count), 0) AS total_stars");
        Map<String, Object> starsResult = githubRepoMapper.selectMaps(starsWrapper).stream().findFirst().orElse(null);
        if (starsResult != null && starsResult.get("total_stars") != null) {
            dto.setTotalStars(((Number) starsResult.get("total_stars")).longValue());
        } else {
            dto.setTotalStars(0L);
        }

        // 总Fork数之和
        QueryWrapper<GithubRepo> forksWrapper = new QueryWrapper<>();
        forksWrapper.select("IFNULL(SUM(forks_count), 0) AS total_forks");
        Map<String, Object> forksResult = githubRepoMapper.selectMaps(forksWrapper).stream().findFirst().orElse(null);
        if (forksResult != null && forksResult.get("total_forks") != null) {
            dto.setTotalForks(((Number) forksResult.get("total_forks")).longValue());
        } else {
            dto.setTotalForks(0L);
        }

        // 涉及语言数（排除null）
        QueryWrapper<GithubRepo> langWrapper = new QueryWrapper<>();
        langWrapper.select("COUNT(DISTINCT language) AS total_languages")
                .isNotNull("language");
        Map<String, Object> langResult = githubRepoMapper.selectMaps(langWrapper).stream().findFirst().orElse(null);
        if (langResult != null && langResult.get("total_languages") != null) {
            dto.setTotalLanguages(((Number) langResult.get("total_languages")).longValue());
        } else {
            dto.setTotalLanguages(0L);
        }

        // 涉及作者数
        QueryWrapper<GithubRepo> ownerWrapper = new QueryWrapper<>();
        ownerWrapper.select("COUNT(DISTINCT owner_name) AS total_owners");
        Map<String, Object> ownerResult = githubRepoMapper.selectMaps(ownerWrapper).stream().findFirst().orElse(null);
        if (ownerResult != null && ownerResult.get("total_owners") != null) {
            dto.setTotalOwners(((Number) ownerResult.get("total_owners")).longValue());
        } else {
            dto.setTotalOwners(0L);
        }

        return dto;
    }

    /**
     * 最受欢迎仓库 Top 10（按 stars_count 降序）
     */
    public List<GithubRepo> getTopStarredRepos(int topN) {
        QueryWrapper<GithubRepo> wrapper = new QueryWrapper<>();
        wrapper.orderByDesc("stars_count")
                .last("LIMIT " + topN);
        return githubRepoMapper.selectList(wrapper);
    }

    /**
     * 最近活跃仓库 Top 10（按 repo_updated_at 降序）
     */
    public List<GithubRepo> getRecentActiveRepos(int topN) {
        QueryWrapper<GithubRepo> wrapper = new QueryWrapper<>();
        wrapper.isNotNull("repo_updated_at")
                .orderByDesc("repo_updated_at")
                .last("LIMIT " + topN);
        return githubRepoMapper.selectList(wrapper);
    }
}
