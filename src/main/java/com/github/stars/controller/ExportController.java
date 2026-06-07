package com.github.stars.controller;

import com.github.stars.entity.GithubRepo;
import com.github.stars.service.GithubRepoService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 导出控制器 - 支持 MD 格式导出
 */
@RestController
@RequestMapping("/export")
public class ExportController {

    @Resource
    private GithubRepoService githubRepoService;

    /**
     * 导出筛选结果为 Markdown 文件
     */
    @GetMapping("/md")
    public ResponseEntity<byte[]> exportMd(
            @RequestParam(value = "keyword", defaultValue = "") String keyword,
            @RequestParam(value = "language", defaultValue = "") String language,
            @RequestParam(value = "categoryIds", defaultValue = "") String categoryIds,
            @RequestParam(value = "sortBy", defaultValue = "starred_at") String sortBy,
            @RequestParam(value = "sortOrder", defaultValue = "desc") String sortOrder,
            @RequestParam(value = "maxCount", defaultValue = "50") int maxCount) {

        // 查询符合条件的仓库（带分页限制）
        List<GithubRepo> repos = githubRepoService.findPage(1, maxCount, keyword, language,
                sortBy, sortOrder, null, null, null, categoryIds).getRecords();

        StringBuilder md = new StringBuilder();
        md.append("# GitHub Stars 导出报告\n\n");
        md.append("> 导出时间: ").append(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))).append("\n");
        md.append("> 项目数量: ").append(repos.size()).append("\n");
        if (!keyword.isEmpty()) md.append("> 关键词: ").append(keyword).append("\n");
        if (!language.isEmpty()) md.append("> 语言: ").append(language).append("\n");
        md.append("\n---\n\n");

        for (int i = 0; i < repos.size(); i++) {
            GithubRepo repo = repos.get(i);
            md.append("# ").append(i + 1).append(". ").append(repo.getFullName()).append("\n\n");

            // 基本信息表格
            md.append("| 属性 | 值 |\n");
            md.append("|------|----|\n");
            md.append("| ⭐ Stars | ").append(repo.getStarsCount()).append(" |\n");
            md.append("| 🍴 Forks | ").append(repo.getForksCount()).append(" |\n");
            md.append("| 🔤 语言 | ").append(repo.getLanguage() != null ? repo.getLanguage() : "-").append(" |\n");
            md.append("| 🔗 GitHub | [").append(repo.getFullName()).append("](").append(repo.getHtmlUrl()).append(") |\n");
            if (repo.getHomepage() != null && !repo.getHomepage().isEmpty()) {
                md.append("| 🌐 主页 | [").append(repo.getHomepage()).append("](").append(repo.getHomepage()).append(") |\n");
            }
            md.append("\n");

            // 描述（优先中文）
            String desc = repo.getDescriptionCn();
            if (desc == null || desc.isEmpty()) desc = repo.getDescription();
            if (desc != null && !desc.isEmpty()) {
                md.append("**描述**: ").append(desc).append("\n\n");
            }

            // README（优先中文翻译）
            md.append("## 📖 README\n\n");
            if (repo.getReadmeCn() != null && !repo.getReadmeCn().isEmpty()) {
                md.append("> 以下为中文翻译版本\n\n");
                md.append(repo.getReadmeCn()).append("\n\n");
            } else if (repo.getReadmeOriginal() != null && !repo.getReadmeOriginal().isEmpty()) {
                md.append("> 原始英文版本 (尚未翻译)\n\n");
                // 限制长度避免文件过大
                String readme = repo.getReadmeOriginal();
                if (readme.length() > 5000) readme = readme.substring(0, 5000) + "\n\n... (内容过长已截断)";
                md.append(readme).append("\n\n");
            } else {
                md.append("*暂无 README*\n\n");
            }

            md.append("---\n\n");
        }

        byte[] bytes = md.toString().getBytes(StandardCharsets.UTF_8);
        String filename = "github_stars_export_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")) + ".md";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + java.net.URLEncoder.encode(filename, StandardCharsets.UTF_8))
                .contentType(MediaType.TEXT_PLAIN)
                .contentLength(bytes.length)
                .body(bytes);
    }
}
