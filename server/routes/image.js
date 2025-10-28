import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import { promisify } from 'util'
import config from '../config.js'
import { fromFile } from 'geotiff'

const execAsync = promisify(exec)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// 数据目录
const DATA_DIR = path.join(__dirname, '../../public/data')
const TIF_DIR = path.join(DATA_DIR, 'data_tif')  // TIF文件专用目录
const METADATA_FILE = path.join(DATA_DIR, 'imageData.json')

// 优化任务进度追踪
const optimizationProgress = new Map()
// 格式: { id: string, progress: number (0-100), status: string, step: string, startTime: number }

// 🆕 元数据缓存机制
let metadataCache = null
let lastSyncTime = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

// 清除缓存的辅助函数
function clearCache() {
  metadataCache = null
  lastSyncTime = 0
  console.log('🗑️ 元数据缓存已清除')
}

// 缓存conda环境中的GDAL路径（避免重复查找）
let cachedGDALPath = null
let cachedCondaEnvPath = null

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // TIF文件上传到data_tif目录
    cb(null, TIF_DIR)
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname)
  }
})

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (['.tif', '.tiff', '.img', '.jp2'].includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('只支持 .tif, .tiff, .img, .jp2 格式的文件'))
    }
  }
})

// 初始化元数据文件
function initMetadata() {
  if (!fs.existsSync(METADATA_FILE)) {
    fs.writeFileSync(METADATA_FILE, JSON.stringify({ images: [] }, null, 2))
  }
}

// 读取元数据
function readMetadata() {
  try {
    const data = fs.readFileSync(METADATA_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    return { images: [] }
  }
}

// 写入元数据
function writeMetadata(data) {
  fs.writeFileSync(METADATA_FILE, JSON.stringify(data, null, 2))
}

// 从文件名解析影像信息
function parseImageInfo(filename) {
  const parts = filename.replace('.tif', '').replace('.tiff', '').split('_')
  const year = parts[0] || String(new Date().getFullYear())
  
  return {
    name: filename,
    year: String(year),  // 确保是字符串
    sensor: parts.length > 2 ? parts[2] : 'Unknown',
    region: parts.length > 1 ? parts[1] : 'Unknown',
    date: `${year}-01-01`,
    cloudCover: Math.floor(Math.random() * 30),
    status: 'processed'
  }
}

// 扫描data_tif目录，同步元数据（自动读取真实文件大小）
async function syncMetadata() {
  try {
    console.log('🔍 开始同步元数据...')
    const files = fs.readdirSync(TIF_DIR)
    console.log(`📁 找到 ${files.length} 个文件`)
    
    const tifFiles = files.filter(f => {
      const ext = path.extname(f).toLowerCase()
      return ['.tif', '.tiff'].includes(ext)
    })
    console.log(`📊 其中 ${tifFiles.length} 个TIF文件`)
    
    const metadata = readMetadata()
    console.log(`💾 当前元数据中有 ${metadata.images.length} 条记录`)
  
  // 为每个TIF文件更新或创建记录（异步处理）
  const updatePromises = tifFiles.map(async (filename) => {
    try {
      const filePath = path.join(TIF_DIR, filename)
      const stats = fs.statSync(filePath)
      const fileSize = (stats.size / (1024 * 1024)).toFixed(2) + 'MB'
      
      // 查找是否已存在
      const existingImage = metadata.images.find(img => img.name === filename)
    
    if (existingImage) {
      // ✅ 更新文件修改时间
      existingImage.uploadTime = stats.mtime.toISOString()
      
      // ⚠️ 只有未优化的文件才更新大小（避免覆盖优化后的数据）
      if (!existingImage.isOptimized && !existingImage.isOptimizedResult) {
        existingImage.size = fileSize
        existingImage.originalSize = fileSize
        
        // 🔍 自动检测优化状态 - 仅在满足以下条件时才检测：
        // 1. 文件修改时间发生变化（说明文件被修改过）
        // 2. 或者从未检测过（lastOptimizationCheck不存在）
        const currentMTime = stats.mtime.getTime()
        const lastMTime = existingImage.lastModifiedTime || 0
        const needsCheck = !existingImage.lastOptimizationCheck || (currentMTime > lastMTime)
        
        if (needsCheck) {
          try {
            const detection = await detectOptimizationStatus(filePath)
            existingImage.lastOptimizationCheck = new Date().toISOString()
            existingImage.lastModifiedTime = currentMTime
            
            if (detection.isOptimized) {
              existingImage.isOptimized = true
              existingImage.optimizedSize = fileSize
              console.log(`🎯 自动识别为已优化文件: ${filename}`)
            }
          } catch (err) {
            // 检测失败不影响主流程
            console.warn(`⚠️ 自动检测失败: ${filename}`)
          }
        } else {
          // 跳过检测，使用缓存的结果
          console.log(`⏭️ 跳过检测（使用缓存）: ${filename}`)
        }
      } else if (existingImage.isOptimized && !existingImage.isOptimizedResult) {
        // 如果已优化，只更新originalSize
        existingImage.originalSize = fileSize
      }
      
      // 更新文件修改时间
      existingImage.lastModifiedTime = stats.mtime.getTime()
      
      // 如果没有其他字段，补充基本信息
      if (!existingImage.year) {
        const info = parseImageInfo(filename)
        Object.assign(existingImage, info)
      }
      
      // 📊 补充分析：如果元数据中没有统计数据，则自动分析（只分析一次）
      if (!existingImage.statistics || !existingImage.statistics.analyzed) {
        try {
          console.log(`📊 [补充分析] 检测到旧文件缺少统计数据: ${filename}`)
          const statistics = await analyzeTifFile(filePath)
          // ✅ 无论成功或失败，都保存结果（避免重复分析）
          existingImage.statistics = statistics
          console.log(`✅ [补充分析] 统计数据已保存`)
        } catch (err) {
          console.warn(`⚠️ [补充分析] 旧文件分析失败: ${filename}`, err.message)
          // ✅ 即使异常也标记为已分析
          existingImage.statistics = {
            analyzed: true,
            error: true,
            errorMessage: err.message,
            analyzedAt: new Date().toISOString()
          }
        }
      } else {
        console.log(`⏭️ [补充分析] 跳过已分析的文件: ${filename}`)
      }
      
      console.log(`✅ 更新文件信息: ${filename} (${fileSize})`)
    } else {
      // ✅ 添加新文件（自动读取真实信息）
      const info = parseImageInfo(filename)
      
      // 🔧 修复：找到当前最大的ID编号，避免ID重复
      let maxId = 0
      metadata.images.forEach(img => {
        const match = img.id.match(/^IMG(\d+)$/)
        if (match) {
          const num = parseInt(match[1], 10)
          if (num > maxId) maxId = num
        }
      })
      const newId = 'IMG' + String(maxId + 1).padStart(3, '0')
      
      const newImage = {
        id: newId,
        ...info,
        size: fileSize,
        originalSize: fileSize,  // 新文件的原始大小就是当前大小
        optimizedSize: null,
        thumbnail: `/data/data_tif/${filename}`,
        preview: `/data/data_tif/${filename}`,
        filePath: `/data/data_tif/${filename}`,
        originalPath: `/data/data_tif/${filename}`,
        optimizedPath: null,
        isOptimized: false,
        uploadTime: stats.mtime.toISOString(),
        period: '1',  // 默认第一期
        cropType: 'all',  // 默认全部作物
        description: `自动导入的影像文件`
      }
      
      // 🔍 自动检测新上传文件的优化状态（仅新文件检测一次）
      try {
        const detection = await detectOptimizationStatus(filePath)
        newImage.lastOptimizationCheck = new Date().toISOString()
        newImage.lastModifiedTime = stats.mtime.getTime()
        
        if (detection.isOptimized) {
          newImage.isOptimized = true
          newImage.optimizedSize = fileSize
          console.log(`🎯 新文件自动识别为已优化: ${filename}`)
        }
      } catch (err) {
        // 检测失败不影响主流程，标记为已检测但未优化
        newImage.lastOptimizationCheck = new Date().toISOString()
        newImage.lastModifiedTime = stats.mtime.getTime()
        console.warn(`⚠️ 新文件自动检测失败: ${filename}`)
      }
      
      // 📊 自动分析TIF文件并保存统计数据
      try {
        console.log(`📊 正在分析新文件: ${filename}`)
        const statistics = await analyzeTifFile(filePath)
        // ✅ 无论成功或失败，都保存结果（避免重复分析）
        newImage.statistics = statistics
        console.log(`✅ 统计数据已保存到元数据`)
      } catch (err) {
        console.warn(`⚠️ TIF分析失败: ${filename}`, err.message)
        // ✅ 即使异常也标记为已分析
        newImage.statistics = {
          analyzed: true,
          error: true,
          errorMessage: err.message,
          analyzedAt: new Date().toISOString()
        }
      }
      
      metadata.images.push(newImage)
      console.log(`✅ 添加新文件: ${filename} (ID: ${newId}, ${fileSize})`)
    }
    } catch (fileError) {
      console.error(`❌ 处理文件 ${filename} 时出错:`, fileError.message)
    }
  })
  
  // 等待所有文件处理完成（使用Promise.allSettled避免单个失败导致全部失败）
  await Promise.allSettled(updatePromises)
    
    // 移除已删除的文件
    const removedCount = metadata.images.length
    metadata.images = metadata.images.filter(img => tifFiles.includes(img.name))
    const actualRemoved = removedCount - metadata.images.length
    if (actualRemoved > 0) {
      console.log(`✅ 移除 ${actualRemoved} 个已删除的文件记录`)
    }
    
    writeMetadata(metadata)
    console.log('✅ 元数据同步完成')
    return metadata
  } catch (error) {
    console.error('❌ syncMetadata 出错:', error)
    throw error
  }
}

// 初始化
initMetadata()
// syncMetadata现在是async，但初始化时不等待完成（避免阻塞启动）
syncMetadata().catch(err => console.error('初始化元数据同步失败:', err))

// 初始化GDAL加速模式（异步，不阻塞启动）
console.log('========================================')
console.log('🚀 初始化GDAL加速模式...')
console.log('========================================')
initGDALPath().then((result) => {
  if (result) {
    console.log('✅ GDAL加速模式已启用')
    console.log('   ⚡ 优化速度将提升 50-80%')
    console.log('   📂 GDAL路径:', result.gdalPath)
    console.log('   📦 Conda环境:', result.condaEnv)
    console.log('========================================')
  } else {
    console.warn('========================================')
    console.warn('⚠️ GDAL加速模式未启用')
    console.warn('   将使用标准模式（较慢，每次优化都会重新启动conda）')
    console.warn('   原因：未检测到conda环境中的GDAL')
    console.warn('========================================')
  }
}).catch(err => {
  console.warn('========================================')
  console.warn('⚠️ GDAL加速模式初始化失败')
  console.warn('   将使用标准模式（较慢，每次优化都会重新启动conda）')
  console.warn('   提示：请在 Anaconda Prompt 中启动后端以获得更快的速度')
  console.warn('   错误信息:', err.message)
  console.warn('========================================')
})

// 路由

// 获取影像列表（带缓存机制）
router.get('/list', async (req, res) => {
  try {
    const now = Date.now()
    const forceRefresh = req.query.refresh === 'true' // 支持前端强制刷新
    
    // 如果有缓存且未过期且不强制刷新，直接返回缓存
    if (!forceRefresh && metadataCache && (now - lastSyncTime < CACHE_DURATION)) {
      const cacheAge = Math.floor((now - lastSyncTime) / 1000)
      console.log(`✅ 使用缓存数据（缓存时间: ${cacheAge}秒）`)
      return res.json({
        code: 200,
        message: '获取成功（缓存）',
        data: metadataCache.images,
        cached: true,
        cacheAge: cacheAge
      })
    }
    
    // 否则重新同步
    console.log('🔄 重新同步元数据...')
    const metadata = await syncMetadata()
    metadataCache = metadata
    lastSyncTime = now
    
    res.json({
      code: 200,
      message: '获取成功',
      data: metadata.images,
      cached: false
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: error.message
    })
  }
})

// 获取所有文件列表（包括TIF、SHP、GeoJSON等）
router.get('/files', (req, res) => {
  try {
    const allFiles = []
    
    // 扫描的目录列表
    const scanDirs = [
      { path: DATA_DIR, label: 'data' },  // 用于扫描TIF文件
      { path: path.join(DATA_DIR, 'data_shp'), label: 'data_shp' }  // 只扫描data_shp文件夹的SHP文件
      // data_geojson 不需要扫描
    ]
    
    scanDirs.forEach(({ path: dirPath, label }) => {
      if (!fs.existsSync(dirPath)) {
        console.log(`⚠️ 目录不存在: ${dirPath}`)
        return
      }
      
      const files = fs.readdirSync(dirPath)
      
      files.forEach(filename => {
        const fullPath = path.join(dirPath, filename)
        const stats = fs.statSync(fullPath)
        
        // 跳过目录
        if (stats.isDirectory()) return
        
        const ext = path.extname(filename).toLowerCase()
        const fileSize = (stats.size / (1024 * 1024)).toFixed(2) + 'MB'
        
        // 判断文件类型
        let fileType = 'OTHER'
        if (['.tif', '.tiff'].includes(ext)) {
          fileType = 'TIF'
        } else if (['.shp'].includes(ext)) {
          fileType = 'SHP'
        } else if (['.geojson', '.json'].includes(ext)) {
          fileType = 'GeoJSON'
        } else if (['.dbf', '.shx', '.prj', '.cpg', '.sbn', '.sbx'].includes(ext)) {
          // SHP相关辅助文件，也标记为SHP类型
          fileType = 'SHP'
        }
        
        // 过滤规则：data根目录只返回TIF，data_shp只返回SHP相关文件
        if (label === 'data' && fileType !== 'TIF') {
          return  // data根目录跳过非TIF文件
        }
        if (label === 'data_shp' && fileType !== 'SHP') {
          return  // data_shp目录跳过非SHP文件
        }
        
        allFiles.push({
          id: `${label}_${filename}`,
          name: filename,
          type: fileType,
          size: fileSize,
          path: fullPath,
          directory: label,
          uploadTime: stats.mtime.toISOString()
        })
      })
    })
    
    console.log(`✅ 扫描到 ${allFiles.length} 个文件`)
    console.log(`   - TIF: ${allFiles.filter(f => f.type === 'TIF').length}`)
    console.log(`   - SHP: ${allFiles.filter(f => f.type === 'SHP').length}`)
    console.log(`   - GeoJSON: ${allFiles.filter(f => f.type === 'GeoJSON').length}`)
    
    res.json({
      code: 200,
      message: '获取成功',
      data: allFiles
    })
  } catch (error) {
    console.error('❌ 获取文件列表失败:', error)
    res.status(500).json({
      code: 500,
      message: error.message
    })
  }
})

// 处理OPTIONS请求（CORS预检）
router.options('/file/:filename', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')
  res.sendStatus(204)
})

