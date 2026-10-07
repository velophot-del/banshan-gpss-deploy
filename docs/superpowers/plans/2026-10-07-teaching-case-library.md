# 半山学堂教学案例库实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 按已确认规格在半山学堂建立独立的研究生教学案例模块，提供案例录入、授权分级、教师手册、筛选与使用登记。

**Architecture:** 案例数据独立于现有文章系统，采用案例主记录、不可覆盖版本、课程/标签、附件、评审与使用登记表。沿用现有 JWT/账号体系并增加教师角色；公开内容只从已审核且授权公开的版本读取，受限文件独立存储并经权限校验后下载。

**Tech Stack:** Vue 3、Vue Router、TypeScript、Express、MySQL 8、现有 Element Plus 与 Markdown 编辑器；不新增依赖。

**Spec:** `docs/superpowers/specs/2026-10-07-teaching-case-library-design.md`

## Global Constraints

- 不修改知识库 `10_原始资料/` 原件；不自动导入未核实的文章、研究稿、作业或模板。
- 保留 `/section/method`、现有 `/article/:id` 和全部既有文章数据。
- 案例正式发布必须满足审核与授权准入；未授权/仅校内/仅课堂材料不能从公开接口或公开静态目录读取。
- 数据库迁移只增不删且可重复执行；保留现有管理员凭据，不重置密码。
- 不安装依赖，不部署生产，不在实际案例内容缺失时编造案例。
- 复用现有依赖；完成后执行 client/server build 和匹配的本地烟雾核验。

## Review Focus

- 待审、未授权、受限案例及未获展示授权的单件学生作品不能经列表、搜索、直接详情、关联案例或附件地址泄露。
- teacher 角色不能写入案例、评审或教师账号；未认证用户不能读手册和私有附件。
- 并发申请编号时不得生成重复 case code。
- 初始化和重复启动不得重置现有管理员密码或改写既有文章。
- 发布新版本不得覆盖旧正文、手册、附件引用或历史使用登记。

## File Map

- Modify `banshan-academy/server/src/scripts/initDb.ts`：新增案例表与管理员角色列的幂等建表/迁移。
- Modify `banshan-academy/server/src/scripts/seed.ts`：只在默认管理员不存在时创建，不更新已有密码。
- Modify `banshan-academy/server/src/middleware/auth.ts`、`server/src/routes/auth.ts`：JWT 携带角色并提供角色守卫/教师账号管理。
- Create `banshan-academy/server/src/routes/cases.ts`、`adminCases.ts`、`teacherCases.ts`：公开检索、管理、作品授权、手册与使用登记 API。
- Modify `banshan-academy/server/src/index.ts`：注册路由、配置受保护文件目录，不通过静态服务暴露私有文件。
- Modify `docker-compose.yml` 与半山服务配置：挂载独立、持久化的案例私有文件目录。
- Modify `banshan-academy/client/src/types/index.ts`、`api/index.ts`：案例、版本、标签、附件、评审、使用记录接口类型与请求。
- Create `banshan-academy/client/src/views/public/CaseLibrary.vue`、`CaseDetail.vue`、`CaseTeacherGuide.vue`：课程—年级—课题目录、案例/作品详情、教师区。
- Create `banshan-academy/client/src/views/admin/CaseList.vue`、`CaseEdit.vue`、`TeacherAccounts.vue`：案例元数据/版本/发布审核与教师账号维护。
- Create `banshan-academy/client/src/views/admin/CaseUseRecords.vue`：课堂使用记录管理与概览。
- Create `banshan-academy/client/src/views/teacher/TeacherLogin.vue`、`UsageRecord.vue` (or equivalent focused views): 教师登录和使用登记。
- Modify `client/src/router/index.ts`、`SiteHeader.vue`、`SiteFooter.vue`、`Home.vue`：导航及受保护路由/首页案例入口。
- Modify `banshan-academy/README.md`、root `README.md`：案例库管理说明、角色与私有存储配置。

---

### Task 1: 案例数据结构与安全迁移

