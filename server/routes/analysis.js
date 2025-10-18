import express from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import multer from 'multer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 尝试导入archiver库（用于SHP文件打包）
let archiver = null
try {
  const archiverModule = await import('archiver')
  archiver = archiverModule.default
  console.log('✅ archiver库已加载，SHP打包下载功能已启用')
} catch (error) {
  console.warn('⚠️ archiver库未安装，SHP将单独下载（推荐安装以获得完整功能）')
  console.warn('   请运行: npm install archiver --save')
}

const router = express.Router()

// 数据目录
const DATA_DIR = path.join(__dirname, '../../public/data')
const SHP_DIR = path.join(DATA_DIR, 'data_shp')
const GEOJSON_DIR = path.join(DATA_DIR, 'data_geojson')
const KMZ_DIR = path.join(DATA_DIR, 'data_kmz')

// 确保目录存在
if (!fs.existsSync(SHP_DIR)) {
  fs.mkdirSync(SHP_DIR, { recursive: true })
}
if (!fs.existsSync(GEOJSON_DIR)) {
  fs.mkdirSync(GEOJSON_DIR, { recursive: true })
}
if (!fs.existsSync(KMZ_DIR)) {
  fs.mkdirSync(KMZ_DIR, { recursive: true })
}

// 配置multer存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase()
    let targetDir = SHP_DIR
    
    if (ext === '.geojson' || ext === '.json') {
      targetDir = GEOJSON_DIR
    } else if (ext === '.kmz') {
      targetDir = KMZ_DIR
    } else if (ext === '.shp') {
      targetDir = SHP_DIR
    }
    
    cb(null, targetDir)
  },
  filename: function (req, file, cb) {
    // 使用原始文件名，避免中文乱码
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8')
    const ext = path.extname(originalName)
    const basename = path.basename(originalName, ext)
    
    // 确定目标目录
    const extLower = ext.toLowerCase()
    let targetDir = SHP_DIR
    if (extLower === '.geojson' || extLower === '.json') {
      targetDir = GEOJSON_DIR
    } else if (extLower === '.kmz') {
      targetDir = KMZ_DIR
    }
    
    // 检查文件是否已存在，如果存在则添加序号
    let finalName = originalName
    let counter = 1
    while (fs.existsSync(path.join(targetDir, finalName))) {
      finalName = `${basename}(${counter})${ext}`
      counter++
    }
    
    cb(null, finalName)
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB
  },
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase()
    const validExtensions = ['.shp', '.geojson', '.json', '.kmz']
    
    if (validExtensions.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('只支持 SHP、GeoJSON、JSON 和 KMZ 格式文件'))
    }
  }
})

console.log('✅ 分析结果管理模块已加载')

// 获取识别结果列表（扫描SHP和GeoJSON文件）
router.get('/results', (req, res) => {
  try {
    const results = []
    
    // 1. 扫描SHP文件
    const shpFiles = fs.readdirSync(SHP_DIR).filter(f => f.endsWith('.shp'))
    shpFiles.forEach((filename) => {
      const shpPath = path.join(SHP_DIR, filename)
      const stats = fs.statSync(shpPath)
      const basename = path.basename(filename, '.shp')
      
      // 计算所有相关文件的总大小
      const shpExtensions = ['.shp', '.shx', '.dbf', '.prj', '.cpg', '.sbn', '.sbx']
      let totalSize = 0
      let fileCount = 0
      
      for (const ext of shpExtensions) {
        const relatedFile = path.join(SHP_DIR, basename + ext)
        if (fs.existsSync(relatedFile)) {
          totalSize += fs.statSync(relatedFile).size
          fileCount++
        }
      }
      
      results.push({
        id: `shp_${basename}_${stats.mtimeMs}`,
        name: filename,
        type: 'SHP',
        format: 'shp',
        taskName: basename,
        analysisType: 'recognition',
        size: `${(totalSize / (1024 * 1024)).toFixed(2)} MB`,
        fileCount: fileCount, // 相关文件数量
        createTime: stats.mtime.toLocaleString('zh-CN'),
        timestamp: stats.mtimeMs
      })
    })
    
    // 2. 扫描GeoJSON文件
    if (fs.existsSync(GEOJSON_DIR)) {
      const geojsonFiles = fs.readdirSync(GEOJSON_DIR).filter(f => f.endsWith('.geojson') || f.endsWith('.json'))
      geojsonFiles.forEach((filename) => {
        const geojsonPath = path.join(GEOJSON_DIR, filename)
        const stats = fs.statSync(geojsonPath)
        const ext = path.extname(filename)
        const basename = path.basename(filename, ext)
        
        results.push({
          id: `geojson_${basename}_${stats.mtimeMs}`,
          name: filename,
          type: 'GeoJSON',
          format: 'geojson',
          taskName: basename,
          analysisType: 'recognition',
          size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
          createTime: stats.mtime.toLocaleString('zh-CN'),
          timestamp: stats.mtimeMs
        })
      })
    }
    
    // 3. 扫描KMZ文件
    if (fs.existsSync(KMZ_DIR)) {
      const kmzFiles = fs.readdirSync(KMZ_DIR).filter(f => f.endsWith('.kmz'))
      kmzFiles.forEach((filename) => {
        const kmzPath = path.join(KMZ_DIR, filename)
        const stats = fs.statSync(kmzPath)
        const basename = path.basename(filename, '.kmz')
        
        results.push({
          id: `kmz_${basename}_${stats.mtimeMs}`,
          name: filename,
          type: 'KMZ',
          format: 'kmz',
          taskName: basename,
          analysisType: 'recognition',
          size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
          createTime: stats.mtime.toLocaleString('zh-CN'),
          timestamp: stats.mtimeMs
        })
      })
    }
    
    // 按时间倒序排序
    results.sort((a, b) => b.timestamp - a.timestamp)
    
    res.json({
      code: 200,
      message: '获取成功',
      data: results
    })
  } catch (error) {
    console.error('获取识别结果列表失败:', error)
    res.status(500).json({
      code: 500,
      message: error.message
    })
  }
})

