# CareerOS · Oracle Cloud Always Free 部署指南（一步步）

> 目标：把 CareerOS 全套（Next.js Web + BullMQ Worker + Postgres/pgvector + Redis + MinIO + docreader gRPC + Caddy HTTPS）部署到**一台 Oracle ARM 免费 VM**，零架构改造、零费用。
> 适用栈已核实：pnpm 11.13.1 / Node ≥22 / Next 16 / tsx / BullMQ / Prisma 6 / Playwright(chromium) / docreader(arm64 ✓) / pgvector(arm64 ✓)。

---

## 0. 为什么是 Oracle（一句话）

本栈有两个**常驻进程**需求：BullMQ worker（一死全异步链路挂）、docreader gRPC 容器。Vercel 跑不了常驻 worker、Cloudflare 根本不是容器平台——只有 Oracle Always Free 的 ARM VM 能一把梭，且 4 OCPU / 24GB / 200GB / 10TB 出网全免费。

---

## 1. 注册 Oracle Cloud（你操作，涉及账号/支付）

1. 打开 https://www.oracle.com/cloud/free/ ，用邮箱注册 **Free Tier** 账号。
2. 验证手机 + **绑定信用卡**（会预授权 $1，不会真正扣费，仅防滥用）。
3. ⚠️ 注册/开实例时**全程不要开 VPN**（Oracle 风控会直接拒账号，且难解封）。
4. 区域建议选离你近且有 Always Free ARM 的，例如 `ap-tokyo-1`（东京）、`ap-singapore-1`、`ap-osaka-1`、`us-ashburn-1` 等。ARM(Ampere A1) 在大部分区域都免费提供。
5. 进入控制台后先到 **Identity → Compartments** 建一个 `careeros`  compartment（可选，便于管理）。

> 如果首页提示「升级到付费」，Free Tier 账号本身就含 Always Free 资源，无需付费；不要误点付费升级。

---

## 2. 创建 Always Free VM

1. 控制台 → **Compute → Instances → Create instance**。
2. **Name**：`careeros-vm`。
3. **Image**：Ubuntu 24.04 (aarch64) 或 22.04（都行，本文用 Ubuntu）。
4. **Shape**：点「Change shape」→ **VM.Standard.A1.Flex** →
   - OCPU = **4**
   - Memory = **24 GB**
   - 启动卷 = **200 GB**（缺省即可，Always Free 上限内）
5. **Networking**：
   - 选「Create new VCN」或已有 VCN，勾选 **Assign a public IPv4 address**。
   - **Security lists（入站规则）**确认/新增允许：
     | 协议 | 端口 | 用途 |
     |---|---|---|
     | TCP | 22 | SSH |
     | TCP | 80 | HTTP（Let's Encrypt 校验 + 跳转） |
     | TCP | 443 | HTTPS |
     | TCP | 9101 | 可选：MinIO 控制台（不公开也行，需要时再加） |
   - ⚠️ **80 和 443 必须开放**，否则 Caddy 申请证书会失败。
6. **SSH keys**：选「Generate a key pair」下载私钥，或粘贴你已有的 **公钥**（推荐用你本机 `~/.ssh/id_ed25519.pub`）。
7. 点 **Create**，等待状态 `Running`，记下 **Public IP**（下文写作 `<VM_IP>`）。

---

## 3. 登录 + 装 Docker（在 VM 上执行）

```bash
# Ubuntu 镜像默认用户是 ubuntu
ssh ubuntu@<VM_IP>

# 更新系统
sudo apt-get update && sudo apt-get -y upgrade

# 一键装 Docker + compose 插件（官方脚本）
sudo apt-get install -y ca-certificates curl
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# 让 docker 组生效（重登或执行下一行）
newgrp docker
docker --version          # 应显示 24+/25+
docker compose version    # 应显示 v2.x
```

> 退出重登一次让 `docker` 组权限生效，之后命令可不加 `sudo`（本文后续命令默认已生效；若报权限错，命令前加 `sudo`）。

---

