import express from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import multer from 'multer'
import { spawn } from 'child_process'
import { promisify } from 'util'
import { exec } from 'child_process'

const execAsync = promisify(exec)

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

// 数据目录（使用环境变量或根据运行环境自动判断，确保在 Docker 容器内得到正确的绝对路径）
// 优先使用环境变量，如果不存在则：容器内使用 /app/public，本地使用相对路径解析
const PUBLIC_DIR = process.env.PUBLIC_DIR || (fs.existsSync('/app') ? '/app/public' : path.resolve(__dirname, '../../public'))
const DATA_DIR = path.join(PUBLIC_DIR, 'data')
const SHP_DIR = path.join(DATA_DIR, 'data_shp')
const GEOJSON_DIR = path.join(DATA_DIR, 'data_geojson')
const KMZ_DIR = path.join(DATA_DIR, 'data_kmz')
const ANALYSIS_RESULTS_DIR = path.join(DATA_DIR, 'data_analysis_results')
const TEMPORAL_DIR = path.join(ANALYSIS_RESULTS_DIR, 'temporal')
const DIFFERENCE_DIR = path.join(ANALYSIS_RESULTS_DIR, 'difference')
const REPORTS_DIR = path.join(ANALYSIS_RESULTS_DIR, 'reports')

// Python脚本路径
const CALCULATE_AREA_SCRIPT = path.join(__dirname, '../scripts/calculate_area.py')

// 检测 Python 命令（Windows 用 python，Linux/Docker 用 python3）
const getPythonCommand = () => {
  // Windows 系统使用 python
  if (process.platform === 'win32') {
    return 'python'
  }
  // Linux/Docker 系统使用 python3
  return 'python3'
}

const PYTHON_CMD = getPythonCommand()

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
    
    // 🆕 修复：直接使用原文件名，不自动重命名
    // 因为前端已经有冲突检测和确认对话框，用户选择"覆盖"后应该直接覆盖文件
    
    // 对于GeoJSON和KMZ，如果文件已存在，先删除
    if (extLower === '.geojson' || extLower === '.json') {
      const existingFile = path.join(targetDir, originalName)
      if (fs.existsSync(existingFile)) {
        console.log(`   ⚠️ GeoJSON文件已存在，将被覆盖: ${originalName}`)
        fs.unlinkSync(existingFile)
      }
    } else if (extLower === '.kmz') {
      // KMZ文件需要删除对应的文件夹
      const kmzBasename = path.basename(originalName, '.kmz')
      const kmzFolder = path.join(targetDir, 'planting_situation', kmzBasename)
      if (fs.existsSync(kmzFolder)) {
        console.log(`   ⚠️ KMZ文件夹已存在，将被覆盖: ${kmzBasename}`)
        fs.rmSync(kmzFolder, { recursive: true, force: true })
      }
      // 同时删除KMZ_DIR根目录下的KMZ文件（如果存在）
      const existingKmz = path.join(targetDir, originalName)
      if (fs.existsSync(existingKmz)) {
        fs.unlinkSync(existingKmz)
      }
    }
    
    // 使用原文件名（覆盖模式）
    cb(null, originalName)
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

// 递归查找KMZ文件
function findKmzFile(dirPath, filename) {
  try {
    const items = fs.readdirSync(dirPath)
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item)
      const stats = fs.statSync(itemPath)
      
      if (stats.isDirectory()) {
        // 递归查找子目录
        const found = findKmzFile(itemPath, filename)
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
    console.error(`递归查找KMZ失败: ${dirPath}`, error)
    return null
  }
}

// 手动生成KML（更可靠，避免tokml的问题）
function generateKMLFromGeoJSON(geojson, documentName, description) {
  const escapeXml = (str) => {
    if (!str) return ''
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }
  
  const isValidCoordinate = (coord) => {
    return Array.isArray(coord) && 
           coord.length >= 2 && 
           typeof coord[0] === 'number' && 
           typeof coord[1] === 'number' &&
           !isNaN(coord[0]) && 
           !isNaN(coord[1]) &&
           Math.abs(coord[0]) <= 180 && 
           Math.abs(coord[1]) <= 90
  }
  
  const coordinatesToKML = (coordinates, geometryType) => {
    try {
      if (geometryType === 'Point') {
        if (!isValidCoordinate(coordinates)) return ''
        return `${coordinates[0]},${coordinates[1]},0`
      } else if (geometryType === 'LineString') {
        const validCoords = coordinates.filter(isValidCoordinate)
        if (validCoords.length < 2) return ''
        return validCoords.map(coord => `${coord[0]},${coord[1]},0`).join('\n          ')
      } else if (geometryType === 'Polygon') {
        // Polygon的第一个环是外环
        const outerRing = coordinates[0]
        if (!outerRing || outerRing.length === 0) return ''
        
        const validCoords = outerRing.filter(isValidCoordinate)
        if (validCoords.length < 3) return '' // 多边形至少需要3个点
        
        // 确保多边形闭合
        const first = validCoords[0]
        const last = validCoords[validCoords.length - 1]
        if (first[0] !== last[0] || first[1] !== last[1]) {
          validCoords.push([first[0], first[1]])
        }
        return validCoords.map(coord => `${coord[0]},${coord[1]},0`).join('\n          ')
      } else if (geometryType === 'MultiPolygon') {
        // 只处理第一个多边形的外环
        if (coordinates[0] && coordinates[0][0]) {
          const outerRing = coordinates[0][0]
          const validCoords = outerRing.filter(isValidCoordinate)
          if (validCoords.length < 3) return ''
          // 确保多边形闭合
          const first = validCoords[0]
          const last = validCoords[validCoords.length - 1]
          if (first[0] !== last[0] || first[1] !== last[1]) {
            validCoords.push([first[0], first[1]])
          }
          return validCoords.map(coord => `${coord[0]},${coord[1]},0`).join('\n          ')
        }
      }
      return ''
    } catch (error) {
      console.warn(`坐标转换失败:`, error.message)
      return ''
    }
  }
  
  const generatePlacemark = (feature, index) => {
    const props = feature.properties || {}
    const geom = feature.geometry
    
    if (!geom || !geom.type || !geom.coordinates) {
      return '' // 跳过无效几何
    }
    
    const name = escapeXml(props.name || props.Name || `地块${index + 1}`)
    const desc = escapeXml(props.description || props.Description || '')
    
    const coords = coordinatesToKML(geom.coordinates, geom.type)
    if (!coords) {
      return '' // 坐标无效，跳过
    }
    
    // 🆕 生成ExtendedData（存储面积、class等字段）
    let extendedDataXml = ''
    const dataFields = []
    
    // 添加面积数据
    if (props.area_m2 !== undefined && props.area_m2 !== null) {
      dataFields.push(`<Data name="area_m2"><value>${props.area_m2}</value></Data>`)
    }
    if (props.area_mu !== undefined && props.area_mu !== null) {
      dataFields.push(`<Data name="area_mu"><value>${props.area_mu}</value></Data>`)
    }
    
    // 添加class字段（种植情况）
    if (props.class !== undefined && props.class !== null) {
      dataFields.push(`<Data name="class"><value>${props.class}</value></Data>`)
    }
    
    // 添加其他可能有用的字段
    if (props.kNDVI !== undefined && props.kNDVI !== null) {
      dataFields.push(`<Data name="kNDVI"><value>${props.kNDVI}</value></Data>`)
    }
    if (props.Id !== undefined && props.Id !== null) {
      dataFields.push(`<Data name="Id"><value>${props.Id}</value></Data>`)
    }
    
    if (dataFields.length > 0) {
      extendedDataXml = `
      <ExtendedData>
        ${dataFields.join('\n        ')}
      </ExtendedData>`
    }
    
    let geometryXml = ''
    if (geom.type === 'Point') {
      geometryXml = `
        <Point>
          <coordinates>${coords}</coordinates>
        </Point>`
    } else if (geom.type === 'LineString') {
      geometryXml = `
        <LineString>
          <tessellate>1</tessellate>
          <coordinates>${coords}</coordinates>
        </LineString>`
    } else if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
      geometryXml = `
        <Polygon>
          <extrude>0</extrude>
          <altitudeMode>clampToGround</altitudeMode>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>${coords}</coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>`
    } else {
      return '' // 不支持的几何类型
    }
    
    return `
    <Placemark>
      <name>${name}</name>
      ${desc ? `<description>${desc}</description>` : ''}${extendedDataXml}
      ${geometryXml}
    </Placemark>`
  }
  
  const placemarks = geojson.features
    .map((feature, index) => generatePlacemark(feature, index))
    .filter(p => p) // 过滤掉空的placemark
    .join('\n')
  
  const validCount = placemarks.split('<Placemark>').length - 1
  const invalidCount = geojson.features.length - validCount
  
  if (invalidCount > 0) {
    console.log(`   📊 KML生成统计: ${validCount}个有效, ${invalidCount}个无效`)
  } else {
    console.log(`   📊 KML生成统计: ${validCount}个Placemark`)
  }
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(documentName)}</name>
    <description>${escapeXml(description)}</description>
    <Style id="defaultStyle">
      <LineStyle>
        <color>ff0000ff</color>
        <width>2</width>
      </LineStyle>
      <PolyStyle>
        <color>7f00ff00</color>
        <fill>1</fill>
        <outline>1</outline>
      </PolyStyle>
    </Style>
${placemarks}
  </Document>
