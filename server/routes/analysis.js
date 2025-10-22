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

// 尝试导入adm-zip库（用于解压ZIP文件）
let AdmZip = null
try {
  const admZipModule = await import('adm-zip')
  AdmZip = admZipModule.default
  console.log('✅ adm-zip库已加载，ZIP解压功能已启用')
} catch (error) {
  console.warn('⚠️ adm-zip库未安装，无法处理ZIP文件上传')
  console.warn('   请运行: npm install adm-zip --save')
}

const router = express.Router()

// 数据目录
const DATA_DIR = path.join(__dirname, '../../public/data')
const SHP_DIR = path.join(DATA_DIR, 'data_shp')
const GEOJSON_DIR = path.join(DATA_DIR, 'data_geojson')
const KMZ_DIR = path.join(DATA_DIR, 'data_kmz')
const ANALYSIS_RESULTS_DIR = path.join(DATA_DIR, 'data_analysis_results')
const TEMPORAL_DIR = path.join(ANALYSIS_RESULTS_DIR, 'temporal')
const DIFFERENCE_DIR = path.join(ANALYSIS_RESULTS_DIR, 'difference')
const REPORTS_DIR = path.join(ANALYSIS_RESULTS_DIR, 'reports')

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
if (!fs.existsSync(TEMPORAL_DIR)) {
  fs.mkdirSync(TEMPORAL_DIR, { recursive: true })
}
if (!fs.existsSync(DIFFERENCE_DIR)) {
  fs.mkdirSync(DIFFERENCE_DIR, { recursive: true })
}
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true })
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
    } else if (ext === '.zip') {
      // ZIP文件临时保存到SHP目录，稍后解压
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
    
    // ZIP文件使用临时文件名（稍后会删除）
    if (extLower === '.zip') {
      cb(null, originalName)
      return
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
    const validExtensions = ['.zip', '.geojson', '.json', '.kmz']
    
    if (validExtensions.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('只支持 ZIP（SHP文件夹压缩包）、GeoJSON、JSON 和 KMZ 格式文件'))
    }
  }
})

// 🔧 辅助函数：递归查找SHP文件
function findShpFile(dirPath, filename) {
  try {
    const items = fs.readdirSync(dirPath)
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item)
      const stats = fs.statSync(itemPath)
      
      if (stats.isDirectory()) {
        // 递归查找子目录
        const found = findShpFile(itemPath, filename)
        if (found) {
          return found
        }
      } else if (item === filename) {
        // 找到文件
        return itemPath
      }
    }
    
    return null
  } catch (error) {
    console.error(`递归查找失败: ${dirPath}`, error)
    return null
  }
}

console.log('✅ 分析结果管理模块已加载')