## 4. 获取代码（二选一）

**方式 A：git clone（推荐，便于后续升级）**
```bash
sudo apt-get install -y git
git clone <你的仓库地址> /opt/careeros
cd /opt/careeros
```

**方式 B：本机 scp 整个目录**
```bash
# 在你本机执行
rsync -avz --exclude node_modules --exclude '.next' --exclude '.git' \
  /Users/hebeihang/DEV/tools/careeros/ ubuntu@<VM_IP>:/opt/careeros/
ssh ubuntu@<VM_IP> "sudo chown -R ubuntu:ubuntu /opt/careeros"
```

确认 `/opt/careeros/deploy/` 下已有：`Dockerfile.web` `Dockerfile.worker` `docker-compose.prod.yml` `Caddyfile` `.env.production.example` `backup.sh` `careeros.service`。

---

## 5. 配置生产环境变量

```bash
cd /opt/careeros
cp deploy/.env.production.example deploy/.env.production
nano deploy/.env.production      # 或用 vim
```

逐项修改（**至少改下面这些**，其余按需）：

| 变量 | 改为什么 |
|---|---|
| `SITE_DOMAIN` | 你的域名，如 `careeros.yourdomain.com` |
| `ACME_EMAIL` | 你的邮箱（证书到期提醒） |
| `DB_PASSWORD` | **强随机串**（别用默认） |
| `S3_SECRET_KEY` | **强随机串** |
| `AUTH_SECRET` | 执行 `openssl rand -base64 32` 生成后粘贴 |
| `SMTP_*` | 真实 SMTP（**OTP 登录/找回密码必需**；可用腾讯云/阿里云邮件推送、SES、SendGrid 等） |
| `AUTH_GOOGLE_ID/SECRET` | 可选；去 Google Cloud Console 建 OAuth 客户端（回调 `https://域名/api/auth/callback/google`）后填入 |

> 注意：`AUTH_DEV_CREDENTIALS=false` 已内置（生产必须关掉 dev 密码登录守卫）。
> 若只配了 SMTP 没配 Google：用户走**邮箱验证码(OTP)登录**即可，完全可用。

---

## 6. 构建 & 启动（首次较慢）

```bash
cd /opt/careeros
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production up -d --build
```

- 首次会**构建 web 与 worker 两个镜像**：`pnpm install` + `prisma generate` + `next build` + 下载 Playwright chromium，约 **5–15 分钟**（取决于网速）。
- 构建完自动按依赖顺序拉起：postgres(健康后) → redis / docreader / minio → web / worker → caddy。
- 观察进度：`docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production logs -f --no-log-prefix` （Ctrl-C 退出跟踪，不影服务）。

---

## 7. 数据库迁移（重要，首次必做）

```bash
cd /opt/careeros
# 应用所有 Prisma 迁移
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production \
  run --rm web pnpm --filter @careeros/db migrate:deploy

# 建向量/业务索引（schema 里 indexes.sql）
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production \
  run --rm web pnpm --filter @careeros/db db:indexes

# （可选）种子数据
# docker compose ... run --rm web pnpm --filter @careeros/db seed
```

> 之后每次升级代码若含新迁移，只需重跑 `migrate:deploy`。

---

## 8. 域名 & DNS

在你域名服务商后台，添加一条 **A 记录**：
- 主机名：`careeros`（或 `@`/`www`，按 `SITE_DOMAIN` 填的值）
- 类型：`A`
- 值：`<VM_IP>`（第 2 步记的公网 IP）

等 DNS 生效（通常几分钟，`dig +short 你的域名` 返回 IP 即生效）。

---

## 9. HTTPS（Caddy 自动签发）

Caddy 容器已在 compose 里，首次有流量访问 `https://你的域名` 时自动向 Let's Encrypt 申请证书并续期，无需手动操作。

```bash
# 等 DNS 生效后验证
curl -I https://你的域名
# 看到 HTTP/2 200 或 308 跳转即成功
```

验证登录链路：浏览器打开 `https://你的域名` → 走 OTP 或 Google 登录。

