#!/bin/sh
set -e

echo "初始化数据库（建库建表）..."
node dist/scripts/initDb.js

echo "写入种子数据（幂等）..."
node dist/scripts/seed.js

echo "启动半山学堂服务..."
exec node dist/index.js
