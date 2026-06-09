package com.github.stars.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Clone 任务实体
 */
@Data
@TableName("clone_task")
public class CloneTask {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("task_id")
    private String taskId;

    @TableField("status")
    private String status;

    @TableField("total_repos")
    private Integer totalRepos;

    @TableField("completed_repos")
    private Integer completedRepos;

    @TableField("failed_repos")
    private Integer failedRepos;

    @TableField("skipped_repos")
    private Integer skippedRepos;

    @TableField("error_message")
    private String errorMessage;

    @TableField("keyword")
    private String keyword;

    @TableField("language")
    private String language;

    @TableField("category_ids")
    private String categoryIds;

    @TableField("date_field")
    private String dateField;

    @TableField("start_date")
    private String startDate;

    @TableField("end_date")
    private String endDate;

    @TableField("sort_by")
    private String sortBy;

    @TableField("sort_order")
    private String sortOrder;

    @TableField("sub_directory")
    private String subDirectory;

    @TableField("target_dir")
    private String targetDir;

    @TableField("concurrency")
    private Integer concurrency;

    @TableField("started_at")
    private LocalDateTime startedAt;

    @TableField("finished_at")
    private LocalDateTime finishedAt;

    @TableField("created_at")
    private LocalDateTime createdAt;

    /** 实时进度结果（非数据库字段，仅用于运行时缓存和 API 返回） */
    @TableField(exist = false)
    private List<CloneResult> results;

    /** 关联的克隆项列表（非数据库字段） */
    @TableField(exist = false)
    private List<CloneTaskItem> items;
}
