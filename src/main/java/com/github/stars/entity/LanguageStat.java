package com.github.stars.entity;

import lombok.Data;

/**
 * 语言统计实体类
 */
@Data
public class LanguageStat {

    /**
     * 编程语言名称
     */
    private String language;

    /**
     * 对应的项目数量
     */
    private Long count;
}
