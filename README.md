# 半山学堂 + 毕业设计管理系统 · 阿里云部署包

本包将「半山学堂」（个人网站）与「毕业设计管理系统（GPSS）」打包成一个部署单元，
通过 Nginx 在同一域名下做路径路由：

| 访问路径 | 系统 |
|----------|------|
| `/` | 半山学堂（前台 + 后台 CMS） |
| `/gpss/` | 毕业设计管理系统（GPSS） |

## 目录结构

```
BSXT2026/
├── docker-compose.yml    # 统一编排：1 MySQL（两库）+ 2 应用 + 1 Nginx
├── nginx.conf            # 统一反向代理（/ → 半山，/gpss/ → 毕设）
├── .env.example          # 环境变量模板
├── deploy.sh             # 一键部署脚本
├── setup-swap.sh         # 低配服务器加 swap（可选）
├── migrate-data.sh       # 从旧「双 MySQL」迁移数据（可选）
├── mysql-init/           # 单 MySQL 首启建库/授权脚本
├── README.md
├── banshan-academy/      # 半山学堂源码（client + server + Dockerfile）
└── gpss/                 # 毕设系统源码（前端 + server + Dockerfile）
```

## 服务器要求

- 一台阿里云 ECS（Linux x86_64，CentOS/Ubuntu 均可）
  - 内存 **2G 及以上**最稳妥；**1.8G 也能跑**，但需先加 swap（见下方「低配服务器（1.8G）注意事项」）
- 已安装 **Docker Engine** + **Docker Compose 插件**（`docker compose` 子命令）
- 安全组开放 **80** 端口（如需 HTTPS 另开 443）

## 半山学堂教学案例库

新版半山学堂提供独立的 `/cases` 研究生教学案例库，保留文章系统和原案例栏目数据；旧 `/section/method` 地址跳转到案例库。管理员从 `/admin/cases` 录入版本、授权与评审，并在 `/admin/teachers` 管理教师账号。教师登录入口为 `/teacher/login`。

部署启动时会通过既有 `entrypoint.sh` 执行幂等数据库结构初始化。案例附件保存在宿主机 `/opt/banshan/case-private`（容器 `/data/case-private`），不公开挂载；升级前请备份数据库并保留此目录。模板包当前没有可导入的案例记录，因此新模块不会生成示例案例。

## 部署步骤

### 1. 上传并解压

```bash
# 本地上传（示例，替换为你的服务器地址）
scp BSXT2026.tar.gz root@<服务器IP>:/opt/
ssh root@<服务器IP>
cd /opt && tar -xzf BSXT2026.tar.gz && cd BSXT2026
```

### 2. 填写环境变量

```bash
cp .env.example .env
vim .env
```

必填项：`PUBLIC_URL`、`MYSQL_ROOT_PASSWORD`、`DB_PASSWORD`、
`BANSHAN_JWT_SECRET`、`GPSS_JWT_SECRET`。
密钥可用 `openssl rand -hex 32` 生成。
（说明：数据库只跑一个 MySQL 实例，`banshan` 与 `gpss` 两库共用账号 `app` + 同一个 `DB_PASSWORD`。）

### 2.5 低配服务器（1.8G 内存）先加 swap

若服务器内存只有 1.8G 左右，建议先执行一次（给系统加 2G swap 兜底）：

```bash
sudo bash setup-swap.sh 2
```

### 3. 一键部署

```bash
bash deploy.sh
# 等价于：docker compose up -d --build
```

首次构建需拉取镜像 + `npm install`，约 3–10 分钟。

### 4. 验证

```bash
curl http://127.0.0.1/api/health          # 半山学堂 API
curl http://127.0.0.1/gpss/api/health     # 毕设系统 API（经子路径）
```

浏览器访问：
- `http://<服务器IP>/` → 半山学堂首页
- `http://<服务器IP>/gpss/` → 毕设系统登录页
- 半山首页顶部「进入毕业设计管理系统」→ 跳转到 `/gpss/`

## 半山学堂后台

- 地址：`http://<服务器IP>/admin/login`
- 首次登录用种子账号 `admin / 123456`（登录后建议改密）
- 数据库表与种子数据（3 个板块 + 管理员 + 示例文章）由 `banshan-app` 启动时自动初始化

## 数据持久化

本包只跑**一个 MySQL 实例**，`banshan` 与 `gpss` 两个库都放在同一数据目录：

- MySQL（两库）：`/opt/mysql`
- 半山上传：`/opt/banshan/uploads`
- 毕设上传：`/opt/gpss/uploads`

备份时打包这三个目录即可（都是 bind mount，`docker compose down` 不会删，重新部署也不丢）。

## 数据迁移（旧「双 MySQL」→ 新「单 MySQL」）

如果你之前用旧版部署包（两个 MySQL 各跑一库）已经存了数据，切换到本版单 MySQL 时，用包里的迁移脚本一键搬运：