// SHP转换为GeoJSON（使用Node.js shapefile库）
router.post('/convert-to-geojson', async (req, res) => {
  try {
    const { shpFilename } = req.body
    
    if (!shpFilename) {
      return res.status(400).json({
        code: 400,
        message: '请提供SHP文件名'
      })
    }
    
    const shpPath = path.join(SHP_DIR, shpFilename)
    
    if (!fs.existsSync(shpPath)) {
      return res.status(404).json({
        code: 404,
        message: 'SHP文件不存在'
      })
    }
    
    // 生成GeoJSON文件路径
    const basename = path.basename(shpFilename, '.shp')
    const geojsonFilename = `${basename}.geojson`
    const geojsonPath = path.join(GEOJSON_DIR, geojsonFilename)
    
    // 如果已经存在，提示用户不要重复转换
    if (fs.existsSync(geojsonPath)) {
      const stats = fs.statSync(geojsonPath)
      console.log(`⚠️ 文件已存在，跳过转换: ${geojsonFilename}`)
      return res.json({
        code: 400,
        message: '该文件已经转换过了，请不要重复转换！如需重新转换，请先删除原文件。',
        data: {
          geojsonFilename: geojsonFilename,
          size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
          path: `/data/data_geojson/${geojsonFilename}`,
          existed: true
        }
      })
    }
    
    // 检查shapefile库是否安装
    let shapefile
    try {
      shapefile = await import('shapefile')
    } catch (error) {
      return res.status(503).json({
        code: 503,
        message: 'shapefile库未安装，请运行: npm install shapefile --save'
      })
    }
    
    console.log(`🔄 开始转换: ${shpFilename} -> ${geojsonFilename}`)
    
    // 使用shapefile库转换
    const source = await shapefile.open(shpPath)
    
    const geojson = {
      type: 'FeatureCollection',
      features: []
    }
    
    let result = await source.read()
    while (!result.done) {
      if (result.value) {
        geojson.features.push(result.value)
      }
      result = await source.read()
    }
    
    // 写入文件
    fs.writeFileSync(geojsonPath, JSON.stringify(geojson, null, 2))
    
    const stats = fs.statSync(geojsonPath)
    
    console.log(`✅ 转换完成: ${geojsonFilename} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`)
    console.log(`   包含 ${geojson.features.length} 个要素`)
    
    res.json({
      code: 200,
      message: '转换成功',
      data: {
        geojsonFilename: geojsonFilename,
        size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
        path: `/data/data_geojson/${geojsonFilename}`,
        featureCount: geojson.features.length
      }
    })
  } catch (error) {
    console.error('转换失败:', error)
    res.status(500).json({
      code: 500,
      message: '转换失败: ' + error.message
    })
  }
})

