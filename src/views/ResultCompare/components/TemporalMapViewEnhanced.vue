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
    
    <!-- PDF预览对话框 - 带字体调整功能 -->
    <el-dialog
      v-model="previewVisible"
      title="📄 PDF预览与导出"
      width="95%"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div class="preview-container">
        <!-- 左侧：配置面板 -->
        <div class="font-config-sidebar">
          <div class="sidebar-header">
            <div class="title">🎨 样式配置</div>
            <div class="button-group">
              <el-button size="small" @click="resetConfig" plain>
                <el-icon><RefreshLeft /></el-icon>
                重置
              </el-button>
              <el-button size="small" type="primary" @click="applyFontSizes">
                <el-icon><Check /></el-icon>
                应用
              </el-button>
            </div>
          </div>
          
          <!-- 标签页切换 -->
          <el-tabs v-model="activeConfigTab" class="config-tabs">
            <el-tab-pane label="🔤 字体配置" name="font">
              <div class="font-items">
            <div class="font-item">
              <label>封面标题</label>
              <el-input-number v-model="fontSizes.coverTitle" :min="20" :max="60" :step="2" size="small" controls-position="right" />
            </div>
            <div class="font-item">
              <label>主标题</label>
              <el-input-number v-model="fontSizes.title" :min="16" :max="40" :step="2" size="small" controls-position="right" />
            </div>
            <div class="font-item">
              <label>小标题</label>
              <el-input-number v-model="fontSizes.subtitle" :min="14" :max="32" :step="2" size="small" controls-position="right" />
            </div>
            <div class="font-item">
              <label>表格表头</label>
              <el-input-number v-model="fontSizes.tableHeader" :min="12" :max="28" :step="1" size="small" controls-position="right" />
            </div>
            <div class="font-item">
              <label>表格内容</label>
              <el-input-number v-model="fontSizes.tableCell" :min="10" :max="24" :step="1" size="small" controls-position="right" />
            </div>
            <div class="font-item">
              <label>说明文字</label>
              <el-input-number v-model="fontSizes.description" :min="10" :max="20" :step="1" size="small" controls-position="right" />
            </div>
            <div class="font-item">
              <label>普通文字</label>
              <el-input-number v-model="fontSizes.normal" :min="10" :max="20" :step="1" size="small" controls-position="right" />
            </div>
            <div class="font-item">
              <label>卡片数值</label>
              <el-input-number v-model="fontSizes.cardValue" :min="20" :max="48" :step="2" size="small" controls-position="right" />
            </div>
              </div>
              
              <el-alert type="info" :closable="false" style="margin-top: 15px;">
                <template #title>
                  <div style="font-size: 12px; line-height: 1.6;">
                    💡 调整字体后点击"应用"查看效果。<br>
                    ⚡ 导出PDF时会直接使用当前预览，无需重新生成！
                  </div>
                </template>
              </el-alert>
            </el-tab-pane>
            
            <el-tab-pane label="🎨 配色方案" name="color">
              <div class="color-schemes">
                <el-radio-group v-model="selectedColorScheme" class="scheme-list">
                  <el-radio label="classic" class="scheme-radio">
                    <div class="scheme-option">
                      <div class="scheme-name">经典蓝紫（默认）</div>
                      <div class="scheme-colors">
                        <span class="color-dot" style="background: #4f46e5"></span>
                        <span class="color-dot" style="background: #8b5cf6"></span>
                        <span class="color-dot" style="background: #10b981"></span>
                        <span class="color-dot" style="background: #f59e0b"></span>
                        <span class="color-dot" style="background: #ef4444"></span>
                      </div>
                    </div>
                  </el-radio>
                  
                  <el-radio label="purple" class="scheme-radio">
                    <div class="scheme-option">
                      <div class="scheme-name">梦幻紫</div>
                      <div class="scheme-colors">
                        <span class="color-dot" style="background: #9333ea"></span>
                        <span class="color-dot" style="background: #a855f7"></span>
                        <span class="color-dot" style="background: #10b981"></span>
                        <span class="color-dot" style="background: #f59e0b"></span>
                        <span class="color-dot" style="background: #f43f5e"></span>
                      </div>
                    </div>
                  </el-radio>
                  
                  <el-radio label="business" class="scheme-radio">
                    <div class="scheme-option">
                      <div class="scheme-name">商务深蓝</div>
                      <div class="scheme-colors">
                        <span class="color-dot" style="background: #1e40af"></span>
                        <span class="color-dot" style="background: #3b82f6"></span>
                        <span class="color-dot" style="background: #059669"></span>
                        <span class="color-dot" style="background: #d97706"></span>
                        <span class="color-dot" style="background: #dc2626"></span>
                      </div>
                    </div>
                  </el-radio>
                  
                  <el-radio label="ocean" class="scheme-radio">
                    <div class="scheme-option">
                      <div class="scheme-name">海洋蓝</div>
                      <div class="scheme-colors">
                        <span class="color-dot" style="background: #0891b2"></span>
                        <span class="color-dot" style="background: #06b6d4"></span>
                        <span class="color-dot" style="background: #14b8a6"></span>
                        <span class="color-dot" style="background: #f59e0b"></span>
                        <span class="color-dot" style="background: #f43f5e"></span>
                      </div>
                    </div>
                  </el-radio>
                  
                  <el-radio label="fresh" class="scheme-radio">
                    <div class="scheme-option">
                      <div class="scheme-name">清新绿色</div>
                      <div class="scheme-colors">
                        <span class="color-dot" style="background: #059669"></span>
                        <span class="color-dot" style="background: #10b981"></span>
                        <span class="color-dot" style="background: #22c55e"></span>
                        <span class="color-dot" style="background: #eab308"></span>
                        <span class="color-dot" style="background: #f43f5e"></span>
                      </div>
                    </div>
                  </el-radio>
                  
                  <el-radio label="sunset" class="scheme-radio">
                    <div class="scheme-option">
                      <div class="scheme-name">日落橙</div>
                      <div class="scheme-colors">
                        <span class="color-dot" style="background: #ea580c"></span>
                        <span class="color-dot" style="background: #f97316"></span>
                        <span class="color-dot" style="background: #10b981"></span>
                        <span class="color-dot" style="background: #fbbf24"></span>
                        <span class="color-dot" style="background: #dc2626"></span>
                      </div>
                    </div>
                  </el-radio>
                  
                  <el-radio label="elegant" class="scheme-radio">
                    <div class="scheme-option">
                      <div class="scheme-name">典雅灰色</div>
                      <div class="scheme-colors">
                        <span class="color-dot" style="background: #374151"></span>
                        <span class="color-dot" style="background: #6b7280"></span>
                        <span class="color-dot" style="background: #10b981"></span>
                        <span class="color-dot" style="background: #f59e0b"></span>
                        <span class="color-dot" style="background: #ef4444"></span>
                      </div>
                    </div>
                  </el-radio>
                </el-radio-group>
              </div>
              
              <el-alert type="success" :closable="false" style="margin-top: 15px;">
                <template #title>
                  <div style="font-size: 12px; line-height: 2;">
                    🎨 选择配色方案后点击"应用"查看效果<br>
                    📊 五个色块含义说明：<br>
                    <span style="margin-left: 10px; display: block; margin-top: 5px;">
                      ① <strong>主色</strong>：表格表头、标题左侧竖线、提示框边框等主要元素<br>
                      ② <strong>次色</strong>：渐变色卡片、图表装饰等次要元素<br>
                      ③ <strong>成功色</strong>：增长趋势、正向数据、未变化地块等积极信息<br>
                      ④ <strong>警告色</strong>：变化地块、需要关注的中等数据等提示信息<br>
                      ⑤ <strong>危险色</strong>：减少趋势、负向数据、高频变化地块等警示信息
                    </span>
            </div>
          </template>
        </el-alert>
            </el-tab-pane>
          </el-tabs>
      </div>
      
        <!-- 右侧：预览区域 -->
        <div class="preview-area">
          <!-- 生成进度显示 -->
          <div v-if="generatingProgress.visible" class="progress-overlay">
            <div class="progress-card">
              <div class="progress-header">
                <div class="progress-icon">📄</div>
                <div class="progress-title">正在生成PDF报告</div>
              </div>
              <el-progress 
                :percentage="Math.round((generatingProgress.current / generatingProgress.total) * 100)" 
                :stroke-width="10"
                striped
                striped-flow
                :duration="3"
              />
              <div class="progress-message">
                {{ generatingProgress.message }} ({{ generatingProgress.current }}/{{ generatingProgress.total }})
              </div>
            </div>
          </div>
          
        <iframe
          ref="previewFrame"
            :src="previewPdfUrl"
            style="width: 100%; height: 70vh; border: none; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
        ></iframe>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="handleClosePreview">关闭预览</el-button>
        <el-button type="primary" @click="handleExportFromPreview" :icon="Document">
          导出PDF（使用当前预览）
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
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Timer, DataAnalysis, TrendCharts, Download, Document, ArrowLeft, ArrowRight, Location, View, Refresh, RefreshLeft, Check
} from '@element-plus/icons-vue'
import CropTransitionChart from './CropTransitionChart.vue'
import CropDistributionChart from './CropDistributionChart.vue'
import RotationPatternChart from './RotationPatternChart.vue'
import UnchangedCropChart from './UnchangedCropChart.vue'
import TemporalChangeMap from './TemporalChangeMap.vue'
import { exportToCSV, analyzeRotationPatterns } from '@/utils/temporalAnalysis'
import { generateTemporalPDF, downloadPDFBlob, getDefaultFontSizes } from '@/utils/pdfGenerator'

