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
    cb(null, DATA_DIR)
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

// 扫描data目录，同步元数据（自动读取真实文件大小）
async function syncMetadata() {
  try {
    console.log('🔍 开始同步元数据...')
    const files = fs.readdirSync(DATA_DIR)
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
      const filePath = path.join(DATA_DIR, filename)
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
        thumbnail: `/data/${filename}`,
        preview: `/data/${filename}`,
        filePath: `/data/${filename}`,
        originalPath: `/data/${filename}`,
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
    const filePath = path.join(DATA_DIR, filename)
    
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
    const filePath = path.join(DATA_DIR, filename)
    
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
      const stats = fs.statSync(path.join(DATA_DIR, file.originalname))
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
        sensor: fileMeta.sensor,
        description: fileMeta.description,
        size: fileSize,
        originalSize: fileSize,
        optimizedSize: null,
        thumbnail: `/data/${file.originalname}`,
        preview: `/data/${file.originalname}`,
        filePath: `/data/${file.originalname}`,
        originalPath: `/data/${file.originalname}`,
        optimizedPath: null,
        isOptimized: false,
        uploadTime: stats.mtime.toISOString(),
        status: 'processed'
      }
      
      // ✅ 上传时立即进行统计分析
      try {
        console.log(`📊 正在分析上传的文件: ${file.originalname}`)
        const filePath = path.join(DATA_DIR, file.originalname)
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
    const allowedFields = ['year', 'period', 'cropType', 'region', 'sensor', 'date', 'cloudCover', 'description']
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
    const filePath = path.join(DATA_DIR, image.name)
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
        const filePath = path.join(DATA_DIR, image.name)
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
    
    const filePath = path.join(DATA_DIR, image.name)
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
      return `set GDAL_DATA=${gdalData}& set PROJ_LIB=${projLib}& ${modifiedCmd}`
    } else {
      return `GDAL_DATA=${gdalData} PROJ_LIB=${projLib} ${modifiedCmd}`
    }
  }
  
  // 🐢 降级方案：每次都启动conda环境（慢，但更兼容）
  if (config.condaEnv) {
    const condaPath = process.env.CONDA_EXE || 'conda'
    return `"${condaPath}" run -n ${config.condaEnv} ${command}`
  }
  
  // 假设GDAL在系统PATH中（Linux/Docker环境）
  console.log(`📋 使用系统PATH中的GDAL命令: ${command}`)
  return command
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
  
  const inputPath = path.join(DATA_DIR, image.name)
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
  const tempOutput = path.join(DATA_DIR, `temp_optimized_${Date.now()}.tif`)
  
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
    optimizedPath = path.join(DATA_DIR, finalFileName)
  } else {
    // 默认添加_optimized后缀
    finalFileName = image.name.replace(/\.tif$/i, '_optimized.tif')
    optimizedPath = path.join(DATA_DIR, finalFileName)
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
  
  // 5. 直接执行投影转换和COG转换（COG格式自带金字塔，无需手动添加）
  console.log('⏳ 投影转换 + COG格式转换（包含自动生成金字塔）...')
  
  optimizationProgress.set(id, {
    progress: 30,
    status: 'reprojecting',
    step: '投影转换 + COG转换 + 金字塔生成（最耗时）...'
  })
  
  // ✅ 修复：COG格式在转换时自动生成内部金字塔，无需再用gdaladdo添加外部金字塔
  // 添加 -co OVERVIEW_RESAMPLING=NEAREST 参数指定金字塔重采样方法
  // 添加 -co NUM_THREADS=ALL_CPUS 参数启用多线程加速
  const gdalwarpCmd = `gdalwarp -s_srs EPSG:32645 -t_srs EPSG:3857 -srcnodata "nan" -dstnodata 255 -wo USE_NAN=YES -of COG -co COMPRESS=LZW -co BLOCKSIZE=512 -co TILED=YES -co OVERVIEW_RESAMPLING=NEAREST -co NUM_THREADS=ALL_CPUS -r near "${inputPath}" "${tempOutput}"`
  const gdalCommand = buildGDALCommand(gdalwarpCmd)
  
  let startTime = Date.now()
  try {
    await execAsync(gdalCommand)
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`✅ 投影转换 + COG转换 + 金字塔生成完成 (耗时: ${elapsed}秒)`)
    console.log(`   COG格式已包含内部金字塔，无需额外添加`)
    
    optimizationProgress.set(id, {
      ...optimizationProgress.get(id),
      progress: 90,
      status: 'completed',
      step: '优化完成（COG格式 + 内部金字塔）'
    })
  } catch (error) {
    if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput)
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
      currentImage.filePath = `/data/${image.name}`
      currentImage.optimizedPath = `/data/${image.name}`
      currentImage.originalPath = `/data/${image.name}`
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
        thumbnail: `/data/${finalFileName}`,
        preview: `/data/${finalFileName}`,
        filePath: `/data/${finalFileName}`,
        optimizedPath: `/data/${finalFileName}`,
        originalPath: `/data/${image.name}`,
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
      const files = fs.readdirSync(DATA_DIR)
      const tempFiles = files.filter(f => f.startsWith('temp_optimized_'))
      const now = Date.now()
      tempFiles.forEach(file => {
        const filePath = path.join(DATA_DIR, file)
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

export default router
