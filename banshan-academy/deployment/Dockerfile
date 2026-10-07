# ===== 构建前端 =====
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ===== 构建后端 =====
FROM node:20-alpine AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# ===== 运行 =====
FROM node:20-alpine
WORKDIR /app/server
ENV NODE_ENV=production

COPY --from=server-build /app/server/node_modules ./node_modules
COPY --from=server-build /app/server/dist ./dist
COPY --from=server-build /app/server/package.json ./package.json
COPY --from=client-build /app/client/dist ../client/dist

COPY deployment/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3012
ENTRYPOINT ["/entrypoint.sh"]