// 下载文件
router.get('/download/:type/:filename', async (req, res) => {
  try {
    const { type, filename } = req.params
    
    // 如果是SHP文件且archiver可用，打包下载
    if (type === 'shp' && archiver) {
      const basename = path.basename(filename, '.shp')
      const shpExtensions = ['.shp', '.shx', '.dbf', '.prj', '.cpg', '.sbn', '.sbx']
      
      // 检查主文件是否存在
      const mainFile = path.join(SHP_DIR, filename)
      if (!fs.existsSync(mainFile)) {
        return res.status(404).send(`文件不存在: ${filename}`)
      }
      
      // 查找所有相关文件
      const relatedFiles = []
      for (const ext of shpExtensions) {
        const file = path.join(SHP_DIR, basename + ext)
        if (fs.existsSync(file)) {
          relatedFiles.push({ path: file, name: basename + ext })
        }
      }
      
      console.log(`📦 打包下载SHP文件: ${basename} (${relatedFiles.length}个文件)`)
      
      // 设置响应头
      const zipFilename = `${basename}.zip`
      res.setHeader('Content-Type', 'application/zip')
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipFilename)}"`)
      
      // 创建zip压缩包
      const archive = archiver('zip', {
        zlib: { level: 9 } // 最高压缩级别
      })
      
      // 监听错误
      archive.on('error', (err) => {
        console.error('压缩失败:', err)
        res.status(500).send('压缩失败: ' + err.message)
      })
      
      // 将压缩流输出到响应
      archive.pipe(res)
      
      // 添加所有相关文件到压缩包
      for (const file of relatedFiles) {
        archive.file(file.path, { name: file.name })
      }
      
      // 完成压缩
      await archive.finalize()
      
    } else {
      // 非SHP文件或archiver不可用，直接下载
      let filePath
      if (type === 'shp') {
        filePath = path.join(SHP_DIR, filename)
      } else if (type === 'geojson') {
        filePath = path.join(GEOJSON_DIR, filename)
      } else if (type === 'kmz') {
        filePath = path.join(KMZ_DIR, filename)
      } else {
        return res.status(400).send('不支持的文件类型')
      }
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).send(`文件不存在: ${filename}`)
      }
      
      console.log(`📥 下载文件: ${filename}`)
      
      res.download(filePath, filename)
    }
  } catch (error) {
    console.error('下载失败:', error)
    if (!res.headersSent) {
      res.status(500).send('下载失败: ' + error.message)
    }
  }
})

// 上传结果文件（SHP、GeoJSON、KMZ）
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        code: 400,
        message: '没有上传文件'
      })
    }
    
    const uploadedFile = req.file
    const ext = path.extname(uploadedFile.originalname).toLowerCase()
    let fileType = 'Unknown'
    
    if (ext === '.shp') {
      fileType = 'SHP'
    } else if (ext === '.geojson' || ext === '.json') {
      fileType = 'GeoJSON'
    } else if (ext === '.kmz') {
      fileType = 'KMZ'
    }
    
    console.log(`✅ 上传成功: ${uploadedFile.originalname} (${(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB) -> ${fileType}`)
    
    res.json({
      code: 200,
      message: '上传成功',
      data: {
        filename: uploadedFile.originalname,
        type: fileType,
        size: `${(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB`,
        path: uploadedFile.path
      }
    })
  } catch (error) {
    console.error('上传失败:', error)
    res.status(500).json({
      code: 500,
      message: '上传失败: ' + error.message
    })
  }
})

// 删除文件
router.delete('/delete/:type/:filename', (req, res) => {
  try {
    const { type, filename } = req.params
    
    let filePath
    if (type === 'shp') {
      filePath = path.join(SHP_DIR, filename)
    } else if (type === 'geojson') {
      filePath = path.join(GEOJSON_DIR, filename)
    } else if (type === 'kmz') {
      filePath = path.join(KMZ_DIR, filename)
    } else {
      return res.status(400).json({
        code: 400,
        message: '不支持的文件类型'
      })
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        code: 404,
        message: `文件不存在: ${filename}`
      })
    }
    
    // 删除文件
    fs.unlinkSync(filePath)
    
    console.log(`🗑️  删除文件成功: ${filename}`)
    
    res.json({
      code: 200,
      message: '删除成功'
    })
  } catch (error) {
    console.error('删除失败:', error)
    res.status(500).json({
      code: 500,
      message: '删除失败: ' + error.message
    })
  }
})

export default router