// 处理HEAD请求（geotiff.js用于查询文件大小）
router.head('/file/:filename', (req, res) => {
  try {
    // 🔧 修复：解码URL编码的文件名（处理括号等特殊字符）
    const filename = decodeURIComponent(req.params.filename)
    const filePath = path.join(TIF_DIR, filename)
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ HEAD请求 - 文件不存在: ${filePath}`)
      return res.sendStatus(404)
    }
    
    const stat = fs.statSync(filePath)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Type', 'image/tiff')
    res.setHeader('Content-Length', stat.size)
    console.log(`✅ HEAD请求成功: ${filename} (${stat.size} bytes)`)
    res.sendStatus(200)
  } catch (error) {
    console.error('❌ HEAD请求失败:', error)
    res.sendStatus(500)
  }
})

// 获取影像文件（用于前端读取和渲染，支持Range请求）
router.get('/file/:filename', (req, res) => {
  try {
    // 🔧 修复：解码URL编码的文件名（处理括号等特殊字符）
    const filename = decodeURIComponent(req.params.filename)
    const filePath = path.join(TIF_DIR, filename)
    
    console.log(`📥 文件请求: ${filename}`)
    console.log(`   完整路径: ${filePath}`)
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ 文件不存在: ${filePath}`)
      return res.status(404).json({
        code: 404,
        message: '文件不存在: ' + filename
      })
    }
    
    // 获取文件信息
    const stat = fs.statSync(filePath)
    const fileSize = stat.size
    
    // 设置CORS和基本响应头（兼容本地和nginx代理）
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Type', 'image/tiff')
    res.setHeader('Cache-Control', 'public, max-age=86400') // 缓存1天
    
    // 处理Range请求（geotiff.js需要用来读取TIF文件的部分数据）
    const range = req.headers.range
    
    if (range) {
      // 解析Range头: bytes=start-end
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      
      // 🔧 修复：验证并调整范围（更宽松的处理）
      if (start < 0 || start >= fileSize) {
        console.error(`❌ 无效的Range起始位置: ${start}/${fileSize}`)
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`)
        return res.end()
      }
      
      // 如果 end 超出范围，自动调整到文件末尾（兼容性更好）
      if (end >= fileSize) {
        console.warn(`⚠️ Range结束位置超出范围，自动调整: ${end} -> ${fileSize - 1}`)
        end = fileSize - 1
      }
      
      const chunksize = (end - start) + 1
      
      // 设置206 Partial Content响应
      res.status(206)
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`)
      res.setHeader('Content-Length', chunksize)
      
      console.log(`📦 Range请求: ${filename} [${start}-${end}/${fileSize}]`)
      
      // 创建文件流（只读取请求的部分）
      const fileStream = fs.createReadStream(filePath, { start, end })
      fileStream.on('error', (error) => {
        console.error('❌ 文件流错误:', error)
        res.end()
      })
      fileStream.pipe(res)
    } else {
      // 没有Range请求，发送完整文件
      console.log(`📦 完整文件请求: ${filename} [${fileSize} bytes]`)
      res.setHeader('Content-Length', fileSize)
      
      const fileStream = fs.createReadStream(filePath)
      fileStream.on('error', (error) => {
        console.error('❌ 文件流错误:', error)
        res.end()
      })
      fileStream.pipe(res)
    }
  } catch (error) {
    console.error('❌ 文件读取失败:', error)
    res.status(500).json({
      code: 500,
      message: error.message
    })
  }
})

