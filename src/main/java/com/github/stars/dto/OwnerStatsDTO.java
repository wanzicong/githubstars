package com.github.stars.dto;

import lombok.Data;

/**
 * 作者统计数据传输对象
 */
@Data
public class OwnerStatsDTO {

    /**
     * 作者名称
     */
    private String ownerName;

    /**
     * 作者头像URL
     */
    private String ownerAvatarUrl;

    /**
     * 该作者的仓库数量
     */
    private Long count;
}
