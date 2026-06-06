package com.github.stars.controller;

import com.github.stars.entity.GithubRepo;
import com.github.stars.entity.TranslationTask;
import com.github.stars.entity.TranslationTaskItem;
import com.github.stars.mapper.TranslationTaskItemMapper;
import com.github.stars.mapper.TranslationTaskMapper;
import com.github.stars.service.GithubRepoService;
import com.github.stars.service.TranslateService;
import com.github.stars.service.TranslateTaskService;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/translate")
public class TranslateController {

    @Resource
    private TranslateService translateService;

    @Resource
    private TranslateTaskService translateTaskService;

    @Resource
    private GithubRepoService githubRepoService;

    @Resource
    private TranslationTaskMapper taskMapper;

    @Resource
    private TranslationTaskItemMapper taskItemMapper;

    /**
     * 翻译单个仓库的描述信息
     */
    @PostMapping("/{repoId}/description")
    public Map<String, Object> translateDescription(@PathVariable Long repoId) {
        Map<String, Object> result = new HashMap<>();
        String descriptionCn = translateService.translateDescription(repoId);
        result.put("success", true);
        result.put("descriptionCn", descriptionCn);
        return result;
    }

    /**
     * 翻译单个仓库的 README（同步方式，可能耗时较长）
     */
    @PostMapping("/{repoId}/readme")
    public Map<String, Object> translateReadme(@PathVariable Long repoId) {
        Map<String, Object> result = new HashMap<>();
        String readmeCn = translateService.translateReadme(repoId);
        result.put("success", true);
        result.put("readmeCn", readmeCn);
        return result;
    }

    /**
     * 翻译单个仓库的 README（异步方式，立即返回 taskId，前端轮询进度）
     */
    @PostMapping("/{repoId}/readme/async")
    public Map<String, Object> translateReadmeAsync(@PathVariable Long repoId) {
        Map<String, Object> result = new HashMap<>();
        Long taskId = translateTaskService.createAndStartSingleReadme(repoId);
        if (taskId == null) {
            result.put("success", false);
            result.put("message", "仓库不存在");
            return result;
        }
        result.put("success", true);
        result.put("taskId", taskId);
        result.put("message", "README 翻译任务已提交");
        return result;
    }

    /**
     * 强制重新翻译单个仓库的 README（异步，忽略已处理标记）
     */
    @PostMapping("/{repoId}/readme/retranslate")
    public Map<String, Object> retranslateReadme(@PathVariable Long repoId) {
        Map<String, Object> result = new HashMap<>();
        Long taskId = translateTaskService.createAndStartSingleReadmeForce(repoId);
        if (taskId == null) {
            result.put("success", false);
            result.put("message", "仓库不存在");
            return result;
        }
        result.put("success", true);
        result.put("taskId", taskId);
        result.put("message", "README 重新翻译任务已提交");
        return result;
    }

    /**
     * 翻译单个仓库的描述和 README（全量翻译）
     */
    @PostMapping("/{repoId}")
    public Map<String, Object> translateAll(@PathVariable Long repoId) {
        Map<String, Object> result = new HashMap<>();
        String descriptionCn = translateService.translateDescription(repoId);
        String readmeCn = translateService.translateReadme(repoId);

        GithubRepo repo = githubRepoService.findById(repoId);
        if (repo != null) {
            result.put("descriptionCn", repo.getDescriptionCn());
            result.put("readmeCn", repo.getReadmeCn());
            result.put("readmeFetched", repo.getReadmeFetched());
        }
        result.put("success", true);
        return result;
    }

    /**
     * 批量翻译描述信息
     */
    @PostMapping("/batch")
    public Map<String, Object> translateBatch(@RequestBody(required = false) Map<String, List<Long>> request) {
        Map<String, Object> result = new HashMap<>();
        List<Long> repoIds = request != null ? request.get("repoIds") : null;
        int count = translateService.translateDescriptionsBatch(repoIds);
        result.put("success", true);
        result.put("translatedCount", count);
        if (repoIds != null) {
            result.put("total", repoIds.size());
        }
        return result;
    }

    /**
     * 获取单仓库翻译状态
     */
    @GetMapping("/{repoId}/status")
    public Map<String, Object> getStatus(@PathVariable Long repoId) {
        Map<String, Object> result = new HashMap<>();
        GithubRepo repo = githubRepoService.findById(repoId);
        if (repo == null) {
            result.put("success", false);
            result.put("message", "仓库不存在");
            return result;
        }
        result.put("success", true);
        result.put("descriptionTranslated", repo.getDescriptionCn() != null && !repo.getDescriptionCn().isEmpty());
        result.put("readmeFetched", Boolean.TRUE.equals(repo.getReadmeFetched()));
        result.put("descriptionCn", repo.getDescriptionCn());
        result.put("readmeCn", repo.getReadmeCn());
        return result;
    }

