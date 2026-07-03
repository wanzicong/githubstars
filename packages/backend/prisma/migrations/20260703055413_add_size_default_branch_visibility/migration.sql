-- Add repo_size, default_branch, visibility columns to github_repo table
ALTER TABLE `github_repo` ADD COLUMN `repo_size` INT DEFAULT NULL COMMENT '仓库大小(KB)' AFTER `is_archived`;
ALTER TABLE `github_repo` ADD COLUMN `default_branch` VARCHAR(255) DEFAULT NULL COMMENT '默认分支' AFTER `repo_size`;
ALTER TABLE `github_repo` ADD COLUMN `visibility` VARCHAR(50) DEFAULT NULL COMMENT '可见性' AFTER `default_branch`;
