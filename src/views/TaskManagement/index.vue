<template>
  <div class="task-management-container">
    <!-- 操作栏 -->
    <el-card class="action-card" shadow="never">
      <el-space wrap>
        <el-button type="primary" @click="showTaskDialog = true">
          <template #icon><Plus :size="16" /></template>
          新建识别任务
        </el-button>
        <el-button @click="handleRefresh">
          <template #icon><RefreshCw :size="16" /></template>
          刷新列表
        </el-button>
        <el-divider direction="vertical" />
        <el-select v-model="statusFilter" placeholder="任务状态" style="width: 120px" clearable>
          <el-option label="全部" value="" />
          <el-option label="排队中" value="pending" />
          <el-option label="运行中" value="running" />
          <el-option label="已完成" value="completed" />
          <el-option label="失败" value="failed" />
        </el-select>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索任务名称"
          style="width: 200px"
          :prefix-icon="Search"
          clearable
        />
      </el-space>
    </el-card>

    <!-- 任务统计 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card stat-all">
          <el-statistic :value="taskStats.total" title="总任务数">
            <template #prefix>
              <el-icon><Tickets /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card stat-running">
          <el-statistic :value="taskStats.running" title="运行中">
            <template #prefix>
              <el-icon><Loading /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card stat-completed">
          <el-statistic :value="taskStats.completed" title="已完成">
            <template #prefix>
              <el-icon><CircleCheck /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card stat-failed">
          <el-statistic :value="taskStats.failed" title="失败">
            <template #prefix>
              <el-icon><CircleClose /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
    </el-row>

    <!-- 任务列表 -->
    <el-card shadow="never" class="task-list-card">
      <template #header>
        <span><el-icon><List /></el-icon> 任务队列</span>
      </template>
      
      <el-table :data="paginatedTaskList" style="width: 100%" max-height="500">
        <el-table-column prop="id" label="任务ID" width="100" />
        <el-table-column prop="name" label="任务名称" min-width="200" />
        <el-table-column prop="method" label="分析方法" width="120">
          <template #default="scope">
            <el-tag>{{ scope.row.method }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="scope">
            <el-tag
              :type="getStatusType(scope.row.status)"
              :icon="getStatusIcon(scope.row.status)"
            >
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="进度" width="200">
          <template #default="scope">
            <el-progress
              :percentage="scope.row.progress"
              :status="scope.row.status === 'failed' ? 'exception' : scope.row.status === 'completed' ? 'success' : ''"
            />
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="160" />
        <el-table-column prop="duration" label="耗时" width="100" />
        <el-table-column label="操作" width="350" fixed="right">
          <template #default="scope">
            <el-button
              v-if="scope.row.status === 'completed'"
              size="small"
              type="success"
              @click="handleViewResult(scope.row)"
            >
              <template #icon><Eye :size="14" /></template>
              查看结果
            </el-button>
            <el-button
              size="small"
              @click="handleViewLog(scope.row)"
            >
              <template #icon><File :size="14" /></template>
              日志
            </el-button>
            <el-button
              v-if="scope.row.status === 'pending' || scope.row.status === 'running'"
              size="small"
              type="warning"
              @click="handleStop(scope.row)"
            >
              <template #icon><Play :size="14" /></template>
              停止
            </el-button>
            <el-button
              size="small"
              type="danger"
              @click="handleDelete(scope.row)"
            >
              <template #icon><Trash2 :size="14" /></template>
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="totalTasks"
        />
      </div>
    </el-card>

    <!-- 变化检测与差异分析模块 -->
    <el-card shadow="never" class="analysis-module-card">
      <template #header>
        <div class="module-header">
          <div class="module-left">
            <span class="module-title">
              <el-icon><DataAnalysis /></el-icon>
              变化检测与差异分析
            </span>
          </div>
          <el-button 
            v-if="hasAnalysisData" 
            type="danger" 
            size="small" 
            @click="handleClearAllData"
          >
            <template #icon><Trash2 :size="14" /></template>
            一键清空
          </el-button>
        </div>
      </template>

      <!-- 功能按钮区 -->
      <div class="analysis-actions">
        <el-card shadow="hover" class="action-button-card" @click="showDifferenceDialog = true">
          <div class="action-content">
            <el-icon class="action-icon" color="#E6A23C"><Location /></el-icon>
            <div class="action-text">
              <div class="action-title">种植差异检测</div>
              <div class="action-desc">对比规划与实际种植情况</div>
            </div>
          </div>
        </el-card>

        <el-card shadow="hover" class="action-button-card" @click="showTemporalDialog = true">
          <div class="action-content">
            <el-icon class="action-icon" color="#409EFF"><DataAnalysis /></el-icon>
            <div class="action-text">
              <div class="action-title">时序变化分析</div>
              <div class="action-desc">分析不同时期作物变化</div>
            </div>
          </div>
        </el-card>

        <el-card shadow="hover" class="action-button-card" @click="showStatisticsDialog = true">
          <div class="action-content">
            <el-icon class="action-icon" color="#67C23A"><Tickets /></el-icon>
            <div class="action-text">
              <div class="action-title">统计汇总</div>
              <div class="action-desc">生成多维度统计报告</div>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 任务执行状态显示 -->
      <el-card v-if="analysisTaskRunning" shadow="never" class="task-running-card">
        <el-result icon="info" title="分析任务执行中">
          <template #sub-title>
            <div style="margin: 20px 0;">
              <el-progress :percentage="analysisProgress" :status="analysisProgress === 100 ? 'success' : ''" />
              <div style="margin-top: 12px; color: #606266;">{{ analysisStatusText }}</div>
            </div>
          </template>
          <template #extra>
            <el-button type="primary" @click="handleViewAnalysisQueue">前往数据管理查看结果</el-button>
          </template>
        </el-result>
      </el-card>
    </el-card>

    <!-- 新建任务对话框 -->
    <el-dialog
      v-model="showTaskDialog"
      title="新建作物识别任务"
      width="700px"
      :close-on-click-modal="false"
    >
      <el-steps :active="currentStep" finish-status="success" align-center>
        <el-step title="基本信息" />
        <el-step title="选择数据" />
        <el-step title="配置参数" />
        <el-step title="确认提交" />
      </el-steps>

      <div class="step-content">
        <!-- 步骤1: 基本信息 -->
        <div v-show="currentStep === 0" class="step-panel">
          <el-form :model="taskForm" label-width="100px">
            <el-form-item label="任务名称">
              <el-input v-model="taskForm.name" placeholder="请输入任务名称" />
            </el-form-item>
            <el-form-item label="任务描述">
              <el-input
                v-model="taskForm.description"
                type="textarea"
                :rows="3"
                placeholder="请输入任务描述"
              />
            </el-form-item>
          </el-form>
        </div>

        <!-- 步骤2: 选择数据 -->
        <div v-show="currentStep === 1" class="step-panel">
          <el-form :model="taskForm" label-width="100px">
            <el-form-item label="影像数据">
              <el-select v-model="taskForm.imageId" placeholder="选择影像" style="width: 100%">
                <el-option label="Sentinel2_XJ_20240315_L2A" value="img001" />
                <el-option label="Landsat8_XJ_20240312_T1" value="img002" />
              </el-select>
            </el-form-item>
            <el-form-item label="地块数据">
              <el-select v-model="taskForm.plotId" placeholder="选择地块" style="width: 100%">
                <el-option label="乌鲁木齐市地块数据" value="plot001" />
                <el-option label="喀什地区地块数据" value="plot002" />
              </el-select>
            </el-form-item>
            <el-form-item label="训练样本">
              <el-upload
                class="upload-demo"
                drag
                :auto-upload="false"
                accept=".shp,.geojson"
              >
                <el-icon class="el-icon--upload"><Upload :size="20" /></el-icon>
                <div class="el-upload__text">拖拽文件到此处或<em>点击上传</em></div>
                <template #tip>
                  <div class="el-upload__tip">支持 .shp, .geojson 格式</div>
                </template>
              </el-upload>
            </el-form-item>
          </el-form>
        </div>

        <!-- 步骤3: 配置参数 -->
        <div v-show="currentStep === 2" class="step-panel">
          <el-form :model="taskForm" label-width="120px">
            <el-form-item label="分类方法">
              <el-radio-group v-model="taskForm.method">
                <el-radio label="RF">随机森林 (RF)</el-radio>
                <el-radio label="SVM">支持向量机 (SVM)</el-radio>
                <el-radio label="DeepLearning">深度学习</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item v-if="taskForm.method === 'RF'" label="决策树数量">
              <el-input-number v-model="taskForm.params.trees" :min="10" :max="1000" />
            </el-form-item>
            <el-form-item v-if="taskForm.method === 'SVM'" label="核函数">
              <el-select v-model="taskForm.params.kernel" style="width: 200px">
                <el-option label="RBF" value="rbf" />
                <el-option label="Linear" value="linear" />
                <el-option label="Polynomial" value="poly" />
              </el-select>
            </el-form-item>
            <el-form-item label="训练比例">
              <el-slider v-model="taskForm.params.trainRatio" :min="50" :max="90" />
              <span style="margin-left: 10px">{{ taskForm.params.trainRatio }}%</span>
            </el-form-item>
          </el-form>
        </div>

        <!-- 步骤4: 确认提交 -->
        <div v-show="currentStep === 3" class="step-panel">
          <el-descriptions title="任务配置信息" :column="1" border>
            <el-descriptions-item label="任务名称">{{ taskForm.name }}</el-descriptions-item>
            <el-descriptions-item label="任务描述">{{ taskForm.description }}</el-descriptions-item>
            <el-descriptions-item label="分类方法">{{ taskForm.method }}</el-descriptions-item>
            <el-descriptions-item label="影像数据">{{ taskForm.imageId }}</el-descriptions-item>
            <el-descriptions-item label="地块数据">{{ taskForm.plotId }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>

      <template #footer>
        <el-button v-if="currentStep > 0" @click="currentStep--">上一步</el-button>
        <el-button @click="showTaskDialog = false">取消</el-button>
        <el-button v-if="currentStep < 3" type="primary" @click="currentStep++">下一步</el-button>
        <el-button v-else type="primary" @click="handleSubmitTask">提交任务</el-button>
      </template>
    </el-dialog>

    <!-- 日志查看对话框 -->
    <el-dialog v-model="showLogDialog" title="任务日志" width="800px">
      <div class="log-container">
        <pre>{{ currentLog }}</pre>
      </div>
    </el-dialog>

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

    <!-- 统计汇总配置对话框 -->
    <el-dialog
      v-model="showStatisticsDialog"
      title="统计汇总配置"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form :model="statisticsConfig" label-width="120px">
        <el-form-item label="选择任务">
          <el-select v-model="statisticsConfig.taskId" placeholder="选择已完成的分析任务" style="width: 100%">
            <el-option 
              v-for="task in completedTasks" 
              :key="task.id"
              :label="task.name" 
              :value="task.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="统计依据">
          <el-radio-group v-model="statisticsConfig.source">
            <el-radio label="difference">种植差异检测结果</el-radio>
            <el-radio label="temporal">时序变化分析结果</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="统计维度">
          <el-checkbox-group v-model="statisticsConfig.dimensions">
            <el-checkbox label="region">按行政区划</el-checkbox>
            <el-checkbox label="crop">按作物类型</el-checkbox>
            <el-checkbox label="diffType">按差异类型</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showStatisticsDialog = false">取消</el-button>
        <el-button type="primary" @click="handleGenerateStatistics" :loading="statisticsLoading">
          生成统计
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import {
  Plus, RefreshCw, Search, Eye, File, Play, Trash2, Upload, Download, GitCompare
} from 'lucide-vue-next'
import {
  Tickets, Loading, CircleCheck, CircleClose, List, DataAnalysis, Location, Right, ArrowLeft, ArrowRight
} from '@element-plus/icons-vue'
import { getRecognitionResults, readGeojsonContent, saveAnalysisResultToServer, saveReportToServer } from '@/api/analysis'
import { useAnalysisStore } from '@/stores/analysis'
import { exportDifferenceToExcel, exportTemporalToExcel, exportStatisticsToExcel, saveFileMetadata } from '@/utils/export'
import { buildTemporalTrajectories, exportToCSV as exportTemporalToCSV } from '@/utils/temporalAnalysis'

const router = useRouter()
const analysisStore = useAnalysisStore()

const statusFilter = ref('')
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const showTaskDialog = ref(false)
const showLogDialog = ref(false)
const currentStep = ref(0)
const currentLog = ref('')

// 对话框显示状态
const showDifferenceDialog = ref(false)
const showTemporalDialog = ref(false)
const showStatisticsDialog = ref(false)

// 分析任务执行状态
const analysisTaskRunning = ref(false)
const analysisProgress = ref(0)
const analysisStatusText = ref('')

// 识别结果文件列表（从数据管理模块的分析结果队列加载）
const recognitionFiles = ref([])

// 功能B.1：种植差异检测
const differenceLoading = ref(false)
const differenceTypeFilter = ref('')
const differenceConfig = ref({
  baseFileId: '',
  compareFileId: ''
})
const differenceResultData = ref([])
const differenceStats = ref({
  total: 0,
  typeMismatch: 0,
  abandoned: 0,
  unplanned: 0,
  normal: 0
})

// 功能B.2：时序变化分析
const temporalLoading = ref(false)
const temporalConfig = ref({
  selectedFileIds: []
})
const temporalResultData = ref([])
const temporalStats = ref({
  total: 0,
  changed: 0,
  unchanged: 0
})

// 时间轴相关
const currentTimelineIndex = ref(0)

// 功能B.3：统计汇总
const statisticsLoading = ref(false)
const statisticsConfig = ref({
  taskId: '',
  source: 'difference',
  dimensions: ['region']
})
const statisticsData = ref([])

const taskForm = ref({
  name: '',
  description: '',
  imageId: '',
  plotId: '',
  method: 'RF',
  params: {
    trees: 100,
    kernel: 'rbf',
    trainRatio: 70
  }
})

const taskList = ref([
  {
    id: 'TASK001',
    name: '2024年春季小麦识别',
    method: 'RF',
    status: 'completed',
    progress: 100,
    createTime: '2024-03-15 10:30:00',
    duration: '25分钟'
  },
  {
    id: 'TASK002',
    name: '棉花种植区域提取',
    method: 'SVM',
    status: 'running',
    progress: 65,
    createTime: '2024-03-15 14:20:00',
    duration: '15分钟'
  },
  {
    id: 'TASK003',
    name: '玉米地块分类识别',
    method: 'DeepLearning',
    status: 'pending',
    progress: 0,
    createTime: '2024-03-15 15:00:00',
    duration: '-'
  },
  {
    id: 'TASK004',
    name: '综合作物类型分类',
    method: 'RF',
    status: 'failed',
    progress: 45,
    createTime: '2024-03-14 16:30:00',
    duration: '10分钟'
  }
])

// 计算属性：过滤后的任务列表（根据状态和搜索关键字）
const filteredTaskList = computed(() => {
  let filtered = taskList.value

  // 按状态筛选
  if (statusFilter.value) {
    filtered = filtered.filter(task => task.status === statusFilter.value)
  }

  // 按名称搜索
  if (searchKeyword.value) {
    filtered = filtered.filter(task => 
      task.name.toLowerCase().includes(searchKeyword.value.toLowerCase())
    )
  }

  return filtered
})

// 计算属性：分页后的任务列表
const paginatedTaskList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredTaskList.value.slice(start, end)
})

