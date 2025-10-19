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
            
            <!-- 导出按钮 -->
            <el-button 
              v-if="hasData" 
              type="success" 
              @click="handleExport"
              :icon="Download"
            >
              导出CSV
            </el-button>
            
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
        description="暂无分析结果，请先在任务管理中执行分析"
        style="margin: 60px 0;"
      >
        <el-button type="primary" @click="goToTaskManagement">
          前往任务管理
        </el-button>
      </el-empty>

      <!-- 差异检测视图 -->
      <DifferenceMapView 
        v-else-if="currentView === 'difference' && differenceResult"
        :data="differenceResult"
      />

      <!-- 时序分析视图 -->
      <TemporalMapView 
        v-else-if="currentView === 'temporal' && temporalResult"
        :data="temporalResult"
      />
      
      <!-- 无数据提示 -->
      <el-alert
        v-else
        title="无可用数据"
        type="info"
        :closable="false"
        style="margin: 20px 0;"
      >
        当前选择的分析类型暂无结果，请切换到其他类型或执行新的分析。
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
import DifferenceMapView from './components/DifferenceMapView.vue'
import TemporalMapView from './components/TemporalMapView.vue'

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

// 组件挂载时，根据有无数据自动切换视图
onMounted(() => {
  console.log('ResultCompare 挂载')
  console.log('差异检测结果:', differenceResult.value)
  console.log('时序分析结果:', temporalResult.value)
  console.log('当前分析类型:', analysisStore.currentAnalysisType)
  
  // 自动切换到有数据的视图
  if (analysisStore.currentAnalysisType) {
    currentView.value = analysisStore.currentAnalysisType
  } else if (differenceResult.value) {
    currentView.value = 'difference'
  } else if (temporalResult.value) {
    currentView.value = 'temporal'
  }
})

// 前往任务管理
const goToTaskManagement = () => {
  router.push('/task-management')
}

// 导出CSV
const handleExport = () => {
  if (currentView.value === 'difference' && differenceResult.value) {
    exportDifferenceCSV()
  } else if (currentView.value === 'temporal' && temporalResult.value) {
    exportTemporalCSV()
  }
}

// 导出差异检测CSV
const exportDifferenceCSV = () => {
  try {
    const data = differenceResult.value
    const features = data.features || []
    
    // 生成CSV内容
    let csvContent = '\uFEFF' // UTF-8 BOM
    csvContent += '地块编号,地块名称,原始作物,当前作物,是否变化,面积(亩)\n'
    
    features.forEach(feature => {
      const props = feature.properties
      csvContent += `${props.plotId || ''},${props.plotName || ''},${props.originalCrop || ''},${props.currentCrop || ''},${props.hasChange ? '是' : '否'},${props.area || 0}\n`
    })
    
    // 下载
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `差异检测_${data.title}_${new Date().getTime()}.csv`
    link.click()
    
    ElMessage.success('CSV文件已导出')
  } catch (error) {
    console.error('导出CSV失败:', error)
    ElMessage.error('导出失败: ' + error.message)
  }
}

// 导出时序分析CSV
const exportTemporalCSV = () => {
  try {
    const data = temporalResult.value
    const features = data.features || []
    
    // 生成CSV内容
    let csvContent = '\uFEFF' // UTF-8 BOM
    csvContent += '地块编号,地块名称,变化次数,时序轨迹,面积(亩)\n'
    
    features.forEach(feature => {
      const props = feature.properties
      const timeline = props.timeline || []
      const timelineStr = timeline.map(t => `${t.time}:${t.crop}`).join(' → ')
      csvContent += `${props.plotId || ''},${props.plotName || ''},${props.changeCount || 0},"${timelineStr}",${props.area || 0}\n`
    })
    
    // 下载
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `时序分析_${data.title}_${new Date().getTime()}.csv`
    link.click()
    
    ElMessage.success('CSV文件已导出')
  } catch (error) {
    console.error('导出CSV失败:', error)
    ElMessage.error('导出失败: ' + error.message)
  }
}

// 清空结果
const handleClear = () => {
  ElMessageBox.confirm(
    '确定要清空当前分析结果吗？此操作不可恢复。',
    '确认清空',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    analysisStore.clearResults()
    ElMessage.success('已清空分析结果')
  }).catch(() => {
    // 用户取消
  })
}
</script>

<style scoped lang="scss">
.result-compare-container {
  padding: 20px;
  height: calc(100vh - 100px);
  
  :deep(.el-card__body) {
    height: calc(100% - 60px);
    overflow: hidden;
  }
}
</style>