**Files:**
- Modify: `banshan-academy/server/src/scripts/initDb.ts`
- Modify: `banshan-academy/server/src/scripts/seed.ts`
- Modify: `banshan-academy/deployment/entrypoint.sh`
- Modify: `docker-compose.yml`

**Produces:** 可重复的案例表/角色列迁移；案例主记录、版本、课程/年级/课题关联、分类标签、逐项作业作品、作品展示授权、附件、匿名评审、课堂使用记录；独立持久私有文件目录。正式数据约束为：正式发布引用一个已审核的当前版本；版本记录、评审和使用登记不可被普通编辑覆盖。

- [ ] 增加幂等迁移，现存 `admins.role` 默认 `admin`，不修改用户名/密码；表包含模板要求的元数据、课程/模块/年级/课题/对象、五维分类、案例内容、逐项作业（作品标题、媒介、过程附件、作者自述、展示授权）、审核、版本、附件、关联案例、使用记录和复审字段。
- [ ] 建立 case code 序列表/事务分配逻辑，使用规范专业代码和年度流水号，并由唯一索引兜底。
- [ ] 将 `seed.ts` 的管理员 upsert 改为不改已有 password_hash；保留首次空库创建默认管理员的行为。
- [ ] 在 compose 中挂载独立案例私有目录，服务器公开静态服务仍仅覆盖公开上传文件。
- [ ] 执行 server build；检查迁移可重复逻辑、外键/索引与既有 `articles` 查询兼容。

### Task 2: 认证角色、案例 API 与发布准入

**Files:**
- Modify: `banshan-academy/server/src/middleware/auth.ts`
- Modify: `banshan-academy/server/src/routes/auth.ts`
- Create: `banshan-academy/server/src/routes/cases.ts`
- Create: `banshan-academy/server/src/routes/adminCases.ts`
- Create: `banshan-academy/server/src/routes/teacherCases.ts`
- Modify: `banshan-academy/server/src/index.ts`

**Consumes:** Task 1 tables, private directory, and admin/teacher roles.

**Produces:** Public `GET /api/cases` supports course/year/topic and method/theme filters, search, pagination, separately flagged editorial picks and latest updates; `GET /api/cases/:caseCode` returns only a publishable public version and its individually authorized works; admin endpoints manage draft/version/review/authorization/assets/teachers; teacher endpoints retrieve authorized manuals, download protected files, and create usage records.

- [ ] Add role to JWT and request user; require `admin` for management APIs and `teacher|admin` for restricted materials and usage records.
- [ ] Add server-side publish validation for required fields, two positive anonymous reviews, permission state, text length, abstracts/keywords, required teaching guide, and recorded similarity result/exception.
- [ ] Implement list/search/detail filters and related-case resolution with case-level and per-work public-authorization predicates applied in every query path.
- [ ] Implement private download handler that resolves only stored attachment IDs and checks role/access; reject filesystem path input and prevent traversal.
- [ ] Implement immutable version publication, admin teacher account create/disable, and teacher-owned usage record create/list endpoints.
- [ ] Execute server build; run a non-destructive API smoke check against an isolated database or controlled local fixture, including anonymous/teacher/admin access paths.

### Task 3: 后台案例与教师资料管理

**Files:**
- Create: `banshan-academy/client/src/views/admin/CaseList.vue`
- Create: `banshan-academy/client/src/views/admin/CaseEdit.vue`
- Create: `banshan-academy/client/src/views/admin/TeacherAccounts.vue`
- Create: `banshan-academy/client/src/views/admin/CaseUseRecords.vue`
- Modify: `banshan-academy/client/src/views/admin/AdminLayout.vue`
- Modify: `banshan-academy/client/src/api/index.ts`
- Modify: `banshan-academy/client/src/types/index.ts`

**Consumes:** Task 2 admin API and case schemas.

**Produces:** Admin can create cases, edit drafts as new versions, attach course/year/topic/tags, add work-level author/process/media/display-rights records, add public and restricted assets, record author/rights/review metadata, manage publication and teacher accounts, and record/review case use.