</kml>`
}

/**
 * 使用 GeoPandas 计算 GeoJSON 中所有 feature 的面积
 * @param {Object} geojson - GeoJSON对象
 * @returns {Promise<Array>} 面积数组 [{area_m2, area_mu}, ...]
 */
async function calculateAreasWithGeopandas(geojson) {
  return new Promise((resolve, reject) => {
    console.log('📐 调用 Python (GeoPandas) 计算面积...')
    
    // 检查Python脚本是否存在
    if (!fs.existsSync(CALCULATE_AREA_SCRIPT)) {
      return reject(new Error(`Python脚本不存在: ${CALCULATE_AREA_SCRIPT}`))
    }
    
    // 使用 Python 命令（自动检测：Windows 用 python，Linux/Docker 用 python3）
    // 如果需要使用 conda 环境，可以使用: conda run -n <env_name> python
    const pythonCmd = PYTHON_CMD
    
    let python
    try {
      python = spawn(pythonCmd, [CALCULATE_AREA_SCRIPT])
    } catch (spawnError) {
      console.error('❌ 启动Python进程失败:', spawnError.message)
      return reject(new Error(`启动Python失败: ${spawnError.message}`))
    }
    
    let output = ''
    let errorOutput = ''
    let processExited = false
    let writeError = null
    
    python.stdout.on('data', (data) => {
      output += data.toString()
    })
    
    python.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })
    
    python.on('close', (code) => {
      processExited = true
      
      // 如果在写入时已经出错，使用写入错误信息
      if (writeError) {
        console.error('❌ Python进程提前退出，可能是环境配置问题')
        console.error('   错误输出:', errorOutput || '(无)')
        console.error('   提示: 请确保已正确安装 Python 和 geopandas 库')
        console.error('   安装命令: pip install geopandas shapely pyproj')
        return reject(new Error(`Python进程提前退出: ${errorOutput || '请检查Python环境配置'}`))
      }
      
      if (code !== 0) {
        console.error('❌ Python脚本执行失败')
        console.error('   退出码:', code)
        console.error('   错误输出:', errorOutput)
        
        // 检测常见错误并给出友好提示
        let errorMessage = errorOutput
        if (errorOutput.includes('ModuleNotFoundError') || errorOutput.includes('No module named')) {
          errorMessage = '缺少必要的Python库。请安装：pip install geopandas shapely pyproj'
        } else if (errorOutput.includes('ImportError')) {
          errorMessage = 'Python库加载失败。请检查Python环境配置'
        }
        
        return reject(new Error(`Python脚本失败 (退出码 ${code}): ${errorMessage}`))
      }
      
      try {
        const areas = JSON.parse(output)
        console.log(`✅ 面积计算完成，共 ${areas.length} 个地块`)
        
        // 统计总面积
        const totalAreaMu = areas.reduce((sum, a) => sum + (a.area_mu || 0), 0)
        console.log(`   总面积: ${totalAreaMu.toFixed(2)} 亩`)
        
        resolve(areas)
      } catch (e) {
        console.error('❌ 解析Python输出失败')
        console.error('   原始输出:', output)
        reject(new Error('解析Python输出失败: ' + e.message))
      }
    })
    
    python.on('error', (error) => {
      processExited = true
      console.error('❌ Python进程错误:', error.message)
      console.error('   提示: 请确保系统中已安装 Python')
      console.error('   检查命令: python --version')
      reject(new Error(`Python进程错误: ${error.message}。请确保已安装Python并添加到系统PATH`))
    })
    
    // ✅ 关键修复：在写入前等待一小段时间，确保进程已启动
    // 并在写入时捕获 EPIPE 错误
    setTimeout(() => {
      // 检查进程是否已经退出
      if (processExited) {
        console.error('❌ Python进程启动失败或立即退出')
        console.error('   错误输出:', errorOutput || '(无)')
        return reject(new Error('Python进程启动失败，请检查Python环境配置'))
      }
      
      // 将GeoJSON通过stdin传给Python
      try {
        const geojsonStr = JSON.stringify(geojson)
        
        // 检查数据大小
        const dataSizeMB = Buffer.byteLength(geojsonStr, 'utf8') / (1024 * 1024)
        if (dataSizeMB > 100) {
          console.warn(`   ⚠️ GeoJSON数据较大 (${dataSizeMB.toFixed(2)} MB)，可能需要较长时间`)
        }
        
        python.stdin.write(geojsonStr, (err) => {
          if (err) {
            writeError = err
            console.error('❌ 写入Python stdin失败:', err.message)
            // 不立即reject，等待close事件
          }
        })
        
        python.stdin.end((err) => {
          if (err) {
            writeError = err
            console.error('❌ 关闭Python stdin失败:', err.message)
          }
        })
      } catch (e) {
        writeError = e
        console.error('❌ 准备数据失败:', e.message)
        reject(new Error('准备数据失败: ' + e.message))
      }
    }, 100) // 等待100毫秒确保进程启动
  })
}

console.log('✅ 分析结果管理模块已加载')

// 获取KMZ文件的面积数据
router.post('/get-kmz-areas', async (req, res) => {
  try {
    const { kmzFilename, relativePath } = req.body
    
    console.log(`📐 收到KMZ面积计算请求: ${kmzFilename}`)
    console.log(`   相对路径: ${relativePath || '根目录'}`)
    
    const basename = path.basename(kmzFilename, '.kmz')
    
    // 1. 先查找是否有对应的GeoJSON文件（在GEOJSON_DIR根目录）
    let geojsonPath = path.join(GEOJSON_DIR, `${basename}.geojson`)
    let geojson
    
    console.log(`   🔍 查找GeoJSON: ${geojsonPath}`)
    
    if (fs.existsSync(geojsonPath)) {
      console.log(`   ✅ 找到对应的GeoJSON文件: ${basename}.geojson`)
      geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'))
      
      // 检查是否已有面积数据
      const hasAreaData = geojson.features.length > 0 && 
                          geojson.features.some(f => f.properties && f.properties.area_mu > 0)
      
      if (hasAreaData) {
        console.log(`   ✅ GeoJSON已包含面积数据，直接返回`)
        const areas = geojson.features.map(f => ({
          area_m2: f.properties.area_m2 || 0,
          area_mu: f.properties.area_mu || 0
        }))
        
        const totalAreaMu = areas.reduce((sum, a) => sum + a.area_mu, 0)
        console.log(`   📊 总面积: ${totalAreaMu.toFixed(2)} 亩`)
        
        return res.json({
          code: 200,
          message: '面积数据获取成功',
          data: {
            areas,
            totalAreaMu: totalAreaMu,
            source: 'geojson'
          }
        })
      } else {
        console.log(`   ⚠️ GeoJSON存在但没有面积数据`)
      }
    } else {
      console.log(`   ⚠️ 未找到对应的GeoJSON文件: ${basename}.geojson`)
      
      // 2. 如果没有GeoJSON，从KMZ转换
      let kmzPath
      if (relativePath) {
        kmzPath = path.join(KMZ_DIR, relativePath, kmzFilename)
      } else {
        kmzPath = path.join(KMZ_DIR, kmzFilename)
      }
      
      // 如果根目录不存在，递归查找
      if (!fs.existsSync(kmzPath)) {
        console.log(`   递归查找KMZ文件...`)
        kmzPath = findKmzFile(KMZ_DIR, kmzFilename)
        if (!kmzPath) {
          return res.status(404).json({
            code: 404,
            message: `KMZ文件不存在: ${kmzFilename}`
          })
        }
      }
      
      console.log(`   找到KMZ文件: ${kmzPath}`)
      
      // 导入必要的库
      let JSZip, tokml
      try {
        const JSZipModule = await import('jszip')
        JSZip = JSZipModule.default || JSZipModule
        const tokmModule = await import('tokml')
        tokml = tokmModule.default || tokmModule
      } catch (error) {
        return res.status(503).json({
          code: 503,
          message: '缺少必要的库，请运行: npm install jszip tokml --save'
        })
      }
      
      // 读取KMZ文件
      const kmzBuffer = fs.readFileSync(kmzPath)
      const zip = new JSZip()
      const unzipped = await zip.loadAsync(kmzBuffer)
      
      // 查找KML文件
      let kmlContent
      for (const filename in unzipped.files) {
        if (filename.endsWith('.kml')) {
          kmlContent = await unzipped.files[filename].async('string')
          break
        }
      }
      
      if (!kmlContent) {
        return res.status(400).json({
          code: 400,
          message: 'KMZ文件中未找到KML数据'
        })
      }
      
      console.log(`   ✅ 提取KML内容成功`)
      
      // 暂不支持从KMZ转换
      return res.status(404).json({
        code: 404,
        message: `未找到对应的GeoJSON文件: ${basename}.geojson，请先转换SHP为KMZ（会自动生成GeoJSON）`
      })
    }
    
    // 如果GeoJSON存在但没有面积数据，返回空数据
    console.log(`   ⚠️ GeoJSON文件存在但没有面积数据，返回空结果`)
    return res.json({
      code: 200,
      message: '未找到面积数据',
      data: {
        areas: [],
        totalAreaMu: 0,
        source: 'none'
      }
    })
    
  } catch (error) {
    console.error('❌ 获取KMZ面积失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取面积失败: ' + error.message
    })
  }
})

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
      const geojsonFiles = fs.readdirSync(GEOJSON_DIR).filter(f => f.endsWith('.geojson'))
      geojsonFiles.forEach((filename) => {
        const geojsonPath = path.join(GEOJSON_DIR, filename)
        const stats = fs.statSync(geojsonPath)
        const ext = path.extname(filename)
        const basename = path.basename(filename, ext)
        
        // 🆕 读取GeoJSON文件的metadata字段
        let metadata = {}
        try {
          const geojsonContent = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'))
          if (geojsonContent.metadata) {
            metadata = geojsonContent.metadata
          }
        } catch (error) {
          console.warn(`读取GeoJSON元数据失败: ${filename}`, error.message)
        }
        
        // 🔧 修复：优先使用元数据中的createdAt字段作为创建时间
        let createTime = stats.mtime.toLocaleString('zh-CN')
        let timestamp = stats.mtimeMs
        
        if (metadata.createdAt) {
          const createdDate = new Date(metadata.createdAt)
          createTime = createdDate.toLocaleString('zh-CN')
          timestamp = createdDate.getTime()
        } else if (metadata.uploadTime) {
          const uploadDate = new Date(metadata.uploadTime)
          createTime = uploadDate.toLocaleString('zh-CN')
          timestamp = uploadDate.getTime()
        }
        
        results.push({
          id: `geojson_${basename}_${timestamp}`,
          name: filename,
          type: 'GeoJSON',
          format: 'geojson',
          taskName: metadata.taskName || basename,
          analysisType: 'recognition',
          recognitionType: metadata.recognitionType || 'crop_recognition',
          size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
          createTime: createTime,
          timestamp: timestamp,
          regionCode: metadata.regionCode || '',
          regionName: metadata.regionName || '未知任务',
          year: metadata.year || '',
          period: metadata.period || ''
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
            let metadata = {}
            const metadataPath = path.join(itemPath.replace('.kmz', '.json'))
            if (fs.existsSync(metadataPath)) {
              try {
                metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
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
            
            // 🔧 修复：优先使用元数据中的createdAt字段作为创建时间
            let createTime = stats.mtime.toLocaleString('zh-CN')
            let timestamp = stats.mtimeMs
            
            if (metadata.createdAt) {
              const createdDate = new Date(metadata.createdAt)
              createTime = createdDate.toLocaleString('zh-CN')
              timestamp = createdDate.getTime()
            } else if (metadata.uploadTime) {
              const uploadDate = new Date(metadata.uploadTime)
              createTime = uploadDate.toLocaleString('zh-CN')
              timestamp = uploadDate.getTime()
            }
            
            results.push({
              id: `kmz_${basename}_${timestamp}`,
              name: item,
              type: 'KMZ',
              format: 'kmz',
              taskName: metadata.taskName || basename,
              analysisType: 'recognition',
              recognitionType: metadata.recognitionType || recognitionType, // 优先使用元数据中的识别类型
              regionCode: regionCode.toUpperCase(), // 区域代码
              regionName: regionName, // 区域中文名称
              year: year, // 年份
              period: period, // 期次
              size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
              createTime: createTime,
              timestamp: timestamp,
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
    
    // 🆕 使用 GeoPandas 计算面积并添加到 properties
    console.log(`📐 开始计算面积...`)
    try {
      const areas = await calculateAreasWithGeopandas(geojson)
      
      // 将面积添加到每个 feature 的 properties 中
      geojson.features.forEach((feature, idx) => {
        if (areas[idx]) {
          if (!feature.properties) {
            feature.properties = {}
          }
          feature.properties.area_m2 = areas[idx].area_m2
          feature.properties.area_mu = areas[idx].area_mu
          
          // 如果计算出错，标记错误
          if (areas[idx].error) {
            feature.properties.area_error = true
          }
        }
      })
      
      console.log(`✅ 面积已添加到GeoJSON的properties中`)
    } catch (areaError) {
      // 面积计算失败不影响转换，只是不添加面积字段
      console.warn(`⚠️ 面积计算失败，将继续转换但不包含面积信息`)
      console.warn(`   错误: ${areaError.message}`)
      console.warn(`   提示: 请确保已安装 geopandas (conda install geopandas)`)
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

// 🆕 SHP临时转换为GeoJSON（带缓存，不保存到磁盘，只返回数据）
router.post('/convert-shp-temp', async (req, res) => {
  try {
    const { shpFilename, relativePath } = req.body
    
    if (!shpFilename) {
      return res.status(400).json({
        code: 400,
        message: '请提供SHP文件名'
      })
    }
    
    // 查找SHP文件路径
    let shpPath
    if (relativePath) {
      shpPath = path.join(SHP_DIR, relativePath, shpFilename)
    } else {
      shpPath = path.join(SHP_DIR, shpFilename)
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
    const basename = path.basename(shpFilename, '.shp')
    
    // 🔧 方案1：缓存机制
    // 缓存文件路径
    const CACHE_DIR = path.join(PUBLIC_DIR, 'data', 'data_geojson_cache')
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true })
      console.log(`📁 创建缓存目录: ${CACHE_DIR}`)
    }
    
    const cacheFilePath = path.join(CACHE_DIR, `${basename}.geojson`)
    const shpStats = fs.statSync(shpPath)
    const shpMtime = shpStats.mtime.getTime()
    
    // 检查缓存是否有效
    let useCache = false
    if (fs.existsSync(cacheFilePath)) {
      const cacheStats = fs.statSync(cacheFilePath)
      const cacheMtime = cacheStats.mtime.getTime()
      
      // 如果缓存文件的修改时间晚于SHP文件，则使用缓存
      if (cacheMtime >= shpMtime) {
        useCache = true
        console.log(`✅ 使用缓存: ${basename}.geojson (缓存时间: ${new Date(cacheMtime).toLocaleString()})`)
      } else {
        console.log(`⚠️ 缓存过期（SHP已更新），重新计算`)
      }
    }
    
    if (useCache) {
      // 从缓存读取
      const geojson = JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8'))
      console.log(`📦 从缓存加载完成，共 ${geojson.features.length} 个要素`)
      
      return res.json({
        code: 200,
        message: '从缓存加载成功',
        data: {
          geojson: geojson,
          featureCount: geojson.features.length,
          hasAreaData: geojson.features.some(f => f.properties && f.properties.area_mu),
          filename: `${basename}.geojson`,
          fromCache: true
        }
      })
    }
    
    console.log(`🔄 开始临时转换: ${shpFilename} -> GeoJSON (内存)`)
    
    // 🔧 使用GeoPandas读取并转换坐标系
    let geojson
    try {
      const { spawn } = await import('child_process');
      geojson = await new Promise((resolve, reject) => {
        const pythonScript = `