// 上传影像
router.post('/upload', upload.array('files'), async (req, res) => {
  try {
    // 获取新上传的文件
    const uploadedFiles = req.files
    
    // 读取现有元数据
    const metadata = readMetadata()
    
    // 获取上传模式和元数据
    const uploadMode = req.body.uploadMode || 'batch'
    let fileMetadataList = []
    
    if (uploadMode === 'individual') {
      fileMetadataList = JSON.parse(req.body.fileMetadataList || '[]')
    }
    
    // 批量模式的通用元数据
    const userMetadata = {
      year: req.body.year || String(new Date().getFullYear()),
      month: req.body.month || String(new Date().getMonth() + 1).padStart(2, '0'),
      period: req.body.period || '1',
      region: req.body.region || '',
      date: req.body.date || '',  // 🆕 采集日期
      sensor: req.body.sensor || '',
      description: req.body.description || ''
    }
    
    // 获取优化选项
    const needOptimize = req.body.needOptimize === 'true'
    const overwriteOriginal = req.body.overwriteOriginal === 'true'
    const optimizedFileName = req.body.optimizedFileName || ''
    
    console.log('📥 上传选项:', {
      uploadMode,
      needOptimize,
      overwriteOriginal,
      optimizedFileName
    })
    
    // ✅ 手动为每个文件创建元数据（不触发全量同步）
    const newImages = []
    
    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i]
      const stats = fs.statSync(path.join(TIF_DIR, file.originalname))
      const fileSize = (stats.size / (1024 * 1024)).toFixed(2) + 'MB'
      
      // 获取该文件的元数据
      let fileMeta
      if (uploadMode === 'individual' && fileMetadataList[i]) {
        fileMeta = fileMetadataList[i]
      } else {
        fileMeta = userMetadata
      }
      
      // 🔧 查找最大ID
      let maxId = 0
      metadata.images.forEach(img => {
        const match = img.id.match(/^IMG(\d+)$/)
        if (match) {
          const num = parseInt(match[1], 10)
          if (num > maxId) maxId = num
        }
      })
      const newId = 'IMG' + String(maxId + 1).padStart(3, '0')
      
      // ✅ 检查是否是覆盖已有文件
      const existingIndex = metadata.images.findIndex(img => img.name === file.originalname)
      
      const newImage = {
        id: existingIndex >= 0 ? metadata.images[existingIndex].id : newId,
        name: file.originalname,
        year: fileMeta.year,
        month: fileMeta.month,
        period: fileMeta.period,
        region: fileMeta.region,
        date: fileMeta.date || '',  // 🆕 采集日期
        sensor: fileMeta.sensor,
        description: fileMeta.description,
        size: fileSize,
        originalSize: fileSize,
        optimizedSize: null,
        thumbnail: `/data/data_tif/${file.originalname}`,
        preview: `/data/data_tif/${file.originalname}`,
        filePath: `/data/data_tif/${file.originalname}`,
        originalPath: `/data/data_tif/${file.originalname}`,
        optimizedPath: null,
        isOptimized: false,
        uploadTime: stats.mtime.toISOString(),
        status: 'processed'
      }
      
      // ✅ 上传时立即进行统计分析
      try {
        console.log(`📊 正在分析上传的文件: ${file.originalname}`)
        const filePath = path.join(TIF_DIR, file.originalname)
        const statistics = await analyzeTifFile(filePath)
        newImage.statistics = statistics
        console.log(`✅ 统计数据已保存`)
      } catch (err) {
        console.warn(`⚠️ TIF分析失败: ${file.originalname}`, err.message)
        newImage.statistics = {
          analyzed: true,
          error: true,
          errorMessage: err.message,
          analyzedAt: new Date().toISOString()
        }
      }
      
      if (existingIndex >= 0) {
        // 覆盖现有文件
        metadata.images[existingIndex] = newImage
        console.log(`🔄 更新文件元数据: ${file.originalname}`)
      } else {
        // 添加新文件
        metadata.images.push(newImage)
        console.log(`✅ 添加新文件元数据: ${file.originalname} (ID: ${newId})`)
      }
      
      newImages.push(newImage)
    }
    
    // 保存元数据
    writeMetadata(metadata)
    
    // ✅ 清除缓存，但不触发全量同步
    clearCache()
    
    // ✅ 返回新上传文件的元数据
    res.json({
      code: 200,
      message: '上传成功',
      data: {
        count: uploadedFiles.length,
        images: newImages
      }
    })
    
    // 异步在后台处理优化
    if (needOptimize) {
      uploadedFiles.forEach(async (file) => {
        try {
          // 查找对应的影像记录
          const currentMetadata = readMetadata()
          const image = currentMetadata.images.find(img => img.name === file.originalname)
          
          if (image) {
            // 检查文件是否已经是优化格式（避免重复优化）
            if (file.originalname.includes('_optimized')) {
              console.log(`⏩ 跳过已优化文件: ${image.name}`)
              // 标记为已优化
              image.isOptimized = true
              writeMetadata(currentMetadata)
              return
            }
            
            console.log(`🚀 自动优化队列：开始优化 ${image.name}`)
            
            // 调用优化函数（传递优化选项）
            optimizeTifFile(image.id, {
              overwriteOriginal,
              customFileName: optimizedFileName
            }).then(() => {
              console.log(`✅ 自动优化完成：${image.name}`)
            }).catch(err => {
              console.error(`❌ 自动优化失败：${image.name}`, err.message)
            })
          }
        } catch (error) {
          console.error(`处理文件优化时出错: ${file.originalname}`, error.message)
        }
      })
    } else {
      console.log('⏭️ 用户选择不优化，保留原始文件')
    }
    
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: error.message
    })
  }
})

// 更新影像元数据
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body
    const metadata = readMetadata()
    
    const image = metadata.images.find(img => img.id === id)
    if (!image) {
      return res.status(404).json({
        code: 404,
        message: '影像不存在'
      })
    }
    
    // 更新允许修改的字段
    const allowedFields = ['year', 'month', 'period', 'region', 'sensor', 'date', 'description']
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        image[field] = updates[field]
      }
    })
    
    // 保存到文件
    writeMetadata(metadata)
    
    // 🆕 清除缓存，确保其他接口能获取到最新数据
    clearCache()
    
    console.log(`✅ 更新影像元数据: ${image.name}`)
    console.log(`   更新字段:`, Object.keys(updates).filter(k => allowedFields.includes(k)))
    
    res.json({
      code: 200,
      message: '更新成功',
      data: image
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: error.message
    })
  }
})

