import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAnalysisStore = defineStore('analysis', () => {
  // 🚫 已禁用localStorage持久化
  // 原因：分析结果数据量太大（可能>50MB），会超出localStorage配额限制（5-10MB）
  // 改用服务器端JSON文件持久化，store仅保存内存中的临时数据
  
  // 当前分析类型：'difference' | 'temporal' | null
  const currentAnalysisType = ref(null)
  
  // 差异检测结果（仅内存，不持久化）
  const differenceResult = ref(null)
  
  // 时序分析结果（仅内存，不持久化）
  const temporalResult = ref(null)
  
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
    console.log('🗑️ 已清空所有分析结果（仅内存，服务器文件保留）')
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