import geopandas as gpd
import json
import sys
from pyproj import Geod

try:
    # 读取SHP文件
    gdf = gpd.read_file(r'${shpPath}')
    original_crs = str(gdf.crs) if gdf.crs else 'Unknown'
    print(f'   📍 原始坐标系: {original_crs}', file=sys.stderr)
    
    # 转换坐标系为WGS84
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        print(f'   🔄 转换坐标系: {original_crs} -> EPSG:4326 (WGS84)', file=sys.stderr)
        gdf = gdf.to_crs(epsg=4326)
    else:
        print(f'   ✅ 坐标系已是WGS84，无需转换', file=sys.stderr)
    
    # 计算测地线面积
    print(f'   📐 计算测地线面积...', file=sys.stderr)
    geod = Geod(ellps='WGS84')
    areas_m2 = []
    for geom in gdf.geometry:
        try:
            area, _ = geod.geometry_area_perimeter(geom)
            areas_m2.append(abs(area))
        except Exception as e:
            print(f'   ⚠️ 某个地块面积计算失败: {str(e)}', file=sys.stderr)
            areas_m2.append(0)
    
    # 添加面积字段到GeoDataFrame
    gdf['area_m2'] = areas_m2
    gdf['area_mu'] = [a * 0.0015 for a in areas_m2]
    
    print(f'   ✅ 面积计算完成', file=sys.stderr)
    
    # 转换为GeoJSON
    geojson_str = gdf.to_json()
    print(geojson_str)
    
except Exception as e:
    print(f'Error: {str(e)}', file=sys.stderr)
    sys.exit(1)
