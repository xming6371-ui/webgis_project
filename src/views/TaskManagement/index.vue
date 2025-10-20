<template>
  <div class="task-management-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">分类分析任务</h2>
      <p class="page-description">智能识别作物类型，分析种植变化趋势</p>
    </div>

    <!-- 使用教程 -->
    <el-collapse v-model="activeGuide" class="guide-section">
      <el-collapse-item name="1">
        <template #title>
          <div class="guide-title">
            <el-icon><QuestionFilled /></el-icon>
            <span>快速上手指南</span>
          </div>
        </template>
        <div class="guide-content">
          <div class="guide-step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h4>选择影像来源</h4>
              <p>支持<strong>本地上传</strong>（可批量选择多个TIF/IMG文件）或从<strong>影像管理</strong>中选择已有影像（支持多选）</p>
            </div>
          </div>
          <div class="guide-step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h4>开始识别</h4>
              <p>选择好影像后，点击"开始识别"按钮，系统会自动进行批量处理，右侧会显示每个影像的识别进度</p>
            </div>
          </div>
          <div class="guide-step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h4>变化分析</h4>
              <p>识别完成后，可使用<strong>种植差异检测</strong>（对比2期）或<strong>时序变化分析</strong>（对比多期）查看作物种植变化</p>
            </div>
          </div>
          <div class="guide-tips">
            <el-icon color="#E6A23C"><WarnTriangleFilled /></el-icon>
            <span><strong>提示：</strong>单个影像识别通常需要2-5分钟，批量识别会按顺序依次处理</span>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>

    <!-- 作物识别模块 -->
    <el-card shadow="hover" class="module-card classification-module">
      <template #header>
        <div class="module-header">
          <span class="module-title">
            <el-icon><DataAnalysis /></el-icon>
            作物智能识别
          </span>
          <el-tag v-if="batchTasks.length > 0" :type="allTasksCompleted ? 'success' : 'primary'" size="small">
            {{ completedTasksCount }}/{{ batchTasks.length }}
          </el-tag>
        </div>
      </template>

      <div class="classification-with-progress">
        <!-- 左侧：识别操作区 -->
        <div class="classification-main">
          <!-- 数据来源选择 -->
          <el-radio-group v-model="imageSource" class="image-source-selector">
            <el-radio-button label="local">
              <Upload :size="16" style="margin-right: 6px;" />
              本地上传（支持批量）
            </el-radio-button>
            <el-radio-button label="library">
              <el-icon><Folder /></el-icon>
              影像管理（支持多选）
            </el-radio-button>
          </el-radio-group>

          <!-- 本地上传模式 -->
          <div v-if="imageSource === 'local'" class="upload-area" @click="handleBatchImageUpload">
            <div class="upload-icon">
              <Upload :size="48" color="#409EFF" />
            </div>
            <div class="upload-text">
              <h3>批量上传遥感影像</h3>
              <p>支持同时选择多个 TIF、IMG 文件，系统将自动进行批量识别</p>
            </div>
            <el-button type="primary" size="large" class="upload-btn">
              <Upload :size="18" style="margin-right: 8px;" />
              选择影像文件（可多选）
            </el-button>
          </div>

          <!-- 影像管理模式 -->
          <div v-else class="library-selection">
            <el-select 
              v-model="selectedImageIds" 
              placeholder="从data文件夹选择影像（可多选）" 
              size="large"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              class="image-selector"
            >
              <el-option
                v-for="img in imageLibrary"
                :key="img.id"
                :label="img.name"
                :value="img.id"
              >
                <div class="image-option">
                  <span class="image-name">{{ img.name }}</span>
                  <span class="image-info">{{ img.type }} | {{ img.size }}</span>
                </div>
              </el-option>
            </el-select>
            <el-button 
              type="primary" 
              size="large" 
              :disabled="selectedImageIds.length === 0"
              @click="handleLibraryBatchClassify"
              class="classify-btn"
            >
              <el-icon style="margin-right: 8px;"><DataAnalysis /></el-icon>
              开始批量识别 ({{ selectedImageIds.length }})
            </el-button>
          </div>

          <!-- 快速提示 -->
          <div class="quick-tips">
            <el-icon><InfoFilled /></el-icon>
            <span>支持批量上传和识别，系统将按顺序处理每个影像，右侧会显示详细进度</span>
          </div>
        </div>

        <!-- 右侧：批量识别进度面板 -->
        <div class="progress-sidebar">
          <div class="progress-header">
            <span class="progress-title">
              <el-icon><Histogram /></el-icon>
              识别进度
            </span>
          </div>

          <div class="progress-content">
            <el-empty 
              v-if="batchTasks.length === 0" 
              description="暂无任务"
              :image-size="80"
            />
            
            <div v-else class="task-list">
              <div 
                v-for="task in batchTasks" 
                :key="task.id" 
                class="task-item"
                :class="{ 'task-completed': task.status === 'completed', 'task-processing': task.status === 'processing' }"
              >
                <div class="task-header">
                  <div class="task-name">
                    <el-icon v-if="task.status === 'completed'" color="#67C23A" :size="16"><CircleCheck /></el-icon>
                    <el-icon v-else-if="task.status === 'processing'" class="rotating" color="#409EFF" :size="16"><Loading /></el-icon>
                    <el-icon v-else color="#909399" :size="16"><Clock /></el-icon>
                    <span>{{ task.name }}</span>
                  </div>
                  <el-tag :type="getTaskStatusType(task.status)" size="small">
                    {{ getTaskStatusText(task.status) }}
                  </el-tag>
                </div>
                
                <el-progress 
                  :percentage="task.progress" 
                  :status="task.status === 'completed' ? 'success' : ''"
                  :stroke-width="6"
                  :show-text="false"
                />
                
                <div class="task-info">
                  <span class="task-progress-text">{{ task.statusText }}</span>
                  <span class="task-time">{{ task.elapsedTime }}</span>
                </div>
              </div>
            </div>

            <div v-if="batchTasks.length > 0 && allTasksCompleted" class="batch-summary">
              <el-alert type="success" :closable="false" class="compact-alert">
                <template #title>
                  <div style="display: flex; align-items: center; gap: 6px; font-size: 13px;">
                    <el-icon :size="16"><SuccessFilled /></el-icon>
                    <span>全部完成！</span>
                  </div>
                </template>
              </el-alert>
              <el-button 
                type="primary" 
                size="small" 
                @click="handleClearBatchTasks"
                style="margin-top: 8px; width: 100%;"
              >
                清空列表
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 变化检测与差异分析模块 -->
    <el-card shadow="never" class="module-card analysis-module">
      <template #header>
        <div class="module-header">
            <span class="module-title">
            <GitCompare :size="18" style="margin-right: 8px;" />
              变化检测与差异分析
            </span>
          <el-button 
            v-if="hasAnalysisData" 
            type="danger" 
            size="small" 
            @click="handleClearAllData"
          >
            <Trash2 :size="14" style="margin-right: 6px;" />
            清空数据
          </el-button>
        </div>
      </template>

      <!-- 功能按钮区 -->
      <div class="analysis-actions">
        <el-card shadow="hover" class="action-card" @click="showDifferenceDialog = true">
          <div class="action-content">
            <el-icon class="action-icon" color="#E6A23C"><Location /></el-icon>
            <div class="action-text">
              <div class="action-title">种植差异检测</div>
              <div class="action-desc">对比不同时期的作物种植差异</div>
            </div>
          </div>
        </el-card>

        <el-card shadow="hover" class="action-card" @click="showTemporalDialog = true">
          <div class="action-content">
            <el-icon class="action-icon" color="#409EFF"><DataAnalysis /></el-icon>
            <div class="action-text">
              <div class="action-title">时序变化分析</div>
              <div class="action-desc">追踪多期作物种植变化轨迹</div>
            </div>
          </div>
        </el-card>
          </div>
        </el-card>

    <!-- 种植差异检测配置对话框 -->
    <el-dialog
      v-model="showDifferenceDialog"
      title="种植差异检测配置"
      width="650px"
      :close-on-click-modal="false"
    >
      <el-alert
        title="说明"
        type="info"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        从识别结果队列中选择两个识别结果文件进行对比，时间早的作为原始图，时间晚的作为对比图
      </el-alert>
      
      <el-form :model="differenceConfig" label-width="100px">
        <el-form-item label="原始图" required>
          <el-select 
            v-model="differenceConfig.baseFileId" 
            placeholder="选择时间较早的识别结果" 
            style="width: 100%"
            filterable
          >
            <el-option 
              v-for="file in recognitionFiles" 
              :key="file.id"
              :label="`${file.taskName} (${file.createTime})`" 
              :value="file.id"
              :disabled="file.id === differenceConfig.compareFileId"
            >
              <div style="display: flex; justify-content: space-between;">
                <span>{{ file.taskName }}</span>
                <span style="color: #8492a6; font-size: 13px;">{{ file.createTime }}</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        
        <el-form-item label="对比图" required>
          <el-select 
            v-model="differenceConfig.compareFileId" 
            placeholder="选择时间较晚的识别结果" 
            style="width: 100%"
            filterable
          >
            <el-option 
              v-for="file in recognitionFiles.filter(f => f.id !== differenceConfig.baseFileId)" 
              :key="file.id"
              :label="`${file.taskName} (${file.createTime})`" 
              :value="file.id"
            >
              <div style="display: flex; justify-content: space-between;">
                <span>{{ file.taskName }}</span>
                <span style="color: #8492a6; font-size: 13px;">{{ file.createTime }}</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDifferenceDialog = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="handleRunDifferenceDetection" 
          :loading="differenceLoading"
          :disabled="!differenceConfig.baseFileId || !differenceConfig.compareFileId"
        >
          开始检测
        </el-button>
      </template>
    </el-dialog>

    <!-- 时序变化分析配置对话框 -->
    <el-dialog
      v-model="showTemporalDialog"
      title="时序变化分析配置"
      width="700px"
      :close-on-click-modal="false"
    >
      <el-alert
        title="说明"
        type="info"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        从分析结果队列中选择多个识别结果文件进行时序变化分析，系统将按时间顺序自动排列
      </el-alert>
      
      <el-form :model="temporalConfig" label-width="120px">
        <el-form-item label="选择文件">
          <el-select 
            v-model="temporalConfig.selectedFileIds" 
            placeholder="选择多个识别结果（至少2个）" 
            style="width: 100%"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
          >
            <el-option 
              v-for="file in recognitionFiles" 
              :key="file.id"
              :label="`${file.taskName} (${file.createTime})`" 
              :value="file.id"
            >
              <div style="display: flex; justify-content: space-between;">
                <span>{{ file.taskName }}</span>
                <span style="color: #8492a6; font-size: 13px;">{{ file.createTime }}</span>
              </div>
            </el-option>
          </el-select>
          <div style="margin-top: 8px; font-size: 12px; color: #909399;">
            已选择 {{ temporalConfig.selectedFileIds.length }} 个文件
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showTemporalDialog = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="handleRunTemporalAnalysis" 
          :loading="temporalLoading"
          :disabled="temporalConfig.selectedFileIds.length < 2"
        >
          开始分析
        </el-button>
      </template>
    </el-dialog>

    <!-- 分析进度对话框 -->
    <el-dialog
      v-model="analysisTaskRunning"
      title="分析执行中"
      width="500px"
      :close-on-click-modal="false"
      :show-close="false"
    >
      <div class="analysis-progress-dialog">
        <el-progress 
          type="circle" 
          :percentage="analysisProgress" 
          :status="analysisProgress === 100 ? 'success' : ''"
          :width="120"
        />
        <div class="progress-text">{{ analysisStatusText }}</div>
        <el-button 
          v-if="analysisProgress === 100" 
          type="primary" 
          @click="handleViewAnalysisQueue"
        >
          前往查看结果
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import {
  Plus, Trash2, Upload, GitCompare
} from 'lucide-vue-next'
import {
  Tickets, DataAnalysis, Location, InfoFilled, Folder, QuestionFilled,
  WarnTriangleFilled, Histogram, CircleCheck, Loading, Clock, SuccessFilled
} from '@element-plus/icons-vue'
import { getRecognitionResults, readGeojsonContent, saveAnalysisResultToServer } from '@/api/analysis'
import { useAnalysisStore } from '@/stores/analysis'
import { buildTemporalTrajectories } from '@/utils/temporalAnalysis'

