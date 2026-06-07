package com.github.stars.controller;

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

    @GetMapping("/config")
    public Map<String, Object> getCloneConfig() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("baseDirectory", cloneService.getBaseDirectory());
        result.put("subdirectoryHistory", cloneService.getSubdirectoryHistory());
        result.put("lastSubdirectory", cloneService.getLastSubdirectory());
        result.put("hasActiveTask", cloneService.hasActiveTask());
        return result;
    }

    @PostMapping("/start")
    public Map<String, Object> startClone(
            @RequestParam(value = "keyword", defaultValue = "") String keyword,
            @RequestParam(value = "language", defaultValue = "") String language,
            @RequestParam(value = "categoryIds", defaultValue = "") String categoryIds,
            @RequestParam(value = "maxCount", defaultValue = "50") int maxCount,
            @RequestParam(value = "subDirectory", defaultValue = "") String subDirectory) {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            String taskId = cloneService.startBatchClone(keyword, language, categoryIds, maxCount, subDirectory);
            result.put("success", true);
            result.put("taskId", taskId);
            result.put("targetDirectory", cloneService.resolveCloneDirectory(subDirectory).getAbsolutePath());
            result.put("message", "Clone 任务已启动（最多5个并发）");
        } catch (IllegalArgumentException | IllegalStateException e) {
            result.put("success", false);
            result.put("message", e.getMessage());
        }
        return result;
    }

    @GetMapping("/task/{taskId}")
    public Map<String, Object> getTaskProgress(@PathVariable String taskId) {
        Map<String, Object> result = new LinkedHashMap<>();
        CloneService.CloneTask task = cloneService.getTask(taskId);
        if (task == null) {
            result.put("success", false);
            result.put("message", "任务不存在");
            return result;
        }
        result.put("success", true);
        result.put("taskId", task.taskId);
        result.put("status", task.status);
        result.put("errorMessage", task.errorMessage);
        result.put("totalRepos", task.totalRepos);
        result.put("completedRepos", task.completedRepos);
        result.put("failedRepos", task.failedRepos);
        result.put("skippedRepos", task.skippedRepos);
        result.put("results", task.results);
        return result;
    }

    @GetMapping("/script")
    public ResponseEntity<byte[]> generateScript(
            @RequestParam(value = "osType", defaultValue = "windows") String osType,
            @RequestParam(value = "keyword", defaultValue = "") String keyword,
            @RequestParam(value = "language", defaultValue = "") String language,
            @RequestParam(value = "categoryIds", defaultValue = "") String categoryIds,
            @RequestParam(value = "maxCount", defaultValue = "50") int maxCount,
            @RequestParam(value = "subDirectory", defaultValue = "") String subDirectory) {

        List<GithubRepo> repos = githubRepoService.findPage(1, maxCount, keyword, language,
                "starred_at", "desc", null, null, null, categoryIds).getRecords();

        File cloneDirFile = cloneService.resolveCloneDirectory(subDirectory);
        String cloneDir = cloneDirFile.getAbsolutePath();
        StringBuilder script = new StringBuilder();

        if ("windows".equals(osType)) {
            script.append("# GitHub Stars 批量 Clone 脚本\n");
            script.append("# 生成时间: ").append(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))).append("\n");
            script.append("# 项目数量: ").append(repos.size()).append("\n\n");
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
                script.append("  git clone ").append(repo.getHtmlUrl()).append(".git\n");
                script.append("}\n\n");
            }
            script.append("Write-Host \"Done! Cloned into $cloneDir\"\n");
        } else {
            script.append("#!/bin/bash\n");
            script.append("# GitHub Stars 批量 Clone 脚本\n");
            script.append("# 生成时间: ").append(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))).append("\n");
            script.append("# 项目数量: ").append(repos.size()).append("\n\n");
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
                script.append("  git clone ").append(repo.getHtmlUrl()).append(".git\n");
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
