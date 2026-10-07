#!/usr/bin/env bash
# ============================================================
# 低配服务器：添加 swap 分区，缓解内存不足（OOM）
# 用法：sudo bash setup-swap.sh [swap大小GB，默认2]
# 说明：swap 只是兜底，治本请看 docker-compose.yml 里 MySQL 的内存调优参数
# ============================================================
set -euo pipefail

SWAP_GB="${1:-2}"
SWAP_FILE=/swapfile

if swapon --show | grep -q "$SWAP_FILE"; then
  echo "✅ swap 已启用，跳过："
  swapon --show
  exit 0
fi

echo "==> 创建 ${SWAP_GB}GB swap 文件 ${SWAP_FILE} ..."
if command -v fallocate >/dev/null 2>&1; then
  fallocate -l "${SWAP_GB}G" "$SWAP_FILE" || dd if=/dev/zero of="$SWAP_FILE" bs=1M count=$((SWAP_GB * 1024))
else
  dd if=/dev/zero of="$SWAP_FILE" bs=1M count=$((SWAP_GB * 1024))
fi

chmod 600 "$SWAP_FILE"
mkswap "$SWAP_FILE"
swapon "$SWAP_FILE"

# 开机自动挂载
if ! grep -q "^${SWAP_FILE} " /etc/fstab; then
  echo "${SWAP_FILE} none swap sw 0 0" >> /etc/fstab
fi

# 降低 swappiness（避免频繁换页拖慢系统）
if ! grep -q "vm.swappiness" /etc/sysctl.conf; then
  echo "vm.swappiness=10" >> /etc/sysctl.conf
fi
sysctl -p >/dev/null 2>&1 || true

echo "==> 完成，当前内存与 swap："
free -h
