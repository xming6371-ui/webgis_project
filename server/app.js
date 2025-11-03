import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

// 导入路由模块
import imageRoutes from './routes/image.js'
import config from './config.js'

// 动态导入analysis路由（避免shapefile库未安装导致启动失败）
let analysisRoutes = null
try {
  const analysisModule = await import('./routes/analysis.js')
  analysisRoutes = analysisModule.default
  console.log('✅ 分析结果管理模块已加载')
} catch (error) {
  console.warn('⚠️ 分析结果管理模块加载失败:', error.message)
  console.warn('   识别结果功能将不可用，但不影响影像管理功能')
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 8080

// 中间件
app.use(cors())
// 增加请求体大小限制到50MB（用于保存大型GeoJSON文件）
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// 日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleString()}] ${req.method} ${req.url}`)
  next()
})

// 挂载路由（添加 /api 前缀，符合RESTful规范）
app.use('/api/image', imageRoutes)
if (analysisRoutes) {
  app.use('/api/analysis', analysisRoutes)
}

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({
    code: 200,
    message: 'WebGIS后端服务运行正常',
    timestamp: new Date().toISOString(),
    services: {
      imageManagement: 'running'
    }
  })
})

// 根路径
app.get('/', (req, res) => {
  res.json({
    code: 200,
    message: 'WebGIS后端服务',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      image: '/api/image/*',
      analysis: '/api/analysis/*'
    }
  })
})

// 404处理
app.use((req, res) => {
  res.status(404).json({
    code: 404,
    message: '接口不存在'
  })
})

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误：', err)
  res.status(500).json({
    code: 500,
    message: err.message || '服务器内部错误'
  })
})

// 初始化数据目录
const initDataDirectories = () => {
  // 使用环境变量或根据运行环境自动判断（修复 Docker 容器内路径问题）
  const dataDir = process.env.DATA_DIR || (fs.existsSync('/app') ? '/app/public/data' : path.resolve(__dirname, '../public/data'))
  const requiredDirs = [
    dataDir,
    path.join(dataDir, 'data_shp'),
    path.join(dataDir, 'data_geojson'),
    path.join(dataDir, 'data_kmz'),
    path.join(dataDir, 'data_analysis_results'),
    path.join(dataDir, 'data_analysis_results/temporal'),
    path.join(dataDir, 'data_analysis_results/difference'),
    path.join(dataDir, 'data_reports')
  ]

  console.log('📁 初始化数据目录...')
  requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      console.log(`   ✅ 创建目录: ${path.relative(__dirname, dir)}`)
    }
  })
  console.log('✅ 数据目录初始化完成\n')
}

// 启动时初始化目录
initDataDirectories()

// 启动服务器
app.listen(PORT, () => {
  console.log('====================================')
  console.log('  WebGIS 后端服务启动成功')
  console.log('====================================')
  console.log(`  服务地址: http://localhost:${PORT}`)
  console.log(`  健康检查: http://localhost:${PORT}/health`)
  const dataDirPath = process.env.DATA_DIR || (fs.existsSync('/app') ? '/app/public/data' : path.resolve(__dirname, '../public/data'))
  console.log(`  数据目录: ${dataDirPath}`)
  console.log('====================================')
  console.log('  可用服务:')
  console.log('  - 影像数据管理 (/api/image)')
  if (analysisRoutes) {
    console.log('  - 识别结果管理 (/api/analysis)')
  }
  console.log('====================================')
  console.log('  GDAL配置:')
  if (config.condaEnv) {
    console.log(`  - Conda环境: ${config.condaEnv}`)
    console.log(`  - 如需修改，请编辑 server/config.js`)
  } else {
    console.log('  - 使用系统PATH中的GDAL')
    console.log('  - 如需使用Conda环境，请配置 server/config.js')
  }
  console.log('====================================')
  console.log('')
})

export default app

