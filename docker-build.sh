#!/bin/bash
# ============================================================
# GitHub Stars — Docker 构建与部署脚本
# ============================================================
# 使用方式:
#   chmod +x docker-build.sh
#   ./docker-build.sh build       # 构建镜像
#   ./docker-build.sh up          # 启动服务
#   ./docker-build.sh down        # 停止服务
#   ./docker-build.sh restart     # 重启服务
#   ./docker-build.sh logs        # 查看日志
#   ./docker-build.sh clean       # 清理镜像
# ============================================================
set -e

COMPOSE_FILE="docker-compose.prod.yml"
BACKEND_IMAGE="githubstars-backend"
FRONTEND_IMAGE="githubstars-frontend"

case "${1:-help}" in
    build)
        echo "=========================================="
        echo " 构建后端镜像..."
        echo "=========================================="
        docker build -t ${BACKEND_IMAGE} -f Dockerfile.backend .

        echo ""
        echo "=========================================="
        echo " 构建前端镜像..."
        echo "=========================================="
        docker build -t ${FRONTEND_IMAGE} -f Dockerfile.frontend .

        echo ""
        echo "=========================================="
        echo " ✅ 镜像构建完成"
        echo "=========================================="
        docker images --filter=reference="${BACKEND_IMAGE}" --filter=reference="${FRONTEND_IMAGE}"
        ;;

    up)
        echo "=========================================="
        echo " 启动生产环境服务..."
        echo "=========================================="
        # 检查 .env.production 是否存在
        if [ ! -f .env.production ]; then
            echo "⚠️  未找到 .env.production 文件！"
            echo "   请复制 .env.production 并修改配置后再启动。"
            exit 1
        fi
        docker compose -f ${COMPOSE_FILE} --env-file .env.production up -d
        echo ""
        echo " ✅ 服务已启动"
        echo "    访问 http://localhost:${HTTP_PORT:-10003}"
        ;;

    down)
        echo "=========================================="
        echo " 停止生产环境服务..."
        echo "=========================================="
        docker compose -f ${COMPOSE_FILE} down
        echo " ✅ 服务已停止"
        ;;

    restart)
        echo "=========================================="
        echo " 重启生产环境服务..."
        echo "=========================================="
        docker compose -f ${COMPOSE_FILE} restart
        echo " ✅ 服务已重启"
        ;;

    logs)
        shift
        docker compose -f ${COMPOSE_FILE} logs -f "$@"
        ;;

    ps)
        docker compose -f ${COMPOSE_FILE} ps
        ;;

    clean)
        echo "=========================================="
        echo " 清理构建镜像..."
        echo "=========================================="
        docker rmi ${BACKEND_IMAGE} ${FRONTEND_IMAGE} 2>/dev/null || true
        echo " ✅ 镜像已清理"
        ;;

    migrate)
        echo "=========================================="
        echo " 手动执行数据库迁移..."
        echo "=========================================="
        docker compose -f ${COMPOSE_FILE} exec backend npx prisma migrate deploy
        echo " ✅ 迁移完成"
        ;;

    shell)
        echo "=========================================="
        echo " 进入后端容器 Shell..."
        echo "=========================================="
        docker compose -f ${COMPOSE_FILE} exec backend sh
        ;;

    *)
        echo "GitHub Stars Docker 部署管理脚本"
        echo ""
        echo "用法: $0 <command>"
        echo ""
        echo "命令:"
        echo "  build         构建 Docker 镜像（后端 + 前端）"
        echo "  up            启动生产环境服务"
        echo "  down          停止生产环境服务"
        echo "  restart       重启服务"
        echo "  logs [svc]    查看日志（可选指定服务名）"
        echo "  ps            查看服务状态"
        echo "  clean         清理 Docker 镜像"
        echo "  migrate       手动执行数据库迁移"
        echo "  shell         进入后端容器 Shell"
        echo ""
        echo "快速部署:"
        echo "  ./docker-build.sh build && ./docker-build.sh up"
        ;;
esac
