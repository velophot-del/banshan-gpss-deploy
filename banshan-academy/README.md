# 半山学堂 · Banshan Academy

个人内容网站 —— 发布设计艺术信息、分享设计表现方法教学案例、追踪设计前沿研究，并提供进入「毕业设计管理系统」的入口。

界面参考 [NDC 日本设计中心](https://www.ndc.co.jp/) 的日式编辑极简风格：白底、近黑文字、大量留白、图片优先的网格卡片、中英双语标题节奏。

## 板块

| slug | 名称 | 英文眉题 |
|------|------|----------|
| `info` | 设计艺术信息 | Design Art News |
| `method` | 视觉表现方法教学案例库（旧文章入口重定向） | Legacy article entry redirects to the case library |
| `frontier` | 设计前沿研究 | Frontiers in Design |

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + Vite + TypeScript（前台手写样式，后台 Element Plus） |
| 富文本 | 内容存 Markdown（后台 `md-editor-v3`，前台 `markdown-it` 渲染） |
| 后端 | Express + TypeScript |
| 数据库 | MySQL 8.0（库 `banshan`） |
| 认证 | JWT + bcryptjs |

## 目录结构

```
banshan-academy/
├── client/          # 前端 (Vue 3 + Vite)
│   └── src/
│       ├── views/public/   # 前台：首页/板块列表/文章详情/关于
│       ├── views/admin/    # CMS 后台：登录/列表/编辑
│       ├── components/     # 页头/页脚/文章卡片/Markdown 渲染
│       └── styles/         # 设计 token 与全局样式
├── server/          # 后端 (Express + MySQL)
│   └── src/
│       ├── routes/         # 分类/文章/后台CRUD/上传/登录
│       └── scripts/        # initDb / seed
└── deployment/      # Docker + Nginx（阿里云部署）
```

## 研究生教学案例库

- 前台入口：`/cases`；旧地址 `/section/method` 自动转到案例库。详情页地址为 `/cases/:caseCode`。
- 案例数据使用独立版本化表，不混入普通文章；案例库模板包为空表，不会自动导入或编造案例。
- 后台：`/admin/cases` 管理草稿、同行评审记录和发布；`/admin/teachers` 创建/停用教师账号。
- 教师登录：`/teacher/login`；教师入口 `/teacher/cases` 可检索公开、校内和课堂授权案例，并查看已授权的教学指导手册、登记课堂使用。
- 发布需通过正文/摘要/关键词/查重、授权、教学手册和两名同行评审等规则校验。每件学生作品按单独授权标记过滤。
- 案例附件保存在独立私有目录，不挂载到 `/uploads` 公共静态路径。部署使用 `CASE_PRIVATE_DIR`（默认容器路径 `/data/case-private`，宿主机卷 `/opt/banshan/case-private`）。
- 首次启动或升级时，部署入口会运行幂等 `db:init` 创建新增表和账号角色列；本次没有连接或修改数据库，也没有发布内容。
- 更新镜像前建议备份数据库，并确认 `/opt/banshan/case-private` 持久化卷可写。

## 本地开发

前置：Node.js ≥ 18、MySQL 8+（本地运行）。

### 1. 安装依赖

```bash
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### 2. 配置数据库

编辑 `server/.env`（本地默认使用 socket + root 空密码，按需修改）：

```env
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=
DB_NAME=banshan
USE_SOCKET=true
```

### 3. 初始化数据库

```bash
cd server
npm run db:init   # 建库建表
npm run db:seed   # 板块 + 管理员 + 示例文章
cd ..
```

### 4. 启动（开发模式）

终端 1 - 后端（`http://127.0.0.1:3012`）：

```bash
cd server && npm run dev
```

终端 2 - 前端（`http://127.0.0.1:5174`，自动代理 /api 与 /uploads）：

```bash
cd client && npm run dev
```

### 一键本地预览（生产式）

```bash
./start.sh
# 访问 http://127.0.0.1:3012
```

## 后台管理

- 入口：`/admin/login`（前台页脚也有「管理入口」链接）
- 初始账号：`admin / 123456`（登录后可在后台发布/编辑/下架文章）

## 部署

阿里云部署见 [deployment/README_DEPLOY.md](deployment/README_DEPLOY.md)（Docker + Nginx，与 GPSS 同机独立运行）。

## API 概览

公开接口：
- `GET /api/settings` — 站点配置（含进入毕设系统链接）
- `GET /api/categories` — 板块列表
- `GET /api/articles` — 文章列表（`?category=slug&page=&pageSize=`）
- `GET /api/articles/featured` — 首页精选
- `GET /api/articles/:id` — 文章详情

后台接口（JWT）：
- `POST /api/admin/auth/login`、`GET /api/admin/auth/me`
- `GET/POST/PUT/DELETE /api/admin/articles`（含 `GET /:id`）
- `POST /api/admin/upload/image` — 图片上传
