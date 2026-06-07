package com.github.stars.controller;

import com.github.stars.entity.GithubRepo;
import com.github.stars.service.GithubRepoService;
import com.github.stars.service.SystemConfigService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 批量 Clone 脚本生成
 */
@RestController
@RequestMapping("/api/clone")
public class CloneController {

    @Resource
    private GithubRepoService githubRepoService;

    @Resource
    private SystemConfigService configService;

    /**
     * 生成批量 Clone 脚本
     * @param osType  操作系统: windows / linux / mac
     * @param keyword 筛选关键词
     * @param language 筛选语言
     * @param categoryIds 筛选分类
     * @param maxCount 最大数量(默认50)
     */
    @GetMapping("/script")
    public ResponseEntity<byte[]> generateScript(
            @RequestParam(value = "osType", defaultValue = "windows") String osType,
            @RequestParam(value = "keyword", defaultValue = "") String keyword,
            @RequestParam(value = "language", defaultValue = "") String language,
            @RequestParam(value = "categoryIds", defaultValue = "") String categoryIds,
            @RequestParam(value = "maxCount", defaultValue = "50") int maxCount) {

        List<GithubRepo> repos = githubRepoService.findPage(1, maxCount, keyword, language,
                "starred_at", "desc", null, null, null, categoryIds).getRecords();

        String cloneDir = configService.getValue("clone.directory", "~/github-stars");
        StringBuilder script = new StringBuilder();

        if ("windows".equals(osType)) {
            // PowerShell script
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
            // Linux/Mac bash script
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

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + java.net.URLEncoder.encode(filename, StandardCharsets.UTF_8))
                .contentType(MediaType.TEXT_PLAIN)
                .contentLength(bytes.length)
                .body(bytes);
    }
}