> 若证书申请失败：99% 是 **80 端口没开**（HTTP-01 校验需要）。回第 2 步把 80 入站放开，再 `docker compose ... restart caddy`。

---

## 10. 进程守护（崩溃自恢复 + 开机自启）

compose 里每个服务都已 `restart: unless-stopped`：**worker 崩了会被自动拉起**（根治本地「worker 死→异步全挂」的老问题）。

主机重启后自动整体拉起（可选但推荐）：

```bash
sudo cp /opt/careeros/deploy/careeros.service /etc/systemd/system/careeros.service
sudo systemctl daemon-reload
sudo systemctl enable --now careeros.service

# 验证：重启 VM 后服务应自动起来
sudo reboot
# 重启后 ssh 回来：docker compose ... ps  应全 Up
```

---

## 11. 备份（Postgres）

```bash
sudo chmod +x /opt/careeros/deploy/backup.sh
# 加 cron：每天 04:10 备份，保留 14 天
(crontab -l 2>/dev/null; echo "10 4 * * * /opt/careeros/deploy/backup.sh >> /var/log/careeros-backup.log 2>&1") | crontab -

# 手动试一次
sudo /opt/careeros/deploy/backup.sh
ls -lh /var/backups/careeros/
```

> 进阶（可选）：把 `/var/backups/careeros/*.sql.gz` 同步到 Oracle 对象存储（10GB 免费、S3 兼容），防 VM 损坏。

---

## 12. 验证 & 排错

```bash
cd /opt/careeros
# 全部服务状态
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production ps
# worker 是否在消费队列
docker compose ... logs --tail=50 worker
# web 报错
docker compose ... logs --tail=50 web
```

常见坑速查：

| 现象 | 原因/解决 |
|---|---|
| web 一直 restart | DB 还没迁移或 `DATABASE_URL` 错；先 `migrate:deploy`（第 7 步） |
| 登录收不到验证码 | `SMTP_*` 没配或错；生产 OTP 依赖真 SMTP |
| 导入解析 500 | docreader 没起；`docker compose ... ps` 看 docreader 是否 Up |
| 岗位监测 0 结果 | 正常：沙箱/无真实招聘站来源；看 worker 日志有无报错 |
| HTTPS 证书失败 | 入站 80 没开；放开后 `restart caddy` |
| worker 进程掉 | `restart: unless-stopped` 会自动拉起；查 `logs worker` 看是否 OOM（24GB 足够，一般不会） |

---

## 13. 后续升级代码

```bash
cd /opt/careeros
git pull                                   # 或重新 scp
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production up -d --build
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production \
  run --rm web pnpm --filter @careeros/db migrate:deploy
```

---

## 附录 A：对象存储可选项（MinIO → Oracle 对象存储）

当前用容器内 MinIO（自包含、零依赖）。若要换成 Oracle 对象存储（更省心、持久）：
1. OCI 控制台建 **Bucket**（标准，S3 兼容），记下命名空间/区域端点。
2. 建 **Customer Secret Key**（Access Key / Secret Key）。
3. 在 `.env.production` 把 web/worker 的：
   - `S3_ENDPOINT=https://<namespace>.compatibility.objectstorage.<region>.oraclecloud.com`
   - `S3_ACCESS_KEY` / `S3_SECRET_KEY` = 上面的 Key
   - `S3_BUCKET` = bucket 名
4. 删掉 `docker-compose.prod.yml` 里的 `minio` 和 `minio-init` 两个 service。
5. 重新 `up -d`。

## 附录 B：资源占用估算（4 OCPU / 24 GB）

- postgres+pgvector ≈ 0.5–1 GB
- redis ≈ 0.2 GB
- minio ≈ 0.3 GB
- docreader ≈ 0.5–1 GB
- web(next) ≈ 0.5–1 GB
- worker(tsx + chromium) ≈ 0.5–1.5 GB（抓取时短暂升高）
- 余量充足，24 GB 完全够；4 OCPU 并发无压力。