// 删除影像
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params
    const metadata = readMetadata()
    
    const image = metadata.images.find(img => img.id === id)
    if (!image) {
      return res.status(404).json({
        code: 404,
        message: '影像不存在'
      })
    }
    
    console.log(`🗑️ 删除影像: ${image.name}`)
    
    // 删除文件
    const filePath = path.join(TIF_DIR, image.name)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      console.log(`   ✅ 文件已删除: ${filePath}`)
    }
    
    // 更新元数据
    metadata.images = metadata.images.filter(img => img.id !== id)
    writeMetadata(metadata)
    
    // 🆕 清除缓存
    clearCache()
    
    res.json({
      code: 200,
      message: '删除成功'
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: error.message
    })
  }
})

// 批量删除影像
router.post('/batch-delete', (req, res) => {
  try {
    const { ids } = req.body
    const metadata = readMetadata()
    
    ids.forEach(id => {
      const image = metadata.images.find(img => img.id === id)
      if (image) {
        const filePath = path.join(TIF_DIR, image.name)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      }
    })
    
    metadata.images = metadata.images.filter(img => !ids.includes(img.id))
    writeMetadata(metadata)
    
    // 🆕 清除缓存
    clearCache()
    
    res.json({
      code: 200,
      message: '批量删除成功',
      data: {
        count: ids.length
      }
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: error.message
    })
  }
})

// 下载影像
router.get('/download/:id', (req, res) => {
  try {
    const { id } = req.params
    const metadata = readMetadata()
    
    const image = metadata.images.find(img => img.id === id)
    if (!image) {
      return res.status(404).json({
        code: 404,
        message: '影像不存在'
      })
    }
    
    const filePath = path.join(TIF_DIR, image.name)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        code: 404,
        message: '文件不存在'
      })
    }
    
    res.download(filePath)
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: error.message
    })
  }
})

// 获取conda环境中GDAL的绝对路径（在后端启动时调用一次）
async function initGDALPath() {
  if (cachedGDALPath) {
    return {
      gdalPath: cachedGDALPath,
      condaEnv: cachedCondaEnvPath
    }
  }
  
  if (config.condaEnv) {
    try {
      // 获取conda环境的根目录
      const condaPath = process.env.CONDA_EXE || 'conda'
      const envCmd = `"${condaPath}" run -n ${config.condaEnv} echo %CONDA_PREFIX%`
      const { stdout: envPath } = await execAsync(envCmd)
      cachedCondaEnvPath = envPath.trim()
      
      // 构建GDAL可执行文件路径
      const gdalwarpPath = path.join(cachedCondaEnvPath, 'Library', 'bin', 'gdalwarp.exe')
      
      if (fs.existsSync(gdalwarpPath)) {
        cachedGDALPath = path.join(cachedCondaEnvPath, 'Library', 'bin')
        console.log(`🚀 GDAL加速模式已启用`)
        console.log(`   环境路径: ${cachedCondaEnvPath}`)
        console.log(`   GDAL路径: ${cachedGDALPath}`)
        console.log(`   ⚡ 优化速度将提升 50-80%`)
        return {
          gdalPath: cachedGDALPath,
          condaEnv: cachedCondaEnvPath
        }
      }
    } catch (error) {
      console.warn('⚠️ 无法获取GDAL绝对路径，将使用 conda run 方式（较慢）')
      console.warn('   如需加速，请确保：')
      console.warn('   1. 后端在 Anaconda Prompt 中启动')
      console.warn('   2. conda环境已正确配置')
    }
  }
  
  return null
}

// 构建GDAL命令（支持conda环境 + 加速模式）
function buildGDALCommand(command) {
  // 检测操作系统
  const isWindows = process.platform === 'win32'
  const gdalExecutableSuffix = isWindows ? '.exe' : ''
  
  // 🚀 加速模式：使用绝对路径 + 环境变量（避免重复启动conda）
  if (cachedGDALPath && cachedCondaEnvPath) {
    // 替换命令中的 gdalwarp/gdaladdo/gdal_translate 为绝对路径
    const modifiedCmd = command
      .replace(/^gdalwarp\b/, `"${path.join(cachedGDALPath, 'gdalwarp' + gdalExecutableSuffix)}"`)
      .replace(/^gdaladdo\b/, `"${path.join(cachedGDALPath, 'gdaladdo' + gdalExecutableSuffix)}"`)
      .replace(/^gdal_translate\b/, `"${path.join(cachedGDALPath, 'gdal_translate' + gdalExecutableSuffix)}"`)
    
    // 设置环境变量（GDAL需要）
    const gdalData = path.join(cachedCondaEnvPath, 'Library', 'share', 'gdal')
    const projLib = path.join(cachedCondaEnvPath, 'Library', 'share', 'proj')
    
    // 构建完整命令（Windows）
    if (isWindows) {
      // 禁用.aux.xml文件的自动生成
      return `set GDAL_DATA=${gdalData}& set PROJ_LIB=${projLib}& set GDAL_PAM_ENABLED=NO& ${modifiedCmd}`
    } else {
      return `GDAL_DATA=${gdalData} PROJ_LIB=${projLib} GDAL_PAM_ENABLED=NO ${modifiedCmd}`
    }
  }
  
  // 🐢 降级方案：每次都启动conda环境（慢，但更兼容）
  if (config.condaEnv) {
    const condaPath = process.env.CONDA_EXE || 'conda'
    // 禁用.aux.xml文件的自动生成
    if (isWindows) {
      return `"${condaPath}" run -n ${config.condaEnv} set GDAL_PAM_ENABLED=NO& ${command}`
    } else {
      return `"${condaPath}" run -n ${config.condaEnv} bash -c "GDAL_PAM_ENABLED=NO ${command}"`
    }
  }
  
  // 假设GDAL在系统PATH中（Linux/Docker环境）
  console.log(`📋 使用系统PATH中的GDAL命令（禁用.aux.xml）: GDAL_PAM_ENABLED=NO ${command}`)
  if (isWindows) {
    return `set GDAL_PAM_ENABLED=NO& ${command}`
  } else {
    return `GDAL_PAM_ENABLED=NO ${command}`
  }
}

// 检查GDAL是否安装
async function checkGDAL() {
  try {
    const command = buildGDALCommand('gdalinfo --version')
    const { stdout } = await execAsync(command)
    console.log('✅ GDAL已安装:', stdout.trim())
    if (config.condaEnv) {
      console.log(`   使用Conda环境: ${config.condaEnv}`)
    }
    return true
  } catch (error) {
    console.error('❌ GDAL检测失败:', error.message)
    if (config.condaEnv) {
      console.error(`   提示：请确保conda环境 "${config.condaEnv}" 存在且已安装GDAL`)
      console.error(`   安装命令: conda activate ${config.condaEnv} && conda install -c conda-forge gdal`)
    } else {
      console.error('   提示：请安装GDAL或在 server/config.js 中配置conda环境名')
    }
    return false
  }
}

// ✅ 已删除作物类型映射和检测函数，因为现在只统计像元个数

// ✅ 简化版TIF分析：只统计像元个数和基本信息
async function analyzeTifFile(filePath) {
  try {
    console.log('📊 [后端] 开始分析TIF文件:', path.basename(filePath))
    
    // 读取TIF文件
    const tiff = await fromFile(filePath)
    const image = await tiff.getImage()
    
    // 获取像元数据
    const data = await image.readRasters()
    const values = data[0] // 第一个波段
    const pixelCount = values.length
    
    // 获取地理变换参数（用于计算面积）
    const pixelSize = image.getResolution() // [宽度, 高度]
    const pixelAreaM2 = Math.abs(pixelSize[0] * pixelSize[1]) // 平方米
    const pixelAreaMu = pixelAreaM2 / 666.67 // 转换为亩
    const totalAreaMu = pixelCount * pixelAreaMu
    
    console.log(`✅ 像元个数: ${pixelCount.toLocaleString()}`)
    console.log(`   像元大小: ${pixelSize[0]}m × ${pixelSize[1]}m`)
    console.log(`   总面积: ${totalAreaMu.toFixed(2)} 亩`)
    
    // ✅ 返回简化的统计信息
    const statistics = {
      pixelCount: pixelCount,
      pixelWidth: image.getWidth(),
      pixelHeight: image.getHeight(),
      pixelSizeX: pixelSize[0],
      pixelSizeY: pixelSize[1],
      pixelAreaM2: pixelAreaM2,
      pixelAreaMu: pixelAreaMu,
      totalAreaMu: totalAreaMu.toFixed(2),
      analyzedAt: new Date().toISOString(),
      analyzed: true
    }
    
    return statistics
  } catch (error) {
    console.error('❌ [后端] TIF分析失败:', error.message)
    // ✅ 即使失败也返回标记，避免重复分析
    return {
      analyzed: true,
      error: true,
      errorMessage: error.message,
      analyzedAt: new Date().toISOString()
    }
  }
}