```bash
# 前提：旧的 banshan-mysql / gpss-mysql 容器还在运行
bash migrate-data.sh
# 脚本会：导出两库 → 停旧容器 → 起新单 MySQL → 导入 → 提示你启动全部服务

# 完成后启动全部服务
docker compose up -d --build
```

手动迁移（等价步骤）：

```bash
# 1. 导出旧数据
docker exec banshan-mysql sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" banshan' > banshan.sql
docker exec gpss-mysql    sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" gpss'    > gpss.sql

# 2. 停旧部署，起新单 MySQL
docker compose down
docker stop banshan-mysql gpss-mysql   # 旧容器（新 compose 里已无此名，需手动停）
docker compose up -d mysql

# 3. 导入
docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" banshan' < banshan.sql
docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" gpss'    < gpss.sql

# 4. 起全部
docker compose up -d --build
```

> 若旧库里表名/库名与默认 `banshan`/`gpss` 不同，先在 `.env` 里把 `BANSHAN_DB_NAME`/`GPSS_DB_NAME` 改成一致再迁移。

## 常见命令

```bash
docker compose logs -f              # 实时日志
docker compose ps                   # 查看状态
docker compose restart              # 重启
docker compose down                 # 停止（不删数据卷）
docker compose up -d --build        # 更新代码后重建并启动
```

## 更新部署

1. 用新包覆盖 `banshan-academy/` 或 `gpss/` 源码
2. `docker compose up -d --build`

### GitHub Actions 自动更新半山学堂

`.github/workflows/deploy-banshan.yml` 会在 `main` 分支的半山学堂源码变更后，打包并通过仓库中的 `upgrade.sh --only banshan --build` 更新半山学堂服务。配置未完成时工作流会跳过部署并在运行摘要中列出缺项。

在 GitHub 仓库 `Settings → Secrets and variables → Actions` 中配置：

- Repository variables：`BANSHAN_DEPLOY_HOST`、`BANSHAN_DEPLOY_USER`
- Repository secrets：`BANSHAN_DEPLOY_SSH_KEY`、`BANSHAN_DEPLOY_KNOWN_HOSTS`

`BANSHAN_DEPLOY_KNOWN_HOSTS` 必须从可信运维记录取得，工作流启用严格 SSH 主机校验。配置齐全后，可推送半山学堂变更自动部署，也可在 Actions 页面手动运行 `Deploy Banshan Academy`。

## 启用 HTTPS（可选）

包内已附带 `nginx-https.conf`（HTTP 自动跳转 HTTPS + SSL）。启用步骤：

1. **申请证书**（二选一）：
   - 阿里云「SSL 证书」免费申请，下载 Nginx 格式的 `fullchain.pem` 与 `privkey.pem`
   - 或用 certbot：`certbot certonly --standalone -d yourdomain.com`
2. **放证书**：把两个 pem 放到服务器 `/opt/certs/`
3. **改 `docker-compose.yml` 的 nginx 服务**：
   ```yaml
   ports:
     - "80:80"
     - "443:443"
   volumes:
     - ./nginx-https.conf:/etc/nginx/conf.d/default.conf:ro
     - /opt/certs:/etc/nginx/certs:ro
   ```
4. **重启**：`docker compose up -d`
5. 打开安全组 443 端口，访问 `https://你的域名/` 与 `https://你的域名/gpss/`

## 已内嵌的路径改动（说明）

- GPSS 前端 `vite.config.ts` 已设 `base: '/gpss/'`，SPA 路由 / API / 静态资源 / 上传 URL 均带 `/gpss/` 前缀
- GPSS 后端通过环境变量 `PUBLIC_BASE_PATH=/gpss` 给上传文件 URL 加前缀
- Nginx `location /gpss/` 用「末尾斜杠」把 `/gpss/` 前缀剥除后再交给 gpss-app
- 半山「进入毕业设计管理系统」链接指向 `/gpss/`

## 常见问题

- **访问 `/gpss` 不带斜杠 404？** Nginx 已加 `location = /gpss` 301 到 `/gpss/`。
- **1.8G 低配服务器内存不够？** 本包已做两件优化，基本无需额外操作：
  1. **单 MySQL 实例**（`banshan` + `gpss` 两库合一），省掉一个 mysqld 进程约 250~400MB；
  2. MySQL `command:` 里内置内存调优（`performance-schema=OFF`、`innodb-buffer-pool-size=128M` 等）。
  仍不放心可再加 swap 兜底：`sudo bash setup-swap.sh 2`。
- **上传大文件（设计作品）被拦？** Nginx `client_max_body_size` 已设为 `500m`。
- **毕设图片不显示？** 确认 `gpss-app` 的 `PUBLIC_BASE_PATH=/gpss` 已生效（compose 已内置）。
- **已有旧「双 MySQL」部署的数据要迁移？** 见上文「数据迁移」章节，`bash migrate-data.sh` 一键搬运。