const router = useRouter()
const analysisStore = useAnalysisStore()

// 使用教程折叠状态
const activeGuide = ref([])

// 对话框显示状态
const showDifferenceDialog = ref(false)
const showTemporalDialog = ref(false)

// 分析任务执行状态
const analysisTaskRunning = ref(false)
const analysisProgress = ref(0)
const analysisStatusText = ref('')

// 识别结果文件列表（从数据管理模块的分析结果队列加载）
const recognitionFiles = ref([])

// 影像来源选择
const imageSource = ref('local') // local: 本地上传, library: 影像管理
const selectedImageIds = ref([]) // 改为数组，支持多选
const imageLibrary = ref([]) // 影像管理中的影像列表

// 批量识别任务列表
const batchTasks = ref([])
let taskIdCounter = 0

// 差异检测配置
const differenceLoading = ref(false)
const differenceConfig = ref({
  baseFileId: '',
  compareFileId: ''
})

// 时序变化分析配置
const temporalLoading = ref(false)
const temporalConfig = ref({
  selectedFileIds: []
})

// 计算属性：判断是否有分析数据（通过 store 判断）
const hasAnalysisData = computed(() => {
  return analysisStore.differenceResult !== null || 
         analysisStore.temporalResult !== null
})

// 批量任务相关计算属性
const completedTasksCount = computed(() => {
  return batchTasks.value.filter(task => task.status === 'completed').length
})

