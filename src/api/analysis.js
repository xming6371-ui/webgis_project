import request from './index'

// 获取识别结果列表（从data_shp和data_geojson目录扫描）
export const getRecognitionResults = () => {
  return request.get('/analysis/results')
}

// SHP转换为GeoJSON
export const convertShpToGeojson = (shpFilename, relativePath = null) => {
  return request.post('/analysis/convert-to-geojson', {
    shpFilename,
    relativePath
  })
}

// SHP转换为KMZ（中间文件不保留）
export const convertShpToKmz = (shpFilename, relativePath) => {
  return request.post('/analysis/convert-shp-to-kmz', {
    shpFilename,
    relativePath
  })
}

// 下载文件
export const downloadAnalysisFile = (type, filename) => {
  return request.get(`/analysis/download/${type}/${filename}`, {
    responseType: 'blob'
  })
}

// 删除文件
export const deleteAnalysisFile = (type, filename) => {
  return request.delete(`/analysis/delete/${type}/${filename}`)
}

// GeoJSON转换为SHP
export const convertGeojsonToShp = (geojsonFilename) => {
  return request.post('/analysis/convert-to-shp', {
    geojsonFilename
  })
}

// 读取GeoJSON文件内容
export const readGeojsonContent = (filename) => {
  // 对文件名进行URL编码，避免特殊字符导致404
  const encodedFilename = encodeURIComponent(filename)
  console.log('请求读取文件:', filename, '编码后:', encodedFilename)
  return request.get(`/analysis/read-geojson/${encodedFilename}`)
}

// 保存分析结果GeoJSON
export const saveAnalysisResult = (filename, geojsonData) => {
  return request.post('/analysis/save-result', {
    filename,
    geojsonData
  })
}

// 导出差异检测CSV
export const exportDifferenceCSV = (filename, data) => {
  return request.post('/analysis/export-difference-csv', {
    filename,
    data
  }, {
    responseType: 'blob'
  })
}

// 导出时序分析CSV
export const exportTemporalCSV = (filename, data) => {
  return request.post('/analysis/export-temporal-csv', {
    filename,
    data
  }, {
    responseType: 'blob'
  })
}

// ========== 新增：分析结果持久化API ==========

// 保存完整的分析结果（JSON格式）
export const saveAnalysisResultToServer = (type, data) => {
  return request.post('/analysis/save-analysis-result', {
    type,
    data
  })
}

// 保存报告文件到服务器
export const saveReportToServer = (filename, content, type) => {
  return request.post('/analysis/save-report', {
    filename,
    content,
    type
  })
}

// 获取保存的分析结果列表
export const getSavedAnalysisResults = () => {
  return request.get('/analysis/saved-analysis-results')
}

// 加载单个分析结果
export const loadAnalysisResult = (type, filename) => {
  return request.get(`/analysis/load-analysis-result/${type}/${filename}`)
}

// 下载报告文件
export const downloadReport = (filename) => {
  return request.get(`/analysis/download-report/${filename}`, {
    responseType: 'blob'
  })
}

// 删除分析结果文件
export const deleteAnalysisResult = (type, filename) => {
  return request.delete(`/analysis/delete-analysis-result/${type}/${filename}`)
}

// 上传PDF报告到服务器
export const uploadReportToServer = (file, type) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('type', type)
  
  return request.post('/analysis/upload-report', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

// 保存识别结果元数据
export const saveRecognitionMetadata = (filename, relativePath, metadata) => {
  return request.post('/analysis/save-recognition-metadata', {
    filename,
    relativePath,
    metadata
  })
}

// 获取KMZ文件的面积数据（使用后端GeoPandas计算）
export const getKmzAreas = (kmzFilename, relativePath) => {
  return request.post('/analysis/get-kmz-areas', {
    kmzFilename,
    relativePath
  })
}

// 🆕 SHP临时转换为GeoJSON（带缓存，用于直接显示）
export const convertShpTemp = (shpFilename, relativePath) => {
  return request.post('/analysis/convert-shp-temp', {
    shpFilename,
    relativePath
  })
}

// 🆕 快速加载SHP（不计算面积，只转换坐标系）
export const convertShpFast = (shpFilename, relativePath) => {
  return request.post('/analysis/convert-shp-fast', {
    shpFilename,
    relativePath
  })
}

// 🆕 异步计算SHP面积
export const calculateShpAreas = (shpFilename, relativePath) => {
  return request.post('/analysis/calculate-shp-areas', {
    shpFilename,
    relativePath
  })
}

// 🆕 检测文件冲突（上传前检查）
export const checkFileConflict = (filename, metadata) => {
  return request.post('/analysis/check-file-conflict', {
    filename,
    metadata
  })
}

