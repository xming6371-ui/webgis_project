import request from './index'

// 获取识别结果列表（从data_shp和data_geojson目录扫描）
export const getRecognitionResults = () => {
  return request.get('/analysis/results')
}

// SHP转换为GeoJSON
export const convertShpToGeojson = (shpFilename) => {
  return request.post('/analysis/convert-to-geojson', {
    shpFilename
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

