-- GitHub Stars 管理系统 - 数据库建表脚本
-- 数据库: githubstars

CREATE DATABASE IF NOT EXISTS `githubstars` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `githubstars`;

-- GitHub 仓库表
CREATE TABLE IF NOT EXISTS `github_repo` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `repo_name` VARCHAR(255) DEFAULT NULL COMMENT '仓库名称',
    `full_name` VARCHAR(500) DEFAULT NULL COMMENT '仓库全名（owner/repo）',
    `description` TEXT DEFAULT NULL COMMENT '仓库描述',
    `language` VARCHAR(100) DEFAULT NULL COMMENT '编程语言',
    `owner_name` VARCHAR(255) DEFAULT NULL COMMENT '作者名称',
    `owner_avatar_url` VARCHAR(1000) DEFAULT NULL COMMENT '作者头像URL',
    `html_url` VARCHAR(1000) DEFAULT NULL COMMENT '仓库GitHub链接',
    `homepage` VARCHAR(1000) DEFAULT NULL COMMENT '项目主页链接',
    `stars_count` INT DEFAULT 0 COMMENT 'Star数量',
    `forks_count` INT DEFAULT 0 COMMENT 'Fork数量',
    `watchers_count` INT DEFAULT 0 COMMENT 'Watcher数量',
    `open_issues_count` INT DEFAULT 0 COMMENT '开放Issue数量',
    `topics` TEXT DEFAULT NULL COMMENT '主题标签（JSON数组字符串）',
    `license_name` VARCHAR(255) DEFAULT NULL COMMENT '开源许可证名称',
    `is_fork` TINYINT(1) DEFAULT 0 COMMENT '是否为Fork仓库',
    `is_archived` TINYINT(1) DEFAULT 0 COMMENT '是否已归档',
    `repo_created_at` DATETIME DEFAULT NULL COMMENT '仓库创建时间',
    `repo_updated_at` DATETIME DEFAULT NULL COMMENT '仓库最后更新时间',
    `repo_pushed_at` DATETIME DEFAULT NULL COMMENT '仓库最后推送时间',
    `starred_at` DATETIME DEFAULT NULL COMMENT 'Star时间',
    `created_at` DATETIME DEFAULT NULL COMMENT '记录创建时间',
    `updated_at` DATETIME DEFAULT NULL COMMENT '记录更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_full_name` (`full_name`),
    KEY `idx_language` (`language`),
    KEY `idx_owner_name` (`owner_name`),
    KEY `idx_starred_at` (`starred_at`),
    KEY `idx_stars_count` (`stars_count`),
    KEY `idx_repo_updated_at` (`repo_updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='GitHub Star仓库表';

-- 中文翻译字段（2025-06-06 新增）
ALTER TABLE `github_repo`
    ADD COLUMN `description_cn` TEXT DEFAULT NULL COMMENT '中文翻译-仓库描述' AFTER `description`,
    ADD COLUMN `readme_cn` LONGTEXT DEFAULT NULL COMMENT '中文翻译-README' AFTER `description_cn`,
    ADD COLUMN `readme_original` LONGTEXT DEFAULT NULL COMMENT '原始README内容' AFTER `readme_cn`,
    ADD COLUMN `readme_fetched` TINYINT(1) DEFAULT 0 COMMENT '是否已获取并翻译README' AFTER `readme_original`;

-- 同步日志表
CREATE TABLE IF NOT EXISTS `sync_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `sync_type` VARCHAR(50) DEFAULT NULL COMMENT '同步类型（手动同步/定时同步）',
    `status` VARCHAR(50) DEFAULT NULL COMMENT '同步状态（进行中/成功/失败）',
    `total_count` INT DEFAULT NULL COMMENT '总仓库数',
    `synced_count` INT DEFAULT NULL COMMENT '已同步数',
    `started_at` DATETIME DEFAULT NULL COMMENT '开始时间',
    `finished_at` DATETIME DEFAULT NULL COMMENT '完成时间',
    `error_message` TEXT DEFAULT NULL COMMENT '错误信息',
    `created_at` DATETIME DEFAULT NULL COMMENT '记录创建时间',
    PRIMARY KEY (`id`),
    KEY `idx_status` (`status`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='同步日志表';

-- Clone任务表
CREATE TABLE IF NOT EXISTS `clone_task` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `task_id` VARCHAR(64) NOT NULL COMMENT '任务唯一标识',
    `status` VARCHAR(32) DEFAULT 'PENDING' COMMENT '任务状态：PENDING/RUNNING/COMPLETED/FAILED',
    `total_repos` INT DEFAULT 0 COMMENT '总仓库数',
    `completed_repos` INT DEFAULT 0 COMMENT '已完成数',
    `failed_repos` INT DEFAULT 0 COMMENT '失败数',
    `skipped_repos` INT DEFAULT 0 COMMENT '跳过数',
    `error_message` TEXT DEFAULT NULL COMMENT '错误信息',
    `keyword` VARCHAR(255) DEFAULT NULL COMMENT '筛选关键词',
    `language` VARCHAR(255) DEFAULT NULL COMMENT '筛选语言',
    `category_ids` VARCHAR(255) DEFAULT NULL COMMENT '筛选分类ID列表',
    `date_field` VARCHAR(64) DEFAULT NULL COMMENT '时间筛选字段',
    `start_date` VARCHAR(16) DEFAULT NULL COMMENT '开始日期',
    `end_date` VARCHAR(16) DEFAULT NULL COMMENT '结束日期',
    `sort_by` VARCHAR(64) DEFAULT NULL COMMENT '排序字段',
    `sort_order` VARCHAR(16) DEFAULT NULL COMMENT '排序方向',
    `sub_directory` VARCHAR(255) DEFAULT NULL COMMENT '子目录',
    `target_dir` VARCHAR(500) DEFAULT NULL COMMENT '目标目录',
    `concurrency` INT DEFAULT 5 COMMENT '并发数',
    `started_at` DATETIME DEFAULT NULL COMMENT '开始时间',
    `finished_at` DATETIME DEFAULT NULL COMMENT '完成时间',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `pinned` INT DEFAULT 0 COMMENT '是否置顶：0=否，1=是',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_task_id` (`task_id`),
    KEY `idx_status` (`status`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Clone任务表';

-- Clone任务项表
CREATE TABLE IF NOT EXISTS `clone_task_item` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `task_id` VARCHAR(64) NOT NULL COMMENT '关联任务ID',
    `full_name` VARCHAR(500) NOT NULL COMMENT '仓库全名（owner/repo）',
    `status` VARCHAR(32) NOT NULL COMMENT '克隆状态：CLONED/FAILED/SKIPPED',
    `message` TEXT DEFAULT NULL COMMENT '状态信息',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    KEY `idx_task_id` (`task_id`),
    KEY `idx_full_name` (`full_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Clone任务项表';
