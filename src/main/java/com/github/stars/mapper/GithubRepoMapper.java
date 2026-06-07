package com.github.stars.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.github.stars.entity.GithubRepo;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface GithubRepoMapper extends BaseMapper<GithubRepo> {

    /**
     * 查询未分类的仓库（不在 repo_category 表中的）
     */
    @Select("SELECT r.* FROM github_repo r LEFT JOIN repo_category rc ON r.id = rc.repo_id WHERE rc.repo_id IS NULL")
    List<GithubRepo> selectUncategorizedRepos();

    /**
     * 插入或更新（基于 uk_full_name 唯一索引）
     * 存在则更新所有业务字段，不存在则插入
     */
    @Insert("INSERT INTO github_repo (repo_name, full_name, description, language, owner_name, owner_avatar_url, "
            + "html_url, homepage, stars_count, forks_count, watchers_count, open_issues_count, topics, license_name, "
            + "is_fork, is_archived, repo_created_at, repo_updated_at, repo_pushed_at, starred_at, created_at, updated_at) "
            + "VALUES (#{repoName}, #{fullName}, #{description}, #{language}, #{ownerName}, #{ownerAvatarUrl}, "
            + "#{htmlUrl}, #{homepage}, #{starsCount}, #{forksCount}, #{watchersCount}, #{openIssuesCount}, #{topics}, #{licenseName}, "
            + "#{isFork}, #{isArchived}, #{repoCreatedAt}, #{repoUpdatedAt}, #{repoPushedAt}, #{starredAt}, #{createdAt}, #{updatedAt}) "
            + "ON DUPLICATE KEY UPDATE "
            + "repo_name = VALUES(repo_name), description = VALUES(description), language = VALUES(language), "
            + "owner_name = VALUES(owner_name), owner_avatar_url = VALUES(owner_avatar_url), "
            + "html_url = VALUES(html_url), homepage = VALUES(homepage), stars_count = VALUES(stars_count), "
            + "forks_count = VALUES(forks_count), watchers_count = VALUES(watchers_count), "
            + "open_issues_count = VALUES(open_issues_count), topics = VALUES(topics), license_name = VALUES(license_name), "
            + "is_fork = VALUES(is_fork), is_archived = VALUES(is_archived), "
            + "repo_created_at = VALUES(repo_created_at), repo_updated_at = VALUES(repo_updated_at), "
            + "repo_pushed_at = VALUES(repo_pushed_at), starred_at = VALUES(starred_at), updated_at = VALUES(updated_at)")
    int upsert(GithubRepo repo);
}
