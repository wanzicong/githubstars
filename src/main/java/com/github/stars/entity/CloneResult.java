package com.github.stars.entity;

import lombok.Data;

/**
 * Clone 单项结果（非数据库实体，用于实时进度缓存和 API 返回）
 */
@Data
public class CloneResult {
    /** 仓库全名（owner/repo） */
    private String fullName;

    /** 克隆状态：CLONED / FAILED / SKIPPED */
    private String status;

    /** 状态信息 */
    private String message;
}