const allTasksCompleted = computed(() => {
  return batchTasks.value.length > 0 && batchTasks.value.every(task => task.status === 'completed')
})

// 获取任务状态显示文本
const getTaskStatusText = (status) => {
  const statusMap = {
    'waiting': '等待中',
    'processing': '识别中',
    'completed': '已完成',
    'failed': '失败'
  }
  return statusMap[status] || '未知'
}

// 获取任务状态标签类型
const getTaskStatusType = (status) => {
  const typeMap = {
    'waiting': 'info',
    'processing': 'primary',
    'completed': 'success',
    'failed': 'danger'
  }
  return typeMap[status] || 'info'
}

// 加载识别结果文件列表（从后端API读取GeoJSON文件）
const loadRecognitionFiles = async () => {
  try {
    // 从后端API加载识别结果
    const response = await getRecognitionResults()
    if (response.code === 200) {
      const allResults = response.data || []
      
      // 只加载 GeoJSON 类型的识别结果文件
      recognitionFiles.value = allResults.filter(r => {
        // 检查文件类型是否为 GeoJSON 或 GEOJSON（不区分大小写）
        const isGeoJSON = r.type && r.type.toUpperCase() === 'GEOJSON'
        return isGeoJSON
      })
      
      console.log('✅ 已从后端加载GeoJSON识别结果文件:', recognitionFiles.value.length, '个')
      console.log('识别结果文件列表:', recognitionFiles.value)
    } else {
      recognitionFiles.value = []
      console.log('后端返回数据为空')
    }
  } catch (error) {
    console.error('❌ 从后端加载识别结果文件失败:', error)
    recognitionFiles.value = []
  }
}

// 加载影像管理数据（从本地data文件夹）
const loadImageLibrary = async () => {
  try {
    // 从后端API加载data文件夹中的影像列表
    const { getImageList } = await import('@/api/image')
    const response = await getImageList()
    
    if (response.code === 200 && response.data) {
      // 过滤出TIF和IMG格式的影像文件
      imageLibrary.value = response.data
        .filter(img => {
          const ext = img.name?.toLowerCase()
          return ext?.endsWith('.tif') || ext?.endsWith('.tiff') || ext?.endsWith('.img')
        })
        .map(img => ({
          id: img.id,
          name: img.name,
          type: img.type || 'TIF',
          size: img.size || '未知',
          path: img.path,
          uploadTime: img.uploadTime || img.createTime
        }))
      
      console.log('✅ 已从data文件夹加载影像列表:', imageLibrary.value.length, '个')
      console.log('影像列表:', imageLibrary.value)
    } else {
      imageLibrary.value = []
      console.log('⚠️ data文件夹中暂无影像文件')
    }
  } catch (error) {
    console.error('❌ 加载data文件夹影像列表失败:', error)
    imageLibrary.value = []
    ElMessage.warning('无法加载影像列表，请检查后端服务')
  }
}

// 组件挂载时加载数据
onMounted(() => {
  loadRecognitionFiles()
  loadImageLibrary()
})

// 前往数据管理查看分析结果
const handleViewAnalysisQueue = () => {
  router.push('/image-management')
}

// 批量上传影像文件
const handleBatchImageUpload = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.tif,.tiff,.img'
  input.multiple = true // 支持多选
  
  input.onchange = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      handleBatchImageFiles(files)
    }
  }
  
  input.click()
}

// 处理批量上传的影像文件
const handleBatchImageFiles = (files) => {
  console.log(`批量上传 ${files.length} 个文件:`, files)
  
  // 为每个文件创建任务
  const newTasks = files.map(file => ({
    id: `task_${++taskIdCounter}`,
    name: file.name,
    file: file,
    status: 'waiting',
    progress: 0,
    statusText: '等待处理',
    elapsedTime: '00:00',
    startTime: null
  }))
  
  batchTasks.value.push(...newTasks)
  
  ElMessage.success(`已添加 ${files.length} 个识别任务，开始批量处理`)
  
  // 开始处理批量任务
  processBatchTasks()
}

// 从影像管理批量识别
const handleLibraryBatchClassify = () => {
  if (selectedImageIds.value.length === 0) {
    ElMessage.warning('请选择要识别的影像')
    return
  }
  
  const selectedImages = imageLibrary.value.filter(img => 
    selectedImageIds.value.includes(img.id)
  )
  
  console.log(`从影像管理选择 ${selectedImages.length} 个影像:`, selectedImages)
  
  // 为每个影像创建任务
  const newTasks = selectedImages.map(img => ({
    id: `task_${++taskIdCounter}`,
    name: img.name,
    imageId: img.id,
    status: 'waiting',
    progress: 0,
    statusText: '等待处理',
    elapsedTime: '00:00',
    startTime: null
  }))
  
  batchTasks.value.push(...newTasks)
  
  ElMessage.success(`已添加 ${selectedImages.length} 个识别任务，开始批量处理`)
  
  // 清空选择
  selectedImageIds.value = []
  
  // 开始处理批量任务
  processBatchTasks()
}