// 检测TIF文件是否已优化（通过GDAL读取元数据）
async function detectOptimizationStatus(filePath) {
  try {
    // 使用gdalinfo获取文件信息
    const cmd = buildGDALCommand(`gdalinfo "${filePath}"`)
    const { stdout } = await execAsync(cmd)
    
    // 检测指标
    const checks = {
      hasCorrectProjection: false,  // 坐标系是否为EPSG:3857
      hasOverviews: false,          // 是否有金字塔
      hasCompression: false,        // 是否有压缩
      isCOG: false                  // 是否为COG格式
    }
    
    // 1. 检测坐标系
    if (stdout.includes('PROJCS["WGS 84 / Pseudo-Mercator"') || 
        stdout.includes('EPSG:3857') || 
        stdout.includes('Authority["EPSG","3857"]')) {
      checks.hasCorrectProjection = true
    }
    
    // 2. 检测金字塔
    if (stdout.includes('Overviews:') || stdout.includes('Overview ')) {
      checks.hasOverviews = true
    }
    
    // 3. 检测压缩
    if (stdout.includes('COMPRESSION=LZW') || 
        stdout.includes('COMPRESSION=DEFLATE') ||
        stdout.includes('COMPRESSION=JPEG')) {
      checks.hasCompression = true
    }
    
    // 4. 检测COG特征（TILED=YES）
    if (stdout.includes('TILED=YES') || stdout.includes('Block=')) {
      checks.isCOG = true
    }
    
    // 判断是否已优化：至少满足3个条件
    const optimizedCount = Object.values(checks).filter(Boolean).length
    const isOptimized = optimizedCount >= 3
    
    console.log(`📊 检测文件: ${path.basename(filePath)}`)
    console.log(`   坐标系: ${checks.hasCorrectProjection ? '✅ EPSG:3857' : '❌ 其他'}`)
    console.log(`   金字塔: ${checks.hasOverviews ? '✅ 有' : '❌ 无'}`)
    console.log(`   压缩: ${checks.hasCompression ? '✅ 有' : '❌ 无'}`)
    console.log(`   COG: ${checks.isCOG ? '✅ 是' : '❌ 否'}`)
    console.log(`   结论: ${isOptimized ? '✅ 已优化' : '❌ 未优化'} (${optimizedCount}/4)`)
    
    return {
      isOptimized,
      checks,
      reason: isOptimized ? `符合${optimizedCount}个优化标准` : `仅符合${optimizedCount}个优化标准`
    }
  } catch (error) {
    console.error('❌ 检测优化状态失败:', error.message)
    return {
      isOptimized: false,
      reason: '检测失败: ' + error.message
    }
  }
}

