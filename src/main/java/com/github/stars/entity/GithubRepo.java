package com.github.stars.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName("github_repo")
public class GithubRepo {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("repo_name")
    private String repoName;

    @TableField("full_name")
    private String fullName;

    @TableField("description")
    private String description;

    @TableField("description_cn")
    private String descriptionCn;

    @TableField("readme_cn")
    private String readmeCn;

    @TableField("readme_fetched")
    private Boolean readmeFetched;

    @TableField("language")
    private String language;

    @TableField("owner_name")
    private String ownerName;

    @TableField("owner_avatar_url")
    private String ownerAvatarUrl;

    @TableField("html_url")
    private String htmlUrl;

    @TableField("homepage")
    private String homepage;

    @TableField("stars_count")
    private Integer starsCount;

    @TableField("forks_count")
    private Integer forksCount;

    @TableField("watchers_count")
    private Integer watchersCount;

    @TableField("open_issues_count")
    private Integer openIssuesCount;

    @TableField("topics")
    private String topics;

    @TableField("license_name")
    private String licenseName;

    @TableField("is_fork")
    private Boolean isFork;

    @TableField("is_archived")
    private Boolean isArchived;

    @TableField("repo_created_at")
    private LocalDateTime repoCreatedAt;

    @TableField("repo_updated_at")
    private LocalDateTime repoUpdatedAt;

    @TableField("repo_pushed_at")
    private LocalDateTime repoPushedAt;

    @TableField("starred_at")
    private LocalDateTime starredAt;

    @TableField("created_at")
    private LocalDateTime createdAt;

    @TableField("updated_at")
    private LocalDateTime updatedAt;

    /**
     * 仓库所属分类名称列表（非数据库字段，查询时动态填充）
     */
    @TableField(exist = false)
    private List<String> categoryNames;
}
