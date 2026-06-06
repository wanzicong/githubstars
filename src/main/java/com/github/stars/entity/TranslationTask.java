package com.github.stars.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("translation_task")
public class TranslationTask {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("status")
    private String status;

    @TableField("total_items")
    private Integer totalItems;

    @TableField("completed_items")
    private Integer completedItems;

    @TableField("failed_items")
    private Integer failedItems;

    @TableField("desc_total")
    private Integer descTotal;

    @TableField("desc_completed")
    private Integer descCompleted;

    @TableField("desc_failed")
    private Integer descFailed;

    @TableField("readme_total")
    private Integer readmeTotal;

    @TableField("readme_completed")
    private Integer readmeCompleted;

    @TableField("readme_failed")
    private Integer readmeFailed;

    @TableField("created_at")
    private LocalDateTime createdAt;

    @TableField("finished_at")
    private LocalDateTime finishedAt;
}
