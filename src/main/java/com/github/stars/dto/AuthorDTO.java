package com.github.stars.dto;

import lombok.Data;

/**
 * 作者中心数据传输对象
 * 包含作者维度的聚合统计信息
 */
@Data
public class AuthorDTO {

    /**
     * 作者 GitHub 用户名
     */
    private String ownerName;

    /**
     * 作者头像 URL
     */
    private String ownerAvatarUrl;

    /**
     * 该作者的 Star 仓库数量
     */
    private Long repoCount;

    /**
     * 该作者所有仓库的 Star 数之和
     */
    private Long totalStars;

    /**
     * 该作者使用最多的编程语言
     */
    private String topLanguage;

    /**
     * 该作者最近一次 Star 的时间
     */
    private String lastStarredAt;
}
