#!/bin/bash
# 半山学堂 · 本地一键启动（生产式：后端托管前端构建产物）
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> 1/4 初始化数据库（建库建表 + 种子数据）"
cd "$ROOT/server"
npm run db:init
npm run db:seed

echo "==> 2/4 构建前端"
cd "$ROOT/client"
npm run build

echo "==> 3/4 构建后端"
cd "$ROOT/server"
npm run build

echo "==> 4/4 启动服务（http://127.0.0.1:3012）"
NODE_ENV=production node dist/index.js
