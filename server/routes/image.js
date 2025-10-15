import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// 数据目录
const DATA_DIR = path.join(__dirname, '../../public/data')
const METADATA_FILE = path.join(DATA_DIR, 'imageData.json')

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
  const year = parts[0] || new Date().getFullYear()
  
  return {
    name: filename,
    year: year,
    sensor: parts.length > 2 ? parts[2] : 'Unknown',
    region: parts.length > 1 ? parts[1] : 'Unknown',
    date: `${year}-01-01`,
    cloudCover: Math.floor(Math.random() * 30),
    status: 'processed'
  }
}

// 扫描data目录，同步元数据
function syncMetadata() {
  const files = fs.readdirSync(DATA_DIR)
  const tifFiles = files.filter(f => {
    const ext = path.extname(f).toLowerCase()
    return ['.tif', '.tiff'].includes(ext)
  })
  
  const metadata = readMetadata()
  const existingNames = new Set(metadata.images.map(img => img.name))
  
  // 添加新文件
  tifFiles.forEach((filename) => {
    if (!existingNames.has(filename)) {
      const stats = fs.statSync(path.join(DATA_DIR, filename))
      const fileSize = (stats.size / (1024 * 1024)).toFixed(2) + 'MB'
      const info = parseImageInfo(filename)
      
      metadata.images.push({
        id: 'IMG' + String(metadata.images.length + 1).padStart(3, '0'),
        ...info,
        size: fileSize,
        thumbnail: `/data/${filename}`,
        preview: `/data/${filename}`,
        uploadTime: new Date().toISOString()
      })
    }
  })
  
  // 移除已删除的文件
  metadata.images = metadata.images.filter(img => tifFiles.includes(img.name))
  
  writeMetadata(metadata)
  return metadata
}

// 初始化
initMetadata()
syncMetadata()

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

export default router
