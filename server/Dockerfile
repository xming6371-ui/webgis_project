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
    python3-pip \
    python3-setuptools \
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

# 安装 Python 库（geopandas 及其依赖）
# 注意：GDAL 库（C/C++）已经在上面编译安装，这里需要安装 GDAL Python 绑定
# 注意：Ubuntu 24.04 需要 --break-system-packages 参数来安装系统级包
# 配置 pip 使用国内镜像源（解决网络超时问题）
# 注意：不升级 pip，因为 Ubuntu 24.04 的 pip 是系统包，无法卸载
RUN echo "=== 安装 Python 依赖库 ===" \
    && pip3 config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple \
    && pip3 config set global.timeout 300 \
    && echo "步骤 1: 安装 GDAL Python 绑定（使用系统已编译的 GDAL 3.11.4）..." \
    && pip3 install --no-cache-dir --break-system-packages --timeout=300 gdal \
    && python3 -c "from osgeo import gdal; print(f'✅ GDAL Python 绑定已安装: {gdal.__version__}')" \
    && echo "步骤 2: 安装 GeoPandas..." \
    && pip3 install --no-cache-dir --break-system-packages --timeout=300 geopandas \
    && python3 -c "import geopandas; from osgeo import gdal; print(f'✅ GeoPandas 安装成功，使用 GDAL {gdal.__version__}')" \
    && echo "=== Python 库安装完成 ==="

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

