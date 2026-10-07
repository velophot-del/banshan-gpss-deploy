-- ============================================================
-- 单 MySQL 双库初始化（首次初始化、数据目录为空时由 mysql 镜像自动执行）
--
-- 说明：
--   · 镜像已通过 MYSQL_USER=app / MYSQL_DATABASE=gpss 创建 app 用户并授权 gpss 库
--   · 这里补建 banshan 库并授权 app
--   · 两库在本脚本执行后都已存在，因此两个应用启动时各自跑的
--     `CREATE DATABASE IF NOT EXISTS ...` 走的是「库已存在」的幂等 no-op 分支，
--     无需全局 CREATE 权限
-- ============================================================

CREATE DATABASE IF NOT EXISTS banshan
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON banshan.* TO 'app'@'%';

FLUSH PRIVILEGES;