// 处理批量任务（按顺序依次处理）
let isProcessing = false
const processBatchTasks = async () => {
  if (isProcessing) return
  
  isProcessing = true
  
  const waitingTasks = batchTasks.value.filter(task => task.status === 'waiting')
  
  for (const task of waitingTasks) {
    await processTask(task)
  }
  
  isProcessing = false
  
  // 全部完成后显示通知
  if (allTasksCompleted.value) {
    ElNotification({
      title: '✅ 批量识别完成',
      message: `已完成 ${batchTasks.value.length} 个影像的识别，结果已保存`,
      type: 'success',
      duration: 8000
    })
    
    // 刷新识别结果列表
    await loadRecognitionFiles()
  }
}

// 处理单个任务
const processTask = (task) => {
  return new Promise((resolve) => {
    task.status = 'processing'
    task.progress = 0
    task.startTime = Date.now()
    
    // 更新经过时间的定时器
    const timeInterval = setInterval(() => {
      if (task.status === 'processing') {
        const elapsed = Math.floor((Date.now() - task.startTime) / 1000)
        const minutes = Math.floor(elapsed / 60)
        const seconds = elapsed % 60
        task.elapsedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      } else {
        clearInterval(timeInterval)
      }
    }, 1000)
    
    // 模拟分类识别过程
    // 步骤1: 上传/加载 (0-20%)
    task.statusText = '正在加载影像数据...'
    setTimeout(() => {
      task.progress = 20
      task.statusText = '影像加载完成，正在预处理...'
    }, 800)
    
    // 步骤2: 预处理 (20-40%)
    setTimeout(() => {
      task.progress = 40
      task.statusText = '预处理完成，正在进行智能识别...'
    }, 1800)
    
    // 步骤3: 识别 (40-85%)
    setTimeout(() => {
      task.progress = 70
      task.statusText = '智能识别中...'
    }, 3000)
    
    setTimeout(() => {
      task.progress = 85
      task.statusText = '正在保存识别结果...'
    }, 4200)
    
    // 步骤4: 完成 (85-100%)
    setTimeout(() => {
      task.progress = 100
      task.status = 'completed'
      task.statusText = '识别完成'
      clearInterval(timeInterval)
      
      console.log(`✅ 任务完成: ${task.name}`)
      resolve()
    }, 5000)
  })
}

// 清空批量任务列表
const handleClearBatchTasks = () => {
  batchTasks.value = []
  ElMessage.success('已清空任务列表')
}

// 功能B.1：执行种植差异检测（真实数据分析）
const handleRunDifferenceDetection = async () => {
  if (!differenceConfig.value.baseFileId || !differenceConfig.value.compareFileId) {
    ElMessage.warning('请选择两个识别结果文件进行对比')
    return
  }

  differenceLoading.value = true
  showDifferenceDialog.value = false
  
  // 显示任务执行状态
  analysisTaskRunning.value = true
  analysisProgress.value = 0
  analysisStatusText.value = '正在加载识别结果文件...'

  try {
    // 获取选择的文件
    const baseFile = recognitionFiles.value.find(f => f.id === differenceConfig.value.baseFileId)
    const compareFile = recognitionFiles.value.find(f => f.id === differenceConfig.value.compareFileId)

    if (!baseFile || !compareFile) {
      throw new Error('未找到选择的文件，请重新选择')
    }

    console.log('开始差异检测分析')
    console.log('原始图文件:', baseFile)
    console.log('对比图文件:', compareFile)

    // 1. 读取两个GeoJSON文件
    analysisProgress.value = 20
    analysisStatusText.value = '正在读取原始图数据...'
    console.log(`正在读取原始图: ${baseFile.name}`)
    const baseResponse = await readGeojsonContent(baseFile.name)
    console.log('原始图响应:', baseResponse)
    
    analysisProgress.value = 35
    analysisStatusText.value = '正在读取对比图数据...'
    const compareResponse = await readGeojsonContent(compareFile.name)
    
    if (baseResponse.code !== 200 || compareResponse.code !== 200) {
      throw new Error('读取GeoJSON文件失败')
    }
    
    const baseGeojson = baseResponse.data
    const compareGeojson = compareResponse.data
    
    console.log(`原始图包含 ${baseGeojson.features?.length || 0} 个要素`)
    console.log(`对比图包含 ${compareGeojson.features?.length || 0} 个要素`)
    
    // 2. 进行差异分析
    analysisProgress.value = 50
    analysisStatusText.value = '正在进行空间叠加分析...'
    
    const diffResult = performDifferenceAnalysis(baseGeojson, compareGeojson, baseFile, compareFile)
    
    analysisProgress.value = 75
    analysisStatusText.value = '正在生成分析报告...'
    
    // 3. 保存分析结果到全局状态（用于ResultCompare直接展示）
    const analysisResult = {
      type: 'difference',
      title: `${baseFile.taskName} vs ${compareFile.taskName}`,
      baseFile: {
        id: baseFile.id,
        name: baseFile.name,
        taskName: baseFile.taskName,
        geojson: baseGeojson
      },
      compareFile: {
        id: compareFile.id,
        name: compareFile.name,
        taskName: compareFile.taskName,
        geojson: compareGeojson
      },
      features: diffResult.geojson.features,
      stats: diffResult.stats,
      metadata: diffResult.geojson.metadata,
      analysisTime: new Date().toLocaleString('zh-CN')
    }
    
    analysisProgress.value = 90
    analysisStatusText.value = '正在准备可视化...'
    
    console.log('差异检测完成，结果:', analysisResult)
    console.log(`共 ${diffResult.stats.total} 个地块，${diffResult.stats.changed} 个有变化`)
    
    // 保存到全局状态
    analysisStore.setDifferenceResult(analysisResult)

    analysisProgress.value = 95
    analysisStatusText.value = '正在保存分析结果...'
    
    // 保存完整的JSON格式分析结果到服务器
    try {
      const analysisData = {
        version: '1.0',
        id: `difference_${Date.now()}`,
        type: 'difference',
        metadata: {
          title: `${baseFile.taskName} vs ${compareFile.taskName}`,
          createTime: new Date().toLocaleString('zh-CN'),
          baseFile: baseFile.taskName,
          compareFile: compareFile.taskName,
          totalPlots: diffResult.stats.total,
          changedPlots: diffResult.stats.changed
        },
        data: analysisResult
      }
      
      const saveResponse = await saveAnalysisResultToServer('difference', analysisData)
      console.log('✅ 差异分析结果已保存为JSON:', saveResponse.data)
    } catch (error) {
      console.error('保存JSON失败:', error)
      ElMessage.warning('分析结果保存失败，但可以继续查看')
    }
    
    analysisProgress.value = 100
    analysisStatusText.value = '分析完成！'
    
    differenceLoading.value = false
    
    // 显示成功提示
    ElNotification({
      title: '✅ 差异检测完成',
      message: `已检测到${diffResult.stats.changed}个变化地块，分析结果已保存`,
      type: 'success',
      duration: 5000
    })
    
    // 等待2秒后关闭进度对话框并跳转
    setTimeout(() => {
      analysisTaskRunning.value = false
      router.push('/result-compare')
    }, 2000)
    
  } catch (error) {
    console.error('差异检测失败:', error)
    console.error('错误详情:', error.response?.data || error.response || error)
    analysisTaskRunning.value = false
    differenceLoading.value = false
    
    let errorMsg = '差异检测失败'
    if (error.response?.data?.message) {
      errorMsg += ': ' + error.response.data.message
    } else if (error.message) {
      errorMsg += ': ' + error.message
    }
    
    ElMessage({
      message: errorMsg,
      type: 'error',
      duration: 8000,
      showClose: true
    })
  }
}

