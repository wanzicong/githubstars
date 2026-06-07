package com.github.stars.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName("category")
public class Category {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("name")
    private String name;

    @TableField("description")
    private String description;

    @TableField("sort_order")
    private Integer sortOrder;

    @TableField("created_at")
    private LocalDateTime createdAt;

    @TableField("updated_at")
    private LocalDateTime updatedAt;

    @TableField("parent_id")
    private Long parentId;

    /** 非数据库字段：子分类列表 */
    @TableField(exist = false)
    private List<Category> children;

    /** 非数据库字段：层级 1=一级分类 2=二级分类 */
    @TableField(exist = false)
    private Integer level;

    /** 非数据库字段：该分类下的仓库数量 */
    @TableField(exist = false)
    private Integer repoCount;
}
