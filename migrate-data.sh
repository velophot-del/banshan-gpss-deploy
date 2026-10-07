#!/usr/bin/env bash
# ============================================================
# 数据迁移：从旧的「双 MySQL」部署迁移到新的「单 MySQL」部署
# 前提：旧的 banshan-mysql / gpss-mysql 容器仍在运行（旧部署未删除）
# 用法：bash migrate-data.sh
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

# 读取 .env（提供库名、root 密码等）
if [ ! -f .env ]; then
  echo "❌ 未找到 .env，请先 cp .env.example .env 并填写"
  exit 1
fi
set -a; source .env; set +a

BANSHAN_DB="${BANSHAN_DB_NAME:-banshan}"
GPSS_DB="${GPSS_DB_NAME:-gpss}"
BACKUP_DIR="./backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "=========================================="
echo " 数据迁移：双 MySQL → 单 MySQL"
echo "=========================================="

# 1. 从旧容器导出
echo "[1/4] 从旧容器导出数据..."
HAS_OLD=0
if docker ps --format '{{.Names}}' | grep -q '^banshan-mysql$'; then
  echo "      导出 banshan 库 ..."
  docker exec banshan-mysql sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers "'"$BANSHAN_DB"'"' > "$BACKUP_DIR/banshan.sql"
  echo "      ✅ $BACKUP_DIR/banshan.sql"
  HAS_OLD=1
else
  echo "      ⚠️  未发现运行中的 banshan-mysql 容器，跳过"
fi

if docker ps --format '{{.Names}}' | grep -q '^gpss-mysql$'; then
  echo "      导出 gpss 库 ..."
  docker exec gpss-mysql sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers "'"$GPSS_DB"'"' > "$BACKUP_DIR/gpss.sql"
  echo "      ✅ $BACKUP_DIR/gpss.sql"
  HAS_OLD=1
else
  echo "      ⚠️  未发现运行中的 gpss-mysql 容器，跳过"
fi

if [ "$HAS_OLD" = "0" ]; then
  echo "      没有可迁移的旧数据（旧容器都不在），退出。"
  exit 0
fi

# 2. 停掉旧部署（旧 compose 的容器；旧 mysql 容器名不在新 compose 里，会被保留）
echo "[2/4] 停掉旧部署 ..."
docker compose down 2>/dev/null || true
docker stop banshan-mysql gpss-mysql 2>/dev/null || true

# 3. 起新的单 MySQL
echo "[3/4] 启动新的单 MySQL ..."
docker compose up -d mysql
echo "      等待 MySQL 就绪 ..."
sleep 20

# 4. 导入
echo "[4/4] 导入数据到单 MySQL ..."
if [ -s "$BACKUP_DIR/banshan.sql" ]; then
  docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "'"$BANSHAN_DB"'"' < "$BACKUP_DIR/banshan.sql"
  echo "      ✅ banshan 导入完成"
fi
if [ -s "$BACKUP_DIR/gpss.sql" ]; then
  docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "'"$GPSS_DB"'"' < "$BACKUP_DIR/gpss.sql"
  echo "      ✅ gpss 导入完成"
fi

echo ""
echo "=========================================="
echo " 启动全部服务：docker compose up -d --build"
echo " 备份文件保留在：$BACKUP_DIR/"
echo "=========================================="
