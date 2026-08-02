-- 我的仓库功能：新增 my_repo / my_repo_category_link 表，
-- 以及我的仓库克隆/下载任务子项表（与 Star 仓库的子项表平行）

-- 我的仓库主表
CREATE TABLE `my_repo` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `repo_name` VARCHAR(255) NULL COMMENT '仓库名',
    `full_name` VARCHAR(500) NULL COMMENT '仓库全名 owner/repo',
    `description` TEXT NULL COMMENT '描述原文',
    `description_cn` TEXT NULL COMMENT '描述中文翻译',
    `readme_cn` LONGTEXT NULL COMMENT 'README 中文翻译',
    `readme_original` LONGTEXT NULL COMMENT 'README 原文',
    `readme_fetched` TINYINT NOT NULL DEFAULT 0 COMMENT '是否已拉取 README',
    `language` VARCHAR(100) NULL COMMENT '主语言',
    `owner_name` VARCHAR(255) NULL COMMENT '所有者',
    `owner_avatar_url` VARCHAR(1000) NULL COMMENT '所有者头像',
    `html_url` VARCHAR(1000) NULL COMMENT 'GitHub 地址',
    `homepage` VARCHAR(1000) NULL COMMENT '主页',
    `stars_count` INT NOT NULL DEFAULT 0 COMMENT 'Star 数',
    `forks_count` INT NOT NULL DEFAULT 0 COMMENT 'Fork 数',
    `watchers_count` INT NOT NULL DEFAULT 0 COMMENT 'Watch 数',
    `open_issues_count` INT NOT NULL DEFAULT 0 COMMENT '开放 Issue 数',
    `topics` TEXT NULL COMMENT '主题标签 JSON',
    `license_name` VARCHAR(255) NULL COMMENT '许可证',
    `is_fork` TINYINT NOT NULL DEFAULT 0 COMMENT '是否 Fork',
    `is_archived` TINYINT NOT NULL DEFAULT 0 COMMENT '是否归档',
    `is_private` TINYINT NOT NULL DEFAULT 0 COMMENT '是否私有',
    `repo_size` INT NULL COMMENT '仓库大小(KB)',
    `default_branch` VARCHAR(255) NULL COMMENT '默认分支',
    `visibility` VARCHAR(50) NULL COMMENT '可见性',
    `repo_created_at` DATETIME NULL COMMENT 'GitHub 创建时间',
    `repo_updated_at` DATETIME NULL COMMENT 'GitHub 更新时间',
    `repo_pushed_at` DATETIME NULL COMMENT 'GitHub 推送时间',
    `created_at` DATETIME NOT NULL COMMENT '本地创建时间',
    `updated_at` DATETIME NOT NULL COMMENT '本地更新时间',
    PRIMARY KEY (`id`),
    UNIQUE INDEX `my_repo_full_name_key` (`full_name`),
    INDEX `my_repo_language_idx` (`language`),
    INDEX `my_repo_stars_count_idx` (`stars_count`),
    INDEX `my_repo_repo_updated_at_idx` (`repo_updated_at`),
    INDEX `my_repo_is_private_idx` (`is_private`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '我的仓库';

-- 我的仓库-分类关联表
CREATE TABLE `my_repo_category_link` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `category_id` BIGINT NOT NULL COMMENT '分类 ID',
    `my_repo_id` BIGINT NOT NULL COMMENT '我的仓库 ID',
    `created_at` DATETIME NOT NULL COMMENT '创建时间',
    PRIMARY KEY (`id`),
    UNIQUE INDEX `my_repo_category_link_category_id_my_repo_id_key` (`category_id`, `my_repo_id`),
    INDEX `my_repo_category_link_my_repo_id_idx` (`my_repo_id`),
    CONSTRAINT `my_repo_category_link_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `category` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `my_repo_category_link_my_repo_id_fkey` FOREIGN KEY (`my_repo_id`) REFERENCES `my_repo` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '我的仓库-分类关联';

-- 我的仓库克隆任务子项
CREATE TABLE `my_repo_clone_task_item` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `task_id` BIGINT NOT NULL COMMENT '克隆任务 ID',
    `repo_id` BIGINT NOT NULL COMMENT '我的仓库 ID',
    `full_name` VARCHAR(500) NULL COMMENT '仓库全名',
    `clone_url` VARCHAR(1000) NULL COMMENT '克隆地址',
    `local_path` VARCHAR(1000) NULL COMMENT '本地路径',
    `status` VARCHAR(50) NULL DEFAULT 'PENDING' COMMENT '状态',
    `retry_count` INT NOT NULL DEFAULT 0 COMMENT '重试次数',
    `error_message` TEXT NULL COMMENT '错误信息',
    `created_at` DATETIME NULL COMMENT '创建时间',
    `updated_at` DATETIME NULL COMMENT '更新时间',
    PRIMARY KEY (`id`),
    INDEX `my_repo_clone_task_item_task_id_idx` (`task_id`),
    INDEX `my_repo_clone_task_item_repo_id_idx` (`repo_id`),
    INDEX `my_repo_clone_task_item_status_idx` (`status`),
    CONSTRAINT `my_repo_clone_task_item_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `clone_task` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `my_repo_clone_task_item_repo_id_fkey` FOREIGN KEY (`repo_id`) REFERENCES `my_repo` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '我的仓库克隆任务子项';

-- 我的仓库下载任务子项
CREATE TABLE `my_repo_download_task_item` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `task_id` BIGINT NOT NULL COMMENT '下载任务 ID',
    `repo_id` BIGINT NOT NULL COMMENT '我的仓库 ID',
    `full_name` VARCHAR(500) NULL COMMENT '仓库全名',
    `archive_url` VARCHAR(2000) NULL COMMENT '压缩包地址',
    `local_file_path` VARCHAR(1000) NULL COMMENT '本地文件路径',
    `extract_dir` VARCHAR(1000) NULL COMMENT '解压目录',
    `file_size` BIGINT NULL DEFAULT 0 COMMENT '文件大小(字节)',
    `default_branch` VARCHAR(100) NULL COMMENT '默认分支',
    `status` VARCHAR(50) NULL DEFAULT 'PENDING' COMMENT '状态',
    `retry_count` INT NOT NULL DEFAULT 0 COMMENT '重试次数',
    `error_message` TEXT NULL COMMENT '错误信息',
    `created_at` DATETIME NULL COMMENT '创建时间',
    `updated_at` DATETIME NULL COMMENT '更新时间',
    PRIMARY KEY (`id`),
    INDEX `my_repo_download_task_item_task_id_idx` (`task_id`),
    INDEX `my_repo_download_task_item_repo_id_idx` (`repo_id`),
    INDEX `my_repo_download_task_item_status_idx` (`status`),
    CONSTRAINT `my_repo_download_task_item_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `download_task` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `my_repo_download_task_item_repo_id_fkey` FOREIGN KEY (`repo_id`) REFERENCES `my_repo` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '我的仓库下载任务子项';
