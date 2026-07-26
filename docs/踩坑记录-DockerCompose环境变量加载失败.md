# 踩坑记录 — Docker Compose 环境变量加载失败

> **记录日期**：2026-07-25
> **二次更新**：2026-07-26（补充根目录执行仍失败的根因）
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

### 第一次记录（2026-07-25）：工作目录错误

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

### 第二次记录（2026-07-26）：根目录执行仍失败

即使在项目根目录执行，警告 `"DATABASE_URL" is not set` 仍然出现。原因是：

**`env_file:` 和 `${VAR}` 占位符使用两套独立的环境变量加载机制：**

| 机制 | 加载来源 | 用途 |
|------|---------|------|
| `env_file:` | 容器内运行时环境变量 | 直接注入到容器进程 |
| `${VAR}` 占位符替换 | compose CLI 自己的环境（shell env + `--env-file`） | 在 compose 解析 YAML 时替换 |

- `env_file: .env.production` 只影响**容器内**的 env，不影响 compose 自己解析 `${DATABASE_URL}`
- compose 解析 `${DATABASE_URL}` 时，按以下顺序查找：
  1. 当前 shell 环境变量（`env | grep DATABASE_URL`）
  2. `--env-file` 参数指定的文件
  3. **默认只读 `.env`**（不是 `.env.production`）
- 项目里没有 `.env` 文件，shell 也没 export `DATABASE_URL` → 解析为空字符串

**结论：** 即使 `env_file:` 路径正确，`${VAR}` 占位符依然找不到值。**两个机制都要喂。**

---

## 正确做法

### 方案 1（推荐）：始终用 `--env-file` 显式指定

```bash
cd /d/WorkSpaceCoding/apps/githubstars
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

`--env-file` 同时影响：
- compose 解析 `${VAR}` 占位符时的查找来源
- 容器内环境变量（与 `env_file:` 叠加，不冲突）

### 方案 2：把 `.env.production` 软链/复制为 `.env`

```bash
# 一次性设置（Windows 下用 copy）
cp .env.production .env

# 之后就可以不带 --env-file
docker compose -f docker-compose.prod.yml up -d
```

compose 默认读 `.env`，无需 `--env-file`。**注意：** `.env` 通常已在 `.gitignore`，不会泄露。

### 方案 3：去掉 compose 文件里的 `${VAR}` 占位符

如果 `env_file:` 已经能注入所有变量，可以把：
```yaml
environment:
  DATABASE_URL: ${DATABASE_URL}   # ← 这一行删掉
```
改为完全依赖 `env_file:`，让变量不经过 compose 解析。但这样会失去"启动前校验"的能力（变量缺失时 compose 不会报警告）。

---

## 验证检查清单

执行 `docker compose up -d` 后，**必须**做以下检查：

```bash
# 1. 检查输出是否含 "variable is not set" 警告
docker compose -f docker-compose.prod.yml --env-file .env.production up -d 2>&1 | grep "is not set"

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

1. **`env_file:` 和 `${VAR}` 占位符是两套独立机制** — 前者管容器运行时 env，后者管 compose 解析时的字符串替换。两个都要喂，缺一个就会失败。

2. **docker compose 默认只读 `.env`**，不会自动读 `.env.production` / `.env.staging` 等变体。自定义文件名必须显式 `--env-file`。

3. **`env_file` 加载失败不会报错，只会警告**。`variable is not set` 警告容易被忽略，但后果是服务启动失败。必须主动检查。

4. **入口脚本（entrypoint）失败时容器会进入重启循环**。`docker ps` 看到的 "Up X seconds" 是误导性的——它只反映当前这次启动的存活时间，不反映服务是否真正可用。必须配合 `docker logs` 和 curl 实际验证。

5. **容器健康状态 healthy ≠ 业务可用**。`githubstars-backend` 的 healthcheck 是 `wget http://localhost:10002/api/docs-json`，能通只说明 HTTP 服务起来了，不代表数据库连接正常。业务级验证必须 curl 真实接口。

---

## 相关文件

- [docker-compose.prod.yml](../docker-compose.prod.yml)
- [.env.production](../.env.production)（本地，未提交）
- [Dockerfile.backend](../Dockerfile.backend)（含 entrypoint 脚本）
