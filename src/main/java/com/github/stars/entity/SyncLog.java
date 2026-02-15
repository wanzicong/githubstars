package com.github.stars.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("sync_log")
public class SyncLog {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("sync_type")
    private String syncType;

    @TableField("status")
    private String status;

    @TableField("total_count")
    private Integer totalCount;

    @TableField("synced_count")
    private Integer syncedCount;

    @TableField("started_at")
    private LocalDateTime startedAt;

    @TableField("finished_at")
    private LocalDateTime finishedAt;

    @TableField("error_message")
    private String errorMessage;

    @TableField("created_at")
    private LocalDateTime createdAt;
}
