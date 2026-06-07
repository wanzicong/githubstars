package com.github.stars.controller;

import com.github.stars.service.AiAnalyzeService;
import com.github.stars.service.GithubSearchService;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 趋势排行榜 API
 */
@RestController
@RequestMapping("/api/trending")
public class TrendingController {

    @Resource
    private GithubSearchService githubSearchService;

    @Resource
    private AiAnalyzeService aiAnalyzeService;

    /**
     * 获取趋势排行榜
     * @param since  daily(1天) / weekly(7天) / monthly(30天)
     * @param language 编程语言过滤
     * @param perPage 返回数量(默认20)
     */
    @GetMapping
    public Map<String, Object> trending(
            @RequestParam(value = "since", defaultValue = "daily") String since,
            @RequestParam(value = "language", defaultValue = "") String language,
            @RequestParam(value = "perPage", defaultValue = "20") int perPage) {

        int days;
        switch (since) {
            case "weekly": days = 7; break;
            case "monthly": days = 30; break;
            default: days = 1;
        }

        String dateStr = LocalDate.now().minusDays(days).format(DateTimeFormatter.ISO_DATE);
        StringBuilder query = new StringBuilder("created:>" + dateStr);
        if (language != null && !language.trim().isEmpty()) {
            query.append(" language:").append(language.trim());
        }

        Map<String, Object> searchResult = githubSearchService.searchRepos(
                query.toString(), null, "stars", 1, perPage);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("since", since);
        result.put("total", searchResult.get("total"));
        result.put("repos", searchResult.get("repos"));
        result.put("dateRange", dateStr + " ~ " + LocalDate.now().format(DateTimeFormatter.ISO_DATE));
        return result;
    }

    @PostMapping("/analyze")
    public Map<String, Object> analyzeTrending(
            @RequestParam(value = "since", defaultValue = "daily") String since,
            @RequestParam(value = "language", defaultValue = "") String language) {

        Map<String, Object> result = new LinkedHashMap<>();
        // First fetch the trending repos
        Map<String, Object> trendingResult = trending(since, language, 20);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> repos = (List<Map<String, Object>>) trendingResult.get("repos");

        String taskId = aiAnalyzeService.createTrendingAnalyzeTask(since, language, repos);
        result.put("success", true);
        result.put("taskId", taskId);
        result.put("message", "趋势分析任务已启动");
        return result;
    }
}