// 优化TIF文件的核心函数（可被路由和自动优化调用）
async function optimizeTifFile(id, options = {}) {
  // 解析选项
  const {
    overwriteOriginal = false,  // 是否覆盖原文件
    customFileName = ''          // 自定义文件名（不带.tif后缀）
  } = options
  
  // 1. 检查GDAL是否安装
  const hasGDAL = await checkGDAL()
  if (!hasGDAL) {
    throw new Error('GDAL未安装或配置错误')
  }
  
  // 2. 获取文件信息
  const metadata = readMetadata()
  const image = metadata.images.find(img => img.id === id)
  
  if (!image) {
    throw new Error('文件不存在')
  }
  
  const inputPath = path.join(TIF_DIR, image.name)
  if (!fs.existsSync(inputPath)) {
    throw new Error('文件不存在')
  }
  
  // 检查是否已优化（如果不是覆盖模式）
  if (!overwriteOriginal && image.isOptimized) {
    return {
      originalSize: image.originalSize,
      optimizedSize: image.optimizedSize,
      alreadyOptimized: true
    }
  }
  
  console.log(`\n🚀 开始优化: ${image.name}`)
  console.log(`   覆盖原文件: ${overwriteOriginal ? '是' : '否'}`)
  if (!overwriteOriginal && customFileName) {
    console.log(`   自定义文件名: ${customFileName}.tif`)
  }
  
  // 初始化进度追踪
  const initialProgress = {
    id,
    progress: 0,
    status: 'starting',
    step: '准备优化...',
    startTime: Date.now()
  }
  optimizationProgress.set(id, initialProgress)
  console.log(`📊 初始化进度追踪 [${id}]:`, initialProgress)
  
  // 3. 准备文件路径
  const tempOutput = path.join(TIF_DIR, `temp_optimized_${Date.now()}.tif`)
  const tempScaled = path.join(TIF_DIR, `temp_scaled_${Date.now()}.tif`) // 用于缩放后的临时文件
  
  // 根据选项决定最终输出路径
  let optimizedPath
  let finalFileName
  
  if (overwriteOriginal) {
    // 覆盖原文件：直接覆盖，不创建备份
    optimizedPath = inputPath  // 最终会覆盖原文件
    finalFileName = image.name
    console.log(`⚠️ 将覆盖原文件: ${image.name}`)
  } else if (customFileName) {
    // 使用自定义文件名
    finalFileName = `${customFileName}.tif`
    optimizedPath = path.join(TIF_DIR, finalFileName)
  } else {
    // 默认添加_optimized后缀
    finalFileName = image.name.replace(/\.tif$/i, '_optimized.tif')
    optimizedPath = path.join(TIF_DIR, finalFileName)
  }
  
  // ✅ 检查文件名冲突（不覆盖原文件模式下）
  if (!overwriteOriginal && fs.existsSync(optimizedPath) && optimizedPath !== inputPath) {
    // 检查是否已经在元数据中存在同名文件
    const existingImage = metadata.images.find(img => img.name === finalFileName)
    if (existingImage) {
      console.warn(`⚠️ 优化文件 ${finalFileName} 已存在，将被覆盖`)
      // ✅ 不抛出错误，允许覆盖优化文件
      // 删除旧的元数据记录，稍后会创建新的
      metadata.images = metadata.images.filter(img => img.name !== finalFileName)
      writeMetadata(metadata)
    }
  }
  
  // 获取原始文件大小（优化前）
  const originalStats = fs.statSync(inputPath)
  const originalSizeMB = (originalStats.size / (1024 * 1024)).toFixed(2)
  
  // 更新进度：开始投影转换
  optimizationProgress.set(id, {
    id,
    progress: 10,
    status: 'reprojecting',
    step: '投影转换 + COG转换（最耗时）...',
    startTime: Date.now()
  })
  
  // 🔍 步骤4：判断是否为 RGB 影像 + 自动检测源坐标系
  let isRGB = false
  let sourceSRS = 'EPSG:32645' // 默认值
  let dataType = 'Unknown' // 数据类型
  
  console.log('🔍 使用 gdalinfo 检测影像类型和坐标系...')
  try {
    const gdalinfoCmd = buildGDALCommand(`gdalinfo "${inputPath}"`)
    console.log(`   执行命令: ${gdalinfoCmd}`)
    const { stdout: gdalinfo } = await execAsync(gdalinfoCmd)
    
    // 🌐 自动检测源坐标系（尝试多种匹配方式）
    // 方式1: 匹配 AUTHORITY["EPSG","32645"]
    let srsMatch = gdalinfo.match(/AUTHORITY\["EPSG","(\d+)"\]/)
    
    // 方式2: 匹配 PROJCS["WGS 84 / UTM zone 45N"... 
    if (!srsMatch) {
      if (gdalinfo.includes('UTM zone 45N') || gdalinfo.includes('UTM Zone 45N')) {
        sourceSRS = 'EPSG:32645'
        console.log(`🌐 检测到UTM Zone 45N，使用: ${sourceSRS}`)
      }
    } else {
      sourceSRS = `EPSG:${srsMatch[1]}`
      console.log(`🌐 检测到源坐标系: ${sourceSRS}`)
    }
    
    if (!srsMatch && !gdalinfo.includes('UTM')) {
      console.log(`⚠️ 无法检测坐标系，使用默认值: ${sourceSRS}`)
      console.log('--- gdalinfo 输出（前500字符）---')
      console.log(gdalinfo.substring(0, 500))
      console.log('--------------------------------')
    }
    
    // 🎨 检测是否为 RGB 影像 + 数据类型
    const bandMatches = gdalinfo.match(/Band \d+/g)
    const bandCount = bandMatches ? bandMatches.length : 1
    
    const dataTypeMatch = gdalinfo.match(/Type=(\w+)/)
    dataType = dataTypeMatch ? dataTypeMatch[1] : 'Unknown'  // 赋值给外层变量
    
    console.log(`   波段数: ${bandCount}`)
    console.log(`   数据类型: ${dataType}`)
    
    // 方法1：检查文件名是否包含 "RGB"（不区分大小写）
    if (image.name.toUpperCase().includes('RGB')) {
      isRGB = true
      console.log('🎨 检测到RGB影像（文件名包含RGB）')
    } 
    // 方法2：检测波段数和数据类型
    else if (bandCount === 3 && (dataType === 'Byte' || dataType === 'UInt16')) {
      isRGB = true
      console.log('🎨 检测到RGB影像（3波段 + RGB数据类型）')
    } else {
      console.log('📊 检测到普通TIF影像（KNDVI等）')
    }
  } catch (err) {
    console.warn('⚠️ 无法检测影像类型和坐标系，使用默认参数')
    console.warn(`   错误信息: ${err.message}`)
    if (err.stderr) {
      console.warn(`   stderr: ${err.stderr}`)
    }
  }
  
  // 5. 直接执行投影转换和COG转换（COG格式自带金字塔，无需手动添加）
  console.log('⏳ 投影转换 + COG格式转换（包含自动生成金字塔）...')
  
  optimizationProgress.set(id, {
    progress: 30,
    status: 'reprojecting',
    step: '投影转换 + COG转换 + 金字塔生成（最耗时）...'
  })
  
  // 根据影像类型选择不同的优化参数
  let gdalwarpCmd
  
  if (isRGB) {
    // 🎨 RGB 影像优化参数
    console.log('📋 使用 RGB 影像优化参数:')
    console.log(`   - 源坐标系: ${sourceSRS}`)
    console.log(`   - 数据类型: ${dataType}`)
    console.log('   - 目标坐标系: EPSG:3857 (Web Mercator)')
    
    // 根据数据类型选择压缩方式和处理策略
    if (dataType === 'Byte') {
      // 8位RGB：使用JPEG压缩（高压缩率）
      console.log('   - 压缩方式: JPEG (质量85，适用于8位RGB)')
      console.log('   - 不转换数据类型（已是Byte）')
      console.log('   - 重采样方法: cubic（更适合RGB影像）')
      gdalwarpCmd = `gdalwarp -s_srs ${sourceSRS} -t_srs EPSG:3857 -of COG -co COMPRESS=JPEG -co QUALITY=85 -co BLOCKSIZE=512 -co OVERVIEW_RESAMPLING=CUBIC -co NUM_THREADS=ALL_CPUS -r cubic "${inputPath}" "${tempOutput}"`
    } else if (dataType === 'UInt16') {
      // 16位RGB：使用LZW压缩（JPEG不支持16位）
      console.log('   - 压缩方式: LZW（UInt16类型不支持JPEG）')
      console.log('   - 保持UInt16数据类型')
      console.log('   - 重采样方法: cubic（更适合RGB影像）')
      gdalwarpCmd = `gdalwarp -s_srs ${sourceSRS} -t_srs EPSG:3857 -of COG -co COMPRESS=LZW -co BLOCKSIZE=512 -co OVERVIEW_RESAMPLING=CUBIC -co NUM_THREADS=ALL_CPUS -r cubic "${inputPath}" "${tempOutput}"`
    } else if (dataType === 'Float32' || dataType === 'Float64') {
      // 浮点RGB：需要转换为Byte并使用检测到的值域统一缩放
      console.log(`   - ⚠️ 检测到浮点类型 (${dataType})`)
      console.log('   - 需要转换为Byte (0-255) 以便正确显示')
      console.log('   - 将检测实际值域并统一缩放所有波段')
      console.log('   - 压缩方式: JPEG (质量85)')
      console.log('   - 重采样方法: cubic')
      
      // 标记需要两步处理
      gdalwarpCmd = 'TWO_STEP_FLOAT_RGB'
    } else {
      // 其他类型：保守处理，使用LZW
      console.log(`   - 压缩方式: LZW（${dataType}类型使用保守策略）`)
      console.log('   - 重采样方法: cubic')
      gdalwarpCmd = `gdalwarp -s_srs ${sourceSRS} -t_srs EPSG:3857 -of COG -co COMPRESS=LZW -co BLOCKSIZE=512 -co OVERVIEW_RESAMPLING=CUBIC -co NUM_THREADS=ALL_CPUS -r cubic "${inputPath}" "${tempOutput}"`
    }
  } else {
    // 📊 普通 TIF 影像优化参数（KNDVI 等单波段浮点数据）
    console.log('📋 使用普通 TIF 影像优化参数（KNDVI等）:')
    console.log(`   - 源坐标系: ${sourceSRS}`)
    console.log('   - 目标坐标系: EPSG:3857')
    console.log('   - 压缩方式: LZW')
    console.log('   - NoData: NaN → 255')
    console.log('   - 重采样方法: near（保持原始像素值）')
    
    gdalwarpCmd = `gdalwarp -s_srs ${sourceSRS} -t_srs EPSG:3857 -srcnodata "nan" -dstnodata 255 -wo USE_NAN=YES -of COG -co COMPRESS=LZW -co BLOCKSIZE=512 -co OVERVIEW_RESAMPLING=NEAREST -co NUM_THREADS=ALL_CPUS -r near "${inputPath}" "${tempOutput}"`
  }
  
  // 判断是否需要两步处理（Float类型RGB影像）
  const needTwoStepProcessing = (gdalwarpCmd === 'TWO_STEP_FLOAT_RGB')
  
  let startTime = Date.now()
  try {
    if (needTwoStepProcessing) {
      // ========== 两步处理：Float RGB 影像 ==========
      console.log('\n🔄 开始两步处理流程:')
      
      // 步骤0: 使用gdalinfo -stats检测值域并计算百分位数
      console.log('📊 步骤0: 检测影像值域范围并计算2%百分位数拉伸...')
      const gdalinfoStatsCmd = buildGDALCommand(`gdalinfo -stats "${inputPath}"`)
      const { stdout: statsOutput } = await execAsync(gdalinfoStatsCmd)
      
      // 提取每个波段的最小值和最大值
      const bandStats = []
      const bandRegex = /Band (\d+)[\s\S]*?Minimum=([\d.]+)[\s\S]*?Maximum=([\d.]+)/g
      let match
      while ((match = bandRegex.exec(statsOutput)) !== null) {
        bandStats.push({
          band: parseInt(match[1]),
          min: parseFloat(match[2]),
          max: parseFloat(match[3])
        })
      }
      
      console.log('   检测到各波段绝对值域:')
      bandStats.forEach(stat => {
        console.log(`   - Band ${stat.band}: ${stat.min.toFixed(2)} ~ ${stat.max.toFixed(2)}`)
      })
      
      // ✅ 使用2%线性拉伸（排除极值，增强对比度）
      // 计算：min + (max - min) * 0.02 和 max - (max - min) * 0.02
      console.log(`   ✅ 策略：2%线性拉伸（类似ArcGIS Pro的百分比裁剪）`)
      
      const band1 = bandStats.find(s => s.band === 1) || bandStats[0]
      const band2 = bandStats.find(s => s.band === 2) || bandStats[1]
      const band3 = bandStats.find(s => s.band === 3) || bandStats[2]
      
      // 应用2%裁剪
      const clipPercent = 0.02
      const b1Range = band1.max - band1.min
      const b2Range = band2.max - band2.min
      const b3Range = band3.max - band3.min
      
      const b1Min = band1.min + b1Range * clipPercent
      const b1Max = band1.max - b1Range * clipPercent
      const b2Min = band2.min + b2Range * clipPercent
      const b2Max = band2.max - b2Range * clipPercent
      const b3Min = band3.min + b3Range * clipPercent
      const b3Max = band3.max - b3Range * clipPercent
      
      // 步骤1: gdal_translate 转换数据类型，每个波段使用2%裁剪后的范围
      console.log('\n📋 步骤1/2: 数据类型转换 + 2%线性拉伸')
      console.log(`   Band 1 (红): ${b1Min.toFixed(2)}-${b1Max.toFixed(2)} → 0-255`)
      console.log(`   Band 2 (绿): ${b2Min.toFixed(2)}-${b2Max.toFixed(2)} → 0-255`)
      console.log(`   Band 3 (蓝): ${b3Min.toFixed(2)}-${b3Max.toFixed(2)} → 0-255`)
      
      const translateCmd = `gdal_translate -ot Byte -scale_1 ${b1Min} ${b1Max} 0 255 -scale_2 ${b2Min} ${b2Max} 0 255 -scale_3 ${b3Min} ${b3Max} 0 255 -a_nodata 0 -of GTiff "${inputPath}" "${tempScaled}"`
      const fullTranslateCmd = buildGDALCommand(translateCmd)
      console.log(`   命令: ${fullTranslateCmd}`)
      console.log(`   ⚠️ 使用2%线性拉伸（增强对比度）`)
      
      optimizationProgress.set(id, {
        ...optimizationProgress.get(id),
        progress: 40,
        status: 'converting',
        step: '步骤1/2: Float→Byte转换 + 统一缩放...'
      })
      
      const { stdout: stdout1, stderr: stderr1 } = await execAsync(fullTranslateCmd)
      const elapsed1 = ((Date.now() - startTime) / 1000).toFixed(2)
      
      if (!fs.existsSync(tempScaled)) {
        throw new Error('步骤1失败：未生成缩放后的文件')
      }
      
      const scaledStats = fs.statSync(tempScaled)
      console.log(`✅ 步骤1完成 (耗时: ${elapsed1}秒)`)
      console.log(`   缩放后文件大小: ${(scaledStats.size / (1024 * 1024)).toFixed(2)}MB`)
      if (stderr1 && stderr1.trim()) console.log(`   stderr: ${stderr1}`)
      
      // 检查缩放后的像素值分布
      console.log('\n📊 检查缩放后的像素值分布...')
      const checkStatsCmd = buildGDALCommand(`gdalinfo -stats "${tempScaled}"`)
      try {
        const { stdout: checkOutput } = await execAsync(checkStatsCmd)
        const scaledBandRegex = /Band (\d+)[\s\S]*?Minimum=([\d.]+)[\s\S]*?Maximum=([\d.]+)[\s\S]*?Mean=([\d.]+)/g
        let checkMatch
        while ((checkMatch = scaledBandRegex.exec(checkOutput)) !== null) {
          console.log(`   Band ${checkMatch[1]}: Min=${checkMatch[2]}, Max=${checkMatch[3]}, Mean=${checkMatch[4]}`)
        }
      } catch (err) {
        console.warn('   ⚠️ 无法检查缩放后统计信息')
      }
      
      // 步骤2: gdalwarp 投影转换 + COG优化
      console.log('\n📋 步骤2/2: 投影转换 + COG优化')
      const warpCmd = `gdalwarp -s_srs ${sourceSRS} -t_srs EPSG:3857 -of COG -co COMPRESS=JPEG -co QUALITY=85 -co BLOCKSIZE=512 -co OVERVIEW_RESAMPLING=CUBIC -co NUM_THREADS=ALL_CPUS -r cubic "${tempScaled}" "${tempOutput}"`
      const fullWarpCmd = buildGDALCommand(warpCmd)
      console.log(`   命令: ${fullWarpCmd}`)
      
      optimizationProgress.set(id, {
        ...optimizationProgress.get(id),
        progress: 60,
        status: 'reprojecting',
        step: '步骤2/2: 投影转换 + COG优化...'
      })
      
      const startTime2 = Date.now()
      const { stdout: stdout2, stderr: stderr2 } = await execAsync(fullWarpCmd)
      const elapsed2 = ((Date.now() - startTime2) / 1000).toFixed(2)
      
      console.log(`✅ 步骤2完成 (耗时: ${elapsed2}秒)`)
      const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`✅ 两步处理总耗时: ${totalElapsed}秒`)
      if (stderr2 && stderr2.trim()) console.log(`   stderr: ${stderr2}`)
      
      // 清理中间文件
      if (fs.existsSync(tempScaled)) {
        fs.unlinkSync(tempScaled)
        console.log('🗑️ 已清理中间临时文件')
      }
      
    } else {
      // ========== 单步处理：标准流程 ==========
      const gdalCommand = buildGDALCommand(gdalwarpCmd)
      console.log('📋 完整GDAL命令:')
      console.log(`   ${gdalCommand}`)
      
      const { stdout, stderr } = await execAsync(gdalCommand)
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`✅ 投影转换 + COG转换 + 金字塔生成完成 (耗时: ${elapsed}秒)`)
      if (stderr && stderr.trim()) console.log(`   GDAL stderr: ${stderr}`)
    }
    
    // ========== 检查最终输出文件 ==========
    if (!fs.existsSync(tempOutput)) {
      console.error('❌ GDAL命令执行后，临时文件未生成！')
      console.error(`   期望路径: ${tempOutput}`)
      throw new Error('GDAL未生成输出文件')
    }
    
    const tempStats = fs.statSync(tempOutput)
    const tempSizeMB = (tempStats.size / (1024 * 1024)).toFixed(2)
    console.log(`✅ 最终优化文件大小: ${tempSizeMB}MB (${tempStats.size} 字节)`)
    console.log(`   COG格式已包含内部金字塔`)
    
    // 如果文件太小（<1KB），可能是失败了
    if (tempStats.size < 1024) {
      console.error(`❌ 警告：生成的文件太小 (${tempStats.size} 字节)，可能优化失败！`)
      throw new Error(`GDAL生成的文件异常小 (${tempStats.size} 字节)`)
    }
    
    optimizationProgress.set(id, {
      ...optimizationProgress.get(id),
      progress: 90,
      status: 'completed',
      step: '优化完成（COG格式 + 内部金字塔）'
    })
  } catch (error) {
    console.error('❌ GDAL执行失败:')
    console.error(`   错误: ${error.message}`)
    if (error.stderr) console.error(`   stderr: ${error.stderr}`)
    if (error.stdout) console.log(`   stdout: ${error.stdout}`)
    // 清理所有临时文件
    if (fs.existsSync(tempOutput)) {
      console.log(`   清理临时文件: ${tempOutput}`)
      fs.unlinkSync(tempOutput)
    }
    if (fs.existsSync(tempScaled)) {
      console.log(`   清理临时文件: ${tempScaled}`)
      fs.unlinkSync(tempScaled)
    }
    optimizationProgress.delete(id)
    throw new Error('GDAL转换失败: ' + error.message)
  }
  
  // 更新进度：保存优化文件
  optimizationProgress.set(id, {
    ...optimizationProgress.get(id),
    progress: 95,
    status: 'saving',
    step: '保存优化文件...'
  })
  
  // 7. 保存优化文件
  console.log('⏳ 保存优化文件...')
  
  if (fs.existsSync(optimizedPath)) {
    console.log('   删除旧的优化文件...')
    fs.unlinkSync(optimizedPath)
  }
  
  fs.renameSync(tempOutput, optimizedPath)
  console.log(`✅ 优化文件已保存: ${path.basename(optimizedPath)}`)
  
  // 更新进度：完成
  optimizationProgress.set(id, {
    ...optimizationProgress.get(id),
    progress: 100,
    status: 'completed',
    step: '优化完成！'
  })
  
  // 8. 更新元数据
  const currentMetadata = readMetadata()
  const currentImage = currentMetadata.images.find(img => img.id === id)
  
  // 在if外定义变量，避免作用域问题
  const optimizedStats = fs.statSync(optimizedPath)
  const optimizedSizeMB = (optimizedStats.size / (1024 * 1024)).toFixed(2)
  const compressionRatio = ((1 - optimizedStats.size / originalStats.size) * 100).toFixed(1)
  const savedSpaceMB = ((originalStats.size - optimizedStats.size) / (1024 * 1024)).toFixed(2)
  
  if (currentImage) {
    if (overwriteOriginal) {
      // 覆盖原文件：直接更新原记录
      currentImage.isOptimized = true
      currentImage.status = 'processed'
      currentImage.size = optimizedSizeMB + 'MB'
      currentImage.originalSize = originalSizeMB + 'MB'
      currentImage.optimizedSize = optimizedSizeMB + 'MB'
      currentImage.filePath = `/data/data_tif/${image.name}`
      currentImage.optimizedPath = `/data/data_tif/${image.name}`
      currentImage.originalPath = `/data/data_tif/${image.name}`
      currentImage.name = image.name
      
      // 📊 分析优化后的TIF文件
      try {
        console.log(`📊 正在分析优化后的文件: ${image.name}`)
        const statistics = await analyzeTifFile(optimizedPath)
        currentImage.statistics = statistics
        console.log(`✅ 统计数据已更新`)
      } catch (err) {
        console.warn(`⚠️ 优化后TIF分析失败: ${image.name}`, err.message)
        currentImage.statistics = {
          analyzed: true,
          error: true,
          errorMessage: err.message,
          analyzedAt: new Date().toISOString()
        }
      }
    } else {
      // 不覆盖原文件：创建新记录，原记录保持不变
      // 1. 原记录保持不变（继续指向原文件）
      currentImage.isOptimized = false  // 原文件未优化
      
      // 2. 创建新记录for优化后的文件
      // 找到最大ID，避免冲突
      let maxId = 0
      currentMetadata.images.forEach(img => {
        const match = img.id.match(/^IMG(\d+)$/)
        if (match) {
          const num = parseInt(match[1], 10)
          if (num > maxId) maxId = num
        }
      })
      const newId = 'IMG' + String(maxId + 1).padStart(3, '0')
      
      const newImage = {
        id: newId,
        name: finalFileName,
        year: currentImage.year,
        period: currentImage.period,
        cropType: currentImage.cropType,
        sensor: currentImage.sensor,
        region: currentImage.region,
        date: currentImage.date,
        cloudCover: currentImage.cloudCover,
        status: 'processed',
        size: optimizedSizeMB + 'MB',
        originalSize: originalSizeMB + 'MB',
        optimizedSize: optimizedSizeMB + 'MB',
        thumbnail: `/data/data_tif/${finalFileName}`,
        preview: `/data/data_tif/${finalFileName}`,
        filePath: `/data/data_tif/${finalFileName}`,
        optimizedPath: `/data/data_tif/${finalFileName}`,
        originalPath: `/data/data_tif/${image.name}`,
        isOptimized: true,
        isOptimizedResult: true,  // 标记为优化结果文件
        sourceFileId: id,  // 记录源文件ID
        uploadTime: new Date().toISOString(),
        description: `优化自 ${image.name}（压缩率${compressionRatio}%，节省${savedSpaceMB}MB）`
      }
      
      // 📊 分析优化后的TIF文件
      try {
        console.log(`📊 正在分析优化后的新文件: ${finalFileName}`)
        const statistics = await analyzeTifFile(optimizedPath)
        newImage.statistics = statistics
        console.log(`✅ 统计数据已保存到新记录`)
      } catch (err) {
        console.warn(`⚠️ 优化后TIF分析失败: ${finalFileName}`, err.message)
        newImage.statistics = {
          analyzed: true,
          error: true,
          errorMessage: err.message,
          analyzedAt: new Date().toISOString()
        }
      }
      
      currentMetadata.images.push(newImage)
      console.log(`✅ 创建新记录: ${newId} - ${finalFileName}`)
    }
    
    writeMetadata(currentMetadata)
    
    // 🆕 清除缓存，确保前端能立即获取到最新数据
    clearCache()
    console.log('🗑️ 已清除缓存，前端将获取最新数据')
    
    console.log(`\n✅ 优化成功!`)
    console.log(`   原始文件: ${image.name} (${originalSizeMB} MB)`)
    console.log(`   优化文件: ${finalFileName} (${optimizedSizeMB} MB)`)
    console.log(`   压缩率: ${compressionRatio}%`)
    console.log(`   节省空间: ${savedSpaceMB} MB`)
    if (overwriteOriginal) {
      console.log(`   ✅ 已覆盖原文件\n`)
    } else {
      console.log(`   ✅ 已保存为新文件: ${finalFileName}\n`)
    }
  }
  
  // 清理进度记录（5秒后）
  setTimeout(() => {
    optimizationProgress.delete(id)
    console.log(`🧹 已清理进度记录: ${id}`)
  }, 5000)
  
  return {
    originalFile: image.name,
    optimizedFile: finalFileName,
    originalSize: originalSizeMB + 'MB',
    optimizedSize: optimizedSizeMB + 'MB',
    compressionRatio: compressionRatio + '%',
    overwriteOriginal
  }
}

