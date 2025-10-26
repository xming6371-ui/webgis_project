<template>
  <div class="temporal-map-view-enhanced">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <el-space wrap>
        <el-button-group>
          <el-button
            :type="activeTab === 'timeline' ? 'primary' : ''"
            @click="activeTab = 'timeline'"
          >
            <el-icon><Location /></el-icon>
            地图与统计
          </el-button>
          <el-button
            :type="activeTab === 'charts' ? 'primary' : ''"
            @click="activeTab = 'charts'"
          >
            <el-icon><TrendCharts /></el-icon>
            图表分析
          </el-button>
        </el-button-group>

        <el-divider direction="vertical" />

        <el-button @click="handlePreview" :icon="View" type="primary">预览PDF</el-button>
        <el-button @click="handleExportReport" :icon="Document">导出报告</el-button>
      </el-space>
    </div>
    
    <!-- PDF预览对话框 -->
    <el-dialog
      v-model="previewVisible"
      title="PDF预览 - 可实时调整字体大小"
      width="90%"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div style="background: #f5f5f5; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
        <el-alert type="info" :closable="false">
          <template #title>
            <div style="font-size: 14px;">
              💡 <strong>如何调整字体：</strong>
              <ol style="margin: 10px 0 0 20px; line-height: 1.8;">
                <li>打开文件：<code>src/utils/pdfGenerator.js</code></li>
                <li>找到第 44-60 行的 <code>FONT_SIZES</code> 对象</li>
                <li>修改字体大小（如 <code>title: '30px'</code>）</li>
                <li>保存文件后，点击下方"刷新预览"按钮</li>
                <li>查看新效果，满意后关闭预览，点击"导出报告"</li>
              </ol>
            </div>
          </template>
        </el-alert>
      </div>
      
      <el-button @click="refreshPreview" type="primary" style="margin-bottom: 10px;">
        <el-icon><Refresh /></el-icon>
        刷新预览（修改字体后点这里）
      </el-button>
      
      <div style="border: 2px solid #ddd; border-radius: 8px; overflow: hidden; background: white;">
        <iframe
          ref="previewFrame"
          :srcdoc="previewHTML"
          style="width: 100%; height: 70vh; border: none;"
        ></iframe>
      </div>
      
      <template #footer>
        <el-button @click="previewVisible = false">关闭预览</el-button>
        <el-button type="primary" @click="handleExportFromPreview">
          确认字体，导出PDF
        </el-button>
      </template>
    </el-dialog>

    <!-- 时间轴视图 -->
    <div v-show="activeTab === 'timeline'" class="timeline-view">
      <!-- 使用新的地图组件 -->
      <TemporalChangeMap :data="data" />
    </div>

    <!-- 图表视图 -->
    <div v-show="activeTab === 'charts'" class="charts-view">
      <el-row :gutter="20">
        <el-col :span="24">
          <CropDistributionChart :distribution="data.cropDistribution" />
        </el-col>
        <el-col :span="12" style="margin-top: 20px;">
          <CropTransitionChart 
            :transitions="data.transitionMatrix" 
            :total-changes="data.stats.totalChanges || 0"
          />
        </el-col>
        <el-col :span="12" style="margin-top: 20px;">
          <RotationPatternChart
            :patterns="rotationPatterns"
            :total-plots="data.stats.changed"
          />
        </el-col>
        <el-col :span="24" style="margin-top: 20px;">
          <UnchangedCropChart :trajectories="data.trajectories" />
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Timer, DataAnalysis, TrendCharts, Download, Document, ArrowLeft, ArrowRight, Location, View, Refresh
} from '@element-plus/icons-vue'
import CropTransitionChart from './CropTransitionChart.vue'
import CropDistributionChart from './CropDistributionChart.vue'
import RotationPatternChart from './RotationPatternChart.vue'
import UnchangedCropChart from './UnchangedCropChart.vue'
import TemporalChangeMap from './TemporalChangeMap.vue'
import { exportToCSV, analyzeRotationPatterns } from '@/utils/temporalAnalysis'
import { generateTemporalPDF, downloadPDFBlob, generatePreviewHTML } from '@/utils/pdfGenerator'

const props = defineProps({
  data: {
    type: Object,
    required: true
  }
})

const activeTab = ref('timeline')

// 预览相关
const previewVisible = ref(false)
const previewHTML = ref('')
const previewFrame = ref(null)

// 轮作模式分析
const rotationPatterns = computed(() => {
  if (!props.data.trajectories) return []
  return analyzeRotationPatterns(props.data.trajectories || props.data.features.map(f => ({
    timeline: f.properties.timeline
  })))
})

// 打开预览
const handlePreview = () => {
  console.log('🔍 打开PDF预览...')
  previewHTML.value = generatePreviewHTML(props.data, activeTab.value)
  previewVisible.value = true
  ElMessage.success('预览已打开！修改字体后点击"刷新预览"按钮')
}

// 刷新预览（修改字体后）
const refreshPreview = () => {
  console.log('🔄 刷新预览...')
  previewHTML.value = generatePreviewHTML(props.data, activeTab.value)
  ElMessage.success('预览已刷新！请查看新的字体效果')
}

