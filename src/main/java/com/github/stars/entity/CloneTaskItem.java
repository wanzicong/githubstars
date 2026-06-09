package com.github.stars.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Clone 任务项 - 每个仓库的克隆结果
 */
@Data
@TableName("clone_task_item")
public class CloneTaskItem {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("task_id")
    private String taskId;

    @TableField("full_name")
    private String fullName;

    @TableField("status")
    private String status;

    @TableField("message")
    private String message;

    @TableField("created_at")
    private LocalDateTime createdAt;
}
