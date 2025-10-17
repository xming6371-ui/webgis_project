# 新疆WebGIS监测与分析系统

基于 Vue3 + Element Plus + OpenLayers 的现代化WebGIS应用

## 技术栈

- **前端框架**: Vue 3 (Composition API)
- **UI组件库**: Element Plus
- **地图引擎**: OpenLayers
- **图表库**: ECharts
- **状态管理**: Pinia
- **路由**: Vue Router
- **构建工具**: Vite

## 功能模块

1. 监测主控台 - Dashboard首页
2. 影像与数据管理
3. 分类分析任务管理
4. 结果查看与差异比对
5. 图表报表
6. 数据导入导出

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 生产构建

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

## 项目结构

```
xinjiangweb/
├── src/
│   ├── assets/          # 静态资源
│   ├── components/      # 公共组件
│   ├── views/           # 页面组件
│   ├── router/          # 路由配置
│   ├── stores/          # 状态管理
│   ├── utils/           # 工具函数
│   ├── api/             # API接口
│   ├── styles/          # 全局样式
│   ├── App.vue          # 根组件
│   └── main.js          # 入口文件
├── public/              # 公共静态资源
├── index.html           # HTML入口
├── vite.config.js       # Vite配置
└── package.json         # 依赖配置
```

## 开发说明

- 默认运行在 http://localhost:3000
- API代理配置在 vite.config.js 中

## 📚 文档

### 📖 完整文档中心
**[→ 查看所有文档](./docs/README.md)** - 文档总览和快速查找

### 🔧 核心文档

| 文档 | 说明 | 适用人群 |
|------|------|---------|
| [**GDAL完整指南**](./docs/GDAL完整指南.md) | GDAL安装、配置、故障排除 | 🔧 开发者（必读） |
| [**TIF优化完整指南**](./docs/TIF优化完整指南.md) | TIF文件优化功能详解 | 👥 所有用户 |
| [**功能使用指南**](./docs/功能使用指南.md) | 前端功能操作说明 | 👤 最终用户 |

### 🚀 快速链接

- **首次使用** → [快速开始](#快速开始)
- **环境配置** → [GDAL配置](./docs/GDAL完整指南.md#快速开始)
- **优化TIF** → [TIF优化使用](./docs/TIF优化完整指南.md#快速使用)
- **常见问题** → [故障排除](./docs/GDAL完整指南.md#故障排除)
- **后端文档** → [Server README](./server/README.md)

## 🚀 后端服务

### 启动后端

```bash
cd server
npm install
npm run dev
```

后端服务运行在 http://localhost:8080

### 主要功能
- 影像文件管理（上传、删除、下载）
- 自动同步文件元数据
- 文件大小实时统计

详见 [server/README.md](./server/README.md)

## 🛠️ TIF文件优化（必需）

### ⚡ 新功能：后端自动优化！

项目已升级为**后端自动优化**！只需点击按钮，服务器自动处理TIF文件。

#### 快速开始

**1. 安装GDAL（仅需一次）**

```bash
# 创建或激活你的conda环境
conda create -n xm python=3.9  # 或使用你的环境名
conda activate xm

# 安装GDAL
conda install -c conda-forge gdal

# 验证安装
gdalinfo --version
```

**2. 配置conda环境**

编辑 `server/config.js`，设置你的conda环境名：

```javascript
export default {
  condaEnv: 'xm',  // 👈 改成你的环境名
  // ...
}
```

**3. 启动后端服务**

⚠️ **重要**：必须在 **Anaconda Prompt** 中启动后端！

```bash
# 1. 打开 Anaconda Prompt（不是普通CMD！）
# 开始菜单 → Anaconda3 → Anaconda Prompt

# 2. 激活环境
conda activate xm

# 3. 进入项目目录
cd D:\code\前端学习之路\demo\demo07

# 4. 启动后端
cd server
npm install  # 首次需要
npm run dev
```

**成功标志**：看到以下输出表示配置成功
```
====================================
  GDAL配置:
  - Conda环境: xm
====================================
✅ GDAL已安装: GDAL 3.x.x          👈 关键！必须看到这行
   使用Conda环境: xm
```

**如果显示"❌ GDAL检测失败"**，请查看 [GDAL检测失败排查指南](./GDAL检测失败排查指南.md)

**4. 使用优化功能**

1. 打开"影像数据管理"页面
2. 找到未优化的文件
3. 点击"⚙️ 优化TIF"按钮
4. 等待1-5分钟，完成！

**效果**：
- ✅ 文件大小减少 60-95%
- ✅ 地图加载速度提升 5-20倍
- ✅ 全自动处理，无需手动操作

**详细说明**：
- **[后端自动优化使用说明](./docs/后端自动优化使用说明.md)** - 完整使用教程
- **[TIF数据处理完整指南](./docs/TIF数据处理完整指南.md)** - 技术细节
- **[TIF自动优化实现方案](./docs/TIF自动优化实现方案.md)** - 实现原理

