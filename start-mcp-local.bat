@echo off
REM ============================================================
REM 本地 MCP Server 启动脚本（端口 10006）
REM 与 Docker 容器（端口 10005）隔离，避免冲突
REM ============================================================

cd /d %~dp0\packages\mcp-server

REM 检查是否已编译
if not exist dist\index.js (
    echo [MCP] 未找到编译产物，正在构建...
    call npm run build
)

echo [MCP] 启动本地 MCP Server (http://localhost:10006/mcp)
echo [MCP] 按 Ctrl+C 停止
node dist\index.js --http --port 10006
