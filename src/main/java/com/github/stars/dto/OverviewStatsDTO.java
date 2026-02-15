package com.github.stars.dto;

import lombok.Data;

/**
 * 总体概览统计数据传输对象
 */
@Data
public class OverviewStatsDTO {

    /**
     * 总仓库数
     */
    private Long totalRepos;

    /**
     * 总Star数之和
     */
    private Long totalStars;

    /**
     * 总Fork数之和
     */
    private Long totalForks;

    /**
     * 涉及的编程语言数
     */
    private Long totalLanguages;

    /**
     * 涉及的作者数
     */
    private Long totalOwners;
}
