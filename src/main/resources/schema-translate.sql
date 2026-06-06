-- 翻译功能迁移脚本
-- 为 github_repo 表添加中文翻译字段

ALTER TABLE `github_repo`
    ADD COLUMN `description_cn` TEXT DEFAULT NULL COMMENT '中文翻译-仓库描述' AFTER `description`,
    ADD COLUMN `readme_cn` LONGTEXT DEFAULT NULL COMMENT '中文翻译-README' AFTER `description_cn`,
    ADD COLUMN `readme_fetched` TINYINT(1) DEFAULT 0 COMMENT '是否已获取并翻译README' AFTER `readme_cn`;

-- 翻译任务表
CREATE TABLE IF NOT EXISTS `translation_task` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `status` VARCHAR(50) DEFAULT 'PENDING' COMMENT '状态：PENDING/PROCESSING/COMPLETED/FAILED',
    `total_items` INT DEFAULT 0 COMMENT '总翻译项数',
    `completed_items` INT DEFAULT 0 COMMENT '已完成数',
    `failed_items` INT DEFAULT 0 COMMENT '失败数',
    `desc_total` INT DEFAULT 0 COMMENT '描述翻译总数',
    `desc_completed` INT DEFAULT 0 COMMENT '描述翻译完成数',
    `desc_failed` INT DEFAULT 0 COMMENT '描述翻译失败数',
    `readme_total` INT DEFAULT 0 COMMENT 'README翻译总数',
    `readme_completed` INT DEFAULT 0 COMMENT 'README翻译完成数',
    `readme_failed` INT DEFAULT 0 COMMENT 'README翻译失败数',
    `created_at` DATETIME DEFAULT NULL COMMENT '创建时间',
    `finished_at` DATETIME DEFAULT NULL COMMENT '完成时间',
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='翻译任务表';

-- 翻译任务项表
CREATE TABLE IF NOT EXISTS `translation_task_item` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `task_id` BIGINT NOT NULL COMMENT '任务ID',
    `repo_id` BIGINT NOT NULL COMMENT '仓库ID',
    `full_name` VARCHAR(500) DEFAULT NULL COMMENT '仓库全名',
    `translate_type` VARCHAR(20) NOT NULL COMMENT '翻译类型：description/readme',
    `status` VARCHAR(50) DEFAULT 'PENDING' COMMENT '状态：PENDING/PROCESSING/SUCCESS/FAILED',
    `retry_count` INT DEFAULT 0 COMMENT '重试次数',
    `error_message` TEXT DEFAULT NULL COMMENT '错误信息',
    `created_at` DATETIME DEFAULT NULL COMMENT '创建时间',
    `updated_at` DATETIME DEFAULT NULL COMMENT '更新时间',
    PRIMARY KEY (`id`),
    KEY `idx_task_id` (`task_id`),
    KEY `idx_repo_id` (`repo_id`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='翻译任务项表';
