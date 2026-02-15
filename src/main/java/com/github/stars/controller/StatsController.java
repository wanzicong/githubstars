package com.github.stars.controller;

import com.github.stars.dto.LanguageStatsDTO;
import com.github.stars.dto.OverviewStatsDTO;
import com.github.stars.dto.OwnerStatsDTO;
import com.github.stars.dto.TimelineStatsDTO;
import com.github.stars.entity.GithubRepo;
import com.github.stars.service.StatsService;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.List;

@Controller
public class StatsController {

    private final StatsService statsService;

    public StatsController(StatsService statsService) {
        this.statsService = statsService;
    }

    /**
     * 统计总览页面
     */
    @GetMapping("/stats")
    public String statsPage() {
        return "stats";
    }

    /**
     * 语言统计数据（JSON）
     */
    @GetMapping("/api/stats/languages")
    @ResponseBody
    public List<LanguageStatsDTO> languageStats() {
        return statsService.getLanguageStats();
    }

    /**
     * 作者统计数据（JSON）
     */
    @GetMapping("/api/stats/owners")
    @ResponseBody
    public List<OwnerStatsDTO> ownerStats(@RequestParam(defaultValue = "15") int topN) {
        return statsService.getOwnerStats(topN);
    }

    /**
     * 时间线统计数据（JSON）
     */
    @GetMapping("/api/stats/timeline")
    @ResponseBody
    public List<TimelineStatsDTO> timelineStats() {
        return statsService.getTimelineStats();
    }

    /**
     * 总体概览数据（JSON）
     */
    @GetMapping("/api/stats/overview")
    @ResponseBody
    public OverviewStatsDTO overviewStats() {
        return statsService.getOverviewStats();
    }

    /**
     * 最受欢迎仓库 Top 10（JSON）
     */
    @GetMapping("/api/stats/top-starred")
    @ResponseBody
    public List<GithubRepo> topStarredRepos() {
        return statsService.getTopStarredRepos(10);
    }

    /**
     * 最近活跃仓库 Top 10（JSON）
     */
    @GetMapping("/api/stats/recent-active")
    @ResponseBody
    public List<GithubRepo> recentActiveRepos() {
        return statsService.getRecentActiveRepos(10);
    }
}
