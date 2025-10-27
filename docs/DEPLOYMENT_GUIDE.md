# 🚀 代码更新部署指南

本文档提供两种代码更新方式：**Git方式**（推荐）和**SCP直接上传**（快速测试）

---

## 📦 方式一：Git 方式（推荐用于正式部署）

### 优点
- ✅ 有版本控制，可以回退
- ✅ 团队协作方便
- ✅ 代码历史可追溯

### 部署步骤

#### 1. 本地提交代码到 Git

```powershell
# 1.1 查看修改的文件
git status

# 1.2 添加修改的文件到暂存区
git add .

# 1.3 提交到本地仓库
git commit -m "修复：优化TIF文件分析内存溢出问题"

# 1.4 推送到远程仓库（GitHub/Gitee）
git push origin ym
```

#### 2. 服务器拉取最新代码

```powershell
# 2.1 SSH 连接到服务器
ssh root@120.26.239.62

# 2.2 进入项目目录
cd /root/webgis_project

# 2.3 拉取最新代码
git pull origin ym

# 2.4 重新构建并启动服务
docker compose down
# ===== 情况A：只修改了代码（最常见） =====
docker compose restart  # 只重启，不重新构建（秒级完成）

# ===== 情况B：修改了代码和配置文件 =====
docker compose up -d --build  # 使用缓存构建（几十秒完成）

# ===== 情况C：修改了依赖或Dockerfile =====
docker compose build --no-cache  # 完全重新构建（几分钟）
# 接下来
docker compose up -d

# 2.5 查看日志确认启动成功
docker compose logs -f backend
```

#### 3. 验证部署

访问 `http://120.26.239.62` 测试功能是否正常。

---
<!-- 如果又遇到冲突 就用下面这个方法 -->
# ===== 第1步：清除本地修改 =====
cd /root/webgis_project

# 放弃所有本地修改
git reset --hard HEAD

# 删除未跟踪的文件(这个有可能会删除data)
git clean -fd

# ===== 第2步：拉取最新代码 =====
git pull origin main

# ===== 第3步：重新构建并启动服务 =====
# 停止旧服务
docker compose down

# 重新构建（不使用缓存）
docker compose build --no-cache

# 启动服务 后台运行（不占用终端）
docker compose up -d

# ===== 第4步：验证部署 =====
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs backend --tail 50

# 访问网站测试
# http://120.26.239.62

## ⚡ 方式二：SCP 直接上传（快速测试）

### 优点
- ✅ 快速，适合紧急修复
- ✅ 可以先测试再提交Git

### 缺点
- ❌ 没有版本控制
- ❌ 服务器上的修改可能被 `git pull` 覆盖

### 部署步骤

#### 1. 上传单个文件

```powershell
# 上传后端文件
scp server/routes/image.js root@120.26.239.62:/root/webgis_project/server/routes/

# 上传配置文件
scp nginx.conf root@120.26.239.62:/root/webgis_project/

# 上传前端文件（需要先构建）
scp -r dist/* root@120.26.239.62:/root/webgis_project/dist/
```

#### 2. 上传整个目录

```powershell
# 上传整个 server 目录
scp -r server root@120.26.239.62:/root/webgis_project/

# 上传前端构建产物
scp -r dist root@120.26.239.62:/root/webgis_project/
```

#### 3. 重启服务

**方式A：只重启后端（修改了后端代码）**

```powershell
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose restart backend"
```

**方式B：重新构建（修改了 Dockerfile 或依赖）**

```powershell
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose down && docker compose build backend --no-cache && docker compose up -d"
```

**方式C：只重启前端（修改了前端代码）**

```powershell
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose restart frontend"
```

#### 4. 验证部署

访问 `http://120.26.239.62` 测试功能是否正常。

---

## 🔄 混合方式（推荐工作流程）

### 开发测试阶段

1. **本地修改代码**
2. **SCP 上传到服务器测试**
   ```powershell
   scp server/routes/image.js root@120.26.239.62:/root/webgis_project/server/routes/
   ssh root@120.26.239.62 "cd /root/webgis_project && docker compose restart backend"
   ```