const props = defineProps({
  data: {
    type: Object,
    required: true
  }
})

const activeTab = ref('timeline')

// 预览相关
const previewVisible = ref(false)
const previewPdfUrl = ref('')
const previewFrame = ref(null)
const cachedPdfBlob = ref(null) // 缓存生成的PDF Blob
const activeConfigTab = ref('font') // 配置标签页：'font' | 'color'
const selectedColorScheme = ref('classic') // 选中的配色方案
const generatingProgress = ref({
  visible: false,
  current: 0,
  total: 0,
  message: ''
})
const cancelGeneration = ref(false) // 用于取消PDF生成的标志

// 配色方案定义
const COLOR_SCHEMES = {
  classic: {
    name: '经典蓝紫',
    primary: '#4f46e5',
    secondary: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444'
  },
  purple: {
    name: '梦幻紫',
    primary: '#9333ea',
    secondary: '#a855f7',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#f43f5e'
  },
  business: {
    name: '商务深蓝',
    primary: '#1e40af',
    secondary: '#3b82f6',
    success: '#059669',
    warning: '#d97706',
    danger: '#dc2626'
  },
  ocean: {
    name: '海洋蓝',
    primary: '#0891b2',
    secondary: '#06b6d4',
    success: '#14b8a6',
    warning: '#f59e0b',
    danger: '#f43f5e'
  },
  fresh: {
    name: '清新绿色',
    primary: '#059669',
    secondary: '#10b981',
    success: '#22c55e',
    warning: '#eab308',
    danger: '#f43f5e'
  },
  sunset: {
    name: '日落橙',
    primary: '#ea580c',
    secondary: '#f97316',
    success: '#10b981',
    warning: '#fbbf24',
    danger: '#dc2626'
  },
  elegant: {
    name: '典雅灰色',
    primary: '#374151',
    secondary: '#6b7280',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444'
  }
}