`;
        
        const python = spawn(PYTHON_CMD, ['-c', pythonScript]);
        let stdout = '';
        let stderr = '';
        
        python.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        python.stderr.on('data', (data) => {
          stderr += data.toString();
          console.log(data.toString().trim());
        });
        
        python.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`GeoPandas转换失败: ${stderr}`));
          } else {
            try {
              const geojsonData = JSON.parse(stdout);
              resolve(geojsonData);
            } catch (e) {
              reject(new Error(`解析GeoJSON失败: ${e.message}`));
            }
          }
        });
      });
      
      console.log(`✅ 临时转换完成，共 ${geojson.features.length} 个要素`)
      
    } catch (geopandasError) {
      console.warn(`⚠️ GeoPandas转换失败，使用备用方法: ${geopandasError.message}`);
      
      // 回退到shapefile库
      const shapefile = await import('shapefile')
      const source = await shapefile.open(shpPath)
      
      geojson = {
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
      
      console.warn(`⚠️ 使用shapefile库转换，坐标系可能不正确，面积计算可能不准确`)
      console.log(`✅ 临时转换完成（备用方法），共 ${geojson.features.length} 个要素`)
    }
    
    // 读取SHP的元数据（如果存在）
    const shpMetadataPath = path.join(path.dirname(shpPath), `${basename}.json`)
    if (fs.existsSync(shpMetadataPath)) {
      const shpMetadata = JSON.parse(fs.readFileSync(shpMetadataPath, 'utf-8'))
      geojson.metadata = {
        year: shpMetadata.year,
        period: shpMetadata.period,
        regionCode: shpMetadata.regionCode,
        regionName: shpMetadata.regionName,
        recognitionType: shpMetadata.recognitionType,
        taskName: shpMetadata.taskName || basename,
        source: shpMetadata.source || '作物识别',
        createdAt: shpMetadata.createdAt,
        updatedAt: new Date().toISOString()
      }
      console.log(`📋 已读取SHP元数据`)
    }
    
    // 🔧 方案1：保存到缓存
    try {
      fs.writeFileSync(cacheFilePath, JSON.stringify(geojson, null, 2), 'utf-8')
      console.log(`💾 已保存到缓存: ${cacheFilePath}`)
    } catch (cacheError) {
      console.warn(`⚠️ 缓存保存失败: ${cacheError.message}`)
    }
    
    // 返回GeoJSON数据
    res.json({
      code: 200,
      message: '转换成功',
      data: {
        geojson: geojson,
        featureCount: geojson.features.length,
        hasAreaData: geojson.features.some(f => f.properties && f.properties.area_mu),
        filename: `${basename}.geojson`,
        fromCache: false
      }
    })
  } catch (error) {
    console.error('临时转换失败:', error)
    res.status(500).json({
      code: 500,
      message: '临时转换失败: ' + error.message
    })
  }
})

// 🆕 检测文件冲突（上传前检查）- 简化版：只检测文件名是否存在
router.post('/check-file-conflict', async (req, res) => {
  try {
    const { filename } = req.body
    
    if (!filename) {
      return res.status(400).json({
        code: 400,
        message: '请提供文件名'
      })
    }
    
    console.log(`🔍 检查文件是否存在: ${filename}`)
    
    // 获取文件类型
    const ext = path.extname(filename).toLowerCase()
    let fileExists = false
    
    if (ext === '.zip') {
      // SHP文件（ZIP压缩包）
      const basename = path.basename(filename, '.zip')
      const targetDir = path.join(SHP_DIR, basename)
      fileExists = fs.existsSync(targetDir)
    } else if (ext === '.geojson' || ext === '.json') {
      // GeoJSON文件
      const targetPath = path.join(GEOJSON_DIR, filename)
      fileExists = fs.existsSync(targetPath)
    } else if (ext === '.kmz') {
      // KMZ文件
      const basename = path.basename(filename, '.kmz')
      // 查找KMZ文件夹
      const kmzFolder = path.join(KMZ_DIR, 'planting_situation', basename)
      fileExists = fs.existsSync(kmzFolder)
    }
    
    console.log(`📋 文件${fileExists ? '已存在' : '不存在'}: ${filename}`)
    
    res.json({
      code: 200,
      message: fileExists ? '文件已存在' : '文件不存在，可以上传',
      data: {
        conflict: fileExists
      }
    })
    
  } catch (error) {
    console.error('冲突检测失败:', error)
    res.status(500).json({
      code: 500,
      message: '冲突检测失败: ' + error.message
    })
  }
})

// 🆕 方案2：快速加载SHP（不计算面积，只转换坐标系）
router.post('/convert-shp-fast', async (req, res) => {
  try {
    const { shpFilename, relativePath } = req.body
    
    if (!shpFilename) {
      return res.status(400).json({
        code: 400,
        message: '请提供SHP文件名'
      })
    }
    
    // 查找SHP文件路径
    let shpPath
    if (relativePath) {
      shpPath = path.join(SHP_DIR, relativePath, shpFilename)
    } else {
      shpPath = path.join(SHP_DIR, shpFilename)
      if (!fs.existsSync(shpPath)) {
        shpPath = findShpFile(SHP_DIR, shpFilename)
      }
    }
    
    if (!shpPath || !fs.existsSync(shpPath)) {
      return res.status(404).json({
        code: 404,
        message: `SHP文件不存在: ${shpFilename}`
      })
    }
    
    console.log(`⚡ 快速加载SHP文件: ${shpPath}`)
    const basename = path.basename(shpFilename, '.shp')
    
    // 使用GeoPandas读取并转换坐标系（不计算面积）
    let geojson
    try {
      const { spawn } = await import('child_process');
      geojson = await new Promise((resolve, reject) => {
        const pythonScript = `
import geopandas as gpd
import json
import sys

try:
    # 读取SHP文件
    gdf = gpd.read_file(r'${shpPath}')
    original_crs = str(gdf.crs) if gdf.crs else 'Unknown'
    print(f'   📍 原始坐标系: {original_crs}', file=sys.stderr)
    
    # 转换坐标系为WGS84
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        print(f'   🔄 转换坐标系: {original_crs} -> EPSG:4326 (WGS84)', file=sys.stderr)
        gdf = gdf.to_crs(epsg=4326)
    else:
        print(f'   ✅ 坐标系已是WGS84，无需转换', file=sys.stderr)
    
    print(f'   ⚡ 快速加载完成（不计算面积）', file=sys.stderr)
    
    # 转换为GeoJSON
    geojson_str = gdf.to_json()
    print(geojson_str)
    
except Exception as e:
    print(f'Error: {str(e)}', file=sys.stderr)
    sys.exit(1)
`;
        
        const python = spawn(PYTHON_CMD, ['-c', pythonScript]);
        let stdout = '';
        let stderr = '';
        
        python.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        python.stderr.on('data', (data) => {
          stderr += data.toString();
          console.log(data.toString().trim());
        });
        
        python.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`GeoPandas转换失败: ${stderr}`));
          } else {
            try {
              const geojsonData = JSON.parse(stdout);
              resolve(geojsonData);
            } catch (e) {
              reject(new Error(`解析GeoJSON失败: ${e.message}`));
            }
          }
        });
      });
      
      console.log(`⚡ 快速加载完成，共 ${geojson.features.length} 个要素`)
      
    } catch (geopandasError) {
      console.warn(`⚠️ GeoPandas转换失败: ${geopandasError.message}`);
      return res.status(500).json({
        code: 500,
        message: 'GeoPandas转换失败: ' + geopandasError.message
      })
    }
    
    // 读取SHP的元数据
    const shpMetadataPath = path.join(path.dirname(shpPath), `${basename}.json`)
    if (fs.existsSync(shpMetadataPath)) {
      const shpMetadata = JSON.parse(fs.readFileSync(shpMetadataPath, 'utf-8'))
      geojson.metadata = {
        year: shpMetadata.year,
        period: shpMetadata.period,
        regionCode: shpMetadata.regionCode,
        regionName: shpMetadata.regionName,
        recognitionType: shpMetadata.recognitionType,
        taskName: shpMetadata.taskName || basename,
        source: shpMetadata.source || '作物识别',
        createdAt: shpMetadata.createdAt,
        updatedAt: new Date().toISOString()
      }
    }
    
    res.json({
      code: 200,
      message: '快速加载成功',
      data: {
        geojson: geojson,
        featureCount: geojson.features.length,
        hasAreaData: false,
        filename: `${basename}.geojson`
      }
    })
  } catch (error) {
    console.error('快速加载失败:', error)
    res.status(500).json({
      code: 500,
      message: '快速加载失败: ' + error.message
    })
  }
})

// 🆕 方案2：异步计算SHP面积
router.post('/calculate-shp-areas', async (req, res) => {
  try {
    const { shpFilename, relativePath } = req.body
    
    if (!shpFilename) {
      return res.status(400).json({
        code: 400,
        message: '请提供SHP文件名'
      })
    }
    
    // 查找SHP文件路径
    let shpPath
    if (relativePath) {
      shpPath = path.join(SHP_DIR, relativePath, shpFilename)
    } else {
      shpPath = path.join(SHP_DIR, shpFilename)
      if (!fs.existsSync(shpPath)) {
        shpPath = findShpFile(SHP_DIR, shpFilename)
      }
    }
    
    if (!shpPath || !fs.existsSync(shpPath)) {
      return res.status(404).json({
        code: 404,
        message: `SHP文件不存在: ${shpFilename}`
      })
    }
    
    console.log(`📐 开始计算面积: ${shpPath}`)
    const basename = path.basename(shpFilename, '.shp')
    
    // 检查缓存
    const CACHE_DIR = path.join(PUBLIC_DIR, 'data', 'data_geojson_cache')
    const cacheFilePath = path.join(CACHE_DIR, `${basename}.geojson`)
    
    if (fs.existsSync(cacheFilePath)) {
      const shpStats = fs.statSync(shpPath)
      const cacheStats = fs.statSync(cacheFilePath)
      
      if (cacheStats.mtime.getTime() >= shpStats.mtime.getTime()) {
        const geojson = JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8'))
        console.log(`✅ 从缓存读取面积数据`)
        
        // 提取面积数据
        const areas = geojson.features.map(f => ({
          area_m2: f.properties.area_m2 || 0,
          area_mu: f.properties.area_mu || 0
        }))
        
        return res.json({
          code: 200,
          message: '面积计算完成（从缓存）',
          data: {
            areas: areas,
            totalAreaMu: areas.reduce((sum, a) => sum + a.area_mu, 0),
            fromCache: true
          }
        })
      }
    }
    
    // 使用GeoPandas计算面积
    try {
      const { spawn } = await import('child_process');
      const result = await new Promise((resolve, reject) => {
        const pythonScript = `
import geopandas as gpd
import json
import sys
from pyproj import Geod

try:
    # 读取SHP文件
    gdf = gpd.read_file(r'${shpPath}')
    
    # 转换坐标系为WGS84
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(epsg=4326)
    
    # 计算测地线面积
    print(f'   📐 计算测地线面积...', file=sys.stderr)
    geod = Geod(ellps='WGS84')
    areas = []
    for geom in gdf.geometry:
        try:
            area, _ = geod.geometry_area_perimeter(geom)
            area_m2 = abs(area)
            area_mu = area_m2 * 0.0015
            areas.append({'area_m2': round(area_m2, 6), 'area_mu': round(area_mu, 2)})
        except Exception as e:
            areas.append({'area_m2': 0, 'area_mu': 0})
    
    print(f'   ✅ 面积计算完成', file=sys.stderr)
    print(json.dumps({'areas': areas}))
    
