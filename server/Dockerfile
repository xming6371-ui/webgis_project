# ========================================
# 后端 Dockerfile - Node.js + GDAL
# ========================================

FROM node:18-alpine

# 安装 GDAL 和必要的工具
# GDAL 用于处理地理空间数据（TIF 文件优化）
RUN apk add --no-cache \
    gdal \
    gdal-dev \
    gdal-tools \
    python3 \
    py3-numpy \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装生产依赖
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 创建数据目录（实际会通过 volume 挂载）
RUN mkdir -p ../public/data

# 暴露 8080 端口
EXPOSE 8080

# 健康检查 - Docker 会定期检查服务是否正常
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动应用
CMD ["node", "app.js"]

