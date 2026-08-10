# CareerOS · Windows 笔记本本地部署指南（中国友好 / 投资人演示）

> 适用场景：用一台 **Windows x64 笔记本**跑整套 CareerOS（Docker 栈），通过 **Cloudflare Tunnel** 让国内投资人访问，**零租金**、零备案。
> 等价于 Oracle 指南里的 Plan B1，只是主机从 Mac 换成 Windows。所有 `deploy/` 文件原样复用，只改运行环境和几个环境变量。
> 业务成熟后再租云服务器（香港免备案 / 大陆备案），同一套文件直接迁移，见末尾「转正到云」。

---

## 0. 架构与前提

- 8 个服务（postgres / redis / minio / docreader / web / worker / caddy + 隧道）在一个 `docker compose` 里一把梭。
- **已验证 x64 兼容**：`docreader` 镜像同时含 `linux/amd64` 和 `linux/arm64`，其余全是多架构镜像，Windows 笔记本无压力。
- 家庭/办公室网络多无公网 IP → 用 **Cloudflare Tunnel** 解决（免费、自动 HTTPS、不改路由器）。

### 硬件要求
- 内存 **≥ 8 GB**（全套峰值约 3–6 GB，4 GB 会紧；**Docker Desktop 默认只给 2 GB，必须调大**，见步骤 1）。
- 硬盘 ≥ 20 GB 空闲（镜像 + 构建 + 数据）。
- 演示时**接通电源、关闭睡眠**，别合盖。

---

## 1. 安装 Docker Desktop（WSL2 后端）

1. 下载并安装 [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)。
2. 安装时勾选 **Use WSL 2 instead of Hyper-V**（默认就是）。
3. 启动后，右下角托盘 → 右键 Docker 图标 → **Settings → General**，确认 **Use the WSL 2 based engine** 已勾选。
4. **调大内存（关键！）**：Settings → **Resources** → 把 **Memory** 拉到 **至少 6144 MB（建议 8192 MB）**，点 **Apply & Restart**。
   - 默认 2 GB 跑不动 CareerOS（postgres+redis+minio+docreader+web+worker 一起会 OOM 被杀）。
5. 打开 **终端（推荐 Windows Terminal）**，验证：
   ```powershell
   docker --version
   docker compose version
   ```
   都应正常输出版本号。

> 建议用 **WSL2 里的 Ubuntu 终端** 跑后续命令（开始菜单搜 "Ubuntu"）。把代码 clone 到 WSL2 文件系统（如 `~/careeros` 即 `\\wsl$\Ubuntu\home\你的用户名\careeros`），**不要**放 `C:\`（NTFS 下 Docker 构建极慢、且 bind mount 偶发问题）。Docker Desktop 会自动接管 WSL2 里的 docker 命令。

---

## 2. 获取代码

```bash
# 在 WSL2 Ubuntu 终端里（家目录下）
git clone https://github.com/gamesushi/CareerOS.git
cd CareerOS
# 切到当前开发分支（含最新功能与部署文件）
git checkout feat/b-end-job-posting
```

> 如果只要最新可部署代码，也可以直接 `git clone` 后用默认分支；但本指南配套文件在 `feat/b-end-job-posting` 分支上最新。

---

## 3. 配置环境变量

```bash
cd deploy
cp .env.china-demo.example .env.production
```

用编辑器（VS Code / 记事本）打开 `deploy/.env.production`，**逐项填真实值**：

| 变量 | 填什么 |
|---|---|
| `DB_PASSWORD` | 强随机串：`openssl rand -base64 24` |
| `S3_SECRET_KEY` | 强随机串：`openssl rand -base64 24` |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `DEEPSEEK_API_KEY` | 你的 DeepSeek API Key（**必填**，国内可达） |
| `DEEPSEEK_MODEL` | `deepseek-chat`（按账号可用模型填） |
| `SMTP_*` | 国内 SMTP，如 QQ：`smtp.qq.com` / `587` / `false`，`SMTP_USER=你的QQ@qq.com`，`SMTP_PASS`=**授权码**（非登录密码） |
| `AUTH_GOOGLE_ID/SECRET` | **留空**（中国被墙，禁用 Google 登录） |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` | **留空**（被墙，不用） |

> 演示期想「账号+密码」直接登录（免 OTP）：把 `AUTH_DEV_CREDENTIALS` 设 `true`，并**同时**把 `docker-compose.prod.yml` 里 web 服务的 `AUTH_DEV_CREDENTIALS: "false"` 改成 `${AUTH_DEV_CREDENTIALS}`（见下方「坑 1」）。正式上线必须改回 `false`。

---

## 4. 切到隧道版 Caddyfile

默认 `Caddyfile` 会申请 Let's Encrypt 证书（需要真实域名 + 公网 80 端口）。走隧道时不需要，改用 HTTP 版：

```bash
# 在 deploy/ 目录
cp Caddyfile.tunnel Caddyfile
```

> 这会覆盖仓库里的默认 `Caddyfile`，仅影响本机部署。想恢复：`git checkout Caddyfile`。
> （不想覆盖也行：改成编辑 `docker-compose.prod.yml` 里 caddy 的 volumes 那行，把 `./deploy/Caddyfile` 换成 `./deploy/Caddyfile.tunnel`。）

---

## 5. 构建并启动

首次构建会下载 Playwright chromium（约 5–15 分钟，需联网），耐心等。

```bash
# 在仓库根目录（CareerOS/）
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production up -d --build
```

查看进度 / 日志：

```bash
docker compose -f deploy/docker-compose.prod.yml ps
docker compose -f deploy/docker-compose.prod.yml logs -f web      # web 日志
docker compose -f deploy/docker-compose.prod.yml logs -f worker    # worker 日志
```

---

## 6. 数据库迁移

