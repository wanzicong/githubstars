package com.github.stars.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.github.stars.dto.AuthorDTO;
import com.github.stars.entity.GithubRepo;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 作者维度数据访问层
 * 操作 github_repo 表，提供作者聚合查询
 */
public interface AuthorMapper extends BaseMapper<GithubRepo> {

    /**
     * 分页查询作者列表（按仓库数量降序）
     * 聚合统计：仓库数、总 Star 数、主力语言、最近 Star 时间
     */
    @Select("<script>" +
            "SELECT " +
            "  r.owner_name AS ownerName, " +
            "  r.owner_avatar_url AS ownerAvatarUrl, " +
            "  COUNT(*) AS repoCount, " +
            "  SUM(r.stars_count) AS totalStars, " +
            "  (SELECT r2.language FROM github_repo r2 " +
            "   WHERE r2.owner_name = r.owner_name AND r2.language IS NOT NULL " +
            "   GROUP BY r2.language ORDER BY COUNT(*) DESC LIMIT 1) AS topLanguage, " +
            "  MAX(r.starred_at) AS lastStarredAt " +
            "FROM github_repo r " +
            "WHERE 1=1 " +
            "  AND r.owner_name IS NOT NULL " +
            "  AND r.owner_name != '' " +
            "<if test='keyword != null and keyword != \"\"'>" +
            "  AND r.owner_name LIKE CONCAT('%', #{keyword}, '%') " +
            "</if>" +
            "GROUP BY r.owner_name, r.owner_avatar_url " +
            "ORDER BY repoCount DESC" +
            "</script>")
    List<AuthorDTO> selectAuthorPage(
            Page<AuthorDTO> page,
            @Param("keyword") String keyword
    );

    /**
     * 作者总数（用于分页）
     */
    @Select("<script>" +
            "SELECT COUNT(DISTINCT owner_name) FROM github_repo " +
            "WHERE owner_name IS NOT NULL AND owner_name != '' " +
            "<if test='keyword != null and keyword != \"\"'>" +
            "  AND owner_name LIKE CONCAT('%', #{keyword}, '%') " +
            "</if>" +
            "</script>")
    Long countAuthors(@Param("keyword") String keyword);
}
