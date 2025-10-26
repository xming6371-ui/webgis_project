# WebGIS 项目部署指南（GitHub 一键部署）

## 🚀 快速部署

### 前提条件
1. 本地已安装 Node.js 和 Git
2. 已将项目推送到 GitHub 仓库
3. 服务器已配置 SSH 免密登录（或准备好输入密码）

### 一键部署步骤

只需运行：
```bash
deploy-github.bat
```

脚本会自动完成以下操作：
1. ✅ 在本地构建前端（`npm run build`）
2. ✅ 推送代码到 GitHub
3. ✅ 服务器从 GitHub 拉取最新代码
4. ✅ 上传本地构建的 `dist` 目录到服务器
5. ✅ 重新构建 Docker 镜像
6. ✅ 重启服务

---

## 📋 首次部署（服务器初始化）

### 1. 服务器环境准备

#### 1.1 连接服务器
```bash
ssh root@120.26.239.62
```

#### 1.2 安装 Docker
```bash
# 添加 Docker GPG 密钥
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# 添加 Docker 仓库
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu noble stable" | tee /etc/apt/sources.list.d/docker.list

# 安装 Docker
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 启动 Docker
systemctl start docker
systemctl enable docker
```

#### 1.3 配置 Docker 镜像加速（可选但推荐）
```bash
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'EOF'
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://docker.m.daocloud.io",
    "https://dockerproxy.com",
    "https://docker.mirrors.sjtug.sjtu.edu.cn"
  ]
}
EOF

systemctl daemon-reload
systemctl restart docker
```

### 2. 克隆项目到服务器

```bash
cd /root
git clone https://github.com/15859905267/webgis_project.git
cd webgis_project
```

### 3. 首次部署

在本地运行：
```bash
deploy-github.bat
```

---

## 🔄 日常更新部署

修改代码后，只需运行：
```bash
deploy-github.bat
```

脚本会自动：
- 构建最新的前端
- 推送代码到 GitHub
- 服务器拉取更新
- 重新构建并重启服务

---

## 📊 服务管理

### 查看服务状态
```bash
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose ps"
```

### 查看后端日志
```bash
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose logs -f backend"
```

### 查看前端日志
```bash
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose logs -f frontend"
```

### 重启服务
```bash
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose restart"
```

### 停止服务
```bash
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose down"
```

### 启动服务
```bash
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose up -d"
```

---

## 🌐 访问地址

- **前端**: http://120.26.239.62
- **后端 API**: http://120.26.239.62/api/health
- **影像管理**: http://120.26.239.62/image
- **监控主控台**: http://120.26.239.62/dashboard

---

## 🛠️ 技术栈

- **前端**: Vue 3 + Vite + OpenLayers + Element Plus
- **后端**: Node.js + Express
- **数据处理**: GDAL 3.11.3
- **容器化**: Docker + Docker Compose
- **Web服务器**: Nginx

---

## ⚠️ 常见问题

### 1. dist 目录为什么不提交到 GitHub？
`dist` 是构建产物，体积大且频繁变化，不适合提交到 Git。我们在本地构建后通过 SCP 直接上传到服务器。

### 2. 为什么要在本地构建而不是在服务器构建？
- 服务器资源有限（内存/CPU）
- 本地构建速度更快
- 减少服务器依赖

### 3. Git push 失败怎么办？
脚本会继续执行部署，但建议手动检查代码是否正确推送到 GitHub。

### 4. 如何配置 SSH 免密登录？
```bash
# 本地生成 SSH 密钥（如果还没有）
ssh-keygen -t rsa

# 复制公钥到服务器
ssh-copy-id root@120.26.239.62
```

---

## 📝 项目结构

```
webgis_project/
├── src/                    # 前端源码
├── server/                 # 后端源码
│   ├── app.js             # 后端入口
│   ├── config.js          # 后端配置
│   ├── routes/            # API 路由
│   └── Dockerfile         # 后端 Docker 配置
├── public/                # 静态资源
│   └── data/              # 数据目录（由 Docker 挂载）
├── docker-compose.yml     # Docker Compose 配置
├── Dockerfile             # 前端 Docker 配置
├── nginx.conf             # Nginx 配置
├── deploy-github.bat      # 一键部署脚本
└── DEPLOY.md              # 部署文档（本文件）
```

---

## 📞 技术支持

如遇问题，请检查：
1. 服务器 Docker 是否正常运行
2. 后端日志是否有错误信息
3. 防火墙是否开放 80 和 8080 端口
4. 网络连接是否正常


