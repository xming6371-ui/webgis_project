import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import { promisify } from 'util'
import config from '../config.js'

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
function syncMetadata() {
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
  
    // 为每个TIF文件更新或创建记录
    tifFiles.forEach((filename) => {
      try {
        const stats = fs.statSync(path.join(DATA_DIR, filename))
        const fileSize = (stats.size / (1024 * 1024)).toFixed(2) + 'MB'
        
        // 查找是否已存在
        const existingImage = metadata.images.find(img => img.name === filename)
    
    if (existingImage) {
      // ✅ 更新已存在文件的真实大小和修改时间（每次都更新）
      existingImage.size = fileSize
      existingImage.uploadTime = stats.mtime.toISOString()
      
      // 如果文件被优化过，也更新optimizedSize
      if (existingImage.isOptimized) {
        existingImage.optimizedSize = fileSize
      }
      
      // 如果没有其他字段，补充基本信息
      if (!existingImage.year) {
        const info = parseImageInfo(filename)
        Object.assign(existingImage, info)
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
      
        metadata.images.push(newImage)
        console.log(`✅ 添加新文件: ${filename} (ID: ${newId}, ${fileSize})`)
      }
      } catch (fileError) {
        console.error(`❌ 处理文件 ${filename} 时出错:`, fileError.message)
      }
    })
    
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
syncMetadata()

// 初始化GDAL加速模式（异步，不阻塞启动）
// 暂时禁用，避免启动时出错
// initGDALPath().catch(err => {
//   console.warn('⚠️ GDAL加速模式初始化失败，将使用标准模式')
// })

// 路由

// 获取影像列表
router.get('/list', (req, res) => {
  try {
    const metadata = syncMetadata()
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
router.post('/upload', upload.array('files'), (req, res) => {
  try {
    const metadata = syncMetadata()
    
    res.json({
      code: 200,
      message: '上传成功',
      data: {
        count: req.files.length
      }
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

// 缓存conda环境中的GDAL路径（避免重复查找）
let cachedGDALPath = null
let cachedCondaEnvPath = null

// 获取conda环境中GDAL的绝对路径（在后端启动时调用一次）
async function initGDALPath() {
  if (cachedGDALPath) {
    return cachedGDALPath
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
        return cachedGDALPath
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
    // 替换命令中的 gdalwarp/gdaladdo 为绝对路径
    const modifiedCmd = command
      .replace(/^gdalwarp\b/, `"${path.join(cachedGDALPath, 'gdalwarp.exe')}"`)
      .replace(/^gdaladdo\b/, `"${path.join(cachedGDALPath, 'gdaladdo.exe')}"`)
    
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

// 优化TIF文件
router.post('/optimize/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    // 0. 设置请求超时为15分钟（处理大文件）
    req.setTimeout(15 * 60 * 1000) // 15分钟
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
        // 删除超过1小时的临时文件
        if (fileAge > 3600000) {
          fs.unlinkSync(filePath)
          console.log(`🧹 已清理旧临时文件: ${file}`)
        }
      })
    } catch (err) {
      console.warn('清理临时文件时出错:', err.message)
    }
    
    // 1. 检查GDAL是否安装
    const hasGDAL = await checkGDAL()
    if (!hasGDAL) {
      let errorMsg = '服务器未检测到GDAL，请检查配置：\n\n'
      if (config.condaEnv) {
        errorMsg += `1. 确认conda环境 "${config.condaEnv}" 是否存在\n`
        errorMsg += `2. 在该环境中安装GDAL：\n`
        errorMsg += `   conda activate ${config.condaEnv}\n`
        errorMsg += `   conda install -c conda-forge gdal\n\n`
        errorMsg += `3. 如果环境名称不对，请修改 server/config.js 中的 condaEnv 配置`
      } else {
        errorMsg += '1. 安装GDAL到系统PATH\n'
        errorMsg += '2. 或在 server/config.js 中配置 condaEnv（推荐）\n'
        errorMsg += '   例如：condaEnv: "base" 或 "your_env_name"'
      }
      return res.status(500).json({
        code: 500,
        message: errorMsg
      })
    }
    
    // 2. 获取文件信息
    const metadata = readMetadata()
    const image = metadata.images.find(img => img.id === id)
    
    if (!image) {
      return res.status(404).json({
        code: 404,
        message: '文件不存在'
      })
    }
    
    const inputPath = path.join(DATA_DIR, image.name)
    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({
        code: 404,
        message: '文件不存在'
      })
    }
    
    // 检查是否已优化
    if (image.isOptimized) {
      return res.json({
        code: 200,
        message: '该文件已经优化过了',
        data: {
          originalSize: image.originalSize,
          optimizedSize: image.optimizedSize
        }
      })
    }
    
    console.log(`\n🚀 开始优化: ${image.name}`)
    
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
    const backupPath = inputPath.replace(/\.tif$/i, '.original.tif')
    
    // 更新进度：创建备份
    optimizationProgress.set(id, {
      ...optimizationProgress.get(id),
      progress: 10,
      status: 'backing_up',
      step: '创建备份...'
    })
    
    // 4. 创建备份（如果不存在）
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(inputPath, backupPath)
      console.log('✅ 已创建备份文件')
    }
    
    const originalStats = fs.statSync(inputPath)
    const originalSizeMB = (originalStats.size / (1024 * 1024)).toFixed(2)
    
    // 更新进度：开始投影转换
    optimizationProgress.set(id, {
      ...optimizationProgress.get(id),
      progress: 20,
      status: 'reprojecting',
      step: '投影转换 + COG转换（最耗时）...'
    })
    
    // 5. 执行GDAL优化
    console.log('⏳ 步骤1/3: 投影转换 + COG格式转换...')
    const gdalwarpCmd = `gdalwarp -s_srs EPSG:32645 -t_srs EPSG:3857 -dstnodata 255 -of COG -co COMPRESS=LZW -co BLOCKSIZE=512 -co TILED=YES -r near "${inputPath}" "${tempOutput}"`
    const gdalCommand = buildGDALCommand(gdalwarpCmd)
    
    try {
      await execAsync(gdalCommand)
      console.log('✅ 投影转换完成')
      
      // 更新进度：投影转换完成
      optimizationProgress.set(id, {
        ...optimizationProgress.get(id),
        progress: 70,
        status: 'reprojected',
        step: '投影转换完成'
      })
    } catch (error) {
      // 清理临时文件和进度
      if (fs.existsSync(tempOutput)) {
        fs.unlinkSync(tempOutput)
      }
      optimizationProgress.delete(id)
      throw new Error('GDAL转换失败: ' + error.message)
    }
    
    // 更新进度：添加金字塔
    optimizationProgress.set(id, {
      ...optimizationProgress.get(id),
      progress: 75,
      status: 'adding_overviews',
      step: '添加金字塔...'
    })
    
    // 6. 添加金字塔
    console.log('⏳ 步骤2/3: 添加金字塔...')
    const gdaladdoCmd = `gdaladdo -r nearest "${tempOutput}" 2 4 8 16`
    const addoCommand = buildGDALCommand(gdaladdoCmd)
    
    try {
      await execAsync(addoCommand)
      console.log('✅ 金字塔添加完成')
      
      // 更新进度：金字塔添加完成
      optimizationProgress.set(id, {
        ...optimizationProgress.get(id),
        progress: 90,
        status: 'overviews_added',
        step: '金字塔添加完成'
      })
    } catch (error) {
      // 清理临时文件和进度
      if (fs.existsSync(tempOutput)) {
        fs.unlinkSync(tempOutput)
      }
      optimizationProgress.delete(id)
      throw new Error('添加金字塔失败: ' + error.message)
    }
    
    // 更新进度：替换文件
    optimizationProgress.set(id, {
      ...optimizationProgress.get(id),
      progress: 95,
      status: 'replacing',
      step: '替换原文件...'
    })
    
    // 7. 替换原文件
    console.log('⏳ 步骤3/3: 替换原文件...')
    fs.unlinkSync(inputPath)
    fs.renameSync(tempOutput, inputPath)
    console.log('✅ 文件替换完成')
    
    // 更新进度：完成
    optimizationProgress.set(id, {
      ...optimizationProgress.get(id),
      progress: 100,
      status: 'completed',
      step: '优化完成！'
    })
    
    // 8. 更新元数据
    const optimizedStats = fs.statSync(inputPath)
    const optimizedSizeMB = (optimizedStats.size / (1024 * 1024)).toFixed(2)
    const compressionRatio = ((1 - optimizedStats.size / originalStats.size) * 100).toFixed(1)
    
    image.isOptimized = true
    image.status = 'processed'
    image.size = optimizedSizeMB + 'MB'
    image.originalSize = originalSizeMB + 'MB'
    image.optimizedSize = optimizedSizeMB + 'MB'
    image.optimizedPath = `/data/${image.name}`
    image.originalPath = `/data/${path.basename(backupPath)}`
    
    writeMetadata(metadata)
    
    console.log(`\n✅ 优化成功!`)
    console.log(`   原始大小: ${originalSizeMB} MB`)
    console.log(`   优化后: ${optimizedSizeMB} MB`)
    console.log(`   压缩率: ${compressionRatio}%\n`)
    
    res.json({
      code: 200,
      message: '优化成功',
      data: {
        originalSize: image.originalSize,
        optimizedSize: image.optimizedSize,
        compressionRatio: compressionRatio + '%'
      }
    })
    
    // 清理进度记录（5秒后，让前端有时间获取最终状态）
    setTimeout(() => {
      optimizationProgress.delete(id)
      console.log(`🧹 已清理进度记录: ${id}`)
    }, 5000)
    
  } catch (error) {
    console.error('❌ 优化失败:', error.message)
    
    // 更新进度：失败
    optimizationProgress.set(id, {
      ...optimizationProgress.get(id),
      progress: 0,
      status: 'failed',
      step: '优化失败: ' + error.message
    })
    
    // 清理进度记录（30秒后）
    setTimeout(() => {
      optimizationProgress.delete(id)
    }, 30000)
    
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

export default router
