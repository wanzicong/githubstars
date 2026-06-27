/*
  Warnings:

  - You are about to alter the column `created_at` on the `category` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `updated_at` on the `category` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `category_repo_link` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `clone_task` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `started_at` on the `clone_task` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `finished_at` on the `clone_task` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `clone_task_item` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `updated_at` on the `clone_task_item` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `repo_created_at` on the `github_repo` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `repo_updated_at` on the `github_repo` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `repo_pushed_at` on the `github_repo` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `starred_at` on the `github_repo` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `github_repo` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `updated_at` on the `github_repo` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `started_at` on the `sync_log` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `finished_at` on the `sync_log` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `sync_log` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `system_config` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `updated_at` on the `system_config` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `translation_task` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `finished_at` on the `translation_task` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `translation_task_item` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `updated_at` on the `translation_task_item` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `category` MODIFY `created_at` DATETIME NOT NULL,
    MODIFY `updated_at` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `category_repo_link` MODIFY `created_at` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `clone_task` ADD COLUMN `mirror_source` VARCHAR(50) NULL DEFAULT 'direct',
    MODIFY `created_at` DATETIME NULL,
    MODIFY `started_at` DATETIME NULL,
    MODIFY `finished_at` DATETIME NULL;

-- AlterTable
ALTER TABLE `clone_task_item` MODIFY `created_at` DATETIME NULL,
    MODIFY `updated_at` DATETIME NULL;

-- AlterTable
ALTER TABLE `github_repo` MODIFY `repo_created_at` DATETIME NULL,
    MODIFY `repo_updated_at` DATETIME NULL,
    MODIFY `repo_pushed_at` DATETIME NULL,
    MODIFY `starred_at` DATETIME NULL,
    MODIFY `created_at` DATETIME NOT NULL,
    MODIFY `updated_at` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `sync_log` MODIFY `started_at` DATETIME NULL,
    MODIFY `finished_at` DATETIME NULL,
    MODIFY `created_at` DATETIME NULL;

-- AlterTable
ALTER TABLE `system_config` MODIFY `created_at` DATETIME NULL,
    MODIFY `updated_at` DATETIME NULL;

-- AlterTable
ALTER TABLE `translation_task` MODIFY `created_at` DATETIME NULL,
    MODIFY `finished_at` DATETIME NULL;

-- AlterTable
ALTER TABLE `translation_task_item` MODIFY `created_at` DATETIME NULL,
    MODIFY `updated_at` DATETIME NULL;
