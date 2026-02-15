package com.github.stars.dto;

import lombok.Data;

/**
 * 语言统计数据传输对象
 */
@Data
public class LanguageStatsDTO {

    /**
     * 编程语言名称
     */
    private String language;

    /**
     * 该语言的仓库数量
     */
    private Long count;

    /**
     * 该语言占总仓库数的百分比
     */
    private Double percentage;
}
