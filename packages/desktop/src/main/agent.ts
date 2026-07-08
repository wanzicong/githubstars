import { spawn, type ChildProcess } from 'node:child_process'
import { join, resolve } from 'node:path'
import { request } from 'node:http'
import { app } from 'electron'
import log from 'electron-log'
import { createServer, type Server } from 'node:net'

/**
 * Agent 服务管理器 —— 在 Electron 中自动启动 GitHub Agent 服务（github-agent 包）
 *
 * 使用 ELECTRON_RUN_AS_NODE=1 模式启动，将 Electron 可执行文件当作 Node.js 运行时。
 *
 * 负责：
 * 1. 找到可用端口（默认 10011 起，避开后端 10004-10010）
 * 2. 启动 Agent 子进程，注入 DATABASE_URL（与后端共享同一个 SQLite 库）
 *    并透传 ANTHROPIC_* 等系统环境变量（Claude Agent SDK 凭据）
 * 3. 轮询 /health 健康检查，直到 Agent 就绪
 * 4. 崩溃自动重启（最多 3 次）
 * 5. 应用退出时优雅关闭
 *
 * @depends
 *   - BackendManager.getDatabasePath() 等价逻辑 —— Agent 连接同一个 githubstars.db
 *   - github-agent/dist/index.js —— Agent 服务入口
 */
export class AgentManager {
  private process: ChildProcess | null = null
  private port = 10011
  private isShuttingDown = false
  private restartCount = 0
  private readonly MAX_RESTARTS = 3
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null
  private startupResolve: ((value: boolean) => void) | null = null
  private healthPollInterval: ReturnType<typeof setInterval> | null = null
  /** 由外部（BackendManager）传入的数据库文件路径，确保 Agent 与后端共享同一个库 */
  private databasePath: string

  constructor(databasePath: string) {
    this.databasePath = databasePath
  }

  /** 获取 Agent 运行的端口 */
  getPort(): number {
    return this.port
  }

  /** Agent 是否正在运行 */
  isRunning(): boolean {
    return this.process !== null && this.process.exitCode === null
  }

  /**
   * 启动 Agent 服务
   *
   * @returns 就绪返回 true，超时或崩溃返回 false
   */
  async start(): Promise<boolean> {
    this.isShuttingDown = false
    this.port = await this.findFreePort(10011, 10020)

    const agentEntry = this.getAgentEntry()
    const nodeExe = this.getExecutablePath()

    log.info(`[Agent] 启动 Agent 服务 exe=${nodeExe} entry=${agentEntry} port=${this.port}`)

    return new Promise<boolean>((resolve) => {
      this.startupResolve = resolve

      this.process = spawn(nodeExe, [agentEntry], {
        env: {
          // 透传父进程全部环境变量（含 ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN 等 SDK 凭据）
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          AGENT_PORT: String(this.port),
          NODE_ENV: 'production',
          // 与后端共享同一个 SQLite 库；GITHUB_TOKEN 由 Agent 从 system_config 表读取
          DATABASE_URL: `file:${this.databasePath}`,
        },
        cwd: this.getAgentDir(),
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })

      this.process.stdout?.on('data', (data: Buffer) => {
        const msg = data.toString().trim()
        if (msg) log.info(`[Agent:out] ${msg}`)
      })
      this.process.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim()
        if (msg) log.error(`[Agent:err] ${msg}`)
      })

      this.process.on('exit', (code, signal) => {
        log.warn(`[Agent] 进程退出 code=${code} signal=${signal}`)
        this.process = null
        this.stopHealthPoll()

        if (this.startupResolve) {
          this.startupResolve(false)
          this.startupResolve = null
          return
        }

        if (!this.isShuttingDown && this.restartCount < this.MAX_RESTARTS) {
          this.restartCount++
          log.info(`[Agent] 自动重启 (${this.restartCount}/${this.MAX_RESTARTS})...`)
          setTimeout(() => this.start(), 2000)
        } else if (this.restartCount >= this.MAX_RESTARTS) {
          log.error(`[Agent] 已达最大重启次数 (${this.MAX_RESTARTS})，停止自动恢复`)
        }
      })

      this.process.on('error', (err) => {
        log.error(`[Agent] 进程错误: ${err.message}`)
      })

      this.pollHealth()
    })
  }

  /**
   * 轮询 /health 健康检查，每秒一次，最多 60 秒。
   */
  private pollHealth(): void {
    let elapsed = 0
    const MAX_WAIT = 60

    this.stopHealthPoll()
    this.healthPollInterval = setInterval(() => {
      elapsed += 1

      if (!this.process || this.process.exitCode !== null) {
        this.stopHealthPoll()
        return
      }

      if (elapsed >= MAX_WAIT) {
        this.stopHealthPoll()
        log.warn(`[Agent] 健康检查超时 (${MAX_WAIT}s)，但进程仍在运行`)
        if (this.startupResolve) {
          this.startupResolve(true)
          this.startupResolve = null
        }
        return
      }

      this.httpGet(`http://127.0.0.1:${this.port}/health`)
        .then((ok) => {
          if (ok && this.startupResolve) {
            log.info(`[Agent] 健康检查通过，Agent 就绪 (${elapsed}s)`)
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
   * 简单 HTTP GET；返回 2xx/3xx/4xx 视为"可响应"。
   */
  private httpGet(url: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const req = request(url, { timeout: 2000 }, (res) => {
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
   * 停止 Agent 服务。
   */
  async stop(): Promise<void> {
    this.isShuttingDown = true
    this.stopHealthPoll()
    this.stopHealthCheck()

    if (!this.process) return

    log.info('[Agent] 正在停止 Agent 服务...')

    return new Promise((resolve) => {
      const killTimeout = setTimeout(() => {
        if (this.process && this.process.exitCode === null) {
          log.warn('[Agent] 强制终止 Agent 进程')
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

  private getAgentEntry(): string {
    return join(this.getAgentDir(), 'dist', 'index.js')
  }

  private getAgentDir(): string {
    if (app.isPackaged) {
      return join(process.resourcesPath, 'agent')
    }
    // 开发模式指向 github-agent 包本身
    return resolve(__dirname, '../../../../github-agent')
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
        log.warn('[Agent] 健康检查：Agent 进程已退出')
        if (!this.isShuttingDown) {
          log.info('[Agent] 健康检查：触发自动重启')
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
