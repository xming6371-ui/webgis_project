<template>
  <div class="task-management-container">
    <!-- 操作栏 -->
    <el-card class="action-card" shadow="never">
      <el-space wrap>
        <el-button type="primary" @click="showTaskDialog = true">
          <template #icon><Plus :size="16" /></template>
          新建分析任务
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
    <el-card shadow="never">
      <template #header>
        <span><el-icon><List /></el-icon> 任务队列</span>
      </template>
      
      <el-table :data="taskList" style="width: 100%">
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
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="scope">
            <el-button
              v-if="scope.row.status === 'completed'"
              size="small"
              type="success"
              :icon="View"
              @click="handleViewResult(scope.row)"
            >
              查看结果
            </el-button>
            <el-button
              size="small"
              :icon="Document"
              @click="handleViewLog(scope.row)"
            >
              日志
            </el-button>
            <el-button
              v-if="scope.row.status === 'pending' || scope.row.status === 'running'"
              size="small"
              type="warning"
              :icon="VideoPlay"
              @click="handleStop(scope.row)"
            >
              停止
            </el-button>
            <el-button
              size="small"
              type="danger"
              :icon="Delete"
              @click="handleDelete(scope.row)"
            >
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
          :total="total"
        />
      </div>
    </el-card>

    <!-- 新建任务对话框 -->
    <el-dialog
      v-model="showTaskDialog"
      title="新建分类分析任务"
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
                <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
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
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus, RefreshCw, Search, Ticket, Loader, CheckCircle, XCircle,
  List, Eye, File, Play, Trash2, Upload
} from 'lucide-vue-next'

const statusFilter = ref('')
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(100)
const showTaskDialog = ref(false)
const showLogDialog = ref(false)
const currentStep = ref(0)
const currentLog = ref('')

const taskStats = ref({
  total: 156,
  running: 3,
  completed: 148,
  failed: 5
})

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
  ElMessage.success('任务提交成功')
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
</style>

