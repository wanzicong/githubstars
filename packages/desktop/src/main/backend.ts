import { spawn, execSync, type ChildProcess } from 'node:child_process'
import { join, resolve } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { app } from 'electron'
import { request } from 'node:http'
import log from 'electron-log'
import { createServer, type Server } from 'node:net'

/**
 * 后端管理器 —— 在 Electron 中自动启动后端服务
 *
 * 使用 ELECTRON_RUN_AS_NODE=1 模式启动：将 Electron 的可执行文件当作
 * 纯 Node.js 运行时使用（不会创建新窗口），直接运行后端编译后的 main.js。
 *
 * 负责：
 * 1. 找到可用端口（默认 10004，避免与 Web 端 10002 冲突）
 * 2. 启动后端子进程（使用 ELECTRON_RUN_AS_NODE 模式）
 * 3. 轮询 HTTP 健康检查，直到后端就绪后才通知前端
 * 4. 监控后端健康状态，崩溃自动重启（最多 3 次）
 * 5. 应用退出时优雅关闭后端
 */
export class BackendManager {
  private process: ChildProcess | null = null
  private port = 10004
  private isShuttingDown = false
  private restartCount = 0
  private readonly MAX_RESTARTS = 3
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null
  private startupResolve: ((value: boolean) => void) | null = null
  private startupTimeout: ReturnType<typeof setTimeout> | null = null
  private healthPollInterval: ReturnType<typeof setInterval> | null = null

  /** 获取后端运行的端口 */
  getPort(): number {
    return this.port
  }

  /**
   * 获取 SQLite 数据库文件路径（供 Agent 服务共享同一个库）。
   */
  getDatabaseFilePath(): string {
    return this.getDatabasePath()
  }

  /** 后端是否正在运行（进程存活 + HTTP 可响应） */
  isRunning(): boolean {
    return this.process !== null && this.process.exitCode === null
  }