    // ============ 全量异步翻译接口 ============

    /**
     * 启动 README 批量翻译（翻译全部未获取 README 的仓库，异步，10 并发，重试 3 次）
     */
    @PostMapping("/readme-start")
    public Map<String, Object> startReadmeBatch() {
        Map<String, Object> result = new HashMap<>();
        Long taskId = translateTaskService.createAndStartReadmeBatch();
        if (taskId == null) {
            result.put("success", false);
            result.put("message", "没有需要翻译 README 的项目");
            return result;
        }
        result.put("success", true);
        result.put("taskId", taskId);
        result.put("message", "README 批量翻译任务已启动");
        return result;
    }

    /**
     * 启动全量翻译（异步，10 并发，自动重试 3 次）
     */
    @PostMapping("/start")
    public Map<String, Object> startFullTranslate() {
        Map<String, Object> result = new HashMap<>();
        Long taskId = translateTaskService.createAndStartFullTranslate();
        if (taskId == null) {
            result.put("success", false);
            result.put("message", "没有需要翻译的项目");
            return result;
        }
        result.put("success", true);
        result.put("taskId", taskId);
        result.put("message", "翻译任务已启动");
        return result;
    }

    /**
     * 获取翻译任务进度
     */
    @GetMapping("/task/{taskId}")
    public Map<String, Object> getTaskProgress(@PathVariable Long taskId) {
        Map<String, Object> result = new HashMap<>();
        TranslationTask task = taskMapper.selectById(taskId);
        if (task == null) {
            result.put("success", false);
            result.put("message", "任务不存在");
            return result;
        }
        result.put("success", true);
        result.put("taskId", task.getId());
        result.put("status", task.getStatus());
        result.put("totalItems", task.getTotalItems());
        result.put("completedItems", task.getCompletedItems());
        result.put("failedItems", task.getFailedItems());
        result.put("descTotal", task.getDescTotal());
        result.put("descCompleted", task.getDescCompleted());
        result.put("descFailed", task.getDescFailed());
        result.put("readmeTotal", task.getReadmeTotal());
        result.put("readmeCompleted", task.getReadmeCompleted());
        result.put("readmeFailed", task.getReadmeFailed());
        result.put("createdAt", task.getCreatedAt());
        result.put("finishedAt", task.getFinishedAt());

        // 计算进度百分比
        int progress = 0;
        if (task.getTotalItems() != null && task.getTotalItems() > 0) {
            int done = (task.getCompletedItems() != null ? task.getCompletedItems() : 0)
                     + (task.getFailedItems() != null ? task.getFailedItems() : 0);
            progress = done * 100 / task.getTotalItems();
        }
        result.put("progress", progress);
        return result;
    }

    /**
     * 重试失败项
     */
    @PostMapping("/task/{taskId}/retry")
    public Map<String, Object> retryFailed(@PathVariable Long taskId) {
        Map<String, Object> result = new HashMap<>();
        Long newTaskId = translateTaskService.retryFailed(taskId);
        if (newTaskId == null) {
            result.put("success", false);
            result.put("message", "没有失败项需要重试");
            return result;
        }
        result.put("success", true);
        result.put("taskId", newTaskId);
        result.put("message", "重试任务已启动");
        return result;
    }

    /**
     * 获取失败项列表
     */
    @GetMapping("/task/{taskId}/failures")
    public Map<String, Object> getTaskFailures(@PathVariable Long taskId) {
        Map<String, Object> result = new HashMap<>();
        List<TranslationTaskItem> failures = taskItemMapper.selectList(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<TranslationTaskItem>()
                        .eq(TranslationTaskItem::getTaskId, taskId)
                        .eq(TranslationTaskItem::getStatus, "FAILED")
        );
        result.put("success", true);
        result.put("failures", failures);
        result.put("count", failures.size());
        return result;
    }

    /**
     * 获取最近的任务列表
     */
    @GetMapping("/tasks")
    public Map<String, Object> getRecentTasks() {
        Map<String, Object> result = new HashMap<>();
        List<TranslationTask> tasks = taskMapper.selectList(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<TranslationTask>()
                        .orderByDesc(TranslationTask::getId)
                        .last("LIMIT 20")
        );
        result.put("success", true);
        result.put("tasks", tasks);
        return result;
    }
}