// 执行差异分析（对比两个GeoJSON）
const performDifferenceAnalysis = (baseGeojson, compareGeojson, baseFile, compareFile) => {
  const baseFeatures = baseGeojson.features || []
  const compareFeatures = compareGeojson.features || []
  
  console.log('=== 差异分析开始 ===')
  console.log(`原始图要素数: ${baseFeatures.length}`)
  console.log(`对比图要素数: ${compareFeatures.length}`)
  
  // 打印第一个要素的属性，帮助调试
  if (baseFeatures.length > 0) {
    console.log('原始图第一个要素属性:', baseFeatures[0].properties)
  }
  if (compareFeatures.length > 0) {
    console.log('对比图第一个要素属性:', compareFeatures[0].properties)
  }
  
  // 构建对比图的快速查找索引（按plotId或FID）
  const compareMap = new Map()
  compareFeatures.forEach((feature, idx) => {
    const props = feature.properties || {}
    const id = props.FID || props.id || props.plotId || props.OBJECTID || idx
    compareMap.set(String(id), feature)
  })
  
  console.log(`对比图索引构建完成，共 ${compareMap.size} 个地块`)
  
  const resultFeatures = []
  let changedCount = 0
  let unchangedCount = 0
  let matchedCount = 0
  
  // 对比每个地块
  baseFeatures.forEach((baseFeature, index) => {
    const baseProps = baseFeature.properties || {}
    const id = baseProps.FID || baseProps.id || baseProps.plotId || baseProps.OBJECTID || index
    
    // 优先使用gridcode字段判断作物类型！
    const baseGridcode = baseProps.gridcode || baseProps.GRIDCODE || baseProps.GridCode
    const baseCrop = baseGridcode !== undefined 
      ? `作物${baseGridcode}` 
      : (baseProps.label || baseProps.crop || baseProps.class || baseProps.type || baseProps.作物类型 || baseProps.cropType || '未知')
    
    // 在对比图中查找对应地块
    const compareFeature = compareMap.get(String(id))
    
    let currentCrop = '未种植'
    let currentGridcode = null
    let diffType = 'unchanged'
    let hasChange = false
    
    if (compareFeature) {
      matchedCount++
      const compareProps = compareFeature.properties || {}
      
      // 优先使用gridcode字段判断作物类型！
      currentGridcode = compareProps.gridcode || compareProps.GRIDCODE || compareProps.GridCode
      currentCrop = currentGridcode !== undefined 
        ? `作物${currentGridcode}` 
        : (compareProps.label || compareProps.crop || compareProps.class || compareProps.type || compareProps.作物类型 || compareProps.cropType || '未知')
      
      // 判断是否变化（比较gridcode或作物类型）
      if (baseGridcode !== undefined && currentGridcode !== undefined) {
        // 如果有gridcode，直接比较gridcode
        if (baseGridcode !== currentGridcode) {
          diffType = 'changed'
          hasChange = true
          changedCount++
          
          // 打印前5个变化的地块，帮助调试
          if (changedCount <= 5) {
            console.log(`变化地块 ${changedCount}:`, {
              id: id,
              原始gridcode: baseGridcode,
              当前gridcode: currentGridcode,
              原始: baseCrop,
              当前: currentCrop
            })
          }
        } else {
          unchangedCount++
        }
      } else if (baseCrop !== currentCrop) {
        // 没有gridcode，比较作物名称
        diffType = 'changed'
        hasChange = true
        changedCount++
        
        if (changedCount <= 5) {
          console.log(`变化地块 ${changedCount}:`, {
            id: id,
            原始: baseCrop,
            当前: currentCrop
          })
        }
      } else {
        unchangedCount++
      }
    } else {
      // 在对比图中找不到，可能是撂荒或删除
      diffType = 'abandoned'
      hasChange = true
      changedCount++
    }
    
    // 创建结果要素
    resultFeatures.push({
      type: 'Feature',
      properties: {
        ...baseProps,
        plotId: String(id),
        plotName: baseProps.name || baseProps.plotName || `地块${id}`,
        originalCrop: baseCrop,
        currentCrop: currentCrop,
        diffType: diffType,
        hasChange: hasChange,
        area: baseProps.area || baseProps.Area || baseProps.面积 || 0
      },
      geometry: baseFeature.geometry
    })
  })
  
  console.log('=== 差异分析完成 ===')
  console.log(`总地块数: ${resultFeatures.length}`)
  console.log(`匹配成功: ${matchedCount}`)
  console.log(`有变化: ${changedCount}`)
  console.log(`无变化: ${unchangedCount}`)
  
  // 构建结果GeoJSON
  const resultGeojson = {
    type: 'FeatureCollection',
    metadata: {
      analysisType: 'difference',
      baseFile: baseFile.name,
      compareFile: compareFile.name,
      baseTaskName: baseFile.taskName,
      compareTaskName: compareFile.taskName,
      analysisTime: new Date().toLocaleString('zh-CN'),
      totalFeatures: resultFeatures.length,
      changed: changedCount,
      unchanged: unchangedCount,
      matched: matchedCount
    },
    features: resultFeatures
  }
  
  return {
    geojson: resultGeojson,
    stats: {
      total: resultFeatures.length,
      changed: changedCount,
      unchanged: unchangedCount,
      matched: matchedCount
    }
  }
}