except Exception as e:
    print(f'Error: {str(e)}', file=sys.stderr)
    sys.exit(1)
`;
        
        const python = spawn(PYTHON_CMD, ['-c', pythonScript]);
        let stdout = '';
        let stderr = '';
        
        python.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        python.stderr.on('data', (data) => {
          stderr += data.toString();
          console.log(data.toString().trim());
        });
        
        python.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`GeoPandas计算失败: ${stderr}`));
          } else {
            try {
              const resultData = JSON.parse(stdout);
              resolve(resultData);
            } catch (e) {
              reject(new Error(`解析结果失败: ${e.message}`));
            }
          }
        });
      });
      
      const areas = result.areas
      const totalAreaMu = areas.reduce((sum, a) => sum + a.area_mu, 0)
      
      console.log(`✅ 面积计算完成，总面积: ${totalAreaMu.toFixed(2)} 亩`)
      
      res.json({
        code: 200,
        message: '面积计算完成',
        data: {
          areas: areas,
          totalAreaMu: totalAreaMu,
          fromCache: false
        }
      })
      
    } catch (error) {
      console.error('面积计算失败:', error)
      res.status(500).json({
        code: 500,
        message: '面积计算失败: ' + error.message
      })
    }
  } catch (error) {
    console.error('面积计算失败:', error)
    res.status(500).json({
      code: 500,
      message: '面积计算失败: ' + error.message
    })
  }
})

// SHP转换为KMZ（不保留中间文件）
router.post('/convert-shp-to-kmz', async (req, res) => {
  try {
    const { shpFilename, relativePath } = req.body
    
    if (!shpFilename) {
      return res.status(400).json({
        code: 400,
        message: '请提供SHP文件名'
      })
    }
    
    // 查找SHP文件路径
    let shpPath
    if (relativePath) {
      shpPath = path.join(SHP_DIR, relativePath, shpFilename)
    } else {
      shpPath = path.join(SHP_DIR, shpFilename)
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
    
    // 生成文件名
    const basename = path.basename(shpFilename, '.shp')
    const kmzFilename = `${basename}.kmz`
    
    // 🔧 修复：读取SHP元数据，根据recognitionType决定保存文件夹
    const shpMetadataPath = path.join(path.dirname(shpPath), `${basename}.json`)
    let recognitionType = 'planting_situation'  // 默认为种植情况识别
    
    if (fs.existsSync(shpMetadataPath)) {
      try {
        const shpMetadata = JSON.parse(fs.readFileSync(shpMetadataPath, 'utf-8'))
        recognitionType = shpMetadata.recognitionType || 'planting_situation'
        console.log(`   📋 读取到SHP元数据，recognitionType: ${recognitionType}`)
      } catch (err) {
        console.warn(`   ⚠️ 读取SHP元数据失败: ${err.message}`)
      }
    }
    
    // 🆕 根据recognitionType确定文件夹
    const taskFolder = recognitionType === 'crop_recognition' 
      ? 'crop_identification' 
      : 'planting_situation'
    
    const kmzSubDir = path.join(KMZ_DIR, taskFolder, basename)
    if (!fs.existsSync(kmzSubDir)) {
      fs.mkdirSync(kmzSubDir, { recursive: true })
      console.log(`   📁 创建文件夹: ${kmzSubDir}`)
    }
    const kmzPath = path.join(kmzSubDir, kmzFilename)
    
    if (fs.existsSync(kmzPath)) {
      const stats = fs.statSync(kmzPath)
      console.log(`⚠️ KMZ文件已存在，跳过转换: ${kmzFilename}`)
      return res.json({
        code: 400,
        message: '该文件已经转换过了，请不要重复转换！如需重新转换，请先删除原文件。',
        data: {
          kmzFilename: kmzFilename,
          size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
          existed: true
        }
      })
    }
    
    // 导入需要的库
    let shapefile, JSZip
    try {
      shapefile = await import('shapefile')
      const JSZipModule = await import('jszip')
      JSZip = JSZipModule.default || JSZipModule
    } catch (error) {
      return res.status(503).json({
        code: 503,
        message: '缺少必要的库，请运行: npm install shapefile jszip --save',
        error: error.message
      })
    }
    
    console.log(`🔄 开始转换: ${shpFilename} -> KMZ`)
    
    // 步骤1: 使用GeoPandas读取SHP并转换为WGS84 (EPSG:4326)
    console.log(`   1️⃣ 读取SHP文件并转换坐标系...`)
    
    let geojson
    try {
      // 使用GeoPandas读取并转换坐标系
      const { spawn } = await import('child_process')
      
      geojson = await new Promise((resolve, reject) => {
        const pythonScript = `
import geopandas as gpd
import json
import sys

try:
    # 读取SHP文件
    gdf = gpd.read_file(r'${shpPath}')
    
    # 检查当前坐标系
    original_crs = str(gdf.crs) if gdf.crs else 'Unknown'
    print(f'   📍 原始坐标系: {original_crs}', file=sys.stderr)
    
    # 如果不是EPSG:4326，转换为WGS84
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        print(f'   🔄 转换坐标系: {original_crs} -> EPSG:4326 (WGS84)', file=sys.stderr)
        gdf = gdf.to_crs(epsg=4326)
    else:
        print(f'   ✅ 坐标系已是WGS84，无需转换', file=sys.stderr)
    
    # 转换为GeoJSON
    geojson_str = gdf.to_json()
    print(geojson_str)
    
except Exception as e:
    print(f'Error: {str(e)}', file=sys.stderr)
    sys.exit(1)
