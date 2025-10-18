import axios from 'axios'
import { ElMessage } from 'element-plus'

// 创建axios实例
const service = axios.create({
  baseURL: '/api',  // 通过vite代理转发到后端8080端口
  timeout: 900000  // 15分钟超时（TIF优化可能需要1-15分钟，大文件70MB+需要更长时间）
})

// 请求拦截器
service.interceptors.request.use(
  config => {
    // 可以在这里添加token等认证信息
    // config.headers['Authorization'] = 'Bearer ' + getToken()
    return config
  },
  error => {
    console.error('请求错误：', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
service.interceptors.response.use(
  response => {
    // 如果是blob响应（文件下载），直接返回
    if (response.config.responseType === 'blob') {
      return response.data
    }
    
    const res = response.data
    
    // 直接返回响应数据，让组件自己处理code
    // 不在拦截器中统一处理错误消息，避免重复提示
    return res
  },
  error => {
    console.error('响应错误：', error)
    // 只处理网络错误，不显示消息提示（让组件自己处理）
    return Promise.reject(error)
  }
)

export default service