3. **测试通过**

### 正式部署阶段

4. **提交到 Git**
   ```powershell
   git add server/routes/image.js
   git commit -m "修复：优化TIF分析性能"
   git push origin ym
   ```
5. **服务器拉取代码**
   ```powershell
   ssh root@120.26.239.62 "cd /root/webgis_project && git pull origin ym && docker compose restart backend"
   ```

---

## 📋 常用命令速查

### 查看服务状态

```powershell
# 查看所有容器状态
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose ps"

# 查看后端日志（最近50行）
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose logs backend --tail 50"

# 实时查看后端日志
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose logs -f backend"
```

### 重启服务

```powershell
# 重启后端
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose restart backend"

# 重启前端
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose restart frontend"

# 重启所有服务
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose restart"
```

### 停止和启动服务

```powershell
# 停止所有服务
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose down"

# 启动所有服务
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose up -d"

# 重新构建并启动
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose down && docker compose build --no-cache && docker compose up -d"
```

### 检查文件内容

```powershell
# 查看服务器上的文件内容
ssh root@120.26.239.62 "cat /root/webgis_project/server/routes/image.js | head -100"

# 查看文件修改时间
ssh root@120.26.239.62 "ls -lh /root/webgis_project/server/routes/image.js"

# 对比本地和服务器文件
ssh root@120.26.239.62 "md5sum /root/webgis_project/server/routes/image.js"
certutil -hashfile server\routes\image.js MD5
```

---

## 🐛 故障排查

### 问题1：上传后功能还是不正常

**解决方法**：

```powershell
# 1. 确认文件已上传
ssh root@120.26.239.62 "ls -lh /root/webgis_project/server/routes/image.js"

# 2. 检查文件内容是否正确
ssh root@120.26.239.62 "grep -n 'analyzeTifFile' /root/webgis_project/server/routes/image.js | head -5"

# 3. 重新构建Docker镜像（确保容器内是最新代码）
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose down && docker compose build backend --no-cache && docker compose up -d"
```

### 问题2：Docker 容器启动失败

**解决方法**：

```powershell
# 查看详细错误日志
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose logs backend"

# 检查容器状态
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose ps"
```

### 问题3：404 错误（API 找不到）

**原因**：可能是 `server/app.js` 路由配置问题

**解决方法**：

```powershell
# 检查 app.js 文件
ssh root@120.26.239.62 "grep -n 'app.use.*image' /root/webgis_project/server/app.js"

# 应该看到：
# app.use('/api/image', imageRoutes)

# 如果不对，重新上传
scp server/app.js root@120.26.239.62:/root/webgis_project/server/
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose restart backend"
```

---

## 💡 最佳实践

### 1. 开发流程

```
本地开发 → 本地测试 → SCP上传到服务器 → 服务器测试 → 提交Git → 拉取部署
```

### 2. 分支管理

- `main` / `master`：生产环境代码（稳定版本）
- `ym` / `dev`：开发环境代码（测试中）
- `feature-xxx`：功能分支

### 3. 提交信息规范

```powershell
# 修复bug
git commit -m "修复：TIF文件分析内存溢出问题"

# 新增功能
git commit -m "新增：支持NDVI文件自动识别跳过分析"

# 优化改进
git commit -m "优化：采样判断TIF类型，减少内存占用"

# 配置修改
git commit -m "配置：更新Nginx Range请求支持"
```

### 4. 备份策略

在重大更新前，备份服务器数据：

```powershell
# 备份数据目录
ssh root@120.26.239.62 "cd /root/webgis_project && tar -czf backup_$(date +%Y%m%d_%H%M%S).tar.gz public/data imageData.json"

# 下载备份到本地
scp root@120.26.239.62:/root/webgis_project/backup_*.tar.gz ./backups/
```

---

## 📞 联系方式

如果遇到问题，请保留以下信息以便排查：

1. 错误日志（`docker compose logs backend`）
2. 浏览器控制台错误
3. 修改的文件列表（`git status`）
4. 服务器状态（`docker compose ps`）