  /**
   * 启动后端服务
   *
   * 流程：
   * 1. 找到可用端口
   * 2. 启动后端子进程
   * 3. 轮询 HTTP 健康检查等待后端就绪
   * 4. 就绪后返回 true，超时或崩溃返回 false
   */
  async start(): Promise<boolean> {
    this.isShuttingDown = false
    this.port = await this.findFreePort(10004, 10010)

    // 初始化 SQLite 数据库
    this.initDatabase()

    const backendEntry = this.getBackendEntry()
    const nodeExe = this.getExecutablePath()

    log.info(`[Backend] 启动后端服务 exe=${nodeExe} entry=${backendEntry} port=${this.port}`)

    return new Promise<boolean>((resolve) => {
      this.startupResolve = resolve

      this.process = spawn(nodeExe, [backendEntry], {
        env: {
          ELECTRON_RUN_AS_NODE: '1',
          PORT: String(this.port),
          NODE_ENV: 'production',
          CORS_ORIGINS: '*',
          LOG_LEVEL: 'info',
          // SQLite 数据库文件路径（存放在用户数据目录）
          DATABASE_URL: `file:${this.getDatabasePath()}`,
        },
        cwd: this.getBackendDir(),
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })

      // 捕获 stdout/stderr（只记录，不用于判断就绪）
      this.process.stdout?.on('data', (data: Buffer) => {
        const msg = data.toString().trim()
        if (msg) log.info(`[Backend:out] ${msg}`)
      })
      this.process.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim()
        if (msg) log.error(`[Backend:err] ${msg}`)
      })

      // 进程退出处理
      this.process.on('exit', (code, signal) => {
        log.warn(`[Backend] 进程退出 code=${code} signal=${signal}`)
        this.process = null
        this.stopHealthPoll()

        if (this.startupResolve) {
          // 启动过程中崩溃：直接返回失败
          this.startupResolve(false)
          this.startupResolve = null
          return
        }

        // 运行时崩溃：自动重启（有限次数）
        if (!this.isShuttingDown && this.restartCount < this.MAX_RESTARTS) {
          this.restartCount++
          log.info(`[Backend] 自动重启 (${this.restartCount}/${this.MAX_RESTARTS})...`)
          setTimeout(() => this.start(), 2000)
        } else if (this.restartCount >= this.MAX_RESTARTS) {
          log.error(`[Backend] 已达最大重启次数 (${this.MAX_RESTARTS})，停止自动恢复`)
        }
      })

      this.process.on('error', (err) => {
        log.error(`[Backend] 进程错误: ${err.message}`)
      })

      // 启动 HTTP 健康检查轮询
      this.pollHealth()
    })
  }

  /**
   * 轮询 HTTP 健康检查
   * 每 1 秒检查一次，直到后端返回 200/404 等正常响应
   */
  private pollHealth(): void {
    let elapsed = 0
    const MAX_WAIT = 60 // 最多等 60 秒

    this.stopHealthPoll()
    this.healthPollInterval = setInterval(() => {
      elapsed += 1

      // 进程已退出 → 停止轮询
      if (!this.process || this.process.exitCode !== null) {
        this.stopHealthPoll()
        return
      }

      // 超时
      if (elapsed >= MAX_WAIT) {
        this.stopHealthPoll()
        log.warn(`[Backend] HTTP 健康检查超时 (${MAX_WAIT}s)，但进程仍在运行`)
        if (this.startupResolve) {
          this.startupResolve(true)
          this.startupResolve = null
        }
        return
      }

      // HTTP 健康检查
      this.httpGet(`http://127.0.0.1:${this.port}/api/docs`)
        .then((ok) => {
          if (ok && this.startupResolve) {
            log.info(`[Backend] HTTP 健康检查通过，后端就绪 (${elapsed}s)`)
            this.stopHealthPoll()
            this.startHealthCheck()
            this.restartCount = 0
            this.startupResolve(true)
            this.startupResolve = null
          }
        })
        .catch(() => {
          // 还没就绪，继续轮询
        })
    }, 1000)
  }

  private stopHealthPoll(): void {
    if (this.healthPollInterval) {
      clearInterval(this.healthPollInterval)
      this.healthPollInterval = null
    }
  }

  /**
   * 简单的 HTTP GET 请求
   * @returns 如果服务器返回 2xx/3xx/4xx 算"可响应"
   */
  private httpGet(url: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const req = request(url, { timeout: 2000 }, (res) => {
        // 任何正常响应码都算后端就绪
        resolve(res.statusCode! < 500)
      })
      req.on('error', () => reject())
      req.on('timeout', () => {
        req.destroy()
        reject()
      })
      req.end()
    })
  }

  /**
   * 停止后端服务
   */
  async stop(): Promise<void> {
    this.isShuttingDown = true
    this.stopHealthPoll()
    this.stopHealthCheck()

    if (this.startupTimeout) {
      clearTimeout(this.startupTimeout)
      this.startupTimeout = null
    }

    if (!this.process) return

    log.info('[Backend] 正在停止后端服务...')

    return new Promise((resolve) => {
      const killTimeout = setTimeout(() => {
        if (this.process && this.process.exitCode === null) {
          log.warn('[Backend] 强制终止后端进程')
          this.process.kill('SIGKILL')
        }
        resolve()
      }, 5000)

      this.process!.on('exit', () => {
        clearTimeout(killTimeout)
        resolve()
      })

      this.process!.kill('SIGTERM')
    })
  }

  private getExecutablePath(): string {
    if (app.isPackaged) {
      return process.execPath
    }
    return 'node'
  }

  private getBackendEntry(): string {
    return join(this.getBackendDir(), 'dist', 'main.js')
  }

  private getBackendDir(): string {
    if (app.isPackaged) {
      return join(process.resourcesPath, 'backend')
    }
    return resolve(__dirname, '../../../../backend')
  }

  /** SQLite 数据库文件路径（Electron userData 目录下） */
  private getDatabasePath(): string {
    const userDataPath = app.getPath('userData')
    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true })
    }
    return join(userDataPath, 'githubstars.db')
  }

  /**
   * 初始化 SQLite 数据库表结构
   *
   * 每次启动都运行 prisma db push，确保数据库 Schema 与 Prisma 模型同步。
   * db push 是幂等操作——已存在的表/列不会重复创建，已有数据不会丢失。
   * 不检查 existsSync(dbPath)，因为空 SQLite 文件可能存在但无表结构。
   */
  private initDatabase(): void {
    const dbPath = this.getDatabasePath()
    log.info('[Backend] 检查数据库表结构...')
    try {
      const backendDir = this.getBackendDir()
      const nodeExe = this.getExecutablePath()
      const output = execSync(`"${nodeExe}" node_modules/prisma/build/index.js db push --skip-generate`, {
        cwd: backendDir,
        env: {
          ELECTRON_RUN_AS_NODE: '1',
          DATABASE_URL: `file:${dbPath}`,
        },
        timeout: 30000,
        windowsHide: true,
      })
      log.info(`[Backend] db push 输出: ${output.toString().trim()}`)
      log.info('[Backend] 数据库表结构同步完成')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // execSync 抛异常时 stderr 在 .stderr 属性上
      const stderr = (e as any)?.stderr?.toString() || ''
      log.error(`[Backend] 数据库初始化失败: ${msg}`)
      if (stderr) log.error(`[Backend] db push stderr: ${stderr}`)
    }
  }

  private findFreePort(start: number, end: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const tryPort = (port: number) => {
        if (port > end) {
          reject(new Error(`没有可用端口 (${start}-${end})`))
          return
        }
        const server: Server = createServer()
        server.listen(port, '127.0.0.1', () => {
          server.close(() => resolve(port))
        })
        server.on('error', () => tryPort(port + 1))
      }
      tryPort(start)
    })
  }

  private startHealthCheck(): void {
    this.stopHealthCheck()
    this.healthCheckInterval = setInterval(() => {
      if (this.process && this.process.exitCode !== null) {
        log.warn('[Backend] 健康检查：后端进程已退出')
        if (!this.isShuttingDown) {
          log.info('[Backend] 健康检查：触发自动重启')
          this.start()
        }
      }
    }, 15000)
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
  }
}

export const backendManager = new BackendManager()
