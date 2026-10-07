#!/usr/bin/env bash
# 半山学堂 + 毕业设计管理系统 一键部署脚本（阿里云）
set -e

cd "$(dirname "$0")"

echo "=========================================="
echo " 半山学堂 + 毕业设计管理系统 部署"
echo "=========================================="

# 1. 准备环境变量
if [ ! -f .env ]; then
  echo "[1/3] 未发现 .env，从模板生成（请先编辑填入真实密码/密钥）..."
  cp .env.example .env
  echo "      请编辑当前目录下的 .env 后重新运行：bash deploy.sh"
  exit 1
fi
echo "[1/3] 环境变量 .env 已就绪"

# 2. 检查 docker / docker compose
if ! command -v docker >/dev/null 2>&1; then
  echo "错误：未安装 docker，请先安装 Docker Engine 与 Compose 插件"
  exit 1
fi

# 3. 构建并启动
echo "[2/3] 构建镜像并启动容器（首次构建较慢）..."
docker compose up -d --build

echo "[3/3] 等待服务健康..."
sleep 3
docker compose ps

echo ""
echo "=========================================="
echo " 部署完成 ✅"
echo "   半山学堂     http://<服务器IP>/"
echo "   毕业设计系统 http://<服务器IP>/gpss/"
echo "=========================================="
echo " 常用命令："
echo "   查看日志   docker compose logs -f"
echo "   停止       docker compose down"
echo "   更新代码后重新构建并重启  docker compose up -d --build"