// 计算属性：任务总数（用于分页）
const totalTasks = computed(() => {
  return filteredTaskList.value.length
})

// 计算属性：动态统计任务状态
const taskStats = computed(() => {
  return {
    total: taskList.value.length,
    running: taskList.value.filter(t => t.status === 'running').length,
    completed: taskList.value.filter(t => t.status === 'completed').length,
    failed: taskList.value.filter(t => t.status === 'failed').length,
    pending: taskList.value.filter(t => t.status === 'pending').length
  }
})

// 计算属性：已完成的任务列表
const completedTasks = computed(() => {
  return taskList.value.filter(t => t.status === 'completed')
})

// 计算属性：按时间排序的识别结果文件
const sortedRecognitionFiles = computed(() => {
  return [...recognitionFiles.value].sort((a, b) => {
    return new Date(a.createTime) - new Date(b.createTime)
  })
})

// 计算属性：当前时间轴项目
const currentTimelineItem = computed(() => {
  if (currentAnalysisResult.value && currentAnalysisResult.value.timelineData) {
    return currentAnalysisResult.value.timelineData[currentTimelineIndex.value]
  }
  return null
})

// 计算属性：过滤后的差异检测数据
const filteredDifferenceData = computed(() => {
  if (!differenceTypeFilter.value) {
    return differenceResultData.value
  }
  return differenceResultData.value.filter(r => r.diffType === differenceTypeFilter.value)
})

