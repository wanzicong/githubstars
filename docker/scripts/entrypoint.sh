#!/bin/sh
# ============================================================
# GitHub Stars 后端容器入口脚本
# ============================================================
# 职责:
#   1. 等待 MySQL 就绪
#   2. 执行 Prisma 数据库迁移
#   3. 启动 NestJS 后端服务
# ============================================================
set -e

# ─── 配置 ───────────────────────────────────────────────────
# 数据库连接超时（秒）
DB_TIMEOUT=60
# 重试间隔（秒）
RETRY_INTERVAL=3

# 从 DATABASE_URL 解析主机和端口
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:/]*\).*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*@[^:/]*:\([0-9]*\).*/\1/p')
DB_PORT="${DB_PORT:-3306}"

echo "[entrypoint] 等待 MySQL 就绪... (${DB_HOST}:${DB_PORT}, 超时 ${DB_TIMEOUT}s)"

# ─── 等待 MySQL ────────────────────────────────────────────
WAIT_START=$(date +%s)
while true; do
    # 使用 node 的 net 模块检测端口连通性（Alpine 无需额外工具）
    if node -e "
        const net = require('net');
        const s = net.createConnection({ host: '$DB_HOST', port: $DB_PORT }, () => {
            s.end();
            process.exit(0);
        });
        s.on('error', () => process.exit(1));
    " 2>/dev/null; then
        echo "[entrypoint] MySQL 已就绪"
        break
    fi

    NOW=$(date +%s)
    ELAPSED=$((NOW - WAIT_START))
    if [ $ELAPSED -ge $DB_TIMEOUT ]; then
        echo "[entrypoint] 错误: 等待 MySQL 超时 ($DB_TIMEOUTs)，请检查数据库连接"
        echo "[entrypoint] DATABASE_URL: $DATABASE_URL"
        exit 1
    fi

    echo "[entrypoint] 等待 MySQL... (${ELAPSED}s)"
    sleep $RETRY_INTERVAL
done

# ─── Prisma 迁移 ───────────────────────────────────────────
echo "[entrypoint] 执行 Prisma 数据库迁移..."
npx prisma generate --schema=prisma/schema.prisma
npx prisma migrate deploy --schema=prisma/schema.prisma
MIGRATE_EXIT=$?

if [ $MIGRATE_EXIT -ne 0 ]; then
    echo "[entrypoint] 警告: Prisma 迁移未完全应用 (exit=$MIGRATE_EXIT)"
    echo "[entrypoint] 尝试 prisma db push 同步 schema..."
    npx prisma db push --schema=prisma/schema.prisma --accept-data-loss || true
fi

echo "[entrypoint] 数据库迁移完成"

# ─── 启动后端服务 ──────────────────────────────────────────
echo "[entrypoint] 启动 NestJS 后端服务..."
echo "[entrypoint] NODE_ENV=${NODE_ENV}, PORT=${PORT}"

exec node dist/main
