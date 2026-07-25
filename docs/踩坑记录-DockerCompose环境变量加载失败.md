# 踩坑记录 — Docker Compose 环境变量加载失败

> **记录日期**：2026-07-25
> **影响范围**：生产环境部署 / 容器重启
> **严重级别**：高（服务无法启动）

---

## 问题现象

执行 `docker compose -f docker-compose.prod.yml up -d` 重启生产容器后：

1. `docker compose` 输出警告：
   ```
   time="..." level=warning msg="The \"DATABASE_URL\" variable is not set. Defaulting to a blank string."
   ```

2. `githubstars-backend` 容器启动后日志显示：
   ```
   [entrypoint] 等待 MySQL 就绪... (:3306, 超时 60s)
   [entrypoint] 等待 MySQL... (0s/3s/6s/.../59s)
   [entrypoint] 错误: 等待 MySQL 超时 ()，请检查数据库连接
   [entrypoint] DATABASE_URL:
   ```

3. 容器反复崩溃重启，`docker ps` 显示 `Up X seconds (health: starting)` 但秒数一直重置。

---

## 根本原因

**工作目录错误导致 docker compose 找不到 `.env.production` 文件。**

`docker-compose.prod.yml` 中 backend 服务配置：
```yaml
backend:
  env_file:
    - .env.production
  environment:
    DATABASE_URL: ${DATABASE_URL}
```

- `env_file: .env.production` 是**相对路径**，相对于**执行 docker compose 命令时的当前工作目录**
- `${DATABASE_URL}` 也是从当前 shell 环境或 `.env` 文件读取

我当时在 `packages/frontend` 子目录下执行 `docker compose`：
- 相对路径 `.env.production` 解析为 `packages/frontend/.env.production` → **不存在**
- docker compose 静默继续，`DATABASE_URL` 变成空字符串
- backend 容器启动时 entrypoint 脚本读取 `DATABASE_URL` 为空 → 无法连接 MySQL → 超时退出 → 重启循环

---

## 正确做法

### 方案 1（推荐）：始终在项目根目录执行

```bash
cd /d/WorkSpaceCoding/apps/githubstars
docker compose -f docker-compose.prod.yml up -d
```

### 方案 2：显式指定 env 文件

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

`--env-file` 参数支持绝对路径或相对路径，明确告诉 compose 去哪读环境变量。

### 方案 3：使用 `--project-directory`

```bash
docker compose --project-directory /d/WorkSpaceCoding/apps/githubstars \
  -f docker-compose.prod.yml up -d
```

`--project-directory` 会改变所有相对路径的解析基准。

---

## 验证检查清单

执行 `docker compose up -d` 后，**必须**做以下检查：

```bash
# 1. 检查输出是否含 "variable is not set" 警告
docker compose -f docker-compose.prod.yml up -d 2>&1 | grep "is not set"

# 2. 等 30 秒后检查容器健康状态
sleep 30 && docker ps --filter "name=githubstars-" --format "table {{.Names}}\t{{.Status}}"

# 期望输出：
# githubstars-backend    Up 30 seconds (healthy)
# githubstars-frontend   Up 30 seconds (healthy)

# 3. 如果 backend 显示 "Up X seconds" 但 X 一直很小（< 60s）且变化，说明在崩溃重启
# 立即查看日志找原因
docker logs githubstars-backend --tail 30

# 4. curl 验证关键接口
curl -s -X POST http://localhost:10003/api/stars/list \
  -H "Content-Type: application/json" -d '{"pageNum":1,"pageSize":1}' | head -c 200
```

---

## 教训

1. **docker compose 的相对路径解析基准是当前工作目录，不是 compose 文件所在目录**。这是 Docker Compose 的设计，与直觉相反。

2. **`env_file` 加载失败不会报错，只会警告**。`variable is not set` 警告容易被忽略，但后果是服务启动失败。必须主动检查。

3. **入口脚本（entrypoint）失败时容器会进入重启循环**。`docker ps` 看到的 "Up X seconds" 是误导性的——它只反映当前这次启动的存活时间，不反映服务是否真正可用。必须配合 `docker logs` 和 curl 实际验证。

4. **容器健康状态 healthy ≠ 业务可用**。`githubstars-backend` 的 healthcheck 是 `wget http://localhost:10002/api/docs-json`，能通只说明 HTTP 服务起来了，不代表数据库连接正常。业务级验证必须 curl 真实接口。

---

## 相关文件

- [docker-compose.prod.yml](../docker-compose.prod.yml)
- [.env.production](../.env.production)（本地，未提交）
- [Dockerfile.backend](../Dockerfile.backend)（含 entrypoint 脚本）
