import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useAnalysisStore = defineStore('analysis', () => {
  // 从localStorage恢复数据
  const loadFromStorage = () => {
    try {
      const saved = localStorage.getItem('analysisResults')
      if (saved) {
        const data = JSON.parse(saved)
        console.log('📦 从缓存恢复分析结果')
        return data
      }
    } catch (error) {
      console.error('恢复分析结果失败:', error)
    }
    return { currentAnalysisType: null, differenceResult: null, temporalResult: null }
  }
  
  // 保存到localStorage
  const saveToStorage = () => {
    try {
      const data = {
        currentAnalysisType: currentAnalysisType.value,
        differenceResult: differenceResult.value,
        temporalResult: temporalResult.value
      }
      localStorage.setItem('analysisResults', JSON.stringify(data))
      console.log('💾 分析结果已保存到缓存')
    } catch (error) {
      console.error('保存分析结果失败:', error)
    }
  }
  
  // 初始化数据
  const initialData = loadFromStorage()
  
  // 当前分析类型：'difference' | 'temporal' | null
  const currentAnalysisType = ref(initialData.currentAnalysisType)
  
  // 差异检测结果
  const differenceResult = ref(initialData.differenceResult)
  
  // 时序分析结果
  const temporalResult = ref(initialData.temporalResult)
  
  // 监听数据变化，自动保存
  watch([currentAnalysisType, differenceResult, temporalResult], () => {
    saveToStorage()
  }, { deep: true })
  
  // 设置差异检测结果
  const setDifferenceResult = (data) => {
    differenceResult.value = data
    currentAnalysisType.value = 'difference'
    console.log('✅ 差异检测结果已保存到全局状态')
  }
  
  // 设置时序分析结果
  const setTemporalResult = (data) => {
    temporalResult.value = data
    currentAnalysisType.value = 'temporal'
    console.log('✅ 时序分析结果已保存到全局状态')
  }
  
  // 清空结果
  const clearResults = () => {
    differenceResult.value = null
    temporalResult.value = null
    currentAnalysisType.value = null
    localStorage.removeItem('analysisResults')
    console.log('🗑️ 已清空所有分析结果')
  }
  
  // 获取当前结果
  const getCurrentResult = () => {
    if (currentAnalysisType.value === 'difference') {
      return differenceResult.value
    } else if (currentAnalysisType.value === 'temporal') {
      return temporalResult.value
    }
    return null
  }
  
  return {
    currentAnalysisType,
    differenceResult,
    temporalResult,
    setDifferenceResult,
    setTemporalResult,
    clearResults,
    getCurrentResult
  }
})

