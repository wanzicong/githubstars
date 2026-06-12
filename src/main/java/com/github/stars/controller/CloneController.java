package com.github.stars.controller;

import com.github.stars.entity.CloneTask;
import com.github.stars.entity.GithubRepo;
import com.github.stars.service.CloneService;
import com.github.stars.service.GithubRepoService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 批量 Clone - 脚本生成 + 实际执行
 */
@RestController
@RequestMapping("/api/clone")
public class CloneController {

    @Resource
    private GithubRepoService githubRepoService;

    @Resource
    private CloneService cloneService;

    /** 默认克隆深度：1=浅克隆 */
    private static final int DEFAULT_CLONE_DEPTH = 1;
    /** 默认最大仓库大小(MB)，0=不限制 */
    private static final int DEFAULT_MAX_REPO_SIZE_MB = 500;

    @GetMapping("/config")
    public Map<String, Object> getCloneConfig() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("baseDirectory", cloneService.getBaseDirectory());
        result.put("subdirectoryHistory", cloneService.getSubdirectoryHistory());
        result.put("lastSubdirectory", cloneService.getLastSubdirectory());
        result.put("hasActiveTask", cloneService.hasActiveTask());
        result.put("defaultCloneDepth", DEFAULT_CLONE_DEPTH);
        result.put("defaultMaxRepoSizeMb", DEFAULT_MAX_REPO_SIZE_MB);
        return result;
    }

    /**
     * 检查目标磁盘空间
     */
    @GetMapping("/disk-space")
    public Map<String, Object> checkDiskSpace(
            @RequestParam(value = "subDirectory", defaultValue = "") String subDirectory,
            @RequestParam(value = "repoCount", defaultValue = "50") int repoCount) {
        Map<String, Object> result = new LinkedHashMap<>();
        Map<String, Object> diskInfo = cloneService.checkDiskSpace(subDirectory, repoCount);
        result.put("success", true);
        result.putAll(diskInfo);
        return result;
    }

    @PostMapping("/start")
    public Map<String, Object> startClone(
            @RequestParam(value = "keyword", defaultValue = "") String keyword,
            @RequestParam(value = "language", defaultValue = "") String language,
            @RequestParam(value = "categoryIds", defaultValue = "") String categoryIds,
            @RequestParam(value = "maxCount", defaultValue = "50") int maxCount,
            @RequestParam(value = "subDirectory", defaultValue = "") String subDirectory,
            @RequestParam(value = "dateField", defaultValue = "") String dateField,
            @RequestParam(value = "startDate", defaultValue = "") String startDate,
            @RequestParam(value = "endDate", defaultValue = "") String endDate,
            @RequestParam(value = "sortBy", defaultValue = "starred_at") String sortBy,
            @RequestParam(value = "sortOrder", defaultValue = "desc") String sortOrder,
            @RequestParam(value = "concurrency", defaultValue = "5") int concurrency,
            @RequestParam(value = "cloneDepth", defaultValue = "1") int cloneDepth,
            @RequestParam(value = "maxRepoSizeMb", defaultValue = "500") int maxRepoSizeMb) {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            String taskId = cloneService.startBatchClone(keyword, language, categoryIds, maxCount, subDirectory,
                    dateField, startDate, endDate, sortBy, sortOrder, concurrency,
                    cloneDepth, maxRepoSizeMb);
            result.put("success", true);
            result.put("taskId", taskId);
            result.put("targetDirectory", cloneService.resolveCloneDirectory(subDirectory).getAbsolutePath());
            result.put("message", String.format("Clone 任务已启动 (%d并发, depth=%d, maxSize=%dMB)",
                    concurrency, cloneDepth, maxRepoSizeMb));
        } catch (IllegalArgumentException | IllegalStateException e) {
            result.put("success", false);
            result.put("message", e.getMessage());
        }
        return result;
    }

    @GetMapping("/task/{taskId}")
    public Map<String, Object> getTaskProgress(@PathVariable String taskId) {
        Map<String, Object> result = new LinkedHashMap<>();
        CloneTask task = cloneService.getTask(taskId);
        if (task == null) {
            result.put("success", false);
            result.put("message", "任务不存在");
            return result;
        }
        result.put("success", true);
        result.put("taskId", task.getTaskId());
        result.put("status", task.getStatus());
        result.put("errorMessage", task.getErrorMessage());
        result.put("totalRepos", task.getTotalRepos());
        result.put("completedRepos", task.getCompletedRepos());
        result.put("failedRepos", task.getFailedRepos());
        result.put("skippedRepos", task.getSkippedRepos());
        result.put("cloneDepth", task.getCloneDepth());
        result.put("maxRepoSizeMb", task.getMaxRepoSizeMb());
        result.put("cancelled", task.getCancelled());
        result.put("results", task.getResults() != null ? task.getResults() : Collections.emptyList());
        return result;
    }

    /**
     * 取消正在运行的任务
     */
    @PostMapping("/task/{taskId}/cancel")
    public Map<String, Object> cancelTask(@PathVariable String taskId) {
        Map<String, Object> result = new LinkedHashMap<>();
        boolean cancelled = cloneService.cancelTask(taskId);
        result.put("success", cancelled);
        result.put("message", cancelled ? "任务已取消" : "无法取消（任务不存在或已完成）");
        return result;
    }

    @GetMapping("/script")
    public ResponseEntity<byte[]> generateScript(
            @RequestParam(value = "osType", defaultValue = "windows") String osType,
            @RequestParam(value = "keyword", defaultValue = "") String keyword,
            @RequestParam(value = "language", defaultValue = "") String language,
            @RequestParam(value = "categoryIds", defaultValue = "") String categoryIds,
            @RequestParam(value = "maxCount", defaultValue = "50") int maxCount,
            @RequestParam(value = "subDirectory", defaultValue = "") String subDirectory,
            @RequestParam(value = "cloneDepth", defaultValue = "1") int cloneDepth) {

        List<GithubRepo> repos = githubRepoService.findPage(1, maxCount, keyword, language,
                "starred_at", "desc", null, null, null, categoryIds).getRecords();

        File cloneDirFile = cloneService.resolveCloneDirectory(subDirectory);
        String cloneDir = cloneDirFile.getAbsolutePath();

        String depthFlag = cloneDepth > 0 ? " --depth " + cloneDepth : "";

        StringBuilder script = new StringBuilder();

        if ("windows".equals(osType)) {
            script.append("# GitHub Stars 批量 Clone 脚本\n");
            script.append("# 生成时间: ").append(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))).append("\n");
            script.append("# 项目数量: ").append(repos.size()).append("\n");
            script.append("# 克隆深度: ").append(cloneDepth > 0 ? String.valueOf(cloneDepth) : "完整克隆").append("\n\n");
            script.append("$cloneDir = \"").append(cloneDir).append("\"\n");
            script.append("if (-not (Test-Path $cloneDir)) { New-Item -ItemType Directory -Path $cloneDir -Force | Out-Null }\n");
            script.append("Set-Location $cloneDir\n\n");

            for (GithubRepo repo : repos) {
                script.append("# ").append(repo.getFullName());
                if (repo.getDescriptionCn() != null) script.append(" - ").append(repo.getDescriptionCn());
                else if (repo.getDescription() != null) script.append(" - ").append(repo.getDescription());
                script.append("\n");
                script.append("if (Test-Path \"").append(repo.getRepoName()).append("\") {\n");
                script.append("  Write-Host \"[SKIP] ").append(repo.getRepoName()).append(" 已存在\"\n");
                script.append("} else {\n");
                script.append("  git clone").append(depthFlag).append(" ").append(cloneService.buildCloneUrl(repo.getHtmlUrl())).append("\n");
                script.append("}\n\n");
            }
            script.append("Write-Host \"Done! Cloned into $cloneDir\"\n");
        } else {
            script.append("#!/bin/bash\n");
            script.append("# GitHub Stars 批量 Clone 脚本\n");
            script.append("# 生成时间: ").append(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))).append("\n");
            script.append("# 项目数量: ").append(repos.size()).append("\n");
            script.append("# 克隆深度: ").append(cloneDepth > 0 ? String.valueOf(cloneDepth) : "完整克隆").append("\n\n");
            script.append("CLONE_DIR=\"").append(cloneDir).append("\"\n");
            script.append("mkdir -p \"$CLONE_DIR\"\n");
            script.append("cd \"$CLONE_DIR\" || exit\n\n");

            for (GithubRepo repo : repos) {
                script.append("# ").append(repo.getFullName());
                if (repo.getDescriptionCn() != null) script.append(" - ").append(repo.getDescriptionCn());
                else if (repo.getDescription() != null) script.append(" - ").append(repo.getDescription());
                script.append("\n");
                script.append("if [ -d \"").append(repo.getRepoName()).append("\" ]; then\n");
                script.append("  echo \"[SKIP] ").append(repo.getRepoName()).append(" already exists\"\n");
                script.append("else\n");
                script.append("  git clone").append(depthFlag).append(" ").append(cloneService.buildCloneUrl(repo.getHtmlUrl())).append("\n");
                script.append("fi\n\n");
            }
            script.append("echo \"Done! Cloned into $CLONE_DIR\"\n");
        }

        byte[] bytes = script.toString().getBytes(StandardCharsets.UTF_8);
        String ext = "windows".equals(osType) ? "ps1" : "sh";
        String filename = "github_stars_clone_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")) + "." + ext;
        String encodedFilename;
        try {
            encodedFilename = java.net.URLEncoder.encode(filename, "UTF-8");
        } catch (java.io.UnsupportedEncodingException e) {
            encodedFilename = filename;
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFilename)
                .contentType(MediaType.TEXT_PLAIN)
                .contentLength(bytes.length)
                .body(bytes);
    }

    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<Map<String, Object>> handleCloneError(RuntimeException e) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", false);
        result.put("message", e.getMessage());
        return ResponseEntity.badRequest().body(result);
    }
}
