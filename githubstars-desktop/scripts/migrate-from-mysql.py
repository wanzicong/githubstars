import pymysql
import sqlite3
import json
import os
import re
from datetime import datetime

MYSQL = dict(host='127.0.0.1', port=3307, user='root', password='123456', database='githubstars', charset='utf8mb4')
SQLITE_PATH = os.path.join(os.environ.get('APPDATA', ''), 'githubstars-desktop', 'githubstars.db')
CONFIG_PATH = os.path.join(os.environ.get('APPDATA', ''), 'githubstars-desktop', 'config.json')

print(f"📂 SQLite: {SQLITE_PATH}")
print(f"📂 Config: {CONFIG_PATH}")

# 确保目录存在
os.makedirs(os.path.dirname(SQLITE_PATH), exist_ok=True)

# 连接
mysql = pymysql.connect(**MYSQL)
sqlite = sqlite3.connect(SQLITE_PATH)
sqlite.execute("PRAGMA journal_mode=WAL")
sqlite.execute("PRAGMA foreign_keys=ON")

TABLES = {
    'github_repo': ['id','repo_name','full_name','description','description_cn','readme_cn','readme_fetched',
        'language','owner_name','owner_avatar_url','html_url','homepage','stars_count','forks_count',
        'watchers_count','open_issues_count','topics','license_name','is_fork','is_archived',
        'repo_created_at','repo_updated_at','repo_pushed_at','starred_at','created_at','updated_at'],
    'category': ['id','name','description','sort_order','created_at','updated_at'],
    'repo_category': ['id','repo_id','category_id','created_at'],
    'sync_log': ['id','sync_type','status','total_count','synced_count','started_at','finished_at','error_message','created_at'],
    'translation_task': ['id','status','total_items','completed_items','failed_items','desc_total','desc_completed','desc_failed','readme_total','readme_completed','readme_failed','created_at','finished_at'],
    'translation_task_item': ['id','task_id','repo_id','full_name','translate_type','status','retry_count','error_message','created_at','updated_at'],
}

# 迁移所有表
for table, cols in TABLES.items():
    print(f"\n📋 迁移 {table}...")
    col_str = ', '.join(cols)
    placeholders = ', '.join(['?' for _ in cols])

    # 先清空目标表
    sqlite.execute(f"DELETE FROM {table}")

    # 读取 MySQL
    cur = mysql.cursor()
    cur.execute(f"SELECT {col_str} FROM {table}")
    rows = cur.fetchall()
    cur.close()

    # 写入 SQLite
    count = 0
    for row in rows:
        try:
            sqlite.execute(f"INSERT OR REPLACE INTO {table} ({col_str}) VALUES ({placeholders})", row)
            count += 1
        except Exception as e:
            print(f"  ⚠️ 跳过行: {e}")

    sqlite.commit()
    print(f"  ✅ {count}/{len(rows)} 行")

# 迁移 system_config → config.json
print(f"\n📋 迁移 system_config → config.json...")
cur = mysql.cursor()
cur.execute("SELECT config_key, config_value FROM system_config ORDER BY id")
config_items = cur.fetchall()
cur.close()

config = {
    'githubUsername': 'wanzicong',
    'githubToken': '',
    'deepseekApiKey': '',
    'deepseekModel': 'deepseek-chat',
    'deepseekApiUrl': 'https://api.deepseek.com/v1/chat/completions',
}
for key, value in config_items:
    if key == 'github.username': config['githubUsername'] = value or 'wanzicong'
    elif key == 'github.token': config['githubToken'] = value or ''
    elif key == 'deepseek.api_key': config['deepseekApiKey'] = value or ''
    elif key == 'deepseek.model': config['deepseekModel'] = value or 'deepseek-chat'
    elif key == 'deepseek.api_url': config['deepseekApiUrl'] = value or 'https://api.deepseek.com/v1/chat/completions'

with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
    json.dump(config, f, indent=2, ensure_ascii=False)
print(f"  ✅ config.json 已保存")

# 验证
print(f"\n🔍 验证迁移结果...")
for table in TABLES:
    cnt = sqlite.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    print(f"  {table}: {cnt} rows")

# 清理
sqlite.close()
mysql.close()

# 显示配置（脱敏）
print(f"\n📋 配置导入结果:")
for k, v in config.items():
    if 'Token' in k or 'ApiKey' in k:
        show = v[:4] + '****' + v[-4:] if len(v) > 8 else '****'
    else:
        show = v
    print(f"  {k}: {show}")

print(f"\n✅ 全部迁移完成!")
print(f"   SQLite: {SQLITE_PATH}")
print(f"   Config: {CONFIG_PATH}")
print(f"   大小: {os.path.getsize(SQLITE_PATH) / 1024 / 1024:.1f} MB")
