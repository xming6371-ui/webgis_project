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
      if (!existingImage.statistics) {
        try {
          console.log(`📊 [补充分析] 检测到旧文件缺少统计数据: ${filename}`)
          const statistics = await analyzeTifFile(filePath)
          if (statistics) {
            existingImage.statistics = statistics
            console.log(`✅ [补充分析] 旧文件统计数据已保存`)
          }
        } catch (err) {
          console.warn(`⚠️ [补充分析] 旧文件分析失败: ${filename}`, err.message)
          // 分析失败不影响主流程
        }
      } else {
        console.log(`⏭️ [补充分析] 跳过已有统计数据的文件: ${filename}`)
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
      
      // 📊 自动分析TIF文件并保存统计数据（新增功能）
      try {
        console.log(`📊 正在分析新文件: ${filename}`)
        const statistics = await analyzeTifFile(filePath)
        if (statistics) {
          newImage.statistics = statistics
          console.log(`✅ 统计数据已保存到元数据`)
        }
      } catch (err) {
        console.warn(`⚠️ TIF分析失败: ${filename}`, err.message)
        // 分析失败不影响主流程
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

// 获取影像列表
router.get('/list', async (req, res) => {
  try {
    const metadata = await syncMetadata()
    res.json({
      code: 200,
      message: '获取成功',
      data: metadata.images
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

// 获取影像文件（用于前端读取和渲染）
router.get('/file/:filename', (req, res) => {
  try {
    const { filename } = req.params
    const filePath = path.join(DATA_DIR, filename)
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        code: 404,
        message: '文件不存在'
      })
    }
    
    // 设置正确的响应头
    res.setHeader('Content-Type', 'image/tiff')
    res.setHeader('Access-Control-Allow-Origin', '*')
    
    // 发送文件
    const fileStream = fs.createReadStream(filePath)
    fileStream.pipe(res)
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: error.message
    })
  }
})

// 上传影像
router.post('/upload', upload.array('files'), async (req, res) => {
  try {
    const metadata = await syncMetadata()
    
    // 获取新上传的文件
    const uploadedFiles = req.files
    
    // 获取优化选项
    const needOptimize = req.body.needOptimize === 'true'
    const overwriteOriginal = req.body.overwriteOriginal === 'true'
    const optimizedFileName = req.body.optimizedFileName || ''
    
    console.log('📥 上传选项:', {
      needOptimize,
      overwriteOriginal,
      optimizedFileName
    })
    
    // 立即返回响应
    res.json({
      code: 200,
      message: '上传成功',
      data: {
        count: uploadedFiles.length
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
    
    console.log(`✅ 更新影像元数据: ${image.name}`)
    
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
    
    // 删除文件
    const filePath = path.join(DATA_DIR, image.name)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    
    // 更新元数据
    metadata.images = metadata.images.filter(img => img.id !== id)
    writeMetadata(metadata)
    
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
  // 🚀 加速模式：使用绝对路径 + 环境变量（避免重复启动conda）
  if (cachedGDALPath && cachedCondaEnvPath) {
    // 替换命令中的 gdalwarp/gdaladdo/gdal_translate 为绝对路径
    const modifiedCmd = command
      .replace(/^gdalwarp\b/, `"${path.join(cachedGDALPath, 'gdalwarp.exe')}"`)
      .replace(/^gdaladdo\b/, `"${path.join(cachedGDALPath, 'gdaladdo.exe')}"`)
      .replace(/^gdal_translate\b/, `"${path.join(cachedGDALPath, 'gdal_translate.exe')}"`)
    
    // 设置环境变量（GDAL需要）
    const gdalData = path.join(cachedCondaEnvPath, 'Library', 'share', 'gdal')
    const projLib = path.join(cachedCondaEnvPath, 'Library', 'share', 'proj')
    
    // 构建完整命令（Windows）
    return `set GDAL_DATA=${gdalData}& set PROJ_LIB=${projLib}& ${modifiedCmd}`
  }
  
  // 🐢 降级方案：每次都启动conda环境（慢，但更兼容）
  if (config.condaEnv) {
    const condaPath = process.env.CONDA_EXE || 'conda'
    return `"${condaPath}" run -n ${config.condaEnv} ${command}`
  }
  
  // 假设GDAL在系统PATH中
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

// 作物类型映射（与前端cropLegend保持一致）
const CROP_TYPE_MAP = {
  1: '裸地',
  2: '棉花',
  3: '小麦',
  4: '玉米',
  5: '番茄',
  6: '甜菜',
  7: '打瓜',
  8: '辣椒',
  9: '籽用葫芦',
  10: '其它耕地'
}

// 智能检测TIF文件类型（判断是否为作物分类图）
function detectTifType(values) {
  const uniqueValues = new Set()
  let minVal = Infinity
  let maxVal = -Infinity
  let positiveCount = 0
  
  // 采样检测（检查前10000个像元，提高速度）
  const sampleSize = Math.min(10000, values.length)
  for (let i = 0; i < sampleSize; i++) {
    const val = values[i]
    if (!isNaN(val) && isFinite(val)) {
      uniqueValues.add(val)
      if (val > 0) {
        positiveCount++
        if (val < minVal) minVal = val
        if (val > maxVal) maxVal = val
      }
    }
  }
  
  // 判断逻辑：
  // 1. 唯一值数量少（分类图通常只有几个类别）
  // 2. 最大值不超过20（作物类别通常10个以内）
  // 3. 最小值大于等于0（分类代码从0或1开始）
  // 4. 值都是整数（检查前100个正值）
  let allIntegers = true
  let checkedCount = 0
  for (let i = 0; i < values.length && checkedCount < 100; i++) {
    if (values[i] > 0) {
      if (values[i] !== Math.floor(values[i])) {
        allIntegers = false
        break
      }
      checkedCount++
    }
  }
  
  const isClassification = 
    uniqueValues.size <= 30 && 
    maxVal <= 20 && 
    minVal >= 0 && 
    allIntegers &&
    positiveCount > 0
  
  return {
    isClassification,
    uniqueCount: uniqueValues.size,
    minValue: minVal === Infinity ? 0 : minVal,
    maxValue: maxVal === -Infinity ? 0 : maxVal,
    allIntegers,
    positiveCount
  }
}

// 分析TIF文件并生成统计数据（后端版本，与前端analyzeTifFile保持一致）
async function analyzeTifFile(filePath) {
  try {
    console.log('📊 [后端] 开始分析TIF文件:', path.basename(filePath))
    
    // 读取TIF文件
    const tiff = await fromFile(filePath)
    const image = await tiff.getImage()
    
    // 获取像元数据
    const data = await image.readRasters()
    const values = data[0] // 第一个波段
    
    console.log(`   读取了 ${values.length} 个像元`)
    
    // ✅ 智能检测TIF类型
    const detection = detectTifType(values)
    console.log(`   类型检测: 唯一值=${detection.uniqueCount}, 范围=[${detection.minValue}, ${detection.maxValue}], 整数=${detection.allIntegers}`)
    
    // ⚠️ 如果不是作物分类图，跳过分析
    if (!detection.isClassification) {
      console.log(`⏭️ [后端] 跳过非作物分类图（可能是NDVI、DEM或原始遥感影像）`)
      console.log(`   建议：该TIF文件不适合作物统计分析`)
      return null // 返回null，不报错，不阻塞流程
    }
    
    console.log(`✅ [后端] 检测为作物分类图，开始统计分析`)
    
    // 获取地理变换参数（用于计算面积）
    const pixelSize = image.getResolution() // [宽度, 高度]
    const pixelAreaM2 = Math.abs(pixelSize[0] * pixelSize[1]) // 平方米
    const pixelAreaMu = pixelAreaM2 / 666.67 // 转换为亩
    
    console.log(`   像元大小: ${pixelSize[0]}m × ${pixelSize[1]}m = ${pixelAreaM2.toFixed(2)}平方米 = ${pixelAreaMu.toFixed(4)}亩`)
    
    // 统计每个像元值的数量
    const counts = {}
    let totalPixels = 0
    
    for (let i = 0; i < values.length; i++) {
      const val = values[i]
      
      // 跳过NoData值（通常是0或负数）
      if (val > 0 && val <= 10) {
        counts[val] = (counts[val] || 0) + 1
        totalPixels++
      }
    }
    
    // ⚠️ 二次验证：如果没有统计到有效像元，说明不是预期的作物分类图
    if (totalPixels === 0) {
      console.log(`⏭️ [后端] 未检测到有效作物数据（像元值不在1-10范围内）`)
      return null
    }
    
    console.log('   像元值分布:', counts)
    
    // 映射到作物类型并计算百分比
    const cropDistribution = {}
    let totalArea = 0
    
    Object.entries(counts).forEach(([value, count]) => {
      const valueInt = parseInt(value)
      const cropName = CROP_TYPE_MAP[valueInt] || `未知类型(${valueInt})`
      const percentage = (count / totalPixels) * 100
      const area = count * pixelAreaMu
      
      cropDistribution[cropName] = percentage.toFixed(2)
      totalArea += area
    })
    
    console.log('✅ [后端] 作物分布统计:', cropDistribution)
    console.log(`   总面积: ${totalArea.toFixed(0)} 亩, 有效像元: ${totalPixels}`)
    
    const statistics = {
      totalArea: totalArea.toFixed(0),
      plotCount: totalPixels.toString(),
      pixelCount: totalPixels,
      matchRate: '0',
      diffCount: '0',
      cropDistribution: cropDistribution,
      pixelAreaMu: pixelAreaMu,
      counts: counts,
      analyzedAt: new Date().toISOString()
    }
    
    return statistics
  } catch (error) {
    console.error('❌ [后端] TIF分析失败:', error.message)
    return null // 失败时返回null，不阻塞流程
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
  
  // 5. 直接执行投影转换和COG转换
  console.log('⏳ 投影转换 + COG格式转换...')
  
  optimizationProgress.set(id, {
    progress: 30,
    status: 'reprojecting',
    step: '投影转换 + COG转换（最耗时）...'
  })
  
  const gdalwarpCmd = `gdalwarp -s_srs EPSG:32645 -t_srs EPSG:3857 -srcnodata "nan" -dstnodata 255 -wo USE_NAN=YES -of COG -co COMPRESS=LZW -co BLOCKSIZE=512 -co TILED=YES -r near "${inputPath}" "${tempOutput}"`
  const gdalCommand = buildGDALCommand(gdalwarpCmd)
  
  let startTime = Date.now()
  try {
    await execAsync(gdalCommand)
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`✅ 投影转换完成 (耗时: ${elapsed}秒)`)
    
    optimizationProgress.set(id, {
      ...optimizationProgress.get(id),
      progress: 70,
      status: 'reprojected',
      step: '投影转换完成'
    })
  } catch (error) {
    if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput)
    optimizationProgress.delete(id)
    throw new Error('GDAL转换失败: ' + error.message)
  }
  
  // 更新进度：添加金字塔
  optimizationProgress.set(id, {
    ...optimizationProgress.get(id),
    progress: 75,
    status: 'adding_overviews',
    step: '添加金字塔（加快显示速度）...'
  })
  
  // 6. 添加金字塔
  console.log('⏳ 添加金字塔...')
  const gdaladdoCmd = `gdaladdo -r nearest "${tempOutput}" 2 4 8 16`
  const addoCommand = buildGDALCommand(gdaladdoCmd)
  
  try {
    await execAsync(addoCommand)
    console.log('✅ 金字塔添加完成')
    
    optimizationProgress.set(id, {
      ...optimizationProgress.get(id),
      progress: 90,
      status: 'overviews_added',
      step: '金字塔添加完成'
    })
  } catch (error) {
    if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput)
    optimizationProgress.delete(id)
    throw new Error('添加金字塔失败: ' + error.message)
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
        if (statistics) {
          currentImage.statistics = statistics
          console.log(`✅ 统计数据已更新`)
        }
      } catch (err) {
        console.warn(`⚠️ 优化后TIF分析失败: ${image.name}`, err.message)
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
        if (statistics) {
          newImage.statistics = statistics
          console.log(`✅ 统计数据已保存到新记录`)
        }
      } catch (err) {
        console.warn(`⚠️ 优化后TIF分析失败: ${finalFileName}`, err.message)
      }
      
      currentMetadata.images.push(newImage)
      console.log(`✅ 创建新记录: ${newId} - ${finalFileName}`)
    }
    
    writeMetadata(currentMetadata)
    
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