- [ ] Add typed API functions and types matching server response shapes.
- [ ] Add case list with status, authorization, review, review-due, and keyword filters.
- [ ] Add case editor with sections matching the case and teaching-guide templates; surface blocked publication requirements before submit.
- [ ] Add review/authorization/version controls and teacher account create/disable UI; do not show credentials in logs or teacher tables after creation.
- [ ] Add usage-record administration view with the workbook’s fields and summary counts.
- [ ] Execute client build; inspect required/optional fields, validation messages, and empty/error/loading states.

### Task 4: 公开案例库与教师访问体验

**Files:**
- Create: `banshan-academy/client/src/views/public/CaseLibrary.vue`
- Create: `banshan-academy/client/src/views/public/CaseDetail.vue`
- Create: `banshan-academy/client/src/views/public/CaseTeacherGuide.vue`
- Create: `banshan-academy/client/src/views/teacher/TeacherLogin.vue`
- Create: `banshan-academy/client/src/views/teacher/UsageRecord.vue`
- Modify: `banshan-academy/client/src/router/index.ts`
- Modify: `banshan-academy/client/src/components/SiteHeader.vue`
- Modify: `banshan-academy/client/src/components/SiteFooter.vue`
- Modify: `banshan-academy/client/src/views/public/Home.vue`

**Consumes:** Task 2 public/teacher APIs and Task 3 types.

**Produces:** `/section/method` is the dedicated case-library discovery/search page, `/cases/:caseCode` is the detail, and teacher-only functions are behind route guards backed by server authorization.

- [ ] Add directory intro, editor-picked cases clearly distinguished from the complete list, course → year → topic browsing, method/theme tags, latest updates with dates, usage/rights notes, keyword search, pagination, and clear empty/no-result/error states.
- [ ] Add case details with basic metadata, introduction, assignment/problem, expandable work items, authorized process/media/author statements, analysis/teaching takeaways, source/credit/copyright/citation, and related cases.
- [ ] Add teacher login, protected teaching goals/preparation, lesson flow, discussion/activity, assessment guidance, manual download, authorized attachments, and usage-record form.
- [ ] Keep `/article/:id` routes intact and avoid presenting existing method articles as formal cases; case directory only queries dedicated case records.
- [ ] Add route guards for UI behavior while keeping API checks authoritative; ensure logout removes role/session data.
- [ ] Execute client build and browser smoke walkthrough for public, teacher, and admin paths; inspect desktop/mobile page states.

### Task 5: Deployment documentation and whole-system verification

**Files:**
- Modify: `banshan-academy/README.md`
- Modify: `README.md`

- [ ] Document initial database startup, additive schema migration, teacher account creation, private asset mount, publication checks, and no-seed-password-reset behavior.
- [ ] Run `npm run build` in both `banshan-academy/server` and `banshan-academy/client`.
- [ ] Verify existing articles/categories and admin authentication remain usable; verify case pages and APIs enforce public/teacher/admin boundaries, private file protection, version retention, review gate, usage registration, and idempotent migration.
- [ ] Report any live-DB or deployment verification not performed; do not run production deployment or destructive scripts.

---

## Plan Self-Review

- **Spec coverage:** directory discovery/featured/course-year-topic/tag/latest/usage boundary, structured case details and individual works, teacher guide/workflow/assessment, roles, private assets, anonymous review record, immutable versions, use register, two-year review reminder, case-code assignment, legacy article retention, safe migration, and empty/error states each map to a task.
- **Compatibility:** existing article routes and rows remain intact; current admin accounts remain admin and keep their password hashes; seed no longer resets credentials on restart.
- **Access control:** public, teacher, and admin boundaries are enforced on the server; client guards are usability only.
- **Scope limit:** no case-content import, student portal, independent reviewer portal, external plagiarism integration, dependency installation, or production deployment.
- **Verification:** repository has build scripts but no established test script; use existing build commands and non-destructive API/browser smoke checks, with an isolated fixture where available.