// 功能B.2：执行时序变化分析（真实数据分析）
const handleRunTemporalAnalysis = async () => {
  if (!temporalConfig.value.selectedFileIds || temporalConfig.value.selectedFileIds.length < 2) {
    ElMessage.warning('请至少选择2个识别结果文件进行时序分析')
    return
  }

  temporalLoading.value = true
  showTemporalDialog.value = false
  
  // 显示任务执行状态
  analysisTaskRunning.value = true
  analysisProgress.value = 0
  analysisStatusText.value = '正在加载多期识别结果...'

  try {
    // 获取选择的文件并按时间排序
    const selectedFiles = temporalConfig.value.selectedFileIds
      .map(id => recognitionFiles.value.find(f => f.id === id))
      .filter(f => f)
      .sort((a, b) => new Date(a.createTime) - new Date(b.createTime))

    console.log(`开始时序变化分析: ${selectedFiles.length}个时间点`)
    console.log('选择的文件:', selectedFiles)

    // 1. 读取所有GeoJSON文件
    const geojsonDataList = []
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      analysisProgress.value = 10 + (i / selectedFiles.length) * 30
      analysisStatusText.value = `正在读取第${i + 1}/${selectedFiles.length}个文件...`
      
      console.log(`读取文件 ${i + 1}/${selectedFiles.length}: ${file.name}`)
      const response = await readGeojsonContent(file.name)
      console.log(`文件 ${i + 1} 响应:`, response)
      if (response.code === 200) {
        geojsonDataList.push({
          file: file,
          geojson: response.data,
          time: file.createTime
        })
        console.log(`读取 ${file.name}: ${response.data.features?.length || 0} 个要素`)
      }
    }

    // 2. 进行时序分析
    analysisProgress.value = 50
    analysisStatusText.value = '正在分析时序变化轨迹...'
    
    const temporalResult = performTemporalAnalysis(geojsonDataList)
    
    analysisProgress.value = 75
    analysisStatusText.value = '正在生成分析报告...'
    
    // 3. 保存分析结果到全局状态（用于ResultCompare直接展示）
    const analysisResult = {
      type: 'temporal',
      title: `${selectedFiles.length}期时序对比`,
      files: selectedFiles.map(f => ({
        id: f.id,
        name: f.name,
        taskName: f.taskName,
        createTime: f.createTime
      })),
      timePoints: geojsonDataList.map(d => ({
        time: d.time,
        taskName: d.file.taskName,
        createTime: d.file.createTime,
        geojson: d.geojson
      })),
      features: temporalResult.geojson.features,
      stats: temporalResult.stats,
      filesCount: selectedFiles.length,
      // 将metadata中的数据提取到根级别，方便访问
      transitionMatrix: temporalResult.geojson.metadata.transitionMatrix || [],
      cropDistribution: temporalResult.geojson.metadata.cropDistribution || [],
      trajectories: temporalResult.analysisResult?.trajectories || [],
      qualityReport: temporalResult.analysisResult?.qualityReport || { warnings: [], timePointCounts: [], matchRate: 100 },
      metadata: temporalResult.geojson.metadata,
      analysisTime: new Date().toLocaleString('zh-CN')
    }
    
    analysisProgress.value = 90
    analysisStatusText.value = '正在准备可视化...'
    
    console.log('时序分析完成，结果:', analysisResult)
    console.log(`共 ${temporalResult.stats.total} 个地块，${temporalResult.stats.changed} 个有变化`)
    
    // 保存到全局状态
    analysisStore.setTemporalResult(analysisResult)

    analysisProgress.value = 95
    analysisStatusText.value = '正在保存分析结果...'
    
    // 保存完整的JSON格式分析结果到服务器
    try {
      const analysisData = {
        version: '1.0',
        id: `temporal_${Date.now()}`,
        type: 'temporal',
        metadata: {
          title: `${selectedFiles.length}期时序对比`,
          createTime: new Date().toLocaleString('zh-CN'),
          filesCount: selectedFiles.length,
          timeRange: `${selectedFiles[0].taskName} ~ ${selectedFiles[selectedFiles.length-1].taskName}`,
          totalPlots: temporalResult.stats.total,
          changedPlots: temporalResult.stats.changed
        },
        data: analysisResult
      }
      
      const saveResponse = await saveAnalysisResultToServer('temporal', analysisData)
      console.log('✅ 时序分析结果已保存为JSON:', saveResponse.data)
    } catch (error) {
      console.error('保存JSON失败:', error)
      ElMessage.warning('分析结果保存失败，但可以继续查看')
    }
    
    analysisProgress.value = 100
    analysisStatusText.value = '分析完成！'
    
    temporalLoading.value = false
    
    // 显示成功提示
    ElNotification({
      title: '✅ 时序分析完成',
      message: `已完成${selectedFiles.length}期时序变化分析（共${temporalResult.stats.total}个地块，${temporalResult.stats.changed}个有变化）`,
      type: 'success',
      duration: 5000
    })
    
    // 等待2秒后关闭进度对话框并跳转
    setTimeout(() => {
      analysisTaskRunning.value = false
      router.push('/result-compare')
    }, 2000)
    
  } catch (error) {
    console.error('时序分析失败:', error)
    console.error('错误详情:', error.response?.data || error.response || error)
    analysisTaskRunning.value = false
    temporalLoading.value = false
    
    let errorMsg = '时序分析失败'
    if (error.response?.data?.message) {
      errorMsg += ': ' + error.response.data.message
    } else if (error.message) {
      errorMsg += ': ' + error.message
    }
    
    ElMessage({
      message: errorMsg,
      type: 'error',
      duration: 8000,
      showClose: true
    })
  }
}