// 获取识别结果列表（扫描SHP和GeoJSON文件）
router.get('/results', (req, res) => {
  try {
    const results = []
    
    // 🔧 修复：递归扫描SHP文件（支持子文件夹）
    const scanShpDir = (dirPath, relativePath = '') => {
      const items = fs.readdirSync(dirPath)
      
      items.forEach((item) => {
        const itemPath = path.join(dirPath, item)
        const stats = fs.statSync(itemPath)
        
        if (stats.isDirectory()) {
          // 递归扫描子目录
          scanShpDir(itemPath, path.join(relativePath, item))
        } else if (item.endsWith('.shp')) {
          // SHP文件
          const basename = path.basename(item, '.shp')
          
          // 计算所有相关文件的总大小
          const shpExtensions = ['.shp', '.shx', '.dbf', '.prj', '.cpg', '.sbn', '.sbx', '.shp.xml']
          let totalSize = 0
          let fileCount = 0
          const relatedDir = path.dirname(itemPath)
          
          for (const ext of shpExtensions) {
            const relatedFile = path.join(relatedDir, basename + ext)
            if (fs.existsSync(relatedFile)) {
              totalSize += fs.statSync(relatedFile).size
              fileCount++
            }
          }
          
          // 提取区域信息（从文件夹名）
          let regionCode = relativePath ? path.basename(relativePath) : null
          let regionName = regionCode
          
          // 区域映射
          const regionMap = {
            'BTH': '包头湖',
            'JJMC': '经济牧场',
            'KEC': '库尔楚',
            'PHMC': '普惠牧场',
            'PHNC': '普惠农场',
            'YZC': '原种场'
          }
          
          if (regionCode && regionMap[regionCode.toUpperCase()]) {
            regionName = regionMap[regionCode.toUpperCase()]
            regionCode = regionCode.toUpperCase()
          }
          
          // 🔧 修复：尝试读取元数据JSON文件
          let metadata = {
            year: 2024,
            period: 1,
            recognitionType: 'crop_recognition',
            taskName: basename
          }
          
          let createTime = stats.mtime.toLocaleString('zh-CN')
          let timestamp = stats.mtimeMs
          
          const metadataPath = path.join(relatedDir, `${basename}.json`)
          if (fs.existsSync(metadataPath)) {
            try {
              const metadataContent = fs.readFileSync(metadataPath, 'utf-8')
              const savedMetadata = JSON.parse(metadataContent)
              
              // 合并元数据，优先使用JSON文件中的值
              metadata = {
                ...metadata,
                ...savedMetadata,
                // 如果JSON中有regionCode和regionName，使用它们
                regionCode: savedMetadata.regionCode || regionCode,
                regionName: savedMetadata.regionName || regionName
              }
              
              // 🆕 优先使用元数据中的时间（优先级：createdAt > uploadTime > updatedAt > 文件修改时间）
              if (savedMetadata.createdAt) {
                const createdDate = new Date(savedMetadata.createdAt)
                createTime = createdDate.toLocaleString('zh-CN')
                timestamp = createdDate.getTime()
              } else if (savedMetadata.uploadTime) {
                const uploadDate = new Date(savedMetadata.uploadTime)
                createTime = uploadDate.toLocaleString('zh-CN')
                timestamp = uploadDate.getTime()
              } else if (savedMetadata.updatedAt) {
                const updatedDate = new Date(savedMetadata.updatedAt)
                createTime = updatedDate.toLocaleString('zh-CN')
                timestamp = updatedDate.getTime()
              }
              // 如果都没有，使用默认的文件修改时间（已经在上面设置了）
              
              console.log(`✅ 读取元数据: ${basename}.json`, metadata)
            } catch (err) {
              console.warn(`⚠️ 读取元数据文件失败: ${metadataPath}`, err.message)
            }
          }
          
          results.push({
            id: `shp_${basename}_${timestamp}`,
            name: item,
            type: 'SHP',
            format: 'shp',
            taskName: metadata.taskName || basename,
            analysisType: 'recognition',
            recognitionType: metadata.recognitionType || 'crop_recognition',
            size: `${(totalSize / (1024 * 1024)).toFixed(2)} MB`,
            fileCount: fileCount,
            createTime: createTime,
            timestamp: timestamp,
            relativePath: relativePath,
            regionCode: metadata.regionCode || regionCode,
            regionName: metadata.regionName || regionName,
            year: metadata.year || 2024,
            period: metadata.period || 1
          })
        }
      })
    }
    
    // 1. 扫描SHP文件（包括子文件夹）
    if (fs.existsSync(SHP_DIR)) {
      scanShpDir(SHP_DIR)
    }
    
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
    
    // 3. 扫描KMZ文件（包括子文件夹）
    if (fs.existsSync(KMZ_DIR)) {
      // 递归扫描函数
      const scanKmzDir = (dirPath, relativePath = '') => {
        const items = fs.readdirSync(dirPath)
        
        items.forEach((item) => {
          const itemPath = path.join(dirPath, item)
          const stats = fs.statSync(itemPath)
          
          if (stats.isDirectory()) {
            // 递归扫描子目录
            scanKmzDir(itemPath, path.join(relativePath, item))
          } else if (item.endsWith('.kmz')) {
            // KMZ文件
            const basename = path.basename(item, '.kmz')
            
            // 提取区域代码（从文件夹名或文件名）
            let regionCode = relativePath ? path.basename(relativePath) : null
            if (!regionCode || regionCode === 'planting_situation') {
              // 如果没有从文件夹获取到，尝试从文件名提取
              regionCode = basename
            }
            
            // 区域映射
            const regionMap = {
              'BTH': '包头湖',
              'JJMC': '经济牧场',
              'KEC': '库尔楚',
              'PHMC': '普惠牧场',
              'PHNC': '普惠农场',
              'YZC': '原种场'
            }
            
            // 提取年份和期次信息
            // 方案1：从文件夹路径提取（如：planting_situation/2023/period_1/BTH/BTH.kmz）
            let year = null
            let period = null
            
            if (relativePath) {
              const pathParts = relativePath.split(path.sep)
              
              // 检查路径中是否包含年份文件夹（4位数字）
              const yearMatch = pathParts.find(part => /^\d{4}$/.test(part))
              if (yearMatch) {
                year = yearMatch
              }
              
              // 检查路径中是否包含期次文件夹（period_1、period_2等）
              const periodMatch = pathParts.find(part => /^period_(\d+)$/i.test(part))
              if (periodMatch) {
                const match = periodMatch.match(/^period_(\d+)$/i)
                period = match[1]
              }
            }
            
            // 方案2：从文件名提取（如：BTH_2023_1.kmz）
            if (!year || !period) {
              const fileNameMatch = basename.match(/(\d{4})_(\d+)/)
              if (fileNameMatch) {
                year = year || fileNameMatch[1]
                period = period || fileNameMatch[2]
              }
            }
            
            // 方案3：检查是否有同名JSON元数据文件
            const metadataPath = path.join(itemPath.replace('.kmz', '.json'))
            if (fs.existsSync(metadataPath)) {
              try {
                const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
                year = year || metadata.year
                period = period || metadata.period
                regionCode = metadata.regionCode || regionCode
              } catch (err) {
                console.warn(`读取元数据文件失败: ${metadataPath}`, err.message)
              }
            }
            
            const regionName = regionMap[regionCode.toUpperCase()] || '未知区域'
            
            // 判断识别类型（从文件夹路径推断）
            let recognitionType = 'crop_recognition' // 默认作物识别
            if (relativePath.includes('planting_situation')) {
              recognitionType = 'planting_situation' // 种植情况识别
            }
            
            results.push({
              id: `kmz_${basename}_${stats.mtimeMs}`,
              name: item,
              type: 'KMZ',
              format: 'kmz',
              taskName: basename,
              analysisType: 'recognition',
              recognitionType: recognitionType, // 识别任务类型
              regionCode: regionCode.toUpperCase(), // 区域代码
              regionName: regionName, // 区域中文名称
              year: year, // 年份
              period: period, // 期次
              size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
              createTime: stats.mtime.toLocaleString('zh-CN'),
              timestamp: stats.mtimeMs,
              relativePath: relativePath // 相对路径
            })
          }
        })
      }
      
      // 开始扫描
      scanKmzDir(KMZ_DIR)
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
    const { shpFilename, relativePath } = req.body
    
    if (!shpFilename) {
      return res.status(400).json({
        code: 400,
        message: '请提供SHP文件名'
      })
    }
    
    // 🔧 修复：支持子文件夹
    let shpPath
    if (relativePath) {
      // 如果提供了相对路径，直接使用
      shpPath = path.join(SHP_DIR, relativePath, shpFilename)
    } else {
      // 如果没有提供相对路径，先尝试根目录
      shpPath = path.join(SHP_DIR, shpFilename)
      
      // 如果根目录不存在，递归查找
      if (!fs.existsSync(shpPath)) {
        console.log(`⚠️ 根目录未找到文件，开始递归查找: ${shpFilename}`)
        shpPath = findShpFile(SHP_DIR, shpFilename)
      }
    }
    
    if (!shpPath || !fs.existsSync(shpPath)) {
      return res.status(404).json({
        code: 404,
        message: `SHP文件不存在: ${shpFilename}`
      })
    }
    
    console.log(`📍 找到SHP文件: ${shpPath}`)
    
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
    
    // 如果是SHP文件且archiver可用，打包整个文件夹下载
    if (type === 'shp' && archiver) {
      const basename = path.basename(filename, '.shp')
      const folderPath = path.join(SHP_DIR, basename)
      
      // 先检查是否存在文件夹
      if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
        console.log(`📦 打包下载SHP文件夹: ${basename}`)
        
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
          if (!res.headersSent) {
            res.status(500).send('压缩失败: ' + err.message)
          }
        })
        
        // 将压缩流输出到响应
        archive.pipe(res)
        
        // 添加整个文件夹到压缩包
        archive.directory(folderPath, false) // false 表示不包含顶层文件夹名
        
        // 完成压缩
        await archive.finalize()
        
        console.log(`✅ 文件夹压缩完成: ${basename}`)
        
      } else {
        // 如果不存在文件夹，尝试查找单独的SHP文件（兼容旧数据）
        const shpExtensions = ['.shp', '.shx', '.dbf', '.prj', '.cpg', '.sbn', '.sbx']
        
        // 检查主文件是否存在
        const mainFile = path.join(SHP_DIR, filename)
        if (!fs.existsSync(mainFile)) {
          return res.status(404).send(`SHP文件或文件夹不存在: ${filename}`)
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
          if (!res.headersSent) {
            res.status(500).send('压缩失败: ' + err.message)
          }
        })
        
        // 将压缩流输出到响应
        archive.pipe(res)
        
        // 添加所有相关文件到压缩包
        for (const file of relatedFiles) {
          archive.file(file.path, { name: file.name })
        }
        
        // 完成压缩
        await archive.finalize()
      }
      
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

// 上传结果文件（ZIP、GeoJSON、KMZ）
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
    
    // 处理ZIP文件（SHP文件夹压缩包）
    if (ext === '.zip') {
      if (!AdmZip) {
        // 如果没有adm-zip库，删除上传的文件
        fs.unlinkSync(uploadedFile.path)
        return res.status(503).json({
          code: 503,
          message: 'ZIP解压功能不可用，请安装 adm-zip 库: npm install adm-zip --save'
        })
      }
      
      fileType = 'SHP'
      const zipPath = uploadedFile.path
      const basename = path.basename(uploadedFile.originalname, '.zip')
      const targetDir = path.join(SHP_DIR, basename)
      
      console.log(`📦 处理ZIP文件: ${uploadedFile.originalname}`)
      console.log(`   ZIP路径: ${zipPath}`)
      console.log(`   目标文件夹: ${targetDir}`)
      
      try {
        // 如果目标文件夹已存在，先删除
        if (fs.existsSync(targetDir)) {
          console.log(`   ⚠️ 目标文件夹已存在，删除旧文件夹`)
          fs.rmSync(targetDir, { recursive: true, force: true })
        }
        
        // 创建临时解压目录
        const tempDir = path.join(SHP_DIR, `_temp_${basename}_${Date.now()}`)
        fs.mkdirSync(tempDir, { recursive: true })
        
        // 解压ZIP文件到临时目录
        const zip = new AdmZip(zipPath)
        zip.extractAllTo(tempDir, true)
        
        console.log(`   📂 检查ZIP内部结构...`)
        
        // 检查临时目录内容
        const tempContents = fs.readdirSync(tempDir)
        console.log(`   临时目录内容:`, tempContents)
        
        // 智能处理：如果ZIP内部只有一个文件夹，就提取这个文件夹的内容
        if (tempContents.length === 1) {
          const singleItem = tempContents[0]
          const singleItemPath = path.join(tempDir, singleItem)
          const stats = fs.statSync(singleItemPath)
          
          if (stats.isDirectory()) {
            console.log(`   ✅ 检测到ZIP内部只有一个文件夹: ${singleItem}`)
            console.log(`   📤 将文件夹内容移动到目标位置`)
            
            // 将这个文件夹重命名为目标文件夹
            fs.renameSync(singleItemPath, targetDir)
            
            // 删除临时目录
            fs.rmSync(tempDir, { recursive: true, force: true })
          } else {
            // 如果只有一个文件（不太可能），就将临时目录作为目标目录
            fs.renameSync(tempDir, targetDir)
          }
        } else {
          // 如果有多个文件/文件夹，就将临时目录作为目标目录
          console.log(`   ✅ 检测到ZIP内部有多个文件/文件夹`)
          fs.renameSync(tempDir, targetDir)
        }
        
        // 删除临时ZIP文件
        fs.unlinkSync(zipPath)
        
        // 统计解压后的文件
        const files = fs.readdirSync(targetDir)
        const shpFiles = files.filter(f => f.endsWith('.shp'))
        
        console.log(`✅ ZIP解压成功: ${basename}`)
        console.log(`   解压文件数: ${files.length}`)
        console.log(`   SHP文件数: ${shpFiles.length}`)
        
        // 计算文件夹总大小
        let totalSize = 0
        const calculateDirSize = (dir) => {
          const items = fs.readdirSync(dir)
          items.forEach(item => {
            const itemPath = path.join(dir, item)
            const stats = fs.statSync(itemPath)
            if (stats.isDirectory()) {
              calculateDirSize(itemPath)
            } else {
              totalSize += stats.size
            }
          })
        }
        calculateDirSize(targetDir)
        
        // 🆕 总是保存元数据文件（即使用户没有填写元数据表单）
        try {
          // 找到SHP文件名
          const shpFileName = shpFiles.length > 0 ? shpFiles[0] : null
          if (shpFileName) {
            const metadataFileName = shpFileName.replace('.shp', '.json')
            const metadataPath = path.join(targetDir, metadataFileName)
            
            // 解析用户提供的元数据（如果有）
            const userMetadata = req.body.metadata ? JSON.parse(req.body.metadata) : {}
            
            // 创建完整的元数据对象
            const completeMetadata = {
              year: userMetadata.year || new Date().getFullYear(),
              period: userMetadata.period || 1,
              regionCode: userMetadata.regionCode || '',
              regionName: userMetadata.regionName || '',
              recognitionType: userMetadata.recognitionType || 'crop_recognition',
              taskName: userMetadata.taskName || basename,
              uploadTime: new Date().toISOString(),
              createdAt: new Date().toISOString()
            }
            
            fs.writeFileSync(metadataPath, JSON.stringify(completeMetadata, null, 2), 'utf-8')
            console.log(`✅ 元数据已保存: ${metadataFileName}`)
            console.log(`   内容:`, completeMetadata)
          }
        } catch (metaError) {
          console.warn(`⚠️ 保存元数据失败:`, metaError)
        }
        
        return res.json({
          code: 200,
          message: 'SHP文件夹上传并解压成功',
          data: {
            filename: uploadedFile.originalname,
            folderName: basename,
            type: 'SHP',
            size: `${(totalSize / (1024 * 1024)).toFixed(2)} MB`,
            fileCount: files.length,
            shpFileCount: shpFiles.length,
            path: targetDir
          }
        })
      } catch (zipError) {
        console.error('解压ZIP失败:', zipError)
        // 清理临时文件
        if (fs.existsSync(zipPath)) {
          fs.unlinkSync(zipPath)
        }
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true })
        }
        // 清理临时目录
        const tempDir = path.join(SHP_DIR, `_temp_${basename}_${Date.now()}`)
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true })
        }
        
        return res.status(500).json({
          code: 500,
          message: 'ZIP解压失败: ' + zipError.message
        })
      }
    }
    
    // 处理其他文件类型
    if (ext === '.geojson' || ext === '.json') {
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
    
    console.log(`🗑️ 收到删除请求: type=${type}, filename=${filename}`)
    
    let filePath
    const deletedFiles = []
    
    if (type === 'shp') {
      // 🔧 修复：删除整个SHP文件夹
      const basename = path.basename(filename, '.shp')
      const folderPath = path.join(SHP_DIR, basename)
      
      // 先检查是否存在文件夹
      if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
        console.log(`   找到SHP文件夹: ${folderPath}`)
        
        // 递归获取文件夹中的所有文件
        const getAllFiles = (dir) => {
          const files = []
          const items = fs.readdirSync(dir)
          items.forEach(item => {
            const itemPath = path.join(dir, item)
            const stats = fs.statSync(itemPath)
            if (stats.isDirectory()) {
              files.push(...getAllFiles(itemPath))
            } else {
              files.push(item)
            }
          })
          return files
        }
        
        const files = getAllFiles(folderPath)
        deletedFiles.push(...files)
        
        // 删除整个文件夹
        fs.rmSync(folderPath, { recursive: true, force: true })
        console.log(`   ✅ 已删除SHP文件夹: ${basename} (包含 ${files.length} 个文件)`)
        
      } else {
        // 如果不存在文件夹，尝试查找单独的SHP文件（兼容旧数据）
        filePath = path.join(SHP_DIR, filename)
        if (!fs.existsSync(filePath)) {
          console.log(`   根目录未找到，开始递归查找: ${filename}`)
          filePath = findShpFile(SHP_DIR, filename)
          if (!filePath) {
            return res.status(404).json({
              code: 404,
              message: `SHP文件或文件夹不存在: ${filename}`
            })
          }
        }
        console.log(`   找到SHP文件: ${filePath}`)
        
        // 删除所有相关的SHP文件
        const dirPath = path.dirname(filePath)
        const relatedExtensions = ['.shp', '.dbf', '.shx', '.prj', '.cpg', '.sbn', '.sbx', '.shp.xml', '.qpj']
        
        relatedExtensions.forEach(ext => {
          const relatedFile = path.join(dirPath, basename + ext)
          if (fs.existsSync(relatedFile)) {
            fs.unlinkSync(relatedFile)
            deletedFiles.push(basename + ext)
            console.log(`   ✅ 已删除: ${basename}${ext}`)
          }
        })
        
        // 同时删除对应的元数据JSON文件
        const metadataFile = path.join(dirPath, basename + '.json')
        if (fs.existsSync(metadataFile)) {
          fs.unlinkSync(metadataFile)
          deletedFiles.push(basename + '.json')
          console.log(`   ✅ 已删除元数据: ${basename}.json`)
        }
      }
      
      // 同时删除对应的GeoJSON文件（如果存在）
      const geojsonFile = path.join(GEOJSON_DIR, basename + '.geojson')
      if (fs.existsSync(geojsonFile)) {
        fs.unlinkSync(geojsonFile)
        deletedFiles.push(basename + '.geojson')
        console.log(`   ✅ 已删除GeoJSON: ${basename}.geojson`)
      }
      
    } else if (type === 'geojson') {
      filePath = path.join(GEOJSON_DIR, filename)
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          code: 404,
          message: `GeoJSON文件不存在: ${filename}`
        })
      }
      fs.unlinkSync(filePath)
      deletedFiles.push(filename)
      console.log(`   ✅ 已删除: ${filename}`)
      
    } else if (type === 'kmz') {
      filePath = path.join(KMZ_DIR, filename)
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          code: 404,
          message: `KMZ文件不存在: ${filename}`
        })
      }
      fs.unlinkSync(filePath)
      deletedFiles.push(filename)
      console.log(`   ✅ 已删除: ${filename}`)
      
    } else {
      return res.status(400).json({
        code: 400,
        message: '不支持的文件类型'
      })
    }
    
    console.log(`🗑️ 删除成功，共删除 ${deletedFiles.length} 个文件`)
    
    res.json({
      code: 200,
      message: `删除成功，共删除 ${deletedFiles.length} 个文件`,
      deletedFiles
    })
  } catch (error) {
    console.error('删除失败:', error)
    res.status(500).json({
      code: 500,
      message: '删除失败: ' + error.message
    })
  }
})