// 字体大小配置（可在前端调整）
const fontSizes = ref({
  coverTitle: 40,
  coverSubtitle: 24,
  coverDate: 16,
  title: 28,
  subtitle: 22,
  tableHeader: 20,
  tableCell: 15,
  description: 14,
  normal: 15,
  cardLabel: 15,
  cardValue: 32,
  trendArrow: 20,
  miniCoverTitle: 36,
  miniCoverSubtitle: 20,
  miniCardValue: 28
})

// 初始化字体配置
onMounted(() => {
  const defaultSizes = getDefaultFontSizes()
  // 将 '28px' 转换为数字 28
  Object.keys(defaultSizes).forEach(key => {
    fontSizes.value[key] = parseInt(defaultSizes[key])
  })
})

// 轮作模式分析
const rotationPatterns = computed(() => {
  if (!props.data.trajectories) return []
  return analyzeRotationPatterns(props.data.trajectories || props.data.features.map(f => ({
    timeline: f.properties.timeline
  })))
})

// 将数字转换为带px的字符串
const getFontSizesWithUnit = () => {
  const sizes = {}
  Object.keys(fontSizes.value).forEach(key => {
    sizes[key] = `${fontSizes.value[key]}px`
  })
  return sizes
}

// 打开预览
const handlePreview = async () => {
  console.log('🔍 生成PDF预览...')
  console.log('📝 字体配置:', fontSizes.value)
  console.log('🎨 配色方案:', selectedColorScheme.value)
  
  // 重置取消标志
  cancelGeneration.value = false
  
  // 显示进度
  generatingProgress.value = {
    visible: true,
    current: 0,
    total: 15,
    message: '准备生成...'
  }
  previewVisible.value = true // 先打开对话框显示进度
  
  const loadingMsg = ElMessage({ message: '正在生成PDF预览...', type: 'info', duration: 0 })
  
  try {
    // 清除旧的URL和缓存
    if (previewPdfUrl.value) {
      URL.revokeObjectURL(previewPdfUrl.value)
    }
    
    const customFontSizes = getFontSizesWithUnit()
    const customColors = getCurrentColorScheme()
    
    // 将字体和配色方案合并到一个配置对象
    const config = {
      ...customFontSizes,
      colors: customColors
    }
    
    // 进度回调函数（使用nextTick确保UI及时更新）
    const onProgress = async (current, total, message) => {
      // 如果用户取消了生成，抛出一个带标记的错误中断
      if (cancelGeneration.value) {
        const error = new Error('用户取消了PDF生成')
        error.isCancellation = true // 标记为取消操作
        throw error
      }
      
      generatingProgress.value = {
        visible: true,
        current,
        total,
        message
      }
      // 强制Vue更新UI
      await nextTick()
    }
    
    // 生成真正的PDF（带进度回调）
    const pdfBlob = await generateTemporalPDF(props.data, 'all', config, onProgress)
    
    // 检查是否在生成完成前取消了（静默处理）
    if (cancelGeneration.value) {
      loadingMsg.close()
      return
    }
    
    // 💾 缓存生成的PDF Blob（供导出时直接使用）
    cachedPdfBlob.value = pdfBlob
    
    // 转换为URL
    previewPdfUrl.value = URL.createObjectURL(pdfBlob)
    
    // 隐藏进度显示
    generatingProgress.value.visible = false
    
    loadingMsg.close()
    ElMessage.success(`PDF预览已生成（${customColors.name}）！点击"导出PDF"可直接下载`)
  } catch (error) {
    generatingProgress.value.visible = false
    loadingMsg.close()
    
    // 如果是取消操作，静默处理（不显示任何消息，不输出到控制台）
    if (error.isCancellation || error.message === '用户取消了PDF生成') {
      // 静默处理，不输出任何信息
      return
    }
    
    console.error('PDF预览生成失败:', error)
    ElMessage.error(`PDF预览失败：${error.message}`)
  }
}

