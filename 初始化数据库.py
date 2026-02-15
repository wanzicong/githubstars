"""
GitHub Stars 管理系统 - 数据库初始化脚本
创建 githubstars 数据库及相关表结构
"""

import pymysql

# 数据库连接配置
DB_HOST = '127.0.0.1'
DB_PORT = 3307
DB_USER = 'root'
DB_PASSWORD = '123456'
DB_NAME = 'githubstars'


def create_database(cursor):
    """创建数据库"""
    cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    cursor.execute(f"USE `{DB_NAME}`")
    print(f"数据库 '{DB_NAME}' 创建成功（或已存在）")


def create_github_repo_table(cursor):
    """创建 github_repo 表"""
    sql = """
    CREATE TABLE IF NOT EXISTS `github_repo` (
        `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
        `repo_name` VARCHAR(255) NOT NULL COMMENT '仓库名称',
        `full_name` VARCHAR(500) NOT NULL COMMENT '仓库全名（owner/repo）',
        `description` TEXT COMMENT '仓库描述',
        `language` VARCHAR(100) COMMENT '主要编程语言',
        `owner_name` VARCHAR(255) NOT NULL COMMENT '所有者名称',
        `owner_avatar_url` VARCHAR(500) COMMENT '所有者头像URL',
        `html_url` VARCHAR(500) NOT NULL COMMENT '仓库地址',
        `homepage` VARCHAR(500) COMMENT '项目主页',
        `stars_count` INT DEFAULT 0 COMMENT 'Star数量',
        `forks_count` INT DEFAULT 0 COMMENT 'Fork数量',
        `watchers_count` INT DEFAULT 0 COMMENT 'Watcher数量',
        `open_issues_count` INT DEFAULT 0 COMMENT '开放Issue数量',
        `topics` VARCHAR(2000) COMMENT '主题标签（JSON格式）',
        `license_name` VARCHAR(100) COMMENT '许可证名称',
        `is_fork` TINYINT(1) DEFAULT 0 COMMENT '是否为Fork仓库',
        `is_archived` TINYINT(1) DEFAULT 0 COMMENT '是否已归档',
        `repo_created_at` DATETIME COMMENT '仓库创建时间',
        `repo_updated_at` DATETIME COMMENT '仓库更新时间',
        `repo_pushed_at` DATETIME COMMENT '最后推送时间',
        `starred_at` DATETIME COMMENT 'Star时间',
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
        `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录更新时间',
        PRIMARY KEY (`id`),
        UNIQUE KEY `uk_full_name` (`full_name`),
        KEY `idx_language` (`language`),
        KEY `idx_stars_count` (`stars_count`),
        KEY `idx_starred_at` (`starred_at`),
        KEY `idx_owner_name` (`owner_name`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='GitHub Star仓库表';
    """
    cursor.execute(sql)
    print("表 'github_repo' 创建成功（或已存在）")


def create_sync_log_table(cursor):
    """创建 sync_log 表"""
    sql = """
    CREATE TABLE IF NOT EXISTS `sync_log` (
        `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
        `sync_type` VARCHAR(20) NOT NULL COMMENT '同步类型：MANUAL-手动/SCHEDULED-定时',
        `status` VARCHAR(20) NOT NULL COMMENT '同步状态：RUNNING-运行中/SUCCESS-成功/FAILED-失败',
        `total_count` INT DEFAULT 0 COMMENT '总数量',
        `synced_count` INT DEFAULT 0 COMMENT '已同步数量',
        `started_at` DATETIME COMMENT '开始时间',
        `finished_at` DATETIME COMMENT '完成时间',
        `error_message` TEXT COMMENT '错误信息',
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
        PRIMARY KEY (`id`),
        KEY `idx_sync_type` (`sync_type`),
        KEY `idx_status` (`status`),
        KEY `idx_started_at` (`started_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='同步日志表';
    """
    cursor.execute(sql)
    print("表 'sync_log' 创建成功（或已存在）")


def main():
    """主函数"""
    print("=" * 50)
    print("GitHub Stars 数据库初始化")
    print("=" * 50)

    try:
        # 连接 MySQL（不指定数据库）
        connection = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            charset='utf8mb4'
        )
        cursor = connection.cursor()

        # 创建数据库
        create_database(cursor)

        # 创建表
        create_github_repo_table(cursor)
        create_sync_log_table(cursor)

        connection.commit()
        print("=" * 50)
        print("数据库初始化完成！")
        print("=" * 50)

    except pymysql.Error as e:
        print(f"数据库操作失败: {e}")
        raise
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()


if __name__ == '__main__':
    main()
