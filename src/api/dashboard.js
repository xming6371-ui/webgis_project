import request from './index'

// 获取KPI数据
export const getKpiData = (params) => {
  return request({
    url: '/dashboard/kpi',
    method: 'get',
    params
  })
}

// 获取作物分布数据
export const getCropDistribution = (params) => {
  return request({
    url: '/dashboard/crop-distribution',
    method: 'get',
    params
  })
}

// 获取差异统计数据
export const getDiffStats = (params) => {
  return request({
    url: '/dashboard/diff-stats',
    method: 'get',
    params
  })
}

// 获取趋势数据
export const getTrendData = (params) => {
  return request({
    url: '/dashboard/trend',
    method: 'get',
    params
  })
}