// 应用字体和配色设置并刷新预览
const applyFontSizes = async () => {
  console.log('🔄 应用新配置并重新生成PDF预览...')
  console.log('📝 字体配置:', fontSizes.value)
  console.log('🎨 配色方案:', selectedColorScheme.value)
  
  // 显示进度
  generatingProgress.value = {
    visible: true,
    current: 0,
    total: 15,
    message: '正在应用新配置...'
  }
  
  const loadingMsg = ElMessage({ message: '正在更新PDF预览...', type: 'info', duration: 0 })
  
  try {
    // 清除旧的URL
    if (previewPdfUrl.value) {
      URL.revokeObjectURL(previewPdfUrl.value)
    }
    
    const customFontSizes = getFontSizesWithUnit()
    const customColors = getCurrentColorScheme()
    
    // 重新生成PDF（将配色方案合并到配置中）
    const config = {
      ...customFontSizes,
      colors: customColors
    }
    
    // 进度回调函数（使用nextTick确保UI及时更新）
    const onProgress = async (current, total, message) => {
      generatingProgress.value = {
        visible: true,
        current,
        total,
        message
      }
      // 强制Vue更新UI
      await nextTick()
    }
    
    const pdfBlob = await generateTemporalPDF(props.data, 'all', config, onProgress)
    
    // 💾 更新缓存的PDF Blob
    cachedPdfBlob.value = pdfBlob
    
    // 转换为URL
    previewPdfUrl.value = URL.createObjectURL(pdfBlob)
    
    // 隐藏进度
    generatingProgress.value.visible = false
    
    loadingMsg.close()
    ElMessage.success(`已应用${customColors.name}配色！点击"导出PDF"可直接下载`)
  } catch (error) {
    generatingProgress.value.visible = false
    loadingMsg.close()
    console.error('PDF预览更新失败:', error)
    ElMessage.error(`PDF预览更新失败：${error.message}`)
  }
}