// 读取GeoJSON文件内容
router.get('/read-geojson/:filename', (req, res) => {
  try {
    // URL解码文件名（处理中文和特殊字符）
    const filename = decodeURIComponent(req.params.filename)
    console.log(`📖 收到读取请求，文件名: ${filename}`)
    
    const filePath = path.join(GEOJSON_DIR, filename)
    console.log(`   完整路径: ${filePath}`)
    
    if (!fs.existsSync(filePath)) {
      console.log(`   ❌ 文件不存在`)
      // 列出目录中的文件以便调试
      const files = fs.readdirSync(GEOJSON_DIR)
      console.log(`   目录中的文件:`, files)
      
      return res.status(404).json({
        code: 404,
        message: `文件不存在: ${filename}`,
        availableFiles: files
      })
    }
    
    const content = fs.readFileSync(filePath, 'utf-8')
    const geojsonData = JSON.parse(content)
    
    console.log(`   ✅ 读取成功，包含 ${geojsonData.features?.length || 0} 个要素`)
    
    res.json({
      code: 200,
      message: '读取成功',
      data: geojsonData
    })
  } catch (error) {
    console.error('❌ 读取GeoJSON失败:', error)
    res.status(500).json({
      code: 500,
      message: '读取失败: ' + error.message
    })
  }
})

