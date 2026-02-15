package com.github.stars.dto;

import lombok.Data;

/**
 * 时间线统计数据传输对象
 */
@Data
public class TimelineStatsDTO {

    /**
     * 年月标识，格式如 "2024-01"
     */
    private String month;

    /**
     * 该月的Star数量
     */
    private Long count;
}
