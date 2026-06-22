-- CreateTable
CREATE TABLE `github_repo` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `repo_name` VARCHAR(255) NULL,
    `full_name` VARCHAR(500) NULL,
    `description` TEXT NULL,
    `description_cn` TEXT NULL,
    `readme_cn` LONGTEXT NULL,
    `readme_original` LONGTEXT NULL,
    `readme_fetched` BOOLEAN NOT NULL DEFAULT false,
    `language` VARCHAR(100) NULL,
    `owner_name` VARCHAR(255) NULL,
    `owner_avatar_url` VARCHAR(1000) NULL,
    `html_url` VARCHAR(1000) NULL,
    `homepage` VARCHAR(1000) NULL,
    `stars_count` INTEGER NOT NULL DEFAULT 0,
    `forks_count` INTEGER NOT NULL DEFAULT 0,
    `watchers_count` INTEGER NOT NULL DEFAULT 0,
    `open_issues_count` INTEGER NOT NULL DEFAULT 0,
    `topics` TEXT NULL,
    `license_name` VARCHAR(255) NULL,
    `is_fork` BOOLEAN NOT NULL DEFAULT false,
    `is_archived` BOOLEAN NOT NULL DEFAULT false,
    `repo_created_at` DATETIME NULL,
    `repo_updated_at` DATETIME NULL,
    `repo_pushed_at` DATETIME NULL,
    `starred_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,

    UNIQUE INDEX `github_repo_full_name_key`(`full_name`),
    INDEX `github_repo_language_idx`(`language`),
    INDEX `github_repo_owner_name_idx`(`owner_name`),
    INDEX `github_repo_starred_at_idx`(`starred_at`),
    INDEX `github_repo_stars_count_idx`(`stars_count`),
    INDEX `github_repo_repo_updated_at_idx`(`repo_updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `category` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `parent_id` BIGINT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `icon` VARCHAR(100) NULL,
    `description` TEXT NULL,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,

    INDEX `category_parent_id_idx`(`parent_id`),
    INDEX `category_sort_order_idx`(`sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `category_repo_link` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `category_id` BIGINT NOT NULL,
    `repo_id` BIGINT NOT NULL,
    `created_at` DATETIME NOT NULL,

    INDEX `category_repo_link_repo_id_idx`(`repo_id`),
    UNIQUE INDEX `category_repo_link_category_id_repo_id_key`(`category_id`, `repo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sync_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sync_type` VARCHAR(50) NULL,
    `status` VARCHAR(50) NULL,
    `total_count` INTEGER NULL,
    `synced_count` INTEGER NULL,
    `started_at` DATETIME NULL,
    `finished_at` DATETIME NULL,
    `error_message` TEXT NULL,
    `created_at` DATETIME NULL,

    INDEX `sync_log_status_idx`(`status`),
    INDEX `sync_log_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_config` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `config_key` VARCHAR(255) NOT NULL,
    `config_value` TEXT NULL,
    `description` VARCHAR(500) NULL,
    `created_at` DATETIME NULL,
    `updated_at` DATETIME NULL,

    UNIQUE INDEX `system_config_config_key_key`(`config_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `translation_task` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `status` VARCHAR(50) NULL DEFAULT 'PENDING',
    `total_items` INTEGER NOT NULL DEFAULT 0,
    `completed_items` INTEGER NOT NULL DEFAULT 0,
    `failed_items` INTEGER NOT NULL DEFAULT 0,
    `desc_total` INTEGER NOT NULL DEFAULT 0,
    `desc_completed` INTEGER NOT NULL DEFAULT 0,
    `desc_failed` INTEGER NOT NULL DEFAULT 0,
    `readme_total` INTEGER NOT NULL DEFAULT 0,
    `readme_completed` INTEGER NOT NULL DEFAULT 0,
    `readme_failed` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME NULL,
    `finished_at` DATETIME NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `translation_task_item` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT NOT NULL,
    `repo_id` BIGINT NOT NULL,
    `full_name` VARCHAR(500) NULL,
    `translate_type` VARCHAR(20) NOT NULL,
    `status` VARCHAR(50) NULL DEFAULT 'PENDING',
    `retry_count` INTEGER NOT NULL DEFAULT 0,
    `error_message` TEXT NULL,
    `created_at` DATETIME NULL,
    `updated_at` DATETIME NULL,

    INDEX `translation_task_item_task_id_idx`(`task_id`),
    INDEX `translation_task_item_repo_id_idx`(`repo_id`),
    INDEX `translation_task_item_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clone_task` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `status` VARCHAR(50) NULL DEFAULT 'PENDING',
    `target_dir` VARCHAR(1000) NOT NULL,
    `concurrency` INTEGER NOT NULL DEFAULT 5,
    `shallow` BOOLEAN NOT NULL DEFAULT true,
    `total_items` INTEGER NOT NULL DEFAULT 0,
    `completed_items` INTEGER NOT NULL DEFAULT 0,
    `failed_items` INTEGER NOT NULL DEFAULT 0,
    `skipped_items` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME NULL,
    `started_at` DATETIME NULL,
    `finished_at` DATETIME NULL,

    INDEX `clone_task_status_idx`(`status`),
    INDEX `clone_task_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clone_task_item` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT NOT NULL,
    `repo_id` BIGINT NOT NULL,
    `full_name` VARCHAR(500) NULL,
    `clone_url` VARCHAR(1000) NULL,
    `local_path` VARCHAR(1000) NULL,
    `status` VARCHAR(50) NULL DEFAULT 'PENDING',
    `retry_count` INTEGER NOT NULL DEFAULT 0,
    `error_message` TEXT NULL,
    `created_at` DATETIME NULL,
    `updated_at` DATETIME NULL,

    INDEX `clone_task_item_task_id_idx`(`task_id`),
    INDEX `clone_task_item_repo_id_idx`(`repo_id`),
    INDEX `clone_task_item_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `category` ADD CONSTRAINT `category_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `category_repo_link` ADD CONSTRAINT `category_repo_link_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `category_repo_link` ADD CONSTRAINT `category_repo_link_repo_id_fkey` FOREIGN KEY (`repo_id`) REFERENCES `github_repo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `translation_task_item` ADD CONSTRAINT `translation_task_item_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `translation_task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `translation_task_item` ADD CONSTRAINT `translation_task_item_repo_id_fkey` FOREIGN KEY (`repo_id`) REFERENCES `github_repo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clone_task_item` ADD CONSTRAINT `clone_task_item_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `clone_task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clone_task_item` ADD CONSTRAINT `clone_task_item_repo_id_fkey` FOREIGN KEY (`repo_id`) REFERENCES `github_repo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
