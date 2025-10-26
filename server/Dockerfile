# ========================================
# 后端 Dockerfile - Node.js + GDAL
# ========================================

FROM ubuntu:24.04

# 设置非交互式安装和生产环境
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production

# 安装 Node.js 和编译依赖
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    software-properties-common \
    gnupg \
    wget \
    build-essential \
    cmake \
    pkg-config \
    libproj-dev \
    libsqlite3-dev \
    sqlite3 \
    libcurl4-openssl-dev \
    libtiff-dev \
    libgeotiff-dev \
    libpng-dev \
    libjpeg-dev \
    libgif-dev \
    libwebp-dev \
    libexpat1-dev \
    libxerces-c-dev \
    libxml2-dev \
    libzstd-dev \
    liblzma-dev \
    zlib1g-dev \
    python3-dev \
    python3-numpy \
    swig \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 下载并编译 GDAL 3.11.4
RUN echo "=== Downloading GDAL 3.11.4 ===" \
    && cd /tmp \
    && wget --progress=dot:giga https://github.com/OSGeo/gdal/archive/refs/tags/v3.11.4.tar.gz \
    && echo "=== Extracting archive ===" \
    && tar -xzf v3.11.4.tar.gz \
    && cd gdal-3.11.4 \
    && echo "=== Configuring with CMake ===" \
    && mkdir build \
    && cd build \
    && cmake .. \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_INSTALL_PREFIX=/usr/local \
        -DBUILD_PYTHON_BINDINGS=OFF \
        -DBUILD_APPS=ON \
        -DBUILD_TESTING=OFF \
        -DGDAL_USE_GEOTIFF=ON \
        -DGDAL_USE_JPEG=ON \
        -DGDAL_USE_PNG=ON \
        -DGDAL_USE_ZLIB=ON \
    && echo "=== Compiling (this will take 15-30 minutes) ===" \
    && make -j$(nproc) \
    && echo "=== Installing ===" \
    && make install \
    && ldconfig \
    && echo "=== Verifying installation ===" \
    && /usr/local/bin/gdalinfo --version \
    && echo "=== Cleaning up ===" \
    && cd / \
    && rm -rf /tmp/v3.11.4.tar.gz /tmp/gdal-3.11.4

# 设置环境变量
ENV PATH="/usr/local/bin:${PATH}"
ENV LD_LIBRARY_PATH="/usr/local/lib:${LD_LIBRARY_PATH}"

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