// 重置配置为默认值
const resetConfig = () => {
  // 重置字体
  const defaultSizes = getDefaultFontSizes()
  Object.keys(defaultSizes).forEach(key => {
    fontSizes.value[key] = parseInt(defaultSizes[key])
  })
  // 重置配色方案
  selectedColorScheme.value = 'classic'
  
  ElMessage.success('已重置为默认配置（字体+配色）')
}

// 获取当前配色方案
const getCurrentColorScheme = () => {
  return COLOR_SCHEMES[selectedColorScheme.value]
}

// 关闭预览对话框并清理资源
const handleClosePreview = () => {
  // 🚫 如果正在生成，设置取消标志（静默处理）
  if (generatingProgress.value.visible) {
    cancelGeneration.value = true
  }
  
  // 立即隐藏进度提示
  generatingProgress.value.visible = false
  
  // 释放PDF URL
  if (previewPdfUrl.value) {
    URL.revokeObjectURL(previewPdfUrl.value)
    previewPdfUrl.value = ''
  }
  
  // 🗑️ 清除缓存的PDF Blob（关闭预览后不再保留）
  // 如果用户想导出，需要重新打开预览或直接导出
  cachedPdfBlob.value = null
  console.log('🧹 预览关闭，已清除PDF缓存')
  
  // 🔄 重置配色方案为默认值
  selectedColorScheme.value = 'classic'
  
  // 🔄 重置字体大小为默认值
  const defaultSizes = getDefaultFontSizes()
  Object.keys(defaultSizes).forEach(key => {
    fontSizes.value[key] = parseInt(defaultSizes[key])
  })
  
  // 🔄 重置样式配置标签页为默认（字体配置）
  activeConfigTab.value = 'font'
  
  console.log('🔄 已重置样式配置为默认值')
  
  previewVisible.value = false
}

// 从预览导出PDF
const handleExportFromPreview = async () => {
  previewVisible.value = false
  await handleExportReport()
}