// 保存分析结果GeoJSON
router.post('/save-result', (req, res) => {
  try {
    const { filename, geojsonData } = req.body
    
    console.log(`💾 收到保存请求，文件名: ${filename}`)
    console.log(`   数据类型: ${typeof geojsonData}`)
    console.log(`   要素数量: ${geojsonData?.features?.length || 0}`)
    
    if (!filename || !geojsonData) {
      console.log('   ❌ 缺少必要参数')
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数: filename 和 geojsonData 都是必需的'
      })
    }
    
    // 确保目录存在
    if (!fs.existsSync(GEOJSON_DIR)) {
      console.log(`   ℹ️ 创建目录: ${GEOJSON_DIR}`)
      fs.mkdirSync(GEOJSON_DIR, { recursive: true })
    }
    
    const filePath = path.join(GEOJSON_DIR, filename)
    console.log(`   保存路径: ${filePath}`)
    
    // 写入文件
    const jsonString = JSON.stringify(geojsonData, null, 2)
    console.log(`   JSON字符串长度: ${jsonString.length} 字符`)
    
    fs.writeFileSync(filePath, jsonString, 'utf-8')
    
    const stats = fs.statSync(filePath)
    
    console.log(`   ✅ 保存成功: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`)
    
    res.json({
      code: 200,
      message: '保存成功',
      data: {
        filename,
        size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
        path: filePath
      }
    })
  } catch (error) {
    console.error('❌ 保存分析结果失败:', error)
    console.error('   错误堆栈:', error.stack)
    res.status(500).json({
      code: 500,
      message: '保存失败: ' + error.message,
      error: error.toString()
    })
  }
})

