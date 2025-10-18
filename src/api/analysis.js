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

