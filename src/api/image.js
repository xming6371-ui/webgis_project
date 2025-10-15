import request from './index'

// 获取影像列表
export const getImageList = (params) => {
  return request({
    url: '/image/list',
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