`
        
        const python = spawn(PYTHON_CMD, ['-c', pythonScript])
        
        let stdout = ''
        let stderr = ''
        
        python.stdout.on('data', (data) => {
          stdout += data.toString()
        })
        
        python.stderr.on('data', (data) => {
          const msg = data.toString()
          stderr += msg
          // 输出GeoPandas的日志
          if (msg.includes('📍') || msg.includes('🔄') || msg.includes('✅')) {
            console.log(msg.trim())
          }
        })
        
        python.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`GeoPandas处理失败: ${stderr}`))
          } else {
            try {
              const result = JSON.parse(stdout)
              resolve(result)
            } catch (parseError) {
              reject(new Error(`解析GeoJSON失败: ${parseError.message}`))
            }
          }
        })
      })
      
      console.log(`   ✅ 读取完成，共 ${geojson.features.length} 个要素`)
      
    } catch (geopandasError) {
      // 如果GeoPandas失败，回退到shapefile库（但可能坐标系不对）
      console.warn(`   ⚠️ GeoPandas转换失败，使用备用方法: ${geopandasError.message}`)
      console.log(`   📖 正在使用shapefile库读取...`)
      
      const source = await shapefile.open(shpPath)
      geojson = {
        type: 'FeatureCollection',
        features: []
      }
      
      let result = await source.read()
      let invalidCount = 0
      while (!result.done) {
        if (result.value) {
          const geom = result.value.geometry
          if (geom && geom.coordinates && geom.coordinates.length > 0) {
            geojson.features.push(result.value)
          } else {
            invalidCount++
          }
        }
        result = await source.read()
      }
      console.log(`   ✅ 读取完成，共 ${geojson.features.length} 个有效要素${invalidCount > 0 ? ` (跳过${invalidCount}个无效要素)` : ''}`)
      console.warn(`   ⚠️ 注意: 坐标系可能不是WGS84，KMZ可能无法在Google Earth中正确显示`)
    }
    
    // 步骤2: 使用GeoPandas计算面积并保存GeoJSON
    console.log(`   2️⃣ 使用GeoPandas计算面积...`)
    let hasAreaData = false
    try {
      const areas = await calculateAreasWithGeopandas(geojson)
      
      // 将面积添加到每个 feature 的 properties 中
      geojson.features.forEach((feature, idx) => {
        if (areas[idx]) {
          if (!feature.properties) {
            feature.properties = {}
          }
          feature.properties.area_m2 = areas[idx].area_m2
          feature.properties.area_mu = areas[idx].area_mu
          
          // 如果计算出错，标记错误
          if (areas[idx].error) {
            feature.properties.area_error = true
          }
        }
      })
      
      hasAreaData = true
      console.log(`   ✅ 面积计算完成`)
      
    } catch (areaError) {
      console.warn(`   ⚠️ 面积计算失败: ${areaError.message}`)
      console.warn(`   ⚠️ 将继续转换但不包含面积数据`)
    }
    
    // 🆕 读取SHP的元数据（如果存在）- 注意：前面已经读取过一次，这里只是再次确认并保存到GeoJSON
    let shpMetadata = null
    
    if (fs.existsSync(shpMetadataPath)) {
      shpMetadata = JSON.parse(fs.readFileSync(shpMetadataPath, 'utf-8'))
      console.log(`   📋 找到SHP元数据文件（年份: ${shpMetadata.year}, 期次: ${shpMetadata.period}, 区域: ${shpMetadata.regionName || '未指定'}）`)
      
      // 🆕 将元数据保存到GeoJSON的根级别（方便前端读取）- 只保留recognitionType，删除source字段
      // 🔧 修复：转换时使用真实的创建时间，而不是继承SHP的创建时间
      const currentTime = new Date().toISOString()
      geojson.metadata = {
        year: shpMetadata.year,
        period: shpMetadata.period,
        regionCode: shpMetadata.regionCode,
        regionName: shpMetadata.regionName,
        recognitionType: shpMetadata.recognitionType || recognitionType,  // 使用前面读取的recognitionType
        taskName: shpMetadata.taskName || basename,
        createdAt: currentTime,  // 使用转换时的真实时间
        updatedAt: currentTime
      }
      console.log(`   📋 已将元数据添加到GeoJSON根级别`)
    } else {
      console.log(`   ⚠️ SHP元数据文件不存在`)
    }
    
    // 保存GeoJSON文件（带面积数据和元数据）
    console.log(`   💾 保存GeoJSON文件...`)
    const geojsonFilename = `${basename}.geojson`
    const geojsonPath = path.join(GEOJSON_DIR, geojsonFilename)
    fs.writeFileSync(geojsonPath, JSON.stringify(geojson, null, 2))
    const geojsonStats = fs.statSync(geojsonPath)
    console.log(`   ✅ 已保存GeoJSON: ${geojsonFilename} (${(geojsonStats.size / (1024 * 1024)).toFixed(2)} MB)`)
    
    // 步骤3: GeoJSON → KML（手动生成，更可靠）
    console.log(`   3️⃣ 转换为KML...`)
    const kml = generateKMLFromGeoJSON(geojson, basename, `Converted from ${shpFilename}`)
    console.log(`   ✅ KML转换完成`)
    
    // 步骤4: KML → KMZ（压缩）
    console.log(`   4️⃣ 压缩为KMZ...`)
    const zip = new JSZip()
    zip.file('doc.kml', kml)
    const kmzBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    })
    
    // 写入KMZ文件
    fs.writeFileSync(kmzPath, kmzBuffer)
    const stats = fs.statSync(kmzPath)
    
    // 🆕 复制或创建元数据JSON文件到KMZ文件夹（只保留必要字段，删除source字段）
    const kmzMetadataPath = path.join(kmzSubDir, `${basename}.json`)
    
    if (shpMetadata) {
      // 🔧 修复：如果SHP文件夹有元数据，只复制必要字段，删除source字段
      // 🔧 修复：使用转换时的真实时间作为创建时间
      const currentTime = new Date().toISOString()
      const kmzMeta = {
        year: shpMetadata.year,
        period: shpMetadata.period,
        regionCode: shpMetadata.regionCode,
        regionName: shpMetadata.regionName,
        recognitionType: shpMetadata.recognitionType || recognitionType,
        taskName: shpMetadata.taskName || basename,
        createdAt: currentTime,  // 使用转换时的真实时间
        updatedAt: currentTime
      }
      fs.writeFileSync(kmzMetadataPath, JSON.stringify(kmzMeta, null, 2))
      console.log(`   📋 已复制SHP元数据到KMZ文件夹（年份: ${kmzMeta.year}, 期次: ${kmzMeta.period}, 区域: ${kmzMeta.regionName || '未指定'}）`)
    } else {
      // 创建默认元数据
      console.log(`   ⚠️ SHP元数据文件不存在，创建默认元数据`)
      const metadata = {
        year: 2024,
        period: 1,
        regionCode: '',
        regionName: '',
        recognitionType: recognitionType,  // 使用前面读取的recognitionType
        taskName: basename,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      fs.writeFileSync(kmzMetadataPath, JSON.stringify(metadata, null, 2))
      console.log(`   📋 已创建默认元数据文件`)
    }
    
    console.log(`✅ 转换完成: ${kmzFilename} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`)
    
    res.json({
      code: 200,
      message: hasAreaData ? '转换成功（已生成GeoJSON和KMZ，包含面积数据）' : '转换成功（已生成GeoJSON和KMZ）',
      data: {
        kmzFilename: kmzFilename,
        geojsonFilename: geojsonFilename,
        kmzSize: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
        geojsonSize: `${(geojsonStats.size / (1024 * 1024)).toFixed(2)} MB`,
        featureCount: geojson.features.length,
        relativePath: `${taskFolder}/${basename}`,  // 🔧 修复：根据recognitionType动态生成路径
        hasAreaData: hasAreaData
      }
    })
  } catch (error) {
    console.error('❌ 转换失败:', error)
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
router.delete('/delete/:type/:filename', async (req, res) => {
  try {
    const { type, filename } = req.params
    
    console.log(`🗑️ 收到删除请求: type=${type}, filename=${filename}`)
    
    let filePath
    const deletedFiles = []
    
    if (type === 'shp') {
      // 🔧 修复：先查找SHP文件，然后删除文件所在的整个文件夹
      const basename = path.basename(filename, '.shp')
      
      // 先尝试直接查找文件
      filePath = path.join(SHP_DIR, filename)
      if (!fs.existsSync(filePath)) {
        console.log(`   根目录未找到，开始递归查找: ${filename}`)
        filePath = findShpFile(SHP_DIR, filename)
        if (!filePath) {
          return res.status(404).json({
            code: 404,
            message: `SHP文件不存在: ${filename}`
          })
        }
      }
      console.log(`   找到SHP文件: ${filePath}`)
      
      // 🔧 获取SHP文件所在的文件夹路径（父目录）
      const folderPath = path.dirname(filePath)
      console.log(`   SHP文件所在文件夹: ${folderPath}`)
      
      // 🔧 确保是子文件夹（不是根目录data_shp）
      if (folderPath !== SHP_DIR && fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
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
        
        // 🔧 删除整个文件夹（包括文件夹本身）
        console.log(`   🗑️ 正在删除整个文件夹: ${folderPath}`)
        console.log(`   📋 删除前文件夹状态: 存在=${fs.existsSync(folderPath)}`)
        console.log(`   📋 文件夹中的文件数: ${files.length}`)
        
        // 使用同步方法删除，确保删除完成
        try {
          fs.rmSync(folderPath, { recursive: true, force: true })
          console.log(`   🔄 rmSync执行完成`)
        } catch (rmError) {
          console.error(`   ❌ rmSync执行失败:`, rmError)
          return res.status(500).json({
            code: 500,
            message: `删除失败: ${rmError.message}`
          })
        }
        
        // 等待一小段时间，确保文件系统操作完成（Windows可能需要）
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // 验证删除是否成功
        const stillExists = fs.existsSync(folderPath)
        console.log(`   📋 删除后文件夹状态: 存在=${stillExists}`)
        
        if (stillExists) {
          console.error(`   ❌ 删除失败！文件夹仍然存在: ${folderPath}`)
          console.error(`   💡 可能原因: 文件被占用、权限不足、或文件系统延迟`)
          
          // 尝试列出文件夹内容，帮助诊断
          try {
            const remainingFiles = fs.readdirSync(folderPath)
            console.error(`   📂 文件夹中剩余文件:`, remainingFiles)
          } catch (listError) {
            console.error(`   ⚠️ 无法列出文件夹内容:`, listError.message)
          }
          
          return res.status(500).json({
            code: 500,
            message: `删除失败：文件夹可能被占用或没有权限。请关闭所有打开该文件的程序后重试。`
          })
        }
        
        console.log(`   ✅ 已完全删除SHP文件夹: ${path.basename(folderPath)} (包含 ${files.length} 个文件，文件夹已删除)`)
        
      } else {
        // 如果SHP文件直接在根目录，只删除相关文件（不删除data_shp文件夹）
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
      
      // 🆕 同时删除对应的GeoJSON缓存（如果存在）
      const GEOJSON_CACHE_DIR = path.join(PUBLIC_DIR, 'data', 'data_geojson_cache')
      const cachedGeojsonFile = path.join(GEOJSON_CACHE_DIR, basename + '.geojson')
      if (fs.existsSync(cachedGeojsonFile)) {
        fs.unlinkSync(cachedGeojsonFile)
        deletedFiles.push('cache/' + basename + '.geojson')
        console.log(`   ✅ 已删除GeoJSON缓存: ${basename}.geojson`)
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
      // 🔧 修复：删除整个KMZ文件夹（包括元数据）
      const basename = path.basename(filename, '.kmz')
      
      // 尝试在planting_situation下查找文件夹
      let kmzFolder = path.join(KMZ_DIR, 'planting_situation', basename)
      
      if (!fs.existsSync(kmzFolder)) {
        // 如果不存在，尝试根目录
        kmzFolder = path.join(KMZ_DIR, basename)
      }
      
      if (!fs.existsSync(kmzFolder)) {
        // 递归查找KMZ文件
        const kmzFilePath = findKmzFile(KMZ_DIR, filename)
        if (!kmzFilePath) {
          return res.status(404).json({
            code: 404,
            message: `KMZ文件或文件夹不存在: ${filename}`
          })
        }
        kmzFolder = path.dirname(kmzFilePath)
      }
      
      console.log(`   找到KMZ文件夹: ${kmzFolder}`)
      
      // 获取文件夹中的所有文件
      const getAllFiles = (dir) => {
        const files = []
        try {
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
        } catch (error) {
          console.error(`读取文件夹失败: ${dir}`, error)
        }
        return files
      }
      
      const files = getAllFiles(kmzFolder)
      deletedFiles.push(...files)
      
      // 删除整个文件夹
      fs.rmSync(kmzFolder, { recursive: true, force: true })
      console.log(`   ✅ 已删除KMZ文件夹: ${basename} (包含 ${files.length} 个文件)`)
      
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
      // 正确处理中文文件名：multer 默认使用 latin1 编码，需要转换为 utf8
      try {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8')
        cb(null, originalName)
      } catch (error) {
        // 如果转换失败，使用原始文件名
        console.warn('文件名编码转换失败，使用原始文件名:', file.originalname)
        cb(null, file.originalname)
      }
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

// 上传PDF报告（带元数据，用于图表报表和时序报表）
router.post('/upload-pdf-report', pdfUpload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        code: 400,
        message: '没有上传文件'
      })
    }
    
    const uploadedFile = req.file
    const stats = fs.statSync(uploadedFile.path)
    const { type, taskName } = req.body
    
    // 正确处理中文文件名
    let originalname = uploadedFile.originalname
    try {
      originalname = Buffer.from(uploadedFile.originalname, 'latin1').toString('utf8')
    } catch (error) {
      console.warn('文件名编码转换失败，使用原始文件名')
    }
    
    console.log(`✅ PDF报告上传成功: ${originalname}`)
    console.log(`   类型: ${type || 'chart_report'}`)
    console.log(`   任务名: ${taskName || '未命名'}`)
    console.log(`   大小: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`)
    
    // 创建元数据JSON文件（与PDF同名，扩展名为.json）
    const basename = path.basename(originalname, '.pdf')
    const metadataPath = path.join(REPORTS_DIR, `${basename}.json`)
    
    const metadata = {
      filename: originalname,
      type: type || 'chart_report', // 图表报表或时序报表
      taskName: taskName || '未命名报表',
      createdAt: new Date().toISOString(),
      size: stats.size
    }
    
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')
    console.log(`   📋 元数据已保存: ${basename}.json`)
    
    res.json({
      code: 200,
      message: 'PDF报告上传成功',
      data: {
        filename: originalname,
        format: 'PDF',
        type: metadata.type,
        taskName: metadata.taskName,
        size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
        path: `/data/data_analysis_results/reports/${originalname}`
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
            taskName: metadata.title || filename,  // 将metadata.title映射到taskName
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
            taskName: filename,  // 解析失败时使用文件名
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
            taskName: metadata.title || filename,  // 将metadata.title映射到taskName
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
            taskName: filename,  // 解析失败时使用文件名
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
      const reportFiles = fs.readdirSync(REPORTS_DIR).filter(f => !f.endsWith('.json')) // 排除元数据JSON文件
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
        
        // 尝试读取元数据JSON文件
        let taskName = filename
        let analysisType = 'report'
        let reportType = 'unknown'
        
        const basename = path.basename(filename, ext)
        const metadataPath = path.join(REPORTS_DIR, `${basename}.json`)
        
        if (fs.existsSync(metadataPath)) {
          try {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
            taskName = metadata.taskName || filename
            reportType = metadata.type || 'unknown'
            
            // 根据元数据中的type字段确定报告类型
            if (reportType === 'chart_report') {
              analysisType = 'chart_report'
            } else if (reportType === 'temporal_report') {
              analysisType = 'temporal_report'
            } else if (reportType === 'region_comparison') {
              analysisType = 'region_comparison'
            }
            
            console.log(`   📋 读取报告元数据: ${filename}, 任务名: ${taskName}, 类型: ${reportType}`)
          } catch (err) {
            console.warn(`   ⚠️ 读取报告元数据失败: ${metadataPath}`, err.message)
          }
        } else {
          // 如果没有元数据文件，从文件名推断分析类型
          if (filename.includes('时序') || filename.includes('temporal')) {
            reportType = 'temporal'
          } else if (filename.includes('差异') || filename.includes('difference')) {
            reportType = 'difference'
          } else if (filename.includes('农作物') || filename.includes('分析报告')) {
            reportType = 'chart_report'
            analysisType = 'chart_report'
          }
        }
        
        results.push({
          id: `report_${filename}`,
          filename,
          type: analysisType, // 使用分析类型（如果是图表报表则为chart_report，否则为report）
          format: fileType,
          reportType, // 报告的具体类型
          taskName, // 任务名
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
    const filesToDelete = []
    
    if (type === 'temporal') {
      filePath = path.join(TEMPORAL_DIR, filename)
      filesToDelete.push(filePath)
    } else if (type === 'difference') {
      filePath = path.join(DIFFERENCE_DIR, filename)
      filesToDelete.push(filePath)
    } else if (type === 'report') {
      filePath = path.join(REPORTS_DIR, filename)
      filesToDelete.push(filePath)
      
      // 如果是PDF报告，同时删除对应的JSON文件
      if (filename.toLowerCase().endsWith('.pdf')) {
        const jsonFilename = filename.replace(/\.pdf$/i, '.json')
        const jsonFilePath = path.join(REPORTS_DIR, jsonFilename)
        filesToDelete.push(jsonFilePath)
        console.log(`   📝 同时删除JSON文件: ${jsonFilename}`)
      }
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
    
    // 删除所有文件
    let deletedCount = 0
    for (const fileToDelete of filesToDelete) {
      if (fs.existsSync(fileToDelete)) {
        fs.unlinkSync(fileToDelete)
        console.log(`   ✅ 文件已删除: ${path.basename(fileToDelete)}`)
        deletedCount++
      }
    }
    
    // 验证删除成功
    const stillExists = fs.existsSync(filePath)
    console.log(`   验证: 主文件是否仍存在 = ${stillExists}`)
    console.log(`   共删除 ${deletedCount} 个文件`)
    
    res.json({
      code: 200,
      message: `删除成功（共 ${deletedCount} 个文件）`,
      data: { type, filename, deleted: !stillExists, totalDeleted: deletedCount }
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
    
    const fileExt = path.extname(filename).toLowerCase()
    
    console.log(`💾 保存识别结果元数据:`)
    console.log(`   文件: ${filename}`)
    console.log(`   原路径: ${relativePath}`)
    console.log(`   元数据:`, metadata)
    
    // 🔧 修复：根据文件类型采用不同的保存策略
    if (fileExt === '.geojson') {
      // 🆕 GeoJSON文件：直接修改文件的metadata字段，不生成单独的JSON文件
      const geojsonPath = path.join(GEOJSON_DIR, filename)
      
      if (!fs.existsSync(geojsonPath)) {
        return res.status(404).json({
          code: 404,
          message: 'GeoJSON文件不存在'
        })
      }
      
      // 读取GeoJSON文件
      const geojsonContent = fs.readFileSync(geojsonPath, 'utf-8')
      const geojson = JSON.parse(geojsonContent)
      
      // 🔧 修复：保留原有的createdAt字段
      const originalCreatedAt = geojson.metadata?.createdAt
      
      // 更新metadata字段（只保留必要的字段，移除source字段）
      geojson.metadata = {
        year: metadata.year,
        period: metadata.period,
        regionCode: metadata.regionCode,
        regionName: metadata.regionName,
        recognitionType: metadata.recognitionType,
        taskName: metadata.taskName,
        createdAt: originalCreatedAt || metadata.createdAt || new Date().toISOString(),  // 保留原创建时间
        updatedAt: new Date().toISOString()  // 更新修改时间
      }
      
      // 写回GeoJSON文件
      fs.writeFileSync(geojsonPath, JSON.stringify(geojson, null, 2), 'utf-8')
      
      console.log(`✅ GeoJSON元数据已更新: ${filename}`)
      
      return res.json({
        code: 200,
        message: '保存成功',
        data: {
          type: 'geojson',
          filename: filename,
          updated: true
        }
      })
    } else if (fileExt === '.kmz') {
      // 🆕 KMZ文件：更新JSON元数据，并根据recognitionType移动到正确的文件夹
      const oldDir = relativePath ? path.join(KMZ_DIR, relativePath) : KMZ_DIR
      const oldKmzPath = path.join(oldDir, filename)
      const oldJsonPath = path.join(oldDir, filename.replace('.kmz', '.json'))
      
      // 确定新的目标文件夹
      const taskFolder = metadata.recognitionType === 'crop_recognition' 
        ? 'crop_identification' 
        : 'planting_situation'
      
      const baseNameWithoutExt = filename.replace('.kmz', '')
      const newDir = path.join(KMZ_DIR, taskFolder, baseNameWithoutExt)
      const newKmzPath = path.join(newDir, filename)
      const newJsonPath = path.join(newDir, filename.replace('.kmz', '.json'))
      
      console.log(`   旧路径: ${oldKmzPath}`)
      console.log(`   新路径: ${newKmzPath}`)
      
      // 如果recognitionType改变，需要移动文件
      const needMove = oldDir !== newDir
      
      if (needMove) {
        // 确保新目录存在
        if (!fs.existsSync(newDir)) {
          fs.mkdirSync(newDir, { recursive: true })
        }
        
        // 移动KMZ文件
        if (fs.existsSync(oldKmzPath)) {
          fs.renameSync(oldKmzPath, newKmzPath)
          console.log(`   ✅ KMZ文件已移动`)
        }
        
        // 移动JSON元数据文件（如果存在）
        if (fs.existsSync(oldJsonPath)) {
          fs.renameSync(oldJsonPath, newJsonPath)
          console.log(`   ✅ JSON元数据文件已移动`)
        }
        
        // 🔧 修复：删除原来的整个文件夹（仅在修改来源任务时）
        try {
          if (fs.existsSync(oldDir)) {
            // 检查文件夹是否为空
            const files = fs.readdirSync(oldDir)
            if (files.length === 0) {
              fs.rmdirSync(oldDir)
              console.log(`   ✅ 已删除空文件夹: ${path.relative(KMZ_DIR, oldDir)}`)
            } else {
              console.log(`   ⚠️ 原文件夹不为空，保留: ${files.join(', ')}`)
            }
          }
        } catch (err) {
          console.warn(`   ⚠️ 删除原文件夹失败:`, err.message)
        }
      }
      
      // 读取或创建元数据
      let existingMetadata = {}
      const jsonPath = needMove ? newJsonPath : oldJsonPath
      
      if (fs.existsSync(jsonPath)) {
        try {
          const existingContent = fs.readFileSync(jsonPath, 'utf-8')
          existingMetadata = JSON.parse(existingContent)
        } catch (err) {
          console.warn(`   ⚠️ 读取已有元数据失败:`, err.message)
        }
      }
      
      // 🆕 更新元数据（只保留必要的字段，移除source字段）
      const completeMetadata = {
        year: metadata.year,
        period: metadata.period,
        regionCode: metadata.regionCode,
        regionName: metadata.regionName,
        recognitionType: metadata.recognitionType,
        taskName: metadata.taskName,
        createdAt: existingMetadata.createdAt || metadata.createdAt || new Date().toISOString(),
        uploadTime: existingMetadata.uploadTime || metadata.uploadTime,
        updatedAt: new Date().toISOString()
      }
      
      // 确保目录存在
      const targetDir = needMove ? newDir : oldDir
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }
      
      // 写入元数据文件
      fs.writeFileSync(jsonPath, JSON.stringify(completeMetadata, null, 2), 'utf-8')
      
      console.log(`✅ KMZ元数据已保存${needMove ? '并移动到新文件夹' : ''}`)
      
      return res.json({
        code: 200,
        message: '保存成功',
        data: {
          type: 'kmz',
          filename: filename,
          moved: needMove,
          newPath: needMove ? path.relative(KMZ_DIR, newDir) : relativePath
        }
      })
    } else if (fileExt === '.shp') {
      // SHP文件：继续使用JSON元数据文件
      const targetDir = relativePath ? path.join(SHP_DIR, relativePath) : SHP_DIR
      const metadataFilename = filename.replace('.shp', '.json')
      const metadataPath = path.join(targetDir, metadataFilename)
      
      // 确保目录存在
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }
      
      // 读取已有的元数据文件（如果存在）
      let existingMetadata = {}
      if (fs.existsSync(metadataPath)) {
        try {
          const existingContent = fs.readFileSync(metadataPath, 'utf-8')
          existingMetadata = JSON.parse(existingContent)
        } catch (err) {
          console.warn(`   ⚠️ 读取已有元数据失败:`, err.message)
        }
      }
      
      // 🆕 更新元数据（只保留必要的字段，移除source字段）
      const completeMetadata = {
        year: metadata.year,
        period: metadata.period,
        regionCode: metadata.regionCode,
        regionName: metadata.regionName,
        recognitionType: metadata.recognitionType,
        taskName: metadata.taskName,
        createdAt: existingMetadata.createdAt || metadata.createdAt || new Date().toISOString(),
        uploadTime: existingMetadata.uploadTime || metadata.uploadTime,
        updatedAt: new Date().toISOString()
      }
      
      // 写入元数据文件
      fs.writeFileSync(metadataPath, JSON.stringify(completeMetadata, null, 2), 'utf-8')
      
      console.log(`✅ SHP元数据已保存: ${metadataFilename}`)
      
      return res.json({
        code: 200,
        message: '保存成功',
        data: {
          type: 'shp',
          metadataFile: metadataFilename
        }
      })
    } else {
      return res.status(400).json({
        code: 400,
        message: '不支持的文件类型'
      })
    }
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
    
    //  修复：优先使用手动解析（方案2），因为它能正确保留ExtendedData中的class字段
    // GDAL转换可能丢失ExtendedData信息，所以先尝试手动解析
    // 如果手动解析失败，再尝试GDAL（作为降级方案）
    
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
      
      //  修复：从KML的ExtendedData中提取字段并添加到GeoJSON properties中
      // @mapbox/togeojson 默认不会保留 ExtendedData 中的字段
      const placemarks = kmlDom.getElementsByTagName('Placemark')
      console.log(`   找到 ${placemarks.length} 个Placemark元素`)
      
      for (let i = 0; i < placemarks.length && i < geojson.features.length; i++) {
        const placemark = placemarks[i]
        const feature = geojson.features[i]
        
        if (!feature.properties) {
          feature.properties = {}
        }
        
        // 提取ExtendedData中的字段
        const extendedData = placemark.getElementsByTagName('ExtendedData')[0]
        if (extendedData) {
          const dataElements = extendedData.getElementsByTagName('Data')
          
          for (let j = 0; j < dataElements.length; j++) {
            const dataElement = dataElements[j]
            const name = dataElement.getAttribute('name')
            const valueElement = dataElement.getElementsByTagName('value')[0]
            
            if (name && valueElement) {
              const value = valueElement.textContent || valueElement.text || ''
              
              // 转换数值类型
              if (name === 'class' || name === 'gridcode') {
                const numValue = parseInt(value, 10)
                if (!isNaN(numValue)) {
                  feature.properties[name] = numValue
                } else {
                  feature.properties[name] = value
                }
              } else if (name === 'area_m2' || name === 'area_mu') {
                const numValue = parseFloat(value)
                if (!isNaN(numValue)) {
                  feature.properties[name] = numValue
                } else {
                  feature.properties[name] = value
                }
              } else {
                feature.properties[name] = value
              }
            }
          }
        }
        
        // 也提取Name字段（如果有）
        const nameElement = placemark.getElementsByTagName('name')[0]
        if (nameElement && !feature.properties.name) {
          feature.properties.name = nameElement.textContent || nameElement.text || ''
        }
      }
      
      console.log(`✅ KML解析成功，包含 ${geojson.features.length} 个要素`)
      console.log(`   已提取ExtendedData字段到properties`)
      
      // 检查第一个要素是否有class字段
      if (geojson.features.length > 0) {
        const firstProps = geojson.features[0].properties || {}
        const hasClass = firstProps.class !== undefined || firstProps.gridcode !== undefined
        console.log(`   第一个要素的properties:`, Object.keys(firstProps))
        console.log(`   是否有class字段: ${hasClass}`)
        if (hasClass) {
          console.log(`   class值: ${firstProps.class || firstProps.gridcode}`)
        }
      }
      
      return res.json({
        code: 200,
        message: '转换成功',
        data: {
          geojson: geojson
        }
      })
      
    } catch (manualError) {
      console.error('   手动解析失败:', manualError.message)
      console.log('   尝试使用GDAL作为降级方案...')
      
      // 降级方案：使用GDAL转换（可能丢失ExtendedData，但至少能转换几何）
      try {
        const { execSync } = await import('child_process')
        
        // 创建临时GeoJSON文件
        const tempGeojsonPath = fullPath.replace('.kmz', '_temp.geojson')
        
        // 使用ogr2ogr转换
        const cmd = `ogr2ogr -f GeoJSON "${tempGeojsonPath}" "${fullPath}"`
        
        try {
          execSync(cmd, { timeout: 30000 })
          
          if (fs.existsSync(tempGeojsonPath)) {
            // 读取GeoJSON
            const geojsonContent = fs.readFileSync(tempGeojsonPath, 'utf-8')
            const geojson = JSON.parse(geojsonContent)
            
            // 删除临时文件
            fs.unlinkSync(tempGeojsonPath)
            
            console.log(`✅ GDAL转换成功，包含 ${geojson.features.length} 个要素`)
            console.log(`   ⚠️ 注意：GDAL转换可能丢失ExtendedData中的class字段`)
            
            // 尝试从原始KML中提取ExtendedData并补充到GeoJSON中
            try {
              const AdmZip = (await import('adm-zip')).default
              const kmzBuffer = fs.readFileSync(fullPath)
              const zip = new AdmZip(kmzBuffer)
              let kmlContent = null
              
              for (const entry of zip.getEntries()) {
                if (entry.entryName.endsWith('.kml')) {
                  kmlContent = entry.getData().toString('utf-8')
                  break
                }
              }
              
              if (kmlContent) {
                const DOMParser = (await import('@xmldom/xmldom')).DOMParser
                const kmlDom = new DOMParser().parseFromString(kmlContent)
                const placemarks = kmlDom.getElementsByTagName('Placemark')
                
                // 尝试匹配并补充ExtendedData
                for (let i = 0; i < placemarks.length && i < geojson.features.length; i++) {
                  const placemark = placemarks[i]
                  const feature = geojson.features[i]
                  
                  if (!feature.properties) {
                    feature.properties = {}
                  }
                  
                  const extendedData = placemark.getElementsByTagName('ExtendedData')[0]
                  if (extendedData) {
                    const dataElements = extendedData.getElementsByTagName('Data')
                    for (let j = 0; j < dataElements.length; j++) {
                      const dataElement = dataElements[j]
                      const name = dataElement.getAttribute('name')
                      const valueElement = dataElement.getElementsByTagName('value')[0]
                      
                      if (name && valueElement) {
                        const value = valueElement.textContent || valueElement.text || ''
                        if (name === 'class' || name === 'gridcode') {
                          const numValue = parseInt(value, 10)
                          if (!isNaN(numValue)) {
                            feature.properties[name] = numValue
                          }
                        } else if (name === 'area_m2' || name === 'area_mu') {
                          const numValue = parseFloat(value)
                          if (!isNaN(numValue)) {
                            feature.properties[name] = numValue
                          }
                        } else {
                          feature.properties[name] = value
                        }
                      }
                    }
                  }
                }
                console.log(`   ✅ 已从KML补充ExtendedData字段`)
              }
            } catch (supplementError) {
              console.warn('   补充ExtendedData失败:', supplementError.message)
            }
            
            return res.json({
              code: 200,
              message: '转换成功（使用GDAL，已补充ExtendedData）',
              data: {
                geojson: geojson
              }
            })
          }
        } catch (gdalError) {
          console.error('   GDAL转换也失败:', gdalError.message)
          throw new Error(`KMZ转换失败: ${manualError.message}。GDAL降级方案也失败: ${gdalError.message}`)
        }
      } catch (gdalFallbackError) {
        console.error('   GDAL降级方案执行失败:', gdalFallbackError.message)
        return res.status(500).json({
          code: 500,
          message: `KMZ转换失败: ${manualError.message}。请确保安装了必要的依赖：npm install adm-zip @mapbox/togeojson @xmldom/xmldom`
        })
      }
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