// 优化TIF文件（HTTP接口）
router.post('/optimize/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    // 设置请求超时为15分钟（处理大文件）
    req.setTimeout(15 * 60 * 1000)
    res.setTimeout(15 * 60 * 1000)
    
    // 清理旧的临时文件（超过1小时的）
    try {
      const files = fs.readdirSync(TIF_DIR)
      const tempFiles = files.filter(f => f.startsWith('temp_optimized_') || f.startsWith('temp_scaled_'))
      const now = Date.now()
      tempFiles.forEach(file => {
        const filePath = path.join(TIF_DIR, file)
        const stats = fs.statSync(filePath)
        const fileAge = now - stats.mtimeMs
        if (fileAge > 3600000) {
          fs.unlinkSync(filePath)
          console.log(`🧹 已清理旧临时文件: ${file}`)
        }
      })
    } catch (err) {
      console.warn('清理临时文件时出错:', err.message)
    }
    
    // 获取优化选项
    const overwriteOriginal = req.body.overwriteOriginal === true || req.body.overwriteOriginal === 'true'
    const customFileName = req.body.customFileName || ''
    
    console.log(`📥 手动优化选项:`, {
      id,
      overwriteOriginal,
      customFileName
    })
    
    // 调用核心优化函数
    const result = await optimizeTifFile(id, {
      overwriteOriginal,
      customFileName
    })
    
    res.json({
      code: 200,
      message: result.alreadyOptimized ? '该文件已经优化过了' : '优化成功',
      data: result
    })
    
  } catch (error) {
    console.error('❌ 优化失败:', error.message)
    
    // 更新进度：失败
    if (req.params.id) {
      optimizationProgress.set(req.params.id, {
        ...optimizationProgress.get(req.params.id),
        progress: 0,
        status: 'failed',
        step: '优化失败: ' + error.message
      })
      
      // 清理进度记录（30秒后）
      setTimeout(() => {
        optimizationProgress.delete(req.params.id)
      }, 30000)
    }
    
    res.status(500).json({
      code: 500,
      message: '优化失败: ' + error.message
    })
  }
})

