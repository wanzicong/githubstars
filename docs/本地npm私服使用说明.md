# 本地 npm 私服（Verdaccio）使用说明

本项目使用 [Verdaccio](https://verdaccio.org/) 搭建本地 npm 私服，把可复用的子包发布到本地 registry，供其他项目 `npm install` 引用。

## 一、发布的包

| 包名 | 说明 | 类型 |
| --- | --- | --- |
| `@githubstars/shared` | 前后端共享 TypeScript 类型与工具 | 库（编译为 dist） |
| `@githubstars/cli` | 一键启动管理命令行工具 | 可执行 CLI |

> `@githubstars/backend`、`@githubstars/frontend`、`@githubstars/desktop` 属于应用（非库），保留 `private: true`，不发布。

## 二、环境准备

### 1. 安装 Verdaccio（全局，一次性）

```bash
npm install -g verdaccio --registry https://registry.npmmirror.com
```

### 2. 启动 Verdaccio 服务

```bash
# 默认监听 http://localhost:4873，Web UI 也在该地址
verdaccio --listen 4873
```

首次启动会在 `~/.config/verdaccio/config.yaml` 生成默认配置。

### 3. 创建发布用户（一次性）

```bash
# 交互式
npm adduser --registry http://localhost:4873/

# 或用 curl 非交互创建（用户名 local / 密码 local123）
curl -XPUT -H "Content-type: application/json" \
  -d '{"name":"local","password":"local123"}' \
  http://localhost:4873/-/user/org.couchdb.user:local
```

## 三、发布流程

项目根目录已有 `.npmrc`（**含认证 token，已在 .gitignore 中忽略，不会提交**），内容形如：

```ini
@githubstars:registry=http://localhost:4873/
//localhost:4873/:_authToken=<你的 token>
```

发布单个包（各包已配 `publishConfig.registry` 指向本地私服，且 `prepublishOnly` 会自动编译）：

```bash
# 分别进入各包目录发布
cd packages/shared && npm publish
cd packages/cli && npm publish
```

> 每次发布前需**递增版本号**（`npm version patch` 等），否则 registry 会拒绝同版本覆盖。

## 四、在其他项目中使用

在需要引用的项目里配置 scope 走本地私服（写到该项目的 `.npmrc`）：

```ini
@githubstars:registry=http://localhost:4873/
```

然后正常安装：

```bash
npm install @githubstars/shared
npm install -g @githubstars/cli   # CLI 可全局装
```

## 五、常见问题

- **`EPUBLISHCONFLICT` / 拒绝发布**：版本号已存在，先 `npm version patch` 递增。
- **`ENEEDAUTH`**：未登录或 token 失效，重新 `npm adduser --registry http://localhost:4873/`。
- **拉取不到包**：确认 Verdaccio 在运行（`curl http://localhost:4873/-/ping` 应返回 `{}`），且 `.npmrc` 的 scope registry 配置正确。
- **想让 Verdaccio 开机自启/后台常驻**：可用 `pm2 start verdaccio` 管理。

## 六、发布配置说明

各包通过 `publishConfig` 实现「本地开发读源码、发布时读 dist」：

- `shared`：本地 `main` 指向 `./src/index.ts`（TS 直读方便开发），`publishConfig.main` 指向 `./dist/index.js`（发布给外部用编译产物）。
- `files` 字段限定发布内容仅含 `dist`/`bin`，避免把源码、测试等打进包。
