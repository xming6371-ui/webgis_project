import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'

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
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleString()}] ${req.method} ${req.url}`)
  next()
})

// 挂载路由
app.use('/image', imageRoutes)
if (analysisRoutes) {
  app.use('/analysis', analysisRoutes)
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
      image: '/image/*'
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

// 启动服务器
app.listen(PORT, () => {
  console.log('====================================')
  console.log('  WebGIS 后端服务启动成功')
  console.log('====================================')
  console.log(`  服务地址: http://localhost:${PORT}`)
  console.log(`  健康检查: http://localhost:${PORT}/health`)
  console.log(`  数据目录: ${path.join(__dirname, '../public/data')}`)
  console.log('====================================')
  console.log('  可用服务:')
  console.log('  - 影像数据管理 (/image)')
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

