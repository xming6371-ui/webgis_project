import request from './index'

// 获取影像列表
export const getImageList = (params) => {
  return request({
    url: '/image/list',
    method: 'get',
    params
  })
}

// 🆕 强制刷新影像列表（清除后端缓存）
export const refreshImageList = () => {
  return request({
    url: '/image/list',
    method: 'get',
    params: { refresh: 'true' } // 强制重新同步
  })
}

// 获取所有文件列表（包括TIF、SHP、GeoJSON等）
export const getAllFiles = (params) => {
  return request({
    url: '/image/files',
    method: 'get',
    params
  })
}

// 上传影像
export const uploadImage = (data) => {
  return request({
    url: '/image/upload',
    method: 'post',
    data,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

export const updateImage = (id, data) => {
  return request({
    url: `/image/${id}`,
    method: 'put',
    data
  })
}

// 删除影像
export const deleteImage = (id) => {
  return request({
    url: `/image/${id}`,
    method: 'delete'
  })
}

// 批量删除影像
export const batchDeleteImage = (ids) => {
  return request({
    url: '/image/batch-delete',
    method: 'post',
    data: { ids }
  })
}

// 下载影像
export const downloadImage = (id) => {
  return request({
    url: `/image/download/${id}`,
    method: 'get',
    responseType: 'blob'
  })
}

// 优化TIF文件
export const optimizeImage = (id, data) => {
  return request({
    url: `/image/optimize/${id}`,
    method: 'post',
    data
  })
}

// 获取优化进度
export const getOptimizeProgress = (id) => {
  return request({
    url: `/image/optimize-progress/${id}`,
    method: 'get'
  })
}

