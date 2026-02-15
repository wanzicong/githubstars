"""
GitHub Stars 管理系统 - 数据库导出脚本
导出 githubstars 数据库的 DDL 和全部数据为 SQL 文件
"""

import pymysql
import os
from datetime import datetime

# 数据库连接配置
DB_HOST = '127.0.0.1'
DB_PORT = 3307
DB_USER = 'root'
DB_PASSWORD = '123456'
DB_NAME = 'githubstars'

# 导出文件路径
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(OUTPUT_DIR, 'githubstars_backup.sql')


def escape_value(value):
    """转义 SQL 值"""
    if value is None:
        return 'NULL'
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, datetime):
        return f"'{value.strftime('%Y-%m-%d %H:%M:%S')}'"
    if isinstance(value, bytes):
        return f"X'{value.hex()}'"
    # 字符串转义
    s = str(value)
    s = s.replace('\\', '\\\\')
    s = s.replace("'", "\\'")
    s = s.replace('\n', '\\n')
    s = s.replace('\r', '\\r')
    s = s.replace('\t', '\\t')
    return f"'{s}'"


def get_create_table_ddl(cursor, table_name):
    """获取建表 DDL"""
    cursor.execute(f"SHOW CREATE TABLE `{table_name}`")
    row = cursor.fetchone()
    return row[1]


def get_all_tables(cursor):
    """获取所有表名"""
    cursor.execute("SHOW TABLES")
    return [row[0] for row in cursor.fetchall()]


def export_table_data(cursor, table_name):
    """导出表数据为 INSERT 语句"""
    cursor.execute(f"SELECT * FROM `{table_name}`")
    rows = cursor.fetchall()

    if not rows:
        return []

    # 获取列名
    columns = [desc[0] for desc in cursor.description]
    col_list = ', '.join(f'`{c}`' for c in columns)

    statements = []
    # 每 100 条一批
    batch_size = 100
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        values_list = []
        for row in batch:
            values = ', '.join(escape_value(v) for v in row)
            values_list.append(f'({values})')
        stmt = f"INSERT INTO `{table_name}` ({col_list}) VALUES\n" + ',\n'.join(values_list) + ';'
        statements.append(stmt)

    return statements


def main():
    """主函数"""
    print("=" * 50)
    print("GitHub Stars 数据库导出")
    print("=" * 50)

    try:
        connection = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            charset='utf8mb4'
        )
        cursor = connection.cursor()

        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            # 写入文件头
            f.write(f"-- GitHub Stars 数据库备份\n")
            f.write(f"-- 导出时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"-- 数据库: {DB_NAME}\n")
            f.write("-- -------------------------------------------\n\n")

            # 创建数据库
            f.write(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n")
            f.write(f"USE `{DB_NAME}`;\n\n")

            f.write("SET NAMES utf8mb4;\n")
            f.write("SET FOREIGN_KEY_CHECKS = 0;\n\n")

            # 获取所有表
            tables = get_all_tables(cursor)
            print(f"发现 {len(tables)} 张表: {', '.join(tables)}")

            for table in tables:
                print(f"\n正在导出表: {table}")

                # 导出 DDL
                ddl = get_create_table_ddl(cursor, table)
                f.write(f"-- -------------------------------------------\n")
                f.write(f"-- 表结构: {table}\n")
                f.write(f"-- -------------------------------------------\n")
                f.write(f"DROP TABLE IF EXISTS `{table}`;\n")
                f.write(f"{ddl};\n\n")

                # 导出数据
                cursor.execute(f"SELECT COUNT(*) FROM `{table}`")
                count = cursor.fetchone()[0]
                print(f"  记录数: {count}")

                if count > 0:
                    f.write(f"-- -------------------------------------------\n")
                    f.write(f"-- 数据: {table} ({count} 条记录)\n")
                    f.write(f"-- -------------------------------------------\n")
                    statements = export_table_data(cursor, table)
                    for stmt in statements:
                        f.write(stmt + '\n\n')

            f.write("SET FOREIGN_KEY_CHECKS = 1;\n")

        # 统计文件大小
        file_size = os.path.getsize(OUTPUT_FILE)
        if file_size > 1024 * 1024:
            size_str = f"{file_size / 1024 / 1024:.2f} MB"
        else:
            size_str = f"{file_size / 1024:.2f} KB"

        print(f"\n{'=' * 50}")
        print(f"导出完成！")
        print(f"文件: {OUTPUT_FILE}")
        print(f"大小: {size_str}")
        print(f"{'=' * 50}")

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