// 计算属性：判断是否有分析数据
const hasAnalysisData = computed(() => {
  return differenceResultData.value.length > 0 || 
         temporalResultData.value.length > 0 || 
         statisticsData.value.length > 0
})

// 监听筛选条件变化，自动重置到第一页
watch([statusFilter, searchKeyword], () => {
  currentPage.value = 1
})

// 清空所有分析数据
const clearAnalysisData = () => {
  differenceResultData.value = []
  differenceConfig.value = {
    baseFileId: '',
    compareFileId: ''
  }
  temporalResultData.value = []
  temporalConfig.value = {
    selectedFileIds: []
  }
  statisticsData.value = []
  statisticsConfig.value = {
    taskId: '',
    source: 'difference',
    dimensions: ['region']
  }
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

// 组件挂载时加载数据
onMounted(() => {
  loadRecognitionFiles()
})

const getStatusType = (status) => {
  const map = {
    pending: 'info',
    running: 'warning',
    completed: 'success',
    failed: 'danger'
  }
  return map[status]
}

const getStatusIcon = (status) => {
  const map = {
    pending: 'Clock',
    running: 'Loading',
    completed: 'CircleCheck',
    failed: 'CircleClose'
  }
  return map[status]
}

const getStatusText = (status) => {
  const map = {
    pending: '排队中',
    running: '运行中',
    completed: '已完成',
    failed: '失败'
  }
  return map[status]
}

const handleRefresh = () => {
  // 清空筛选条件
  statusFilter.value = ''
  searchKeyword.value = ''
  currentPage.value = 1
  ElMessage.success('列表已刷新')
}

const handleViewResult = (row) => {
  ElMessage.success(`查看任务 ${row.name} 的结果`)
}

const handleViewLog = (row) => {
  currentLog.value = `[2024-03-15 10:30:00] 任务开始执行...\n[2024-03-15 10:31:23] 加载影像数据...\n[2024-03-15 10:33:45] 加载地块数据...\n[2024-03-15 10:35:12] 数据预处理完成\n[2024-03-15 10:38:56] 模型训练中...\n[2024-03-15 10:50:34] 模型训练完成\n[2024-03-15 10:52:18] 执行分类预测...\n[2024-03-15 10:55:00] 任务执行成功`
  showLogDialog.value = true
}

const handleStop = (row) => {
  ElMessageBox.confirm(`确定要停止任务 ${row.name} 吗？`, '停止确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    ElMessage.success('任务已停止')
  })
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要删除任务 ${row.name} 吗？`, '删除确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    ElMessage.success('删除成功')
  })
}

const handleSubmitTask = () => {
  // 创建新任务
  const newTask = {
    id: `TASK${String(taskList.value.length + 1).padStart(3, '0')}`,
    name: taskForm.value.name,
    method: taskForm.value.method,
    status: 'pending',
    progress: 0,
    createTime: new Date().toLocaleString('zh-CN'),
    duration: '-',
    imageId: taskForm.value.imageId
  }
  
  taskList.value.unshift(newTask)
  
  ElMessage.success('任务提交成功，开始执行识别...')
  
  // 模拟任务执行过程
  setTimeout(() => {
    newTask.status = 'running'
    newTask.progress = 30
  }, 1000)
  
  setTimeout(() => {
    newTask.progress = 60
  }, 3000)
  
  setTimeout(() => {
    newTask.status = 'completed'
    newTask.progress = 100
    newTask.duration = '5分钟'
    
    ElNotification({
      title: '✅ 识别任务完成',
      message: `${newTask.name} 已完成识别，结果已保存到识别结果队列`,
      type: 'success',
      duration: 5000
    })
    
    // 刷新识别结果文件列表（从后端重新加载）
    loadRecognitionFiles()
  }, 5000)
  
  showTaskDialog.value = false
  currentStep.value = 0
  taskForm.value = {
    name: '',
    description: '',
    imageId: '',
    plotId: '',
    method: 'RF',
    params: {
      trees: 100,
      kernel: 'rbf',
      trainRatio: 70
    }
  }
}

// 获取差异类型标签样式
const getDiffTagType = (diffType) => {
  const map = {
    normal: 'success',
    typeMismatch: 'warning',
    abandoned: 'danger',
    unplanned: 'info'
  }
  return map[diffType]
}

// 获取差异类型文本
const getDiffTypeText = (diffType) => {
  const map = {
    normal: '正常',
    typeMismatch: '类型不符',
    abandoned: '撂荒/未种植',
    unplanned: '非规划种植'
  }
  return map[diffType]
}

// ============ 新模块方法 ============

// 前往数据管理查看分析结果
const handleViewAnalysisQueue = () => {
  // 这里可以添加路由跳转到数据管理界面
  ElMessage.info('请前往数据管理界面的分析结果队列查看')
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
    analysisStatusText.value = '分析完成！即将跳转...'
    
    differenceLoading.value = false
    analysisTaskRunning.value = false
    
    // 显示成功提示
    ElNotification({
      title: '✅ 差异检测完成',
      message: `已检测到${diffResult.stats.changed}个变化地块，分析结果已保存，正在跳转到结果查看界面...`,
      type: 'success',
      duration: 5000
    })
    
    // 等待800ms后跳转
    setTimeout(() => {
      router.push('/result-compare')
    }, 800)
    
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
    analysisStatusText.value = '分析完成！即将跳转...'
    
    temporalLoading.value = false
    analysisTaskRunning.value = false
    
    // 显示成功提示
    ElNotification({
      title: '✅ 时序分析完成',
      message: `已完成${selectedFiles.length}期时序变化分析（共${temporalResult.stats.total}个地块，${temporalResult.stats.changed}个有变化）。\n\n分析结果已保存，正在跳转到"结果查看与比对"页面...`,
      type: 'success',
      duration: 6000,
      dangerouslyUseHTMLString: false
    })
    
    // 等待800ms后跳转
    setTimeout(() => {
      router.push('/result-compare')
    }, 800)
    
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

// 功能B.3：生成统计汇总
const handleGenerateStatistics = () => {
  if (!statisticsConfig.value.taskId) {
    ElMessage.warning('请先选择一个分析任务')
    return
  }

  statisticsLoading.value = true
  showStatisticsDialog.value = false
  
  // 显示任务执行状态
  analysisTaskRunning.value = true
  analysisProgress.value = 0
  analysisStatusText.value = '正在加载分析数据...'

  // 模拟执行步骤
  setTimeout(() => {
    analysisProgress.value = 40
    analysisStatusText.value = '正在统计分析...'
  }, 500)
  
  setTimeout(() => {
    analysisProgress.value = 80
    analysisStatusText.value = '正在生成报表...'
  }, 1000)

  // 模拟生成统计报表
  setTimeout(() => {
    analysisProgress.value = 100
    analysisStatusText.value = '统计完成！正在保存结果...'
    
    const selectedTask = taskList.value.find(t => t.id === statisticsConfig.value.taskId)
    const selectedTaskName = selectedTask?.name || '未知任务'
    
    // 生成统计汇总结果文件
    const resultFile = {
      id: `statistics_${new Date().getTime()}`,
      name: `统计汇总_${selectedTaskName}.xlsx`,
      type: 'XLSX',
      taskId: statisticsConfig.value.taskId,
      taskName: selectedTaskName,
      analysisType: 'statistics',
      recordCount: 3,  // 统计维度数量
      size: `${(Math.random() * 2 + 0.5).toFixed(2)} MB`,
      createTime: new Date().toLocaleString('zh-CN'),
      timestamp: new Date().getTime(),
      description: `统计汇总报表 - ${statisticsConfig.value.dimensions.join('、')}`,
      dimensions: statisticsConfig.value.dimensions,
      source: statisticsConfig.value.source,
      downloadUrl: `/api/download/statistics_${new Date().getTime()}.xlsx`
    }
    
    // 保存到分析结果队列
    saveAnalysisResultToQueue(resultFile)

    statisticsLoading.value = false
    
    setTimeout(() => {
      analysisTaskRunning.value = false
      ElNotification({
        title: '✅ 统计汇总完成',
        message: '统计报表已生成并保存到数据管理的分析结果队列',
        type: 'success',
        duration: 5000
      })
    }, 500)
  }, 1800)
}


// 保存分析结果到队列
const saveAnalysisResultToQueue = (fileInfo) => {
  try {
    const QUEUE_KEY = 'analysis_result_queue'
    let queue = []
    
    const stored = localStorage.getItem(QUEUE_KEY)
    if (stored) {
      queue = JSON.parse(stored)
    }
    
    // 添加新结果到队列头部
    queue.unshift(fileInfo)
    
    // 限制队列长度（最多保留50条）
    if (queue.length > 50) {
      queue = queue.slice(0, 50)
    }
    
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
    console.log('分析结果已保存到队列:', fileInfo)
  } catch (error) {
    console.error('保存分析结果失败:', error)
  }
}

// 一键清空所有分析数据
const handleClearAllData = () => {
  ElMessageBox.confirm(
    '清空后将删除所有分析数据（包括选中的任务、差异检测结果、时序分析结果和统计数据），此操作不可恢复，是否继续？',
    '确认清空',
    {
      confirmButtonText: '确定清空',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    }
  ).then(() => {
    clearAnalysisData()
    ElMessage.success({
      message: '所有分析数据已清空',
      duration: 3000
    })
  }).catch(() => {
    // 用户取消操作，不显示提示或者只显示3秒
    // ElMessage.info({
    //   message: '已取消清空操作',
    //   duration: 3000
    // })
  })
}
</script>

<style scoped lang="scss">
.task-management-container {
  .action-card {
    margin-bottom: 20px;
    border-radius: 8px;
  }
  
  .stats-row {
    margin-bottom: 20px;
    
    .stat-card {
      border-radius: 8px;
      
      &.stat-all {
        border-left: 4px solid #409EFF;
      }
      
      &.stat-running {
        border-left: 4px solid #E6A23C;
      }
      
      &.stat-completed {
        border-left: 4px solid #67C23A;
      }
      
      &.stat-failed {
        border-left: 4px solid #F56C6C;
      }
    }
  }
  
  .pagination-container {
    display: flex;
    justify-content: center;
    margin-top: 20px;
  }
  
  .step-content {
    margin: 30px 0;
    min-height: 300px;
    
    .step-panel {
      padding: 20px;
    }
  }
  
  .log-container {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 15px;
    border-radius: 4px;
    max-height: 500px;
    overflow-y: auto;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.6;
    
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  }
}

// 差异检测相关样式
.difference-detection-container {
  .config-card {
    margin-bottom: 20px;
    border-radius: 8px;
  }
  
  .difference-stats {
    margin: 20px 0;
    
    .diff-stat-card {
      border-radius: 8px;
      
      &.diff-total {
        border-left: 4px solid #409EFF;
      }
      
      &.diff-mismatch {
        border-left: 4px solid #E6A23C;
      }
      
      &.diff-abandoned {
        border-left: 4px solid #F56C6C;
      }
      
      &.diff-unplanned {
        border-left: 4px solid #909399;
      }
    }
  }
  
  .results-card {
    border-radius: 8px;
  }
}

// 新模块：变化检测与差异分析样式
.analysis-module-card {
  margin-top: 30px;
  border-radius: 8px;
  border: 2px solid #409EFF;
  
  .module-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .module-left {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    
    .module-title {
      font-size: 16px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }
  
  // 功能按钮区域
  .analysis-actions {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    padding: 20px 0;
    
    .action-button-card {
      cursor: pointer;
      transition: all 0.3s;
      border: 2px solid #ebeef5;
      
      &:hover {
        border-color: #409EFF;
        box-shadow: 0 4px 12px rgba(64, 158, 255, 0.2);
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
          }
        }
      }
    }
  }
  
  // 任务执行状态卡片
  .task-running-card {
    margin-top: 20px;
    
    :deep(.el-result__title) {
      font-size: 20px;
      margin-top: 16px;
    }
    
    :deep(.el-result__subtitle) {
      margin-top: 16px;
    }
  }
}
</style>

