#Requires -Version 5.1
<#
.SYNOPSIS
    dev-start.ps1 — 一键启动 前端 / 后端 / Agent 三个开发服务

.DESCRIPTION
    逻辑：
      1. 逐个检测端口是否被占用（前端 10001 / 后端 10002 / Agent 10003）
      2. 若端口已被占用 → 杀掉占用该端口的旧进程
      3. 全部清理完后，用 npm run dev:xxx 重新启动三个服务

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\dev-start.ps1
    启动全部三个服务

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\dev-start.ps1 frontend
    只操作前端

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\dev-start.ps1 backend agent
    只操作后端 + agent
#>
param(
    [string[]]$Services
)

$ErrorActionPreference = 'Continue'

# 切到项目根目录（脚本所在目录的上一级）
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
Set-Location $RootDir

# 服务定义： 名称 → @{ Port; Script }
$ServiceMap = [ordered]@{
    backend  = @{ Port = 10002; Script = 'dev:backend' }
    frontend = @{ Port = 10001; Script = 'dev:frontend' }
    agent    = @{ Port = 10003; Script = 'dev:agent' }
}

$LogDir = Join-Path $RootDir 'logs'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

# 要操作的服务：无参数则全部
if (-not $Services -or $Services.Count -eq 0) {
    $Targets = @('backend', 'frontend', 'agent')
} else {
    $Targets = $Services
}

function Write-Info  { param($msg) Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Write-Err   { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

# 查找监听指定端口的进程 PID
function Get-PortPids {
    param([int]$Port)
    $pids = @()
    try {
        # Get-NetTCPConnection 在 Win8+/PowerShell 3+ 可用
        $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
        $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
    } catch {
        # 回退到 netstat 解析
        $lines = netstat -ano | Select-String -Pattern "LISTENING" | Select-String -Pattern ":$Port\s"
        foreach ($line in $lines) {
            $parts = ($line -split '\s+') | Where-Object { $_ -ne '' }
            if ($parts.Count -ge 5) { $pids += [int]$parts[-1] }
        }
        $pids = $pids | Sort-Object -Unique
    }
    return $pids
}

# 停止占用某端口的所有进程
function Stop-Port {
    param([string]$Name, [int]$Port)
    $pids = Get-PortPids -Port $Port
    if (-not $pids -or $pids.Count -eq 0) {
        Write-Info "$Name (端口 $Port) 未运行，无需清理"
        return
    }
    Write-Info "$Name (端口 $Port) 已被占用，清理进程：$($pids -join ' ')"
    foreach ($procId in $pids) {
        try { Stop-Process -Id $procId -Force -ErrorAction Stop }
        catch { Write-Err "无法结束进程 $procId : $($_.Exception.Message)" }
    }
    # 等待端口释放（最多 5 秒）
    $wait = 0
    while ($wait -lt 10) {
        Start-Sleep -Milliseconds 500
        if (-not (Get-PortPids -Port $Port)) { break }
        $wait++
    }
    if (Get-PortPids -Port $Port) {
        Write-Err "$Name (端口 $Port) 清理后仍被占用，请手动检查"
    } else {
        Write-Info "$Name (端口 $Port) 已释放"
    }
}

# 启动某个服务（新开一个后台进程，日志写入 logs/<name>.log）
function Start-Service-Dev {
    param([string]$Name, [string]$Script)
    $logFile = Join-Path $LogDir "$Name.log"
    Write-Info "启动 $Name → npm run $Script (日志: $logFile)"
    # 用 cmd /c 承载 npm，输出重定向到日志文件，窗口隐藏
    $npmCmd = "npm run $Script > `"$logFile`" 2>&1"
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $npmCmd -WorkingDirectory $RootDir -WindowStyle Hidden
    Write-Info "$Name 已在后台启动"
}

Write-Host "=============================================="
Write-Host " 启动服务: $($Targets -join ', ')"
Write-Host "=============================================="

# 第一步：清理端口
foreach ($name in $Targets) {
    if (-not $ServiceMap.Contains($name)) {
        Write-Err "未知服务: $name (可选: frontend/backend/agent)"
        continue
    }
    Stop-Port -Name $name -Port $ServiceMap[$name].Port
}

Write-Host "----------------------------------------------"

# 第二步：启动服务
foreach ($name in $Targets) {
    if ($ServiceMap.Contains($name)) {
        Start-Service-Dev -Name $name -Script $ServiceMap[$name].Script
    }
}

Write-Host "=============================================="
Write-Info "全部操作完成。查看实时日志： Get-Content logs\<服务名>.log -Wait"
Write-Host "  前端  http://localhost:10001"
Write-Host "  后端  http://localhost:10002"
Write-Host "  Agent http://localhost:10003"
Write-Host "=============================================="
