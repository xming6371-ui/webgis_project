<template>
  <div class="result-compare-container">
    <el-card shadow="never">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 18px; font-weight: 600;">
            <el-icon style="margin-right: 8px;"><DataAnalysis /></el-icon>
            结果查看与比对
          </span>
          <el-space>
            <!-- 切换分析类型 -->
            <el-radio-group v-model="currentView" size="default">
              <el-radio-button value="difference">
                <el-icon><Location /></el-icon>
                差异检测
              </el-radio-button>
              <el-radio-button value="temporal">
                <el-icon><TrendCharts /></el-icon>
                时序分析
              </el-radio-button>
            </el-radio-group>
            
            <!-- 导出按钮（由子组件提供） -->
            <!-- <el-button 
              v-if="hasData" 
              type="success" 
              @click="handleExport"
              :icon="Download"
            >
              导出CSV
            </el-button> -->
            
            <!-- 清空结果 -->
        <el-button 
              v-if="hasData" 
              type="danger" 
              @click="handleClear"
              :icon="Delete"
            >
              清空
        </el-button>
              </el-space>
            </div>
          </template>
          
      <!-- 空状态 -->
      <el-empty 
        v-if="!hasData" 
        description=""
        style="margin: 60px 0;"
      >
        <template #description>
          <div style="color: #909399; font-size: 14px; margin-bottom: 20px;">
            <p style="margin-bottom: 12px;">暂无分析结果，您可以：</p>
            <p style="margin-bottom: 8px;">1. 在任务管理中执行新的分析</p>
            <p>2. 在数据管理中导入已有的分析结果</p>
          </div>
        </template>
        <el-space>
          <el-button type="primary" @click="goToTaskManagement" :icon="TrendCharts">
            前往任务管理
          </el-button>
          <el-button type="success" @click="goToImageManagement" :icon="DataAnalysis">
            前往数据管理
          </el-button>
        </el-space>
      </el-empty>

      <!-- 差异检测视图 -->
      <DifferenceMapViewOptimized 
        v-show="currentView === 'difference' && differenceResult && hasData"
        v-if="differenceResult"
        :data="differenceResult"
        :key="'difference'"
      />

      <!-- 时序分析视图 -->
      <TemporalMapViewEnhanced 
        v-show="currentView === 'temporal' && temporalResult && hasData"
        v-if="temporalResult"
        :data="temporalResult"
        :key="'temporal'"
      />

      <!-- 无数据提示 -->
      <el-alert
        v-if="hasData && currentView === 'difference' && !differenceResult"
        title="无差异检测数据"
        type="info"
        :closable="false"
        style="margin: 20px 0;"
      >
        当前无差异检测结果，请执行新的分析或切换到时序分析。
      </el-alert>
      
      <el-alert
        v-if="hasData && currentView === 'temporal' && !temporalResult"
        title="无时序分析数据"
        type="info"
        :closable="false"
        style="margin: 20px 0;"
      >
        当前无时序分析结果，请执行新的分析或切换到差异检测。
      </el-alert>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DataAnalysis, Location, TrendCharts, Download, Delete } from '@element-plus/icons-vue'
import { useAnalysisStore } from '@/stores/analysis'
import DifferenceMapViewOptimized from './components/DifferenceMapViewOptimized.vue'
import TemporalMapView from './components/TemporalMapView.vue'
import TemporalMapViewEnhanced from './components/TemporalMapViewEnhanced.vue'

const router = useRouter()
const analysisStore = useAnalysisStore()

// 当前查看的类型
const currentView = ref('difference')

// 从store获取结果
const differenceResult = computed(() => analysisStore.differenceResult)
const temporalResult = computed(() => analysisStore.temporalResult)

// 是否有数据
const hasData = computed(() => {
  if (currentView.value === 'difference') {
    return !!differenceResult.value
  } else if (currentView.value === 'temporal') {
    return !!temporalResult.value
  }
  return false
})

// 是否已经初始化过视图
const hasInitialized = ref(false)

// 组件挂载时，根据有无数据自动切换视图（仅首次）
onMounted(() => {
  console.log('ResultCompare 挂载')
  console.log('差异检测结果:', differenceResult.value)
  console.log('时序分析结果:', temporalResult.value)
  console.log('当前分析类型:', analysisStore.currentAnalysisType)
  
  // 只在首次挂载时自动切换
  if (!hasInitialized.value) {
    hasInitialized.value = true
    
    // 根据最后一次分析类型切换，如果没有则按优先级
    if (analysisStore.currentAnalysisType === 'difference' && differenceResult.value) {
      currentView.value = 'difference'
    } else if (analysisStore.currentAnalysisType === 'temporal' && temporalResult.value) {
      currentView.value = 'temporal'
    } else if (differenceResult.value) {
      currentView.value = 'difference'
    } else if (temporalResult.value) {
      currentView.value = 'temporal'
    }
  }
})

// 前往任务管理
const goToTaskManagement = () => {
  router.push('/task-management')
}

// 前往数据管理
const goToImageManagement = () => {
  router.push({ name: 'ImageManagement', query: { tab: 'analysis' } })
}

// 导出CSV（由子组件处理）
const handleExport = () => {
  ElMessage.info('请在对应的视图中使用导出按钮')
}

// 清空结果
const handleClear = () => {
  ElMessageBox.confirm(
    `确定要清空${currentView.value === 'difference' ? '差异检测' : '时序分析'}结果吗？此操作不可恢复。`,
    '确认清空',
    {
      confirmButtonText: '清空当前',
      cancelButtonText: '取消',
      type: 'warning',
      distinguishCancelAndClose: true,
      showClose: true
    }
  ).then(() => {
    // 只清空当前类型的结果
    if (currentView.value === 'difference') {
      analysisStore.setDifferenceResult(null)
      ElMessage.success('已清空差异检测结果')
    } else if (currentView.value === 'temporal') {
      analysisStore.setTemporalResult(null)
      ElMessage.success('已清空时序分析结果')
    }
  }).catch(() => {
    // 用户取消
  })
}
</script>

<style scoped lang="scss">
.result-compare-container {
  padding: 10px 12px;
  height: calc(100vh - 80px);
  
  :deep(.el-card__body) {
    height: calc(100% - 60px);
    overflow: hidden;
  }
}
</style>