// 导出PDF报告
const handleExportReport = async () => {
  const loadingMsg = ElMessage({ message: '正在准备导出PDF...', type: 'info', duration: 0 })
  
  try {
    // 生成ASCII安全的时间戳文件名（避免乱码）
    const now = new Date()
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
    
    const reportType = 'Full_Report'
    const reportName = `Temporal_Analysis_${reportType}_${timestamp}.pdf`
    
    let pdfBlob
    
    // 💾 优先使用缓存的PDF Blob（如果存在）
    if (cachedPdfBlob.value) {
      console.log('✅ 使用预览生成的PDF（无需重新生成）')
      pdfBlob = cachedPdfBlob.value
      loadingMsg.close()
      ElMessage.success('使用预览生成的PDF，下载速度超快！')
    } else {
      console.log('📄 开始生成PDF报告:', reportName)
      console.log('📝 使用的字体配置:', fontSizes.value)
      console.log('🎨 使用的配色方案:', selectedColorScheme.value)
      loadingMsg.close()
      const newLoadingMsg = ElMessage({ message: '正在生成PDF报告...', type: 'info', duration: 0 })
      
      try {
        // 使用当前的字体和配色配置生成PDF
        const customFontSizes = getFontSizesWithUnit()
        const customColors = getCurrentColorScheme()
        const config = {
          ...customFontSizes,
          colors: customColors
        }
        pdfBlob = await generateTemporalPDF(props.data, 'all', config)
        newLoadingMsg.close()
      } catch (error) {
        newLoadingMsg.close()
        throw error
      }
    }
    
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

  // 字体配置卡片样式
  .preview-container {
    display: flex;
    gap: 20px;
    align-items: flex-start;
  }
  
  .font-config-sidebar {
    width: 320px;
    flex-shrink: 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    max-height: 70vh;
    overflow-y: auto;
    
    &::-webkit-scrollbar {
      width: 6px;
    }
    
    &::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
    }
    
    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 3px;
      
      &:hover {
        background: rgba(255, 255, 255, 0.5);
      }
    }
    
    .sidebar-header {
      margin-bottom: 20px;
      
      .title {
        font-size: 16px;
        font-weight: 600;
        color: white;
        margin-bottom: 12px;
      }
      
      .button-group {
        display: flex;
        gap: 10px;
        
        :deep(.el-button) {
          flex: 1;
          border-radius: 8px;
          font-weight: 500;
          transition: all 0.3s;
          
          &.el-button--default {
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: white;
            
            &:hover {
              background: rgba(255, 255, 255, 0.3);
              border-color: rgba(255, 255, 255, 0.5);
              transform: translateY(-2px);
            }
          }
          
          &.el-button--primary {
            background: white;
            border: 1px solid white;
            color: #667eea;
            
            &:hover {
              background: rgba(255, 255, 255, 0.95);
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(255, 255, 255, 0.3);
            }
          }
        }
      }
    }
    
    .font-items {
      display: flex;
      flex-direction: column;
      gap: 12px;
      
      .font-item {
        background: rgba(255, 255, 255, 0.95);
        padding: 10px 12px;
        border-radius: 8px;
        
        label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #606266;
          margin-bottom: 8px;
        }
        
        .el-input-number {
          width: 100%;
        }
      }
    }
  }
  
  .preview-area {
    flex: 1;
    min-width: 0;
    position: relative;
    
    .progress-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.95);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      border-radius: 8px;
      
      .progress-card {
        background: white;
        border-radius: 12px;
        padding: 30px 40px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        min-width: 400px;
        
        .progress-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          
          .progress-icon {
            font-size: 32px;
            animation: bounce 1s infinite;
          }
          
          .progress-title {
            font-size: 18px;
            font-weight: 600;
            color: #374151;
          }
        }
        
        .progress-message {
          margin-top: 12px;
          font-size: 14px;
          color: #6b7280;
          text-align: center;
        }
      }
    }
    
    @keyframes bounce {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-10px);
      }
    }
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
  
  // 配色方案样式
  .config-tabs {
    :deep(.el-tabs__header) {
      margin-bottom: 15px;
      
      .el-tabs__nav-wrap {
        display: flex;
        justify-content: center;
        
        &::after {
          background-color: rgba(255, 255, 255, 0.2);
        }
      }
      
      .el-tabs__nav {
        display: flex;
        justify-content: center;
      }
      
      .el-tabs__item {
        color: rgba(255, 255, 255, 0.7);
        font-weight: 500;
        
        &.is-active {
          color: white;
        }
        
        &:hover {
          color: white;
        }
      }
      
      .el-tabs__active-bar {
        background-color: white;
      }
    }
    
    :deep(.el-tabs__content) {
      color: white;
    }
  }
  
  .color-schemes {
    .scheme-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
    }
    
    .scheme-radio {
      width: 100%;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 8px;
      padding: 12px;
      margin: 0;
      transition: all 0.3s;
      
      &:hover {
        background: white;
        transform: translateX(4px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
      
      :deep(.el-radio__label) {
        width: 100%;
        padding-left: 8px;
      }
    }
    
    .scheme-option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      
      .scheme-name {
        font-size: 14px;
        font-weight: 500;
        color: #374151;
        flex-shrink: 0;
      }
      
      .scheme-colors {
        display: flex;
        gap: 6px;
        margin-left: 12px;
        
        .color-dot {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          border: 2px solid white;
          flex-shrink: 0;
        }
      }
    }
  }
}
</style>

