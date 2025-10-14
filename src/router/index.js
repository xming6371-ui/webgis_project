import { createRouter, createWebHistory } from 'vue-router'
import Layout from '@/views/Layout/index.vue'

const routes = [
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard/index.vue'),
        meta: { title: '监测主控台', icon: 'DataBoard' }
      },
      {
        path: 'image-management',
        name: 'ImageManagement',
        component: () => import('@/views/ImageManagement/index.vue'),
        meta: { title: '影像数据管理', icon: 'Picture' }
      },
      {
        path: 'task-management',
        name: 'TaskManagement',
        component: () => import('@/views/TaskManagement/index.vue'),
        meta: { title: '分类分析任务', icon: 'Setting' }
      },
      {
        path: 'result-compare',
        name: 'ResultCompare',
        component: () => import('@/views/ResultCompare/index.vue'),
        meta: { title: '结果查看与比对', icon: 'View' }
      },
      {
        path: 'report',
        name: 'Report',
        component: () => import('@/views/Report/index.vue'),
        meta: { title: '图表报表', icon: 'DataAnalysis' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router

