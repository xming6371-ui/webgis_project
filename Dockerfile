# ========================================
# 前端 Dockerfile - 多阶段构建
# ========================================
# 阶段1: 构建前端代码
FROM node:18-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建前端
RUN npm run build

# ========================================
# 阶段2: 使用 Nginx 运行
# ========================================
FROM nginx:alpine

# 从构建阶段复制 dist 目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置文件
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露 80 端口
EXPOSE 80

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]

