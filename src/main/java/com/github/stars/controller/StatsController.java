package com.github.stars.controller;

import com.github.stars.dto.LanguageStatsDTO;
import com.github.stars.dto.OverviewStatsDTO;
import com.github.stars.dto.OwnerStatsDTO;
import com.github.stars.dto.TimelineStatsDTO;
import com.github.stars.entity.GithubRepo;
import com.github.stars.service.StatsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class StatsController {

    private final StatsService statsService;

    public StatsController(StatsService statsService) {
        this.statsService = statsService;
    }

    /**
     * 语言统计数据
     */
    @GetMapping("/api/stats/languages")
    public List<LanguageStatsDTO> languageStats() {
        return statsService.getLanguageStats();
    }

    /**
     * 作者统计数据
     */
    @GetMapping("/api/stats/owners")
    public List<OwnerStatsDTO> ownerStats(@RequestParam(defaultValue = "15") int topN) {
        return statsService.getOwnerStats(topN);
    }

    /**
     * 时间线统计数据
     */
    @GetMapping("/api/stats/timeline")
    public List<TimelineStatsDTO> timelineStats() {
        return statsService.getTimelineStats();
    }

    /**
     * 总体概览数据
     */
    @GetMapping("/api/stats/overview")
    public OverviewStatsDTO overviewStats() {
        return statsService.getOverviewStats();
    }

    /**
     * 最受欢迎仓库 Top N
     */
    @GetMapping("/api/stats/top-starred")
    public List<GithubRepo> topStarredRepos(@RequestParam(defaultValue = "10") int topN) {
        return statsService.getTopStarredRepos(topN);
    }

    /**
     * 最近活跃仓库 Top N
     */
    @GetMapping("/api/stats/recent-active")
    public List<GithubRepo> recentActiveRepos(@RequestParam(defaultValue = "10") int topN) {
        return statsService.getRecentActiveRepos(topN);
    }
}
