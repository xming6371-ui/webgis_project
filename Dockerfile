# ========================================
# 前端 Dockerfile - 使用本地构建的 dist 目录
# ========================================
# 注意：需要先在本地执行 npm run build 生成 dist 目录

FROM nginx:alpine

# 复制本地构建好的 dist 目录
COPY dist /usr/share/nginx/html

# 复制 Nginx 配置文件
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露 80 端口
EXPOSE 80

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]

