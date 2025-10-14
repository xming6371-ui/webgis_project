import request from './index'

// 获取任务列表
export const getTaskList = (params) => {
  return request({
    url: '/task/list',
    method: 'get',
    params
  })
}

// 创建任务
export const createTask = (data) => {
  return request({
    url: '/task/create',
    method: 'post',
    data
  })
}

// 获取任务详情
export const getTaskDetail = (id) => {
  return request({
    url: `/task/${id}`,
    method: 'get'
  })
}

// 停止任务
export const stopTask = (id) => {
  return request({
    url: `/task/${id}/stop`,
    method: 'post'
  })
}

// 删除任务
export const deleteTask = (id) => {
  return request({
    url: `/task/${id}`,
    method: 'delete'
  })
}

// 获取任务日志
export const getTaskLog = (id) => {
  return request({
    url: `/task/${id}/log`,
    method: 'get'
  })
}