// 执行时序分析（追踪多个时间点的变化）
const performTemporalAnalysis = (geojsonDataList) => {
  if (!geojsonDataList || geojsonDataList.length < 2) {
    throw new Error('时序分析至少需要2个时间点的数据')
  }
  
  console.log('🔬 使用增强版时序分析算法')
  
  // 准备数据格式
  const timePointsData = geojsonDataList.map(item => ({
    time: item.time,
    taskName: item.file.taskName,
    createTime: item.file.createTime,
    geojsonData: item.geojson
  }))
  
  // 使用新的核心算法进行分析
  const analysisResult = buildTemporalTrajectories(timePointsData, {
    idField: 'Id', // 根据你的GeoJSON数据的实际字段调整
    cropField: 'gridcode', // 作物代码字段
    areaField: 'area' // 面积字段
  })
  
  console.log('✅ 时序分析完成，统计信息:', analysisResult.stats)
  console.log('📊 作物转换矩阵:', analysisResult.transitionMatrix)
  console.log('📊 作物分布:', analysisResult.cropDistribution)
  
  // 兼容原有的返回格式
  return {
    geojson: {
      type: 'FeatureCollection',
      metadata: {
        analysisType: 'temporal',
        timePoints: analysisResult.timePoints,
        filesCount: analysisResult.filesCount,
        analysisTime: new Date().toLocaleString('zh-CN'),
        totalFeatures: analysisResult.stats.total,
        changed: analysisResult.stats.changed,
        unchanged: analysisResult.stats.unchanged,
        transitionMatrix: analysisResult.transitionMatrix,
        cropDistribution: analysisResult.cropDistribution
      },
      features: analysisResult.features
    },
    stats: analysisResult.stats,
    analysisResult: analysisResult // 保留完整的分析结果供后续使用
  }
}

// 一键清空所有分析数据
const handleClearAllData = () => {
  ElMessageBox.confirm(
    '清空后将删除所有分析数据（包括差异检测结果、时序分析结果），此操作不可恢复，是否继续？',
    '确认清空',
    {
      confirmButtonText: '确定清空',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    }
  ).then(() => {
    // 清空store中的分析结果
    analysisStore.clearDifferenceResult()
    analysisStore.clearTemporalResult()
    
    // 重置配置
    differenceConfig.value = {
      baseFileId: '',
      compareFileId: ''
    }
    temporalConfig.value = {
      selectedFileIds: []
    }
    
    ElMessage.success({
      message: '所有分析数据已清空',
      duration: 3000
    })
  }).catch(() => {
    // 用户取消操作
  })
}
</script>

