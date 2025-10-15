# WebGIS 统一后端服务

## 项目结构

```
server/
├── app.js              # 主应用入口
├── routes/             # 路由模块
│   └── image.js        # 影像管理路由
├── package.json        # 依赖配置
└── README.md          # 本文档
```

## 快速开始

### 安装依赖
```bash
cd server
npm install
```

### 启动服务

**开发模式（推荐，支持热重载）**：
```bash
npm run dev
```

**生产模式**：
```bash
npm start
```

**或使用批处理脚本**：
```bash
双击运行根目录下的：启动影像管理服务.bat
```

## 服务配置

- **端口**: 8080
- **数据目录**: `../public/data`
- **环境变量**: 
  - `PORT`: 自定义端口（默认8080）

## API 接口

### 健康检查
```
GET /health
```

### 影像管理模块

#### 获取影像列表
```
GET /image/list
```

#### 上传影像
```
POST /image/upload
Content-Type: multipart/form-data
```

#### 删除影像
```
DELETE /image/:id
```

#### 批量删除影像
```
POST /image/batch-delete
Body: { ids: ['IMG001', 'IMG002', ...] }
```

#### 下载影像
```
GET /image/download/:id
```

## 添加新模块

### 1. 创建路由文件
在 `routes/` 目录下创建新的路由文件，例如 `task.js`：

```javascript
import express from 'express'
const router = express.Router()

router.get('/list', (req, res) => {
  res.json({ code: 200, data: [] })
})

export default router
```

### 2. 在 app.js 中注册路由
```javascript
import taskRoutes from './routes/task.js'
app.use('/task', taskRoutes)
```

### 3. 重启服务
```bash
npm run dev  # 如果使用nodemon会自动重启
```

## 开发说明

### 使用 nodemon 热重载
开发模式下使用 `npm run dev` 启动，代码修改后会自动重启服务，无需手动重启。

### 添加中间件
在 `app.js` 中添加全局中间件：
```javascript
app.use(yourMiddleware)
```

### 错误处理
统一的错误处理已在 `app.js` 中配置，路由中抛出的错误会被自动捕获。

### 日志记录
当前使用简单的控制台日志，可以根据需要集成日志库（如 winston、pino）。

## 技术栈

- **框架**: Express.js
- **文件上传**: Multer
- **跨域**: CORS
- **开发工具**: Nodemon（热重载）

## 注意事项

1. 确保 `public/data` 目录存在且有读写权限
2. 上传的文件会直接保存到 data 目录
3. 删除操作会永久删除文件，请谨慎操作
4. 开发模式下修改代码会自动重启服务

## 扩展功能计划

以后可以在此基础上添加：
- 任务管理模块 (`/task`)
- 用户认证模块 (`/auth`)
- 数据分析模块 (`/analysis`)
- 报表生成模块 (`/report`)
- WebSocket 实时通信
- 数据库集成（MongoDB/PostgreSQL）
- Redis缓存
- 日志系统
- 等等...

## 故障排除

### 端口被占用
修改环境变量 `PORT` 或直接在 `app.js` 中修改端口号。

### 模块找不到
确保已运行 `npm install` 安装所有依赖。

### 文件上传失败
检查 `public/data` 目录权限和磁盘空间。
