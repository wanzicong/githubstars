package com.github.stars.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.github.stars.entity.Category;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface CategoryMapper extends BaseMapper<Category> {

    /**
     * 查询分类下的仓库ID列表
     */
    @Select("SELECT repo_id FROM repo_category WHERE category_id = #{categoryId}")
    List<Long> selectRepoIdsByCategoryId(@Param("categoryId") Long categoryId);

    /**
     * 查询分类下的仓库数量
     */
    @Select("SELECT COUNT(*) FROM repo_category WHERE category_id = #{categoryId}")
    int countReposByCategoryId(@Param("categoryId") Long categoryId);

    /**
     * 查询仓库所属的分类ID列表
     */
    @Select("SELECT category_id FROM repo_category WHERE repo_id = #{repoId}")
    List<Long> selectCategoryIdsByRepoId(@Param("repoId") Long repoId);

    /**
     * 添加仓库到分类
     */
    @Insert("INSERT IGNORE INTO repo_category (repo_id, category_id, created_at) VALUES (#{repoId}, #{categoryId}, NOW())")
    int insertRepoCategory(@Param("repoId") Long repoId, @Param("categoryId") Long categoryId);

    /**
     * 从分类中移除仓库
     */
    @Delete("DELETE FROM repo_category WHERE repo_id = #{repoId} AND category_id = #{categoryId}")
    int deleteRepoCategory(@Param("repoId") Long repoId, @Param("categoryId") Long categoryId);

    /**
     * 移除分类下的所有仓库
     */
    @Delete("DELETE FROM repo_category WHERE category_id = #{categoryId}")
    int deleteAllRepoCategory(@Param("categoryId") Long categoryId);

    /**
     * 移除仓库的所有分类
     */
    @Delete("DELETE FROM repo_category WHERE repo_id = #{repoId}")
    int deleteAllCategoriesByRepoId(@Param("repoId") Long repoId);

    /**
     * 批量添加仓库到分类（INSERT IGNORE 防重复）
     */
    @Insert("<script>" +
            "INSERT IGNORE INTO repo_category (repo_id, category_id, created_at) VALUES " +
            "<foreach collection='repoIds' item='repoId' separator=','>" +
            "(#{repoId}, #{categoryId}, NOW())" +
            "</foreach>" +
            "</script>")
    int batchInsertRepoCategory(@Param("repoIds") List<Long> repoIds, @Param("categoryId") Long categoryId);

    /**
     * 查询所有分类及其仓库数量
     */
    @Select("SELECT c.*, COUNT(rc.repo_id) AS repo_count FROM category c " +
            "LEFT JOIN repo_category rc ON c.id = rc.category_id " +
            "GROUP BY c.id ORDER BY c.sort_order ASC, c.id ASC")
    @Results({
            @Result(column = "repo_count", property = "repoCount")
    })
    List<Category> selectAllWithRepoCount();
}