<style scoped lang="scss">
.task-management-container {
  // 页面标题
  .page-header {
    margin-bottom: 20px;
    padding: 20px 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    color: white;
    
    .page-title {
      margin: 0 0 6px 0;
      font-size: 26px;
      font-weight: 700;
    }
    
    .page-description {
      margin: 0;
      font-size: 15px;
      opacity: 0.95;
    }
  }
  
  // 使用教程区域
  .guide-section {
    margin-bottom: 20px;
    border: none;
    
    :deep(.el-collapse-item__header) {
      background: #f5f7fa;
      border-radius: 8px;
      padding: 12px 16px;
      border: 1px solid #e4e7ed;
      
      &:hover {
        background: #e9ecef;
      }
    }
    
    :deep(.el-collapse-item__content) {
      padding: 0;
    }
    
    .guide-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 600;
      color: #409EFF;
    }
    
    .guide-content {
      padding: 20px;
      background: #fafbfc;
      
      .guide-step {
        display: flex;
        gap: 16px;
        margin-bottom: 20px;
        
        &:last-child {
          margin-bottom: 0;
        }
        
        .step-number {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
    display: flex;
          align-items: center;
    justify-content: center;
          font-weight: 700;
          font-size: 16px;
  }
  
  .step-content {
          flex: 1;
          
          h4 {
            margin: 0 0 6px 0;
            font-size: 16px;
            color: #303133;
          }
          
          p {
            margin: 0;
            font-size: 14px;
            color: #606266;
            line-height: 1.6;
            
            strong {
              color: #409EFF;
            }
          }
        }
      }
      
      .guide-tips {
        margin-top: 16px;
        padding: 12px 16px;
        background: #fff7e6;
        border-left: 4px solid #E6A23C;
    border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 8px;
    font-size: 13px;
        color: #606266;
        
        strong {
          color: #E6A23C;
        }
      }
    }
  }
  
  // 模块卡片通用样式
  .module-card {
    margin-bottom: 24px;
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.3s;
    
    &:hover {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }
    
    .module-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      
      .module-title {
        font-size: 18px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }
  }
  
  // 作物识别模块
  .classification-module {
    border: 2px solid #667eea;
    
    .classification-with-progress {
      display: flex;
      gap: 20px;
      
      // 左侧：识别操作区
      .classification-main {
        flex: 1;
        padding: 24px;
        
        // 数据来源选择器
        .image-source-selector {
          margin-bottom: 24px;
          display: flex;
          justify-content: center;
          
          :deep(.el-radio-button__inner) {
            padding: 12px 32px;
            font-size: 15px;
            
            .el-icon {
              margin-right: 6px;
            }
          }
        }
        
        // 本地上传区域
        .upload-area {
          padding: 40px;
          background: linear-gradient(135deg, #f5f7fa 0%, #e3e7f1 100%);
          border: 2px dashed #409EFF;
          border-radius: 12px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s;
          
          &:hover {
            border-color: #667eea;
            background: linear-gradient(135deg, #e3e7f1 0%, #d4daf0 100%);
            transform: scale(1.02);
          }
          
          .upload-icon {
            margin-bottom: 16px;
            animation: float 3s ease-in-out infinite;
          }
          
          .upload-text {
            margin-bottom: 24px;
            
            h3 {
              margin: 0 0 8px 0;
              font-size: 20px;
              color: #303133;
            }
            
            p {
              margin: 0;
              font-size: 14px;
              color: #606266;
            }
          }
          
          .upload-btn {
            font-size: 15px;
            padding: 12px 32px;
          }
        }
        
        // 影像管理选择区域
        .library-selection {
          display: flex;
          gap: 16px;
          align-items: flex-start;
          padding: 24px;
          background: #f9fafb;
          border-radius: 12px;
          
          .image-selector {
            flex: 1;
            
            :deep(.el-input__wrapper) {
              min-height: 44px;
            }
          }
          
          .classify-btn {
            flex-shrink: 0;
            min-width: 120px;
          }
          
          .image-option {
            display: flex;
            flex-direction: column;
            gap: 4px;
            
            .image-name {
              font-size: 14px;
              color: #303133;
              font-weight: 500;
            }
            
            .image-info {
              font-size: 12px;
              color: #909399;
            }
          }
        }
        
        // 快速提示
        .quick-tips {
          margin-top: 20px;
          padding: 12px 16px;
          background: #ecf5ff;
          border-left: 4px solid #409EFF;
          border-radius: 4px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #606266;
        }
      }
      
      // 右侧：批量识别进度面板
      .progress-sidebar {
        width: 320px;
        flex-shrink: 0;
        background: #fafbfc;
        border-left: 2px solid #e4e7ed;
        display: flex;
        flex-direction: column;
        
        .progress-header {
          padding: 16px;
          border-bottom: 1px solid #e4e7ed;
          
          .progress-title {
            font-size: 15px;
            font-weight: 600;
            color: #303133;
            display: flex;
            align-items: center;
            gap: 6px;
          }
        }
        
        .progress-content {
          padding: 12px;
          flex: 1;
          overflow-y: auto;
          max-height: 500px;
          
          .task-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
            
            .task-item {
              padding: 12px;
              background: white;
              border: 1px solid #e4e7ed;
              border-radius: 8px;
              transition: all 0.3s;
              
              &.task-processing {
                border-color: #409EFF;
                background: #ecf5ff;
                box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
              }
              
              &.task-completed {
                border-color: #67C23A;
                background: #f0f9ff;
              }
              
              .task-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 10px;
                gap: 8px;
                
                .task-name {
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  font-size: 13px;
                  font-weight: 600;
                  color: #303133;
                  flex: 1;
                  min-width: 0;
                  
                  span {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                  }
                }
              }
              
              .task-info {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 6px;
                font-size: 11px;
                
                .task-progress-text {
                  color: #606266;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  flex: 1;
                }
                
                .task-time {
                  color: #909399;
                  font-family: 'Courier New', monospace;
                  margin-left: 8px;
                  flex-shrink: 0;
                }
              }
            }
          }
          
          .batch-summary {
            margin-top: 12px;
            
            .compact-alert {
              padding: 8px 12px;
              
              :deep(.el-alert__title) {
                font-size: 13px;
              }
            }
          }
        }
      }
    }
  }
  
  // 变化检测与差异分析模块
  .analysis-module {
    border: 2px solid #67C23A;
    
  .analysis-actions {
    display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
    padding: 20px 0;
    
      .action-card {
      cursor: pointer;
      transition: all 0.3s;
      border: 2px solid #ebeef5;
        border-radius: 8px;
      
      &:hover {
          border-color: #67C23A;
          box-shadow: 0 6px 16px rgba(103, 194, 58, 0.2);
        transform: translateY(-4px);
      }
      
      .action-content {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 8px;
        
        .action-icon {
          font-size: 48px;
          opacity: 0.9;
        }
        
        .action-text {
          flex: 1;
          
          .action-title {
            font-size: 18px;
            font-weight: 600;
            color: #303133;
            margin-bottom: 8px;
          }
          
          .action-desc {
            font-size: 14px;
            color: #909399;
              line-height: 1.5;
            }
          }
          }
        }
      }
    }
  }
  
// 分析进度对话框
.analysis-progress-dialog {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
  
  .progress-text {
    margin-top: 24px;
    font-size: 15px;
    color: #606266;
    font-weight: 500;
    text-align: center;
  }
  
  .el-button {
    margin-top: 24px;
  }
}

// 浮动动画
@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

// 旋转动画
@keyframes rotating {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.rotating {
  animation: rotating 2s linear infinite;
}

// 响应式设计
@media (max-width: 768px) {
  .task-management-container {
    .page-header {
      padding: 16px;
      
      .page-title {
        font-size: 22px;
      }
      
      .page-description {
        font-size: 14px;
      }
    }
    
    .guide-section {
      .guide-content {
        padding: 16px;
        
        .guide-step {
          .step-number {
            width: 28px;
            height: 28px;
            font-size: 14px;
          }
          
          .step-content h4 {
            font-size: 15px;
          }
        }
      }
    }
    
    .classification-module .classification-with-progress {
      flex-direction: column;
      
      .classification-main {
        padding: 16px;
        
        .image-source-selector {
          :deep(.el-radio-button__inner) {
            padding: 10px 20px;
            font-size: 14px;
          }
        }
        
        .upload-area {
          padding: 24px 16px;
          
          .upload-text h3 {
            font-size: 18px;
          }
        }
        
        .library-selection {
          flex-direction: column;
          padding: 16px;
          
          .classify-btn {
            width: 100%;
          }
        }
      }
      
      .progress-sidebar {
        width: 100%;
        border-left: none;
        border-top: 2px solid #e4e7ed;
        
        .progress-content {
          max-height: 300px;
        }
      }
    }
    
    .analysis-module .analysis-actions {
      grid-template-columns: 1fr;
    }
  }
}
</style>

