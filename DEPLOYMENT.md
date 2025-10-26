# 🚀 WebGIS 项目部署说明

本项目支持 Docker 容器化部署，简化部署流程。

---

## 📚 部署文档

根据您的技术水平，选择适合的文档：

### 🆕 零基础用户（推荐）
**文档**：[Docker部署完全指南-零基础版](./docs/Docker部署完全指南-零基础版.md)

**包含内容**：
- ✅ 如何购买服务器和域名
- ✅ 如何连接到服务器
- ✅ Docker 是什么、如何安装
- ✅ 一步步的详细操作指南
- ✅ 配置 HTTPS 的完整流程
- ✅ 常见问题解决方案

**适合人群**：
- 从未部署过项目的新手
- 不了解 Linux 和 Docker
- 需要手把手教学

---

### 🚀 有经验用户
**文档**：[快速部署参考卡](./docs/快速部署参考卡.md)

**包含内容**：
- ✅ 快速命令参考
- ✅ 核心配置说明
- ✅ 常用命令速查
- ✅ 故障排查表

**适合人群**：
- 熟悉 Linux 基本操作
- 了解 Docker 基础
- 需要快速参考

---

## ⚡ 快速开始

如果您已经很熟悉 Docker，可以直接执行：

```bash
# 1. 克隆项目
git clone <your-repo-url>
cd webgis_project

# 2. 启动服务
docker compose up -d --build

# 3. 访问
http://服务器IP
```

**端口说明**：
- 前端：80 端口（HTTP）
- 后端：8080 端口
- HTTPS：443 端口（需配置SSL）

---

## 📁 Docker 文件说明

| 文件 | 用途 |
|------|------|
| `Dockerfile` | 前端（Vue + Nginx）镜像构建 |
| `server/Dockerfile` | 后端（Node.js + GDAL）镜像构建 |
| `docker-compose.yml` | 服务编排配置 |
| `nginx.conf` | Nginx 服务器配置 |
| `.dockerignore` | Docker 构建忽略文件 |

---

## 🏗️ 架构说明

```
┌─────────────────────────────────────┐
│         Nginx (前端容器)             │
│   - 静态文件托管 (Vue.js)            │
│   - API 代理转发                     │
│   - SSL 证书管理                     │
└─────────────┬───────────────────────┘
              │ /api/* 请求
              ↓
┌─────────────────────────────────────┐
│     Express (后端容器)               │
│   - RESTful API                     │
│   - 文件上传处理                     │
│   - GDAL 影像处理                   │
└─────────────┬───────────────────────┘
              │
              ↓
┌─────────────────────────────────────┐
│     持久化数据卷                     │
│   - public/data/ (影像文件)         │
│   - imageData.json (元数据)         │
└─────────────────────────────────────┘
```

---

## 🔧 配置说明

### 环境变量
在 `docker-compose.yml` 中可配置：
- `NODE_ENV`: 环境模式（production/development）
- `PORT`: 后端端口（默认 8080）

### 数据持久化
数据目录 `public/data/` 通过 volume 挂载，确保数据不会因容器重启而丢失。

### 资源限制
如需限制容器资源使用，在 `docker-compose.yml` 中添加：
```yaml
deploy:
  resources:
    limits:
      cpus: '1'
      memory: 2G
```

---

## 🛠️ 常用操作

```bash
# 启动服务
docker compose up -d

# 停止服务
docker compose down

# 查看日志
docker compose logs -f

# 重启服务
docker compose restart

# 更新代码后重新部署
git pull
docker compose up -d --build

# 备份数据
tar -czf backup.tar.gz public/data/
```

---

## 📞 获取帮助

- **详细教程**：查看 [docs/Docker部署完全指南-零基础版.md](./docs/Docker部署完全指南-零基础版.md)
- **快速参考**：查看 [docs/快速部署参考卡.md](./docs/快速部署参考卡.md)
- **项目文档**：查看 [docs/](./docs/) 目录下的其他文档

---

## ⚠️ 注意事项

1. **首次构建**：首次执行 `docker compose up` 会下载基础镜像和安装依赖，可能需要 10-20 分钟
2. **数据备份**：定期备份 `public/data/` 目录
3. **端口冲突**：确保 80 和 8080 端口未被占用
4. **防火墙**：确保服务器防火墙和云服务商安全组已开放相应端口
5. **GDAL 依赖**：后端镜像已包含 GDAL，无需额外安装

---

## 🎯 下一步

部署成功后，您可能需要：

1. ✅ 配置域名（参考完整指南第七步）
2. ✅ 配置 HTTPS（参考完整指南第八步）
3. ✅ 设置定期备份
4. ✅ 监控服务器资源使用

---

**祝您部署顺利！** 🎉

