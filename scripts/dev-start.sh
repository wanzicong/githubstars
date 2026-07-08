#!/usr/bin/env bash
###############################################################################
# dev-start.sh — 一键启动 前端 / 后端 / Agent 三个开发服务
#
# 逻辑：
#   1. 逐个检测端口是否被占用（前端 10001 / 后端 10002 / Agent 10003）
#   2. 若端口已被占用 → 杀掉占用该端口的旧进程
#   3. 全部清理完后，用 npm run dev:xxx 重新启动三个服务
#
# 用法：
#   bash scripts/dev-start.sh            # 启动全部三个服务
#   bash scripts/dev-start.sh frontend   # 只操作前端
#   bash scripts/dev-start.sh backend agent  # 只操作后端 + agent
###############################################################################
set -uo pipefail

# 切到项目根目录（脚本所在目录的上一级）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# 服务定义： 名称:端口:npm脚本
declare -A PORTS=(
  [frontend]=10001
  [backend]=10002
  [agent]=10003
)
declare -A NPM_SCRIPTS=(
  [frontend]="dev:frontend"
  [backend]="dev:backend"
  [agent]="dev:agent"
)

LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"

# 要操作的服务列表：无参数则全部
if [ "$#" -gt 0 ]; then
  SERVICES=("$@")
else
  SERVICES=(backend frontend agent)
fi

info()  { echo -e "[INFO]  $*"; }
error() { echo -e "[ERROR] $*" >&2; }

# 查找监听指定端口的进程 PID（跨平台：优先 lsof，其次 netstat）
find_pids_by_port() {
  local port="$1"
  local pids=""
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti tcp:"$port" -s tcp:LISTEN 2>/dev/null || true)"
  fi
  if [ -z "$pids" ] && command -v netstat >/dev/null 2>&1; then
    # Windows Git Bash / MSYS：netstat -ano 输出末列是 PID
    pids="$(netstat -ano 2>/dev/null | grep -iE "LISTENING" | grep -E ":$port\b" | awk '{print $NF}' | sort -u || true)"
  fi
  echo "$pids"
}

# 杀掉指定 PID（跨平台）
kill_pid() {
  local pid="$1"
  if command -v taskkill >/dev/null 2>&1; then
    taskkill //PID "$pid" //F >/dev/null 2>&1 || true
  else
    kill -9 "$pid" >/dev/null 2>&1 || true
  fi
}

# 停止占用某端口的所有进程
stop_port() {
  local name="$1" port="$2"
  local pids
  pids="$(find_pids_by_port "$port")"
  if [ -z "$pids" ]; then
    info "$name (端口 $port) 未运行，无需清理"
    return 0
  fi
  info "$name (端口 $port) 已被占用，清理进程：$(echo $pids | tr '\n' ' ')"
  for pid in $pids; do
    kill_pid "$pid"
  done
  # 等待端口释放
  local wait=0
  while [ "$wait" -lt 10 ]; do
    pids="$(find_pids_by_port "$port")"
    [ -z "$pids" ] && break
    sleep 0.5
    wait=$((wait + 1))
  done
  if [ -n "$(find_pids_by_port "$port")" ]; then
    error "$name (端口 $port) 清理后仍被占用，请手动检查"
  else
    info "$name (端口 $port) 已释放"
  fi
}

# 启动某个服务（后台运行，日志写入 logs/<name>.log）
start_service() {
  local name="$1"
  local script="${NPM_SCRIPTS[$name]}"
  local logfile="$LOG_DIR/$name.log"
  info "启动 $name → npm run $script (日志: $logfile)"
  nohup npm run "$script" >"$logfile" 2>&1 &
  info "$name 已在后台启动 (PID $!)"
}

echo "=============================================="
echo " 启动服务: ${SERVICES[*]}"
echo "=============================================="

# 第一步：清理端口
for name in "${SERVICES[@]}"; do
  port="${PORTS[$name]:-}"
  if [ -z "$port" ]; then
    error "未知服务: $name (可选: frontend/backend/agent)"
    continue
  fi
  stop_port "$name" "$port"
done

echo "----------------------------------------------"

# 第二步：启动服务
for name in "${SERVICES[@]}"; do
  [ -n "${PORTS[$name]:-}" ] && start_service "$name"
done

echo "=============================================="
info "全部操作完成。查看实时日志： tail -f logs/<服务名>.log"
echo "  前端 http://localhost:10001"
echo "  后端 http://localhost:10002"
echo "  Agent http://localhost:10003"
echo "=============================================="