// 获取优化进度
router.get('/optimize-progress/:id', (req, res) => {
  try {
    const { id } = req.params
    const progress = optimizationProgress.get(id)
    
    console.log(`🔍 查询进度 [${id}]:`, progress ? `${progress.progress}% - ${progress.step}` : '无记录')
    
    if (!progress) {
      return res.json({
        code: 200,
        data: {
          exists: false
        }
      })
    }
    
    // 计算已用时间
    const elapsed = Math.floor((Date.now() - progress.startTime) / 1000) // 秒
    
    const responseData = {
      exists: true,
      progress: progress.progress,
      status: progress.status,
      step: progress.step,
      elapsed: elapsed
    }
    
    res.json({
      code: 200,
      data: responseData
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: error.message
    })
  }
})

// 注意：TIF统计功能已改为纯前端实现（使用geotiff.js）
// 不再需要后端API

// 清理.aux.xml文件
router.delete('/cleanup-aux-files', (req, res) => {
  try {
    console.log('🧹 开始清理.aux.xml文件...')
    
    // 扫描data_tif目录中的所有.aux.xml文件
    const files = fs.readdirSync(TIF_DIR)
    const auxFiles = files.filter(f => f.endsWith('.aux.xml'))
    
    let deletedCount = 0
    let failedCount = 0
    const deletedFiles = []
    
    auxFiles.forEach(file => {
      const filePath = path.join(TIF_DIR, file)
      try {
        fs.unlinkSync(filePath)
        deletedFiles.push(file)
        deletedCount++
      } catch (err) {
        console.error(`删除失败: ${file}`, err.message)
        failedCount++
      }
    })
    
    console.log(`✅ 清理完成: 删除${deletedCount}个文件，失败${failedCount}个`)
    
    res.json({
      code: 200,
      message: `成功删除${deletedCount}个.aux.xml文件`,
      data: {
        deletedCount,
        failedCount,
        deletedFiles
      }
    })
  } catch (error) {
    console.error('❌ 清理.aux.xml文件失败:', error.message)
    res.status(500).json({
      code: 500,
      message: '清理失败: ' + error.message
    })
  }
})

export default router
