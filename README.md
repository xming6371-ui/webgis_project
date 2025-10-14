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