// 从预览导出PDF
const handleExportFromPreview = async () => {
  previewVisible.value = false
  await handleExportReport()
}

// 导出PDF报告
const handleExportReport = async () => {
  const loadingMsg = ElMessage({ message: '正在生成PDF报告...', type: 'info', duration: 0 })
  
  try {
    // 生成ASCII安全的时间戳文件名（避免乱码）
    const now = new Date()
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
    
    const reportType = activeTab.value === 'timeline' ? 'Map_Statistics' : 'Chart_Analysis'
    const reportName = `Temporal_Analysis_${reportType}_${timestamp}.pdf`
    
    console.log('📄 开始生成PDF报告:', reportName)
    
    // 生成PDF
    const pdfBlob = await generateTemporalPDF(props.data, activeTab.value)
    
    console.log('✅ PDF生成完成，大小:', (pdfBlob.size / 1024 / 1024).toFixed(2), 'MB')
    
    // 下载PDF
    downloadPDFBlob(pdfBlob, reportName)
    
    // 同时保存到服务器
    try {
      const { uploadReportToServer } = await import('@/api/analysis')
      
      // 将Blob转换为File对象
      const pdfFile = new File([pdfBlob], reportName, { type: 'application/pdf' })
      
      const saveResponse = await uploadReportToServer(pdfFile, 'temporal')
      if (saveResponse.code === 200) {
        console.log('✅ PDF报告已保存到服务器:', saveResponse.data)
      }
    } catch (saveError) {
      console.error('保存到服务器失败:', saveError)
      // 不影响下载，只记录错误
    }
    
    loadingMsg.close()
    ElMessage.success('PDF报告导出成功！已保存到下载文件夹和数据管理中')
  } catch (error) {
    console.error('报告导出失败:', error)
    loadingMsg.close()
    ElMessage.error('PDF报告导出失败: ' + error.message)
  }
}

onMounted(() => {
  console.log('TemporalMapViewEnhanced 挂载，数据:', props.data)
})
</script>

<style scoped lang="scss">
.temporal-map-view-enhanced {
  .toolbar {
    margin-bottom: 12px;
    padding: 10px 16px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .timeline-view,
  .statistics-view,
  .charts-view {
    animation: fadeIn 0.3s;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .map-container,
  .table-container {
    width: 100%;
    min-height: 500px;
    position: relative;
    background: #f5f7fa;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 20px;
  }
  
  .table-container {
    background: white;
    padding: 0;
    
    .pagination-container {
      display: flex;
      justify-content: center;
      padding: 20px;
      background: white;
      border-top: 1px solid #ebeef5;
    }
  }
  
  .map-container {

    .time-info {
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      text-align: center;
      z-index: 10;
      background: rgba(255, 255, 255, 0.95);
      padding: 16px 30px;
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
    }

    .plot-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 12px;
      padding: 100px 20px 20px;
      height: 100%;
      overflow-y: auto;

      .plot-item {
        background: #e8f4f8;
        border: 2px solid #b3d8e8;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 80px;
        padding: 8px;
        transition: all 0.3s;
        cursor: pointer;

        &.plot-normal {
          background: #e1f3d8;
          border-color: #67c23a;
        }

        &.plot-unknown {
          background: #f0f0f0;
          border-color: #d0d0d0;
        }

        &:hover {
          transform: scale(1.05);
          z-index: 5;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        }

        .plot-label {
          font-weight: 600;
          font-size: 13px;
          color: #606266;
          text-align: center;
          word-break: break-all;
        }
      }
    }

    .plot-tooltip {
      position: fixed;
      top: 50%;
      right: 30px;
      transform: translateY(-50%);
      background: white;
      border: 2px solid #409eff;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      z-index: 1000;
      min-width: 260px;
      max-width: 320px;
      max-height: 80vh;
      overflow-y: auto;
    }
  }

  .timeline-slider {
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

    .slider-controls {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;

      .slider-wrapper {
        flex: 1;
      }
    }

    .time-labels {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;

      .time-label {
        flex: 1;
        min-width: 120px;
        padding: 12px;
        background: #f5f7fa;
        border: 2px solid #e4e7ed;
        border-radius: 8px;
        text-align: center;
        cursor: pointer;
        transition: all 0.3s;

        &:hover {
          border-color: #409eff;
          background: #ecf5ff;
        }

        &.active {
          border-color: #409eff;
          background: #409eff;
          color: white;

          .time-label-name,
          .time-label-time {
            color: white;
          }
        }

        .time-label-name {
          font-weight: 600;
          font-size: 14px;
          color: #303133;
          margin-bottom: 4px;
        }

        .time-label-time {
          font-size: 12px;
          color: #909399;
        }
      }
    }
  }

  .stats-list {
    .stat-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;

      .stat-value {
        font-size: 24px;
        font-weight: 600;

        &.warning {
          color: #e6a23c;
        }

        &.success {
          color: #67c23a;
        }

        &.primary {
          color: #409eff;
        }
      }
    }
  }

  .change-item {
    padding: 12px;
    border-bottom: 1px solid #ebeef5;
    cursor: pointer;
    transition: background 0.3s;

    &:hover {
      background: #f5f7fa;
    }

    &:last-child {
      border-bottom: none;
    }
  }

  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.3s;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
}
</style>

