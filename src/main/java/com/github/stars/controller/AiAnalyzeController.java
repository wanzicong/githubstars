package com.github.stars.controller;

import com.github.stars.service.AiAnalyzeService;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.*;

@RestController
@RequestMapping("/api/analyze")
public class AiAnalyzeController {

    @Resource
    private AiAnalyzeService aiAnalyzeService;

    /**
     * 启动 AI 分析任务（异步）
     */
    @PostMapping("/start")
    public Map<String, Object> startAnalyze(
            @RequestParam(value = "keyword", defaultValue = "") String keyword,
            @RequestParam(value = "language", defaultValue = "") String language,
            @RequestParam(value = "categoryIds", defaultValue = "") String categoryIds,
            @RequestParam(value = "sortBy", defaultValue = "starred_at") String sortBy,
            @RequestParam(value = "sortOrder", defaultValue = "desc") String sortOrder) {

        Map<String, Object> result = new LinkedHashMap<>();
        String taskId = aiAnalyzeService.createAnalyzeTask(keyword, language, categoryIds, sortBy, sortOrder);
        result.put("success", true);
        result.put("taskId", taskId);
        result.put("message", "AI 分析任务已启动（最多分析 30 个项目）");
        return result;
    }

    /**
     * 查询分析任务状态和结果
     */
    @GetMapping("/task/{taskId}")
    public Map<String, Object> getTaskStatus(@PathVariable String taskId) {
        return aiAnalyzeService.getTaskStatus(taskId);
    }
}
