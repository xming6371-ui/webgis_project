# WebGIS 后端服务

基于 Express + Node.js 的后端服务，提供影像数据管理和TIF文件自动优化功能。

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 配置GDAL环境

**重要**：TIF自动优化功能需要GDAL支持。

#### 方式1：使用Conda环境（推荐）

```bash
# 1. 创建或激活conda环境
conda create -n xm python=3.9
conda activate xm

# 2. 安装GDAL
conda install -c conda-forge gdal

# 3. 验证安装
gdalinfo --version
```

**配置**：编辑 `server/config.js`

```javascript
export default {
  // 设置你的conda环境名称
  condaEnv: 'xm',  // 👈 改成你的环境名
  // ...
}
```

#### 方式2：系统PATH安装

如果GDAL已添加到系统PATH，设置：

```javascript
export default {
  condaEnv: null,  // 👈 设为null
  // ...
}
```

---

## ⚙️ 配置文件说明

### `server/config.js`

```javascript
export default {
  // 服务器端口
  port: 8080,
  
  // Conda环境名称
  // - 如果GDAL在conda中：设置环境名，如 'base', 'xm', 'gis'
  // - 如果GDAL在系统PATH：设置为 null
  condaEnv: 'xm',  // 👈 根据你的环境修改
  
  // 数据目录
  dataDir: 'public/data',
  
  // 元数据文件
  metadataFile: 'imageData.json'
}
```

---

## 📋 不同开发者的配置

### 开发者A（环境名：base）

```javascript
// server/config.js
export default {
  condaEnv: 'base',
  // ...
}
```

### 开发者B（环境名：xm）

```javascript
// server/config.js
export default {
  condaEnv: 'xm',
  // ...
}
```

### 开发者C（环境名：gdal_env）

```javascript
// server/config.js
export default {
  condaEnv: 'gdal_env',
  // ...
}
```

### 服务器部署（系统PATH）

```javascript
// server/config.js
export default {
  condaEnv: null,  // 使用系统PATH
  // ...
}
```

---

## 🔧 启动服务

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

**启动成功输出**：

```
====================================
  WebGIS 后端服务启动成功
====================================
  服务地址: http://localhost:8080
  健康检查: http://localhost:8080/health
  数据目录: D:\...\public\data
====================================
  可用服务:
  - 影像数据管理 (/image)
====================================
  GDAL配置:
  - Conda环境: xm
  - 如需修改，请编辑 server/config.js
====================================
```

---

## 📡 API接口

### 影像管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/image/list` | GET | 获取影像列表 |
| `/image/upload` | POST | 上传影像 |
| `/image/:id` | DELETE | 删除影像 |
| `/image/batch-delete` | POST | 批量删除 |
| `/image/download/:id` | GET | 下载影像 |
| `/image/optimize/:id` | POST | 优化TIF文件 |

### TIF优化接口

**请求**：
```
POST /image/optimize/:id
```

**响应**（成功）：
```json
{
  "code": 200,
  "message": "优化成功",
  "data": {
    "originalSize": "71.25MB",
    "optimizedSize": "2.69MB",
    "compressionRatio": "96.2%"
  }
}
```

**响应**（GDAL未配置）：
```json
{
  "code": 500,
  "message": "服务器未检测到GDAL，请检查配置：\n\n1. 确认conda环境 \"xm\" 是否存在\n2. 在该环境中安装GDAL：\n   conda activate xm\n   conda install -c conda-forge gdal\n\n3. 如果环境名称不对，请修改 server/config.js 中的 condaEnv 配置"
}
```

---

## 🐛 故障排查

### 问题1：GDAL检测失败

**错误**：
```
❌ GDAL检测失败: Command failed: conda run -n xm gdalinfo --version
```

**解决**：
1. 检查conda环境是否存在：
   ```bash
   conda env list
   ```

2. 激活环境并安装GDAL：
   ```bash
   conda activate xm
   conda install -c conda-forge gdal
   gdalinfo --version
   ```

3. 检查 `server/config.js` 中的 `condaEnv` 是否正确

---

### 问题2：端口被占用

**错误**：
```
Error: listen EADDRINUSE: address already in use :::8080
```

**解决**：
```bash
# Windows
netstat -ano | findstr :8080
taskkill /F /PID <进程ID>

# 或修改端口
# server/config.js: port: 8081
```

---

### 问题3：不同电脑环境名不同

**解决**：每个开发者修改自己的 `server/config.js`

**建议**：将 `config.js` 添加到 `.gitignore`，创建 `config.example.js` 作为模板

```bash
# .gitignore
server/config.js

# Git中保留
server/config.example.js
```

---

## 🚢 生产部署

### Docker部署（推荐）

**Dockerfile**：
```dockerfile
FROM node:18-alpine

# 安装GDAL
RUN apk add --no-cache gdal gdal-dev

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 8080
CMD ["npm", "start"]
```

**配置**：
```javascript
// server/config.js
export default {
  condaEnv: null,  // Docker中GDAL在系统PATH
  // ...
}
```

### 传统服务器部署

1. 在服务器安装GDAL
2. 将GDAL添加到系统PATH
3. 配置 `condaEnv: null`

---

## 📚 相关文档

- **[后端自动优化使用说明](../docs/后端自动优化使用说明.md)** - 用户使用指南
- **[TIF自动优化实现方案](../docs/TIF自动优化实现方案.md)** - 技术实现
- **[主README](../README.md)** - 项目概览

---

## 🔄 更新日志

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v2.0 | 2025-10-16 | 添加GDAL配置支持，支持自定义conda环境 |
| v1.0 | 2025-10-15 | 初始版本 |

---

**维护者**：WebGIS开发团队  
**最后更新**：2025-10-16