// ========== 新增：分析结果持久化API ==========

// 保存完整的分析结果（JSON格式）
router.post('/save-analysis-result', (req, res) => {
  try {
    const { type, data } = req.body  // type: temporal/difference
    
    if (!type || !data) {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数: type 和 data'
      })
    }
    
    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = `${type}_${timestamp}.json`
    
    // 确定保存目录
    let targetDir
    if (type === 'temporal') {
      targetDir = TEMPORAL_DIR
    } else if (type === 'difference') {
      targetDir = DIFFERENCE_DIR
    } else {
      return res.status(400).json({
        code: 400,
        message: '不支持的分析类型，只支持 temporal 或 difference'
      })
    }
    
    const filePath = path.join(targetDir, filename)
    
    // 写入文件
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    
    const stats = fs.statSync(filePath)
    
    console.log(`✅ 保存分析结果成功: ${filename} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`)
    
    res.json({
      code: 200,
      message: '分析结果保存成功',
      data: {
        filename,
        path: `/data/data_analysis_results/${type}/${filename}`,
        size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`
      }
    })
  } catch (error) {
    console.error('保存分析结果失败:', error)
    res.status(500).json({
      code: 500,
      message: '保存失败',
      error: error.message
    })
  }
})

// 保存报告文件（Excel/CSV格式）
router.post('/save-report', (req, res) => {
  try {
    const { filename, content, type } = req.body  // type: 'excel' 或 'csv'
    
    if (!filename || !content) {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数: filename 和 content'
      })
    }
    
    const filePath = path.join(REPORTS_DIR, filename)
    
    // 根据类型处理内容
    if (type === 'csv') {
      // CSV文件直接写入文本
      fs.writeFileSync(filePath, content, 'utf-8')
    } else {
      // Excel文件（HTML格式）
      fs.writeFileSync(filePath, content, 'utf-8')
    }
    
    const stats = fs.statSync(filePath)
    
    console.log(`✅ 保存报告文件成功: ${filename} (${(stats.size / 1024).toFixed(2)} KB)`)
    
    res.json({
      code: 200,
      message: '报告文件保存成功',
      data: {
        filename,
        path: `/data/data_analysis_results/reports/${filename}`,
        size: `${(stats.size / 1024).toFixed(2)} KB`
      }
    })
  } catch (error) {
    console.error('保存报告文件失败:', error)
    res.status(500).json({
      code: 500,
      message: '保存失败',
      error: error.message
    })
  }
})

// 上传PDF报告文件
const pdfUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, REPORTS_DIR)
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname)
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ext === '.pdf') {
      cb(null, true)
    } else {
      cb(new Error('只支持PDF文件'))
    }
  }
})

router.post('/upload-report', pdfUpload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        code: 400,
        message: '没有上传文件'
      })
    }
    
    const uploadedFile = req.file
    const stats = fs.statSync(uploadedFile.path)
    
    console.log(`✅ PDF报告上传成功: ${uploadedFile.originalname} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`)
    
    res.json({
      code: 200,
      message: 'PDF报告上传成功',
      data: {
        filename: uploadedFile.originalname,
        format: 'PDF',
        size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
        path: `/data/data_analysis_results/reports/${uploadedFile.originalname}`
      }
    })
  } catch (error) {
    console.error('PDF报告上传失败:', error)
    res.status(500).json({
      code: 500,
      message: 'PDF报告上传失败',
      error: error.message
    })
  }
})

// 获取保存的分析结果列表
router.get('/saved-analysis-results', (req, res) => {
  try {
    const results = []
    
    // 扫描temporal目录
    if (fs.existsSync(TEMPORAL_DIR)) {
      const temporalFiles = fs.readdirSync(TEMPORAL_DIR).filter(f => f.endsWith('.json'))
      temporalFiles.forEach((filename) => {
        const filePath = path.join(TEMPORAL_DIR, filename)
        const stats = fs.statSync(filePath)
        
        // 读取文件内容获取元数据（仅小文件，大文件跳过metadata读取以提升性能）
        let metadata = {}
        try {
          // 如果文件小于10MB，读取metadata；否则跳过
          if (stats.size < 10 * 1024 * 1024) {
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
            metadata = content.metadata || {}
          } else {
            console.log(`⚠️ 文件较大(${(stats.size / (1024 * 1024)).toFixed(2)} MB)，跳过metadata读取: ${filename}`)
            metadata = { title: '大文件分析结果', note: '文件较大，请加载后查看详情' }
          }
          
          results.push({
            id: `temporal_${filename}`,
            filename,
            type: 'temporal',
            format: 'JSON',
            canLoadToMap: true,  // 可以加载到地图
            metadata,
            size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
            createTime: stats.mtime.toLocaleString('zh-CN'),
            timestamp: stats.mtimeMs,
            path: `/data/data_analysis_results/temporal/${filename}`
          })
        } catch (err) {
          console.error(`读取文件失败: ${filename}`, err)
          // 即使读取失败也添加基本信息
          results.push({
            id: `temporal_${filename}`,
            filename,
            type: 'temporal',
            format: 'JSON',
            canLoadToMap: true,
            metadata: { title: '解析失败', error: err.message },
            size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
            createTime: stats.mtime.toLocaleString('zh-CN'),
            timestamp: stats.mtimeMs,
            path: `/data/data_analysis_results/temporal/${filename}`
          })
        }
      })
    }
    
    // 扫描difference目录
    if (fs.existsSync(DIFFERENCE_DIR)) {
      const differenceFiles = fs.readdirSync(DIFFERENCE_DIR).filter(f => f.endsWith('.json'))
      differenceFiles.forEach((filename) => {
        const filePath = path.join(DIFFERENCE_DIR, filename)
        const stats = fs.statSync(filePath)
        
        // 读取文件内容获取元数据（仅小文件，大文件跳过metadata读取以提升性能）
        let metadata = {}
        try {
          // 如果文件小于10MB，读取metadata；否则跳过
          if (stats.size < 10 * 1024 * 1024) {
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
            metadata = content.metadata || {}
          } else {
            console.log(`⚠️ 文件较大(${(stats.size / (1024 * 1024)).toFixed(2)} MB)，跳过metadata读取: ${filename}`)
            metadata = { title: '大文件分析结果', note: '文件较大，请加载后查看详情' }
          }
          
          results.push({
            id: `difference_${filename}`,
            filename,
            type: 'difference',
            format: 'JSON',
            canLoadToMap: true,
            metadata,
            size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
            createTime: stats.mtime.toLocaleString('zh-CN'),
            timestamp: stats.mtimeMs,
            path: `/data/data_analysis_results/difference/${filename}`
          })
        } catch (err) {
          console.error(`读取文件失败: ${filename}`, err)
          // 即使读取失败也添加基本信息
          results.push({
            id: `difference_${filename}`,
            filename,
            type: 'difference',
            format: 'JSON',
            canLoadToMap: true,
            metadata: { title: '解析失败', error: err.message },
            size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
            createTime: stats.mtime.toLocaleString('zh-CN'),
            timestamp: stats.mtimeMs,
            path: `/data/data_analysis_results/difference/${filename}`
          })
        }
      })
    }
    
    // 扫描reports目录
    if (fs.existsSync(REPORTS_DIR)) {
      const reportFiles = fs.readdirSync(REPORTS_DIR)
      reportFiles.forEach((filename) => {
        const filePath = path.join(REPORTS_DIR, filename)
        const stats = fs.statSync(filePath)
        const ext = path.extname(filename).toLowerCase()
        
        let fileType = 'Excel'
        if (ext === '.csv') {
          fileType = 'CSV'
        } else if (ext === '.xls' || ext === '.xlsx') {
          fileType = 'Excel'
        } else if (ext === '.pdf') {
          fileType = 'PDF'
        }
        
        // 从文件名推断分析类型
        let analysisType = 'unknown'
        if (filename.includes('时序') || filename.includes('temporal')) {
          analysisType = 'temporal'
        } else if (filename.includes('差异') || filename.includes('difference')) {
          analysisType = 'difference'
        }
        
        results.push({
          id: `report_${filename}`,
          filename,
          type: 'report',
          format: fileType,
          analysisType,
          canLoadToMap: false,  // 报告文件不能加载到地图
          size: `${(stats.size / 1024).toFixed(2)} KB`,
          createTime: stats.mtime.toLocaleString('zh-CN'),
          timestamp: stats.mtimeMs,
          path: `/data/data_analysis_results/reports/${filename}`
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
    console.error('获取分析结果列表失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取失败',
      error: error.message
    })
  }
})

// 加载单个分析结果
router.get('/load-analysis-result/:type/:filename', (req, res) => {
  try {
    const { type, filename } = req.params
    
    let filePath
    if (type === 'temporal') {
      filePath = path.join(TEMPORAL_DIR, filename)
    } else if (type === 'difference') {
      filePath = path.join(DIFFERENCE_DIR, filename)
    } else {
      return res.status(400).json({
        code: 400,
        message: '不支持的分析类型'
      })
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        code: 404,
        message: '文件不存在'
      })
    }
    
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    
    console.log(`✅ 加载分析结果成功: ${filename}`)
    
    res.json({
      code: 200,
      message: '加载成功',
      data: content
    })
  } catch (error) {
    console.error('加载分析结果失败:', error)
    res.status(500).json({
      code: 500,
      message: '加载失败',
      error: error.message
    })
  }
})

// 下载报告文件
router.get('/download-report/:filename', (req, res) => {
  try {
    const { filename } = req.params
    const filePath = path.join(REPORTS_DIR, filename)
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('文件不存在')
    }
    
    console.log(`📥 下载报告文件: ${filename}`)
    
    res.download(filePath, filename)
  } catch (error) {
    console.error('下载报告失败:', error)
    if (!res.headersSent) {
      res.status(500).send('下载失败: ' + error.message)
    }
  }
})

// 删除分析结果文件
router.delete('/delete-analysis-result/:type/:filename', (req, res) => {
  try {
    const { type, filename } = req.params
    
    console.log(`🗑️ 收到删除请求:`)
    console.log(`   类型: ${type}`)
    console.log(`   文件名: ${filename}`)
    
    let filePath
    if (type === 'temporal') {
      filePath = path.join(TEMPORAL_DIR, filename)
    } else if (type === 'difference') {
      filePath = path.join(DIFFERENCE_DIR, filename)
    } else if (type === 'report') {
      filePath = path.join(REPORTS_DIR, filename)
    } else {
      console.log(`   ❌ 不支持的文件类型: ${type}`)
      return res.status(400).json({
        code: 400,
        message: '不支持的文件类型'
      })
    }
    
    console.log(`   完整路径: ${filePath}`)
    console.log(`   文件是否存在: ${fs.existsSync(filePath)}`)
    
    if (!fs.existsSync(filePath)) {
      console.log(`   ❌ 文件不存在`)
      // 列出目录中的文件以便调试
      const dirPath = path.dirname(filePath)
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath)
        console.log(`   目录中的文件 (${dirPath}):`, files.slice(0, 5))
      }
      
      return res.status(404).json({
        code: 404,
        message: `文件不存在: ${filename}`
      })
    }
    
    // 删除文件
    fs.unlinkSync(filePath)
    console.log(`   ✅ 文件已删除: ${type}/${filename}`)
    
    // 验证删除成功
    const stillExists = fs.existsSync(filePath)
    console.log(`   验证: 文件是否仍存在 = ${stillExists}`)
    
    res.json({
      code: 200,
      message: '删除成功',
      data: { type, filename, deleted: !stillExists }
    })
  } catch (error) {
    console.error('❌ 删除分析结果失败:', error)
    console.error('   错误堆栈:', error.stack)
    res.status(500).json({
      code: 500,
      message: '删除失败: ' + error.message
    })
  }
})

// 保存识别结果元数据
router.post('/save-recognition-metadata', async (req, res) => {
  try {
    const { filename, relativePath, metadata } = req.body
    
    if (!filename || !metadata) {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数'
      })
    }
    
    // 🔧 修复：根据文件类型确定保存目录
    let targetDir
    const fileExt = path.extname(filename).toLowerCase()
    
    if (fileExt === '.shp') {
      // SHP文件保存到 data_shp 目录
      targetDir = relativePath ? path.join(SHP_DIR, relativePath) : SHP_DIR
    } else if (fileExt === '.geojson' || fileExt === '.json') {
      // GeoJSON文件保存到 data_geojson 目录（但元数据一般不需要）
      targetDir = GEOJSON_DIR
    } else {
      // KMZ等其他文件保存到 data_kmz 目录
      targetDir = relativePath ? path.join(KMZ_DIR, relativePath) : KMZ_DIR
    }
    
    // 生成元数据文件名（与数据文件同名，但扩展名为.json）
    const metadataFilename = filename.replace(/\.(kmz|shp|geojson)$/i, '.json')
    const metadataPath = path.join(targetDir, metadataFilename)
    
    console.log(`💾 保存识别结果元数据:`)
    console.log(`   文件: ${filename}`)
    console.log(`   元数据路径: ${metadataPath}`)
    console.log(`   数据:`, metadata)
    
    // 确保目录存在
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }
    
    // 🆕 读取已有的元数据文件（如果存在），保留时间戳
    let existingMetadata = {}
    if (fs.existsSync(metadataPath)) {
      try {
        const existingContent = fs.readFileSync(metadataPath, 'utf-8')
        existingMetadata = JSON.parse(existingContent)
        console.log(`   读取到已有元数据:`, existingMetadata)
      } catch (err) {
        console.warn(`   ⚠️ 读取已有元数据失败:`, err.message)
      }
    }
    
    // 🆕 合并元数据，保留原有的 createdAt 和 uploadTime
    const completeMetadata = {
      ...metadata,
      // 保留原有的时间戳（如果存在）
      createdAt: existingMetadata.createdAt || metadata.createdAt || new Date().toISOString(),
      uploadTime: existingMetadata.uploadTime || metadata.uploadTime,
      updatedAt: new Date().toISOString()
    }
    
    // 写入元数据文件
    fs.writeFileSync(metadataPath, JSON.stringify(completeMetadata, null, 2), 'utf-8')
    
    console.log(`✅ 元数据保存成功: ${metadataFilename}`)
    
    res.json({
      code: 200,
      message: '保存成功',
      data: {
        metadataFile: metadataFilename,
        metadataPath: metadataPath
      }
    })
  } catch (error) {
    console.error('❌ 保存元数据失败:', error)
    res.status(500).json({
      code: 500,
      message: '保存失败: ' + error.message
    })
  }
})

// KMZ转GeoJSON（用于前端无法直接解析的KMZ文件）
router.post('/convert-kmz-to-geojson', async (req, res) => {
  try {
    const { kmzPath } = req.body
    
    if (!kmzPath) {
      return res.status(400).json({
        code: 400,
        message: '请提供KMZ文件路径'
      })
    }
    
    // 构建完整路径
    const fullPath = path.join(__dirname, '../../public', kmzPath)
    
    console.log(`🔄 转换KMZ为GeoJSON: ${kmzPath}`)
    console.log(`   完整路径: ${fullPath}`)
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        code: 404,
        message: 'KMZ文件不存在'
      })
    }
    
    // 方案1: 使用GDAL的ogr2ogr转换
    try {
      const { execSync } = await import('child_process')
      
      // 创建临时GeoJSON文件
      const tempGeojsonPath = fullPath.replace('.kmz', '_temp.geojson')
      
      // 使用ogr2ogr转换
      console.log('   尝试使用GDAL ogr2ogr转换...')
      const cmd = `ogr2ogr -f GeoJSON "${tempGeojsonPath}" "${fullPath}"`
      
      try {
        execSync(cmd, { timeout: 30000 })
        
        if (fs.existsSync(tempGeojsonPath)) {
          // 读取GeoJSON
          const geojsonContent = fs.readFileSync(tempGeojsonPath, 'utf-8')
          const geojson = JSON.parse(geojsonContent)
          
          // 删除临时文件
          fs.unlinkSync(tempGeojsonPath)
          
          console.log(`✅ KMZ转换成功，包含 ${geojson.features.length} 个要素`)
          
          return res.json({
            code: 200,
            message: '转换成功',
            data: {
              geojson: geojson
            }
          })
        }
      } catch (gdalError) {
        console.warn('   GDAL转换失败:', gdalError.message)
        // 继续尝试其他方案
      }
    } catch (error) {
      console.warn('   无法使用GDAL')
    }
    
    // 方案2: 手动解压KMZ并解析KML
    try {
      console.log('   尝试手动解压KMZ...')
      
      // 读取KMZ文件
      const kmzBuffer = fs.readFileSync(fullPath)
      
      // KMZ是ZIP格式，需要解压
      // 这里使用简单的方法：检查文件是否包含KML内容
      const AdmZip = (await import('adm-zip')).default
      const zip = new AdmZip(kmzBuffer)
      const zipEntries = zip.getEntries()
      
      console.log(`   KMZ包含 ${zipEntries.length} 个文件`)
      
      // 查找KML文件
      let kmlContent = null
      for (const entry of zipEntries) {
        if (entry.entryName.endsWith('.kml')) {
          kmlContent = entry.getData().toString('utf-8')
          console.log(`   找到KML文件: ${entry.entryName}`)
          break
        }
      }
      
      if (!kmlContent) {
        throw new Error('KMZ中没有找到KML文件')
      }
      
      // 使用togeojson库转换KML为GeoJSON
      const tj = await import('@mapbox/togeojson')
      const DOMParser = (await import('@xmldom/xmldom')).DOMParser
      
      const kmlDom = new DOMParser().parseFromString(kmlContent)
      const geojson = tj.kml(kmlDom)
      
      console.log(`✅ KML解析成功，包含 ${geojson.features.length} 个要素`)
      
      return res.json({
        code: 200,
        message: '转换成功',
        data: {
          geojson: geojson
        }
      })
      
    } catch (manualError) {
      console.error('   手动解析失败:', manualError.message)
      
      return res.status(500).json({
        code: 500,
        message: `KMZ转换失败: ${manualError.message}。请确保安装了必要的依赖：npm install adm-zip @mapbox/togeojson @xmldom/xmldom`
      })
    }
    
  } catch (error) {
    console.error('KMZ转换失败:', error)
    res.status(500).json({
      code: 500,
      message: error.message
    })
  }
})

export default router