等 `postgres` 变 `healthy`（看 `ps` 输出）、`web` 构建完成并起来后，执行一次迁移：

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production \
  run --rm web pnpm --filter @careeros/db migrate:deploy
```

无报错即成功。

---

## 7. 本地验证

在 Windows 本机浏览器打开 **http://localhost:80** ，应能看到 CareerOS 页面。能注册/登录即说明栈已跑通。

> 若 `AUTH_DEV_CREDENTIALS=true` 且已改 compose，可用「账号+密码」直接登录；否则走 OTP（去你的 SMTP 邮箱收验证码）。

---

## 8. 让投资人访问（Cloudflare Tunnel）

本机没有公网 IP，用隧道把 `http://localhost:80` 暴露成一个公网 HTTPS 地址。

### 方式 A：Cloudflare 快通道（最简单，无需域名）

1. 安装 `cloudflared`：
   ```powershell
   winget install Cloudflare.cloudflared
   ```
   （或去 https://github.com/cloudflare/cloudflared/releases 下 Windows msi）
2. 开一条临时隧道（保持这个终端窗口运行，关掉隧道就断）：
   ```bash
   cloudflared tunnel --url http://localhost:80
   ```
3. 终端会打印一个 `https://xxxx.trycloudflare.com` 地址，**把这个发给投资人**即可。自动 HTTPS、无需备案。

> ⚠️ Cloudflare 在大陆偶尔抖动/偏慢。若投资人打不开或很卡，改用方式 B。

### 方式 B：Tailscale（国内更稳，推荐给投资人演示）

1. 这台 Windows 和投资人设备都装 [Tailscale](https://tailscale.com/) 并登录（可用同一免费账号或互相分享节点）。
2. 投资人那台在 Tailscale 里能看到这台 Windows 的 **100.x.x.x** 地址。
3. 投资人浏览器打开 **http://100.x.x.x:80** 即可访问（Tailscale 中继在大陆通常可用）。
4. 不用跑 cloudflared，隧道关掉也行。

### 方式 C：同一局域网

若投资人和你在同一 WiFi，直接给 TA 本机局域网 IP（命令行 `ipconfig` 看 IPv4，如 `192.168.x.x`）：**http://192.168.x.x:80**。

---

## 9. 常用运维命令

都在仓库根目录执行，compose 文件/环境变量按上面指定：

```bash
# 看状态
docker compose -f deploy/docker-compose.prod.yml ps

# 看日志（实时）
docker compose -f deploy/docker-compose.prod.yml logs -f

# 重启全部
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production restart

# 停掉（保留数据卷）
docker compose -f deploy/docker-compose.prod.yml down

# 停掉并删数据（危险，仅当你想清空重来）
docker compose -f deploy/docker-compose.prod.yml down -v

# 重新构建（改了代码后）
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production up -d --build
```

数据在 Docker 命名卷里（`pgdata` / `redisdata` / `miniodata` / `caddy_data`），`down` 不删，`down -v` 才删。

---

## 10. 坑位提醒

1. **`AUTH_DEV_CREDENTIALS` 被硬编码**：`docker-compose.prod.yml` 的 web 服务写死 `"false"`。演示期想用密码登录，必须把它改成 `${AUTH_DEV_CREDENTIALS}` 并在 `.env.production` 设 `true`。
2. **Docker 内存**：务必把 Docker Desktop 内存调到 ≥6 GB，否则容器会被 OOM 杀。
3. **构建慢**：首次 `--build` 要在容器内 `pnpm install` + `next build` + 下载 chromium，10–20 分钟正常，别中途 Ctrl-C。
4. **代码放 WSL2 文件系统**：放 `C:\` 下构建会极慢且可能 bind mount 异常。
5. **笔记本别睡**：电源设置「接通电源永不睡眠」，演示期间保持插电开机。
6. **Cloudflare 国内抖动**：投资人若访问不稳，切 Tailscale（方式 B）最稳。

---

## 11. 转正到云（业务成熟后）

同一套 `deploy/` 文件原样复用，只换运行环境和 env：

- **香港轻量（免备案，≈¥156/月 4核8G）**：阿里云/腾讯云香港，直接复用，`SITE_DOMAIN` 填真实域名，Caddyfile 换回默认的（`git checkout Caddyfile`），DNS A 记录指向服务器 IP，Caddy 自动签 HTTPS。
- **大陆轻量 + ICP 备案（≈¥220/月，需企业主体）**：国内体验最佳，但需走备案（1–3 周）。
- **数据迁移**：用 `deploy/backup.sh` 导出 Postgres（`pg_dump` → gzip），到新服务器恢复即可；MinIO 文件可用 `mc` 或 `aws cli` 同步。

云上部署比 Oracle 简单：没有容量抢注、没有 VCN/安全列表那套，建好实例开 80/443 后直接复用本指南第 3–7 步。详见 `ORACLE-DEPLOY-GUIDE.md` 第 3–13 步。

---

## 附：与 Oracle 指南的差异一览

| 项目 | Oracle 指南 | 本 Windows 指南 |
|---|---|---|
| 主机 | Oracle A1 ARM VM | 本地 Windows x64 笔记本（Docker Desktop / WSL2） |
| 公网暴露 | 真实公网 IP + Caddy 自动 HTTPS | Cloudflare Tunnel / Tailscale（无公网 IP） |
| Caddyfile | 默认（申请证书） | `Caddyfile.tunnel`（纯 HTTP） |
| AI | OpenAI / Gemini / DeepSeek | 仅 DeepSeek（国内可达） |
| 登录 | Google + OTP | 仅 OTP（Google 被墙禁用） |
| 成本 | 免费（抢得到的话） | ¥0（自有硬件） |
| 常驻 | 云端 24/7 | 依赖笔记本开机 |
