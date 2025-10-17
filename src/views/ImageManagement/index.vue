<template>
  <div class="image-management-container">
    <!-- 操作栏 -->
    <el-card class="action-card" shadow="never">
      <div class="action-bar">
        <div class="action-left">
          <el-button type="primary" size="large" @click="showUploadDialog = true">
            <Upload :size="18" style="margin-right: 8px" />
            上传影像
          </el-button>
          <el-button type="danger" size="large" plain @click="handleBatchDelete">
            <Trash2 :size="18" style="margin-right: 8px" />
            批量删除
          </el-button>
        </div>
        <div class="action-right">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索影像名称或区域"
            size="large"
            style="width: 300px"
            clearable
            @keyup.enter="handleSearch"
          >
            <template #prefix><Search :size="18" /></template>
          </el-input>
          <el-button type="primary" size="large" @click="handleSearch">
            搜索
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 筛选条件 -->
    <el-card class="filter-card" shadow="never">
      <el-form :inline="true" :model="filterForm" size="default">
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="filterForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 280px"
          />
        </el-form-item>
        <el-form-item label="传感器类型">
          <el-select v-model="filterForm.sensor" placeholder="请选择" style="width: 150px" clearable>
            <el-option label="全部" value="" />
            <el-option label="Sentinel-2" value="sentinel2" />
            <el-option label="Landsat-8" value="landsat8" />
            <el-option label="高分系列" value="gaofen" />
          </el-select>
        </el-form-item>
        <el-form-item label="云量">
          <el-slider v-model="filterForm.cloudCover" :max="100" style="width: 200px" />
          <span style="margin-left: 10px">≤ {{ filterForm.cloudCover }}%</span>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleFilter">应用筛选</el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 影像列表 -->
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span><Image :size="16" style="margin-right: 8px" /> 影像目录 (共 {{ tableData.length }} 条)</span>
          <el-radio-group v-model="viewMode" size="small">
            <el-radio-button label="table"><List :size="14" style="margin-right: 6px" /> 列表</el-radio-button>
            <el-radio-button label="grid"><Grid3X3 :size="14" style="margin-right: 6px" /> 缩略图</el-radio-button>
          </el-radio-group>
        </div>
      </template>

      <!-- 表格视图 -->
      <el-table
        v-if="viewMode === 'table'"
        :data="tableData"
        style="width: 100%"
        v-loading="loading"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="id" label="影像ID" width="100" />
        <el-table-column label="缩略图" width="100">
          <template #default="scope">
            <div class="thumbnail-wrapper" @click="handlePreview(scope.row)">
              <img
                :src="generateThumbnail(scope.row)"
                style="width: 60px; height: 60px; border-radius: 4px; cursor: pointer; object-fit: cover;"
                :alt="scope.row.name"
              />
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="影像名称" min-width="200" />
        <el-table-column prop="year" label="年份" width="80" />
        <el-table-column prop="period" label="期次" width="80">
          <template #default="scope">
            第{{ scope.row.period }}期
          </template>
        </el-table-column>
        <el-table-column prop="cropType" label="作物类型" width="100">
          <template #default="scope">
            <el-tag size="small">{{ getCropTypeLabel(scope.row.cropType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sensor" label="传感器" width="120" />
        <el-table-column prop="date" label="采集日期" width="120" />
        <el-table-column prop="region" label="区域" width="150" />
        <el-table-column prop="cloudCover" label="云量" width="80">
          <template #default="scope">
            <el-tag 
              v-if="scope.row.cloudCover !== undefined && scope.row.cloudCover !== null"
              :type="scope.row.cloudCover < 10 ? 'success' : scope.row.cloudCover < 30 ? '' : 'warning'"
            >
              {{ scope.row.cloudCover }}%
            </el-tag>
            <span v-else style="color: #999">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="size" label="文件大小" width="100" />
        <el-table-column label="状态" width="220">
          <template #default="scope">
            <!-- 正在优化中 - 显示进度 -->
            <div v-if="isOptimizing(scope.row.id)" style="width: 100%">
              <div style="display: flex; align-items: center; margin-bottom: 4px">
                <el-icon class="is-loading" style="margin-right: 4px"><Loading /></el-icon>
                <span style="font-size: 12px; color: #E6A23C">{{ getProgress(scope.row.id).step }}</span>
              </div>
              <el-progress 
                :percentage="getProgress(scope.row.id).progress" 
                :status="getProgress(scope.row.id).progress === 100 ? 'success' : ''"
                :stroke-width="8"
                style="margin-top: 2px"
              />
              <div style="font-size: 11px; color: #909399; margin-top: 2px">
                已用时: {{ getProgress(scope.row.id).elapsed || 0 }}秒
              </div>
            </div>
            <!-- 正常状态 -->
            <template v-else>
              <el-tag :type="getStatusType(scope.row.status)" size="small">
                {{ getStatusLabel(scope.row.status) }}
              </el-tag>
              <el-tag 
                v-if="scope.row.isOptimized" 
                type="success" 
                size="small" 
                style="margin-left: 5px"
              >
                已优化
              </el-tag>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="scope">
            <!-- 优化按钮（仅未优化的文件显示） -->
            <el-button 
              v-if="!scope.row.isOptimized" 
              size="small" 
              type="success" 
              link 
              :disabled="isOptimizing(scope.row.id)"
              @click="handleOptimize(scope.row)"
            >
              <el-icon style="margin-right: 4px"><Settings /></el-icon>
              优化TIF
            </el-button>
            <el-button 
              size="small" 
              type="primary" 
              link 
              :disabled="isOptimizing(scope.row.id)"
              @click="handleEdit(scope.row)"
            >
              <Edit :size="14" style="margin-right: 4px" />
              编辑
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              link 
              :disabled="isOptimizing(scope.row.id)"
              @click="handleDelete(scope.row)"
            >
              <Trash2 :size="14" style="margin-right: 4px" />
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 缩略图视图 -->
      <div v-else class="grid-view">
        <div v-for="item in tableData" :key="item.id" class="grid-item">
          <el-checkbox v-model="item.checked" class="item-checkbox" />
          <div class="grid-image-wrapper" @click="handlePreview(item)">
            <img
              :src="generateThumbnail(item)"
              class="grid-image"
              :alt="item.name"
            />
          </div>
          <div class="grid-info">
            <div class="grid-title">{{ item.name }}</div>
            <div class="grid-meta">
              <el-tag size="small">{{ item.sensor }}</el-tag>
              <span>{{ item.date }}</span>
            </div>
            <div class="grid-meta">
              <span>云量: {{ item.cloudCover }}%</span>
              <span>{{ item.size }}</span>
            </div>
            <div class="grid-actions">
              <el-button type="primary" link size="small" @click="handlePreview(item)">
                <Eye :size="14" style="margin-right: 4px" />
                预览
              </el-button>
              <el-button type="danger" link size="small" @click="handleDelete(item)">
                <Trash2 :size="14" style="margin-right: 4px" />
                删除
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 上传对话框 -->
    <el-dialog
      v-model="showUploadDialog"
      title="上传影像"
      width="700px"
      :close-on-click-modal="false"
    >
      <!-- 添加影像信息表单 -->
      <el-form :model="uploadForm" label-width="100px" style="margin-bottom: 20px">
        <el-form-item label="年份" required>
          <el-date-picker
            v-model="uploadForm.year"
            type="year"
            placeholder="选择年份"
            format="YYYY"
            value-format="YYYY"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="期次" required>
          <el-select v-model="uploadForm.period" placeholder="选择期次" style="width: 100%">
            <el-option label="第一期" value="1" />
            <el-option label="第二期" value="2" />
            <el-option label="第三期" value="3" />
            <el-option label="第四期" value="4" />
          </el-select>
        </el-form-item>
        <el-form-item label="作物类型" required>
          <el-select v-model="uploadForm.cropType" placeholder="选择作物类型" style="width: 100%">
            <el-option label="全部作物" value="all" />
            <el-option label="小麦" value="wheat" />
            <el-option label="玉米" value="corn" />
            <el-option label="棉花" value="cotton" />
            <el-option label="水稻" value="rice" />
          </el-select>
        </el-form-item>
        <el-form-item label="区域">
          <el-input v-model="uploadForm.region" placeholder="输入区域代码或名称" />
        </el-form-item>
        <el-form-item label="传感器">
          <el-input v-model="uploadForm.sensor" placeholder="如: Sentinel-2, Landsat-8" />
        </el-form-item>
        <el-form-item label="云量 (%)">
          <el-input-number 
            v-model="uploadForm.cloudCover" 
            :min="0" 
            :max="100" 
            :precision="1"
            placeholder="留空表示无云量信息"
            style="width: 100%"
          />
          <span style="color: #999; font-size: 12px; margin-left: 10px">可选，如果没有云量信息可不填</span>
        </el-form-item>
        <el-form-item label="描述">
          <el-input 
            v-model="uploadForm.description" 
            type="textarea" 
            :rows="2"
            placeholder="填写影像描述信息（可选）" 
          />
        </el-form-item>
      </el-form>

      <el-divider content-position="left">选择文件</el-divider>

      <!-- 文件上传区域 -->
      <el-upload
        class="upload-area"
        drag
        multiple
        :auto-upload="false"
        :on-change="handleFileChange"
        :show-file-list="false"
        accept=".tif,.tiff,.img,.jp2"
      >
        <UploadIcon :size="60" class="upload-icon" />
        <div class="upload-text">
          <div>拖拽文件到此处或<em>点击上传</em></div>
          <div class="upload-tip">支持 .tif, .tiff, .img, .jp2 格式，单个文件不超过 2GB</div>
        </div>
      </el-upload>
      
      <div v-if="uploadFiles.length > 0" class="upload-list" style="margin-top: 15px">
        <div class="upload-list-title">待上传文件 ({{ uploadFiles.length }})</div>
        <div v-for="(file, index) in uploadFiles" :key="index" class="upload-item">
          <File :size="16" />
          <span class="file-name">{{ file.name }}</span>
          <span class="file-size">{{ formatFileSize(file.size) }}</span>
          <X :size="16" class="remove-icon" @click="removeFile(index)" />
        </div>
      </div>
      
      <template #footer>
        <el-button @click="showUploadDialog = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="handleUpload" :disabled="uploadFiles.length === 0">
          {{ uploading ? '上传中...' : '开始上传' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 预览对话框 -->
    <el-dialog
      v-model="showPreviewDialog"
      :title="`影像预览 - ${currentPreview?.name || ''}`"
      width="900px"
      :close-on-click-modal="false"
    >
      <div v-if="currentPreview" class="preview-container">
        <div class="preview-image" v-loading="loadingPreview" element-loading-text="正在渲染影像...">
          <div v-if="previewError" class="preview-error">
            <el-alert type="warning" :title="previewError" show-icon :closable="false" />
            <img
              :src="generateThumbnail(currentPreview)"
              style="width: 100%; max-height: 500px; object-fit: contain; margin-top: 20px;"
              :alt="currentPreview.name"
            />
          </div>
          <img
            v-else-if="previewImageUrl"
            :src="previewImageUrl"
            style="width: 100%; max-height: 500px; object-fit: contain;"
            :alt="currentPreview.name"
          />
          <img
            v-else
            :src="generateThumbnail(currentPreview)"
            style="width: 100%; max-height: 500px; object-fit: contain;"
            :alt="currentPreview.name"
          />
        </div>
        <div class="preview-info">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="影像ID">{{ currentPreview.id }}</el-descriptions-item>
            <el-descriptions-item label="文件名">{{ currentPreview.name }}</el-descriptions-item>
            <el-descriptions-item label="年份">{{ currentPreview.year }}年</el-descriptions-item>
            <el-descriptions-item label="期次">第{{ currentPreview.period }}期</el-descriptions-item>
            <el-descriptions-item label="作物类型">
              <el-tag size="small">{{ getCropTypeLabel(currentPreview.cropType) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="传感器">{{ currentPreview.sensor }}</el-descriptions-item>
            <el-descriptions-item label="采集日期">{{ currentPreview.date }}</el-descriptions-item>
            <el-descriptions-item label="区域">{{ currentPreview.region }}</el-descriptions-item>
            <el-descriptions-item v-if="currentPreview.cloudCover !== undefined && currentPreview.cloudCover !== null" label="云量">
              <el-tag :type="currentPreview.cloudCover < 10 ? 'success' : currentPreview.cloudCover < 30 ? '' : 'warning'">
                {{ currentPreview.cloudCover }}%
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="文件大小">
              {{ currentPreview.size }}
              <span v-if="currentPreview.isOptimized && currentPreview.optimizedSize" style="color: #67c23a; font-size: 12px; margin-left: 5px">
                (优化后: {{ currentPreview.optimizedSize }})
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="getStatusType(currentPreview.status)" size="small">
                {{ getStatusLabel(currentPreview.status) }}
              </el-tag>
              <el-tag 
                v-if="currentPreview.isOptimized" 
                type="success" 
                size="small" 
                style="margin-left: 5px"
              >
                已优化
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="上传时间" :span="2">
              {{ formatDate(currentPreview.uploadTime) }}
            </el-descriptions-item>
            <el-descriptions-item v-if="currentPreview.description" label="描述" :span="2">
              {{ currentPreview.description }}
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
      <template #footer>
        <el-button @click="showPreviewDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 编辑对话框 -->
    <el-dialog
      v-model="showEditDialog"
      title="编辑影像信息"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="影像ID">
          <el-input v-model="editForm.id" disabled />
          <div class="form-tip">不可修改</div>
        </el-form-item>
        
        <el-form-item label="文件名">
          <el-input v-model="editForm.name" disabled />
          <div class="form-tip">不可修改</div>
        </el-form-item>
        
        <el-form-item label="年份">
          <el-select v-model="editForm.year" placeholder="请选择年份" style="width: 100%">
            <el-option
              v-for="year in [2020, 2021, 2022, 2023, 2024, 2025]"
              :key="year"
              :label="`${year}年`"
              :value="year.toString()"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="期次">
          <el-select v-model="editForm.period" placeholder="请选择期次" style="width: 100%">
            <el-option
              v-for="period in [1, 2, 3, 4, 5, 6]"
              :key="period"
              :label="`第${period}期`"
              :value="period.toString()"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="作物类型">
          <el-select v-model="editForm.cropType" placeholder="请选择作物类型" style="width: 100%">
            <el-option label="全部作物" value="all" />
            <el-option label="棉花" value="cotton" />
            <el-option label="小麦" value="wheat" />
            <el-option label="玉米" value="corn" />
            <el-option label="番茄" value="tomato" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="区域">
          <el-input v-model="editForm.region" placeholder="请输入区域" />
        </el-form-item>
        
        <el-form-item label="传感器">
          <el-select v-model="editForm.sensor" placeholder="请选择传感器" style="width: 100%">
            <el-option label="Sentinel-2" value="sentinel2" />
            <el-option label="Landsat-8" value="landsat8" />
            <el-option label="GF-1" value="gf1" />
            <el-option label="VH" value="vh" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="采集日期">
          <el-date-picker
            v-model="editForm.date"
            type="date"
            placeholder="选择日期"
            style="width: 100%"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        
        <el-form-item label="云量 (%)">
          <el-input-number 
            v-model="editForm.cloudCover" 
            :min="0" 
            :max="100" 
            :precision="1"
            placeholder="留空表示无云量信息"
            style="width: 100%"
          />
          <el-alert 
            type="warning" 
            :closable="false"
            style="margin-top: 8px"
          >
            <template #title>
              <span style="font-size: 12px">
                ⚠️ 云量数据通常从遥感影像元数据中自动提取，请谨慎修改
              </span>
            </template>
          </el-alert>
        </el-form-item>
        
        <el-form-item label="文件大小">
          <el-input v-model="editForm.size" disabled />
          <div class="form-tip">不可修改</div>
        </el-form-item>
        
        <el-form-item label="上传时间">
          <el-input v-model="editFormattedUploadTime" disabled />
          <div class="form-tip">不可修改</div>
        </el-form-item>
        
        <el-form-item label="描述">
          <el-input 
            v-model="editForm.description" 
            type="textarea" 
            :rows="3"
            placeholder="请输入影像描述"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSaveEdit">保存修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { Upload, Download, Trash2, Search, Image, List, Grid3X3, Upload as UploadIcon, File, X, Edit, Settings } from 'lucide-vue-next'
import { Loading } from '@element-plus/icons-vue'
import { getImageList, uploadImage, deleteImage, batchDeleteImage, downloadImage, optimizeImage, getOptimizeProgress } from '@/api/image'
import * as GeoTIFF from 'geotiff'

const searchKeyword = ref('')
const viewMode = ref('table')
const currentPage = ref(1)
const pageSize = ref(10)
const showUploadDialog = ref(false)
const uploading = ref(false)

// 正在优化的任务列表
const optimizingTasks = ref(new Set())

// 优化进度数据（id -> { progress, status, step, elapsed }）
const optimizationProgress = ref(new Map())

// 轮询定时器
const progressPollingTimers = ref(new Map())

// 检查是否正在优化
const isOptimizing = (id) => {
  return optimizingTasks.value.has(id)
}

// 获取优化进度
const getProgress = (id) => {
  return optimizationProgress.value.get(id) || { progress: 0, step: '准备中...' }
}

const uploadFiles = ref([])
const selectedRows = ref([])
const loading = ref(false)
const showPreviewDialog = ref(false)
const currentPreview = ref(null)
const previewImageUrl = ref('')
const loadingPreview = ref(false)
const previewError = ref('')

// 编辑相关状态
const showEditDialog = ref(false)
const editForm = ref({
  id: '',
  name: '',
  year: '',
  period: '',
  cropType: '',
  region: '',
  sensor: '',
  date: '',
  cloudCover: null,
  size: '',
  uploadTime: '',
  description: ''
})

const filterForm = ref({
  dateRange: [],
  sensor: '',
  cloudCover: 30
})

// 上传表单数据
const uploadForm = ref({
  year: new Date().getFullYear().toString(),
  period: '1',
  cropType: 'all',
  region: '',
  sensor: '',
  cloudCover: null, // 云量（可选）
  description: ''
})

// 原始数据
const allData = ref([])

// 过滤后的数据
const filteredData = computed(() => {
  let data = [...allData.value]
  
  // 搜索过滤
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    data = data.filter(item => 
      item.name.toLowerCase().includes(keyword) ||
      item.region.toLowerCase().includes(keyword)
    )
  }
  
  // 传感器过滤
  if (filterForm.value.sensor) {
    data = data.filter(item => item.sensor.toLowerCase().includes(filterForm.value.sensor.toLowerCase()))
  }
  
  // 云量过滤（只过滤有云量值的数据）
  data = data.filter(item => 
    item.cloudCover === null || 
    item.cloudCover === undefined || 
    item.cloudCover <= filterForm.value.cloudCover
  )
  
  // 时间范围过滤
  if (filterForm.value.dateRange && filterForm.value.dateRange.length === 2) {
    const [start, end] = filterForm.value.dateRange
    data = data.filter(item => {
      const itemDate = new Date(item.date)
      return itemDate >= start && itemDate <= end
    })
  }
  
  return data
})

// 当前页数据
const tableData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredData.value.slice(start, end)
})

// 总数
const total = computed(() => filteredData.value.length)

// 加载影像列表
const loadImageList = async () => {
  try {
    loading.value = true
    const res = await getImageList()
    allData.value = res.data || []
  } catch (error) {
    console.error('加载影像列表失败：', error)
    ElMessage.error('加载影像列表失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  ElMessage.success('搜索完成')
}

const handleFilter = () => {
  currentPage.value = 1
  ElMessage.success('筛选条件已应用')
}

const resetFilter = () => {
  filterForm.value = {
    dateRange: [],
    sensor: '',
    cloudCover: 30
  }
  currentPage.value = 1
}

const handleSelectionChange = (selection) => {
  selectedRows.value = selection
}

// 生成缩略图（使用SVG占位符）
const generateThumbnail = (row) => {
  // 由于TIF格式浏览器无法直接显示，使用SVG占位图
  const colors = [
    { bg: '#4A90E2', text: '#ffffff' }, // 蓝色
    { bg: '#7ED321', text: '#ffffff' }, // 绿色
    { bg: '#F5A623', text: '#ffffff' }, // 橙色
    { bg: '#BD10E0', text: '#ffffff' }, // 紫色
    { bg: '#50E3C2', text: '#ffffff' }, // 青色
  ]
  
  // 根据ID选择颜色
  const colorIndex = parseInt(row.id.replace(/\D/g, '')) % colors.length
  const color = colors[colorIndex]
  
  // 提取文件名关键信息
  const displayName = row.name.length > 25 ? row.name.substring(0, 22) + '...' : row.name
  const year = row.year || '2024'
  
  // 生成SVG
  const svg = `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="300" fill="${color.bg}"/>
      <text x="200" y="120" font-family="Arial, sans-serif" font-size="16" fill="${color.text}" text-anchor="middle">${displayName}</text>
      <text x="200" y="150" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="${color.text}" text-anchor="middle">${year}</text>
      <text x="200" y="180" font-family="Arial, sans-serif" font-size="14" fill="${color.text}" text-anchor="middle">${row.sensor || 'Unknown'}</text>
      <circle cx="200" cy="220" r="30" fill="none" stroke="${color.text}" stroke-width="2"/>
      <path d="M185,220 L195,230 L215,210" stroke="${color.text}" stroke-width="3" fill="none"/>
    </svg>
  `
  
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
}

// 格式化日期
// 作物类型标签转换
const getCropTypeLabel = (type) => {
  const labels = {
    'all': '全部作物',
    'wheat': '小麦',
    'corn': '玉米',
    'cotton': '棉花',
    'rice': '水稻'
  }
  return labels[type] || type
}

// 状态类型转换
const getStatusType = (status) => {
  const types = {
    'pending': 'info',
    'processing': 'warning',
    'processed': 'success',
    'failed': 'danger'
  }
  return types[status] || 'info'
}

// 状态标签转换
const getStatusLabel = (status) => {
  const labels = {
    'pending': '待处理',
    'processing': '处理中',
    'processed': '已完成',
    'failed': '失败'
  }
  return labels[status] || status
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 编辑表单的上传时间（格式化显示）
const editFormattedUploadTime = computed(() => {
  return formatDate(editForm.value.uploadTime)
})

// 打开编辑对话框
const handleEdit = (row) => {
  editForm.value = {
    id: row.id,
    name: row.name,
    year: row.year,
    period: row.period,
    cropType: row.cropType,
    region: row.region,
    sensor: row.sensor,
    date: row.date,
    cloudCover: row.cloudCover,
    size: row.size,
    uploadTime: row.uploadTime,
    description: row.description || ''
  }
  showEditDialog.value = true
}

// 开始轮询优化进度
const startProgressPolling = (id) => {
  // 如果已有定时器，先清除
  if (progressPollingTimers.value.has(id)) {
    clearInterval(progressPollingTimers.value.get(id))
  }
  
  // 立即获取一次进度
  updateProgress(id)
  
  // 每2秒轮询一次
  const timer = setInterval(() => {
    updateProgress(id)
  }, 2000)
  
  progressPollingTimers.value.set(id, timer)
}

// 停止轮询优化进度
const stopProgressPolling = (id) => {
  if (progressPollingTimers.value.has(id)) {
    clearInterval(progressPollingTimers.value.get(id))
    progressPollingTimers.value.delete(id)
    optimizationProgress.value.delete(id)
  }
}

// 更新单个文件的优化进度
const updateProgress = async (id) => {
  try {
    const response = await getOptimizeProgress(id)
    const data = response.data
    
    console.log(`📊 获取进度 [${id}]:`, data)  // 调试日志
    
    if (data.exists) {
      // 更新进度数据
      optimizationProgress.value.set(id, {
        progress: data.progress,
        status: data.status,
        step: data.step,
        elapsed: data.elapsed
      })
      
      console.log(`✅ 进度已更新: ${data.progress}% - ${data.step}`)  // 调试日志
      
      // 如果完成或失败，停止轮询
      if (data.status === 'completed' || data.status === 'failed') {
        stopProgressPolling(id)
      }
    } else {
      console.log(`⚠️ 后端没有进度记录 [${id}]`)  // 调试日志
      // 后端没有进度记录，可能已完成或失败
      stopProgressPolling(id)
    }
  } catch (error) {
    console.error('获取进度失败:', error)
  }
}

// 优化TIF文件（后台异步优化，不阻塞UI）
const handleOptimize = async (row) => {
  try {
    // 确认对话框
    await ElMessageBox.confirm(
      `<div style="line-height: 1.8;">
        <p><strong>准备优化文件：${row.name}</strong></p>
        <p style="margin-top: 12px;">优化处理包括：</p>
        <ul style="margin: 8px 0; padding-left: 20px;">
          <li>投影转换（EPSG:32645 → EPSG:3857）</li>
          <li>NoData值设置（255）</li>
          <li>转换为COG格式（Cloud Optimized GeoTIFF）</li>
          <li>LZW压缩</li>
          <li>添加金字塔（加速显示）</li>
        </ul>
        <p style="margin-top: 12px; color: #409EFF;">💡 提示：</p>
        <ul style="margin: 8px 0; padding-left: 20px; color: #409EFF;">
          <li>优化将在后台执行，您可以继续操作其他功能</li>
          <li>处理时间：约1-10分钟（取决于文件大小）</li>
          <li>完成后会自动通知您</li>
        </ul>
        <p style="margin-top: 12px;">处理后文件大小通常会减小60-95%，地图显示速度会大幅提升。</p>
      </div>`,
      '确认优化',
      {
        confirmButtonText: '开始优化',
        cancelButtonText: '取消',
        type: 'info',
        dangerouslyUseHTMLString: true,
        customStyle: {
          width: '550px'
        }
      }
    )
    
    // 添加到优化任务列表
    optimizingTasks.value.add(row.id)
    
    // 提示开始优化
    ElMessage({
      message: `🚀 开始优化 ${row.name}，请稍候...`,
      type: 'info',
      duration: 3000
    })
    
    // 开始轮询进度
    startProgressPolling(row.id)
    
    // 异步调用API（不阻塞UI）
    optimizeImage(row.id)
      .then(response => {
        // 移除任务
        optimizingTasks.value.delete(row.id)
        
        // 停止轮询进度
        stopProgressPolling(row.id)
        
        // 显示成功通知
        ElNotification({
          title: '✅ 优化完成',
          message: `${row.name}\n原始: ${response.data.originalSize} → 优化: ${response.data.optimizedSize}\n压缩率: ${response.data.compressionRatio}`,
          type: 'success',
          duration: 8000,
          position: 'bottom-right'
        })
        
        // 刷新列表
        fetchData()
      })
      .catch(error => {
        // 移除任务
        optimizingTasks.value.delete(row.id)
        
        // 停止轮询进度
        stopProgressPolling(row.id)
        
        const errorMsg = error.response?.data?.message || error.message || '优化失败'
        
        // 显示错误通知
        ElNotification({
          title: '❌ 优化失败',
          message: `${row.name}\n${errorMsg}`,
          type: 'error',
          duration: 0,  // 不自动关闭
          position: 'bottom-right'
        })
      })
    
  } catch (error) {
    // 用户取消
  }
}

// 保存编辑
const handleSaveEdit = async () => {
  try {
    // 验证必填字段
    if (!editForm.value.year || !editForm.value.period || !editForm.value.cropType) {
      ElMessage.warning('请填写年份、期次和作物类型')
      return
    }
    
    // 在真实项目中，这里应该调用后端API保存数据
    // await updateImage(editForm.value.id, editForm.value)
    
    // 模拟更新：在 allData 中找到对应项并更新
    const index = allData.value.findIndex(item => item.id === editForm.value.id)
    if (index !== -1) {
      // 只更新可编辑字段
      allData.value[index] = {
        ...allData.value[index],
        year: editForm.value.year,
        period: editForm.value.period,
        cropType: editForm.value.cropType,
        region: editForm.value.region,
        sensor: editForm.value.sensor,
        date: editForm.value.date,
        cloudCover: editForm.value.cloudCover,
        description: editForm.value.description
      }
      
      ElMessage.success('修改成功')
      showEditDialog.value = false
      
      // 注意：纯前端项目，刷新后数据会丢失
      // 在真实项目中，数据会持久化到数据库
    } else {
      ElMessage.error('未找到该影像数据')
    }
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败：' + error.message)
  }
}

// 使用GeoTIFF读取和渲染TIF影像
const renderTiffImage = async (filename) => {
  try {
    loadingPreview.value = true
    previewError.value = ''
    
    // 获取TIF文件
    const response = await fetch(`http://localhost:8080/image/file/${filename}`)
    if (!response.ok) {
      throw new Error('无法加载影像文件')
    }
    
    const arrayBuffer = await response.arrayBuffer()
    const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer)
    const image = await tiff.getImage()
    const width = image.getWidth()
    const height = image.getHeight()
    
    // 读取栅格数据
    const rasters = await image.readRasters()
    
    // 创建canvas
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    const imageData = ctx.createImageData(width, height)
    
    // 获取数据范围用于归一化
    const data = rasters[0]
    let min = Infinity
    let max = -Infinity
    
    for (let i = 0; i < data.length; i++) {
      if (data[i] < min) min = data[i]
      if (data[i] > max) max = data[i]
    }
    
    // 归一化并应用颜色映射
    const range = max - min
    for (let i = 0; i < data.length; i++) {
      const normalized = range > 0 ? (data[i] - min) / range : 0
      const value = Math.floor(normalized * 255)
      
      const idx = i * 4
      // 应用颜色映射 - 使用地形颜色
      if (rasters.length >= 3) {
        // RGB影像
        imageData.data[idx] = Math.floor((rasters[0][i] - min) / range * 255)
        imageData.data[idx + 1] = Math.floor((rasters[1][i] - min) / range * 255)
        imageData.data[idx + 2] = Math.floor((rasters[2][i] - min) / range * 255)
      } else {
        // 单波段 - 使用地形色
        const colors = getTerrainColor(normalized)
        imageData.data[idx] = colors.r
        imageData.data[idx + 1] = colors.g
        imageData.data[idx + 2] = colors.b
      }
      imageData.data[idx + 3] = 255 // Alpha
    }
    
    ctx.putImageData(imageData, 0, 0)
    previewImageUrl.value = canvas.toDataURL()
    
  } catch (error) {
    console.error('渲染TIF影像失败：', error)
    previewError.value = '影像加载失败: ' + error.message
    previewImageUrl.value = generateThumbnail(currentPreview.value)
  } finally {
    loadingPreview.value = false
  }
}

// 地形颜色映射
const getTerrainColor = (value) => {
  // 0-9 的分类数据颜色映射
  const classColors = {
    0: { r: 156, g: 156, b: 156 }, // 裸地 - 灰色
    1: { r: 255, g: 255, b: 190 }, // 棉花 - 浅黄
    2: { r: 255, g: 235, b: 175 }, // 小麦 - 金黄
    3: { r: 255, g: 211, b: 127 }, // 玉米 - 橙黄
    4: { r: 255, g: 85, b: 85 },   // 番茄 - 红色
    5: { r: 170, g: 85, b: 127 },  // 甜菜 - 紫红
    6: { r: 85, g: 255, b: 0 },    // 打瓜 - 亮绿
    7: { r: 255, g: 0, b: 0 },     // 辣椒 - 鲜红
    8: { r: 211, g: 255, b: 190 }, // 籽用葫芦 - 浅绿
    9: { r: 190, g: 210, b: 255 }  // 其它耕地 - 浅蓝
  }
  
  // 将归一化的值转换为类别 (0-9)
  const classValue = Math.floor(value * 10)
  const clampedClass = Math.min(9, Math.max(0, classValue))
  
  return classColors[clampedClass] || { r: 200, g: 200, b: 200 }
}

const handlePreview = async (row) => {
  currentPreview.value = row
  showPreviewDialog.value = true
  previewImageUrl.value = ''
  
  // 异步加载真实影像
  await nextTick()
  await renderTiffImage(row.name)
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要删除影像 ${row.name} 吗？此操作将永久删除该文件！`, '删除确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await deleteImage(row.id)
      ElMessage.success('删除成功')
      await loadImageList()
    } catch (error) {
      console.error('删除失败：', error)
      ElMessage.error('删除失败')
    }
  }).catch(() => {
    // 用户取消删除
  })
}

const handleBatchDelete = () => {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要删除的影像')
    return
  }
  
  ElMessageBox.confirm(`确定要删除选中的 ${selectedRows.value.length} 个影像吗？此操作将永久删除这些文件！`, '批量删除确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      const ids = selectedRows.value.map(row => row.id)
      await batchDeleteImage(ids)
      ElMessage.success(`成功删除 ${ids.length} 个影像`)
      await loadImageList()
    } catch (error) {
      console.error('批量删除失败：', error)
      ElMessage.error('批量删除失败')
    }
  }).catch(() => {
    // 用户取消删除
  })
}

const handleSizeChange = (val) => {
  pageSize.value = val
}

const handleCurrentChange = (val) => {
  currentPage.value = val
}

const handleFileChange = (file) => {
  uploadFiles.value.push(file.raw)
}

const removeFile = (index) => {
  uploadFiles.value.splice(index, 1)
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

const handleUpload = async () => {
  if (uploadFiles.value.length === 0) {
    ElMessage.warning('请先选择文件')
    return
  }
  
  // 验证必填字段
  if (!uploadForm.value.year) {
    ElMessage.warning('请选择年份')
    return
  }
  if (!uploadForm.value.period) {
    ElMessage.warning('请选择期次')
    return
  }
  if (!uploadForm.value.cropType) {
    ElMessage.warning('请选择作物类型')
    return
  }
  
  // ✅ 检查是否有同名文件
  const duplicateFiles = []
  uploadFiles.value.forEach(file => {
    const existing = allData.value.find(img => img.name === file.name)
    if (existing) {
      duplicateFiles.push(file.name)
    }
  })
  
  // ✅ 如果有同名文件，提示用户
  if (duplicateFiles.length > 0) {
    const fileList = duplicateFiles.map(name => `• ${name}`).join('\n')
    const confirmMessage = `以下文件已存在，上传将会覆盖原文件：\n\n${fileList}\n\n⚠️ 注意：原文件将被永久替换！\n\n是否继续上传？`
    
    try {
      await ElMessageBox.confirm(confirmMessage, '文件名冲突警告', {
        confirmButtonText: '覆盖并上传',
        cancelButtonText: '取消上传',
        type: 'warning',
        distinguishCancelAndClose: true
      })
    } catch (error) {
      // 用户取消了
      ElMessage.info('已取消上传')
      return
    }
  }
  
  try {
    uploading.value = true
    const formData = new FormData()
    
    // 添加文件
    uploadFiles.value.forEach(file => {
      formData.append('files', file)
    })
    
    // 添加元数据
    formData.append('year', uploadForm.value.year)
    formData.append('period', uploadForm.value.period)
    formData.append('cropType', uploadForm.value.cropType)
    formData.append('region', uploadForm.value.region || '')
    formData.append('sensor', uploadForm.value.sensor || '')
    if (uploadForm.value.cloudCover !== null && uploadForm.value.cloudCover !== undefined) {
      formData.append('cloudCover', uploadForm.value.cloudCover.toString())
    }
    formData.append('description', uploadForm.value.description || '')
    
    await uploadImage(formData)
    
    // ✅ 上传成功提示
    ElMessage.success({
      message: `成功上传 ${uploadFiles.value.length} 个文件`,
      duration: 3000
    })
    
    // ✅ 提醒用户需要优化
    ElMessage.warning({
      message: '⚠️ 提示：上传的TIF文件较大，建议使用"优化TIF"功能进行处理后再在地图中显示，以获得更流畅的体验',
      duration: 8000,
      showClose: true
    })
    showUploadDialog.value = false
    uploadFiles.value = []
    
    // 重置表单
    uploadForm.value = {
      year: new Date().getFullYear().toString(),
      period: '1',
      cropType: 'all',
      region: '',
      sensor: '',
      cloudCover: null,
      description: ''
    }
    
    await loadImageList()
  } catch (error) {
    console.error('上传失败：', error)
    ElMessage.error('上传失败：' + (error.message || '未知错误'))
  } finally {
    uploading.value = false
  }
}

// 组件挂载时加载数据
onMounted(() => {
  loadImageList()
})

// 组件卸载时清理所有定时器
onUnmounted(() => {
  // 清理所有轮询定时器
  progressPollingTimers.value.forEach((timer, id) => {
    clearInterval(timer)
    console.log(`🧹 清理轮询定时器: ${id}`)
  })
  progressPollingTimers.value.clear()
  optimizationProgress.value.clear()
})
</script>

<style scoped lang="scss">
.image-management-container {
  .action-card, .filter-card {
    margin-bottom: 20px;
    border-radius: 8px;
  }

  .action-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;

    .action-left {
      display: flex;
      gap: 12px;
    }

    .action-right {
      display: flex;
      gap: 12px;
      align-items: center;
    }
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    span {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }
  }

  .thumbnail-wrapper {
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      transform: scale(1.1);
    }
  }

  .image-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 60px;
    height: 60px;
    background: #f5f7fa;
    border-radius: 4px;
    color: #909399;
  }

  .image-placeholder-large {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 180px;
    background: #f5f7fa;
    color: #909399;
    text-align: center;
    padding: 10px;
    font-size: 12px;
  }
  
  .grid-view {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
    
    .grid-item {
      position: relative;
      border: 1px solid #ebeef5;
      border-radius: 8px;
      overflow: hidden;
      transition: all 0.3s;
      
      &:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
      }
      
      .item-checkbox {
        position: absolute;
        top: 10px;
        left: 10px;
        z-index: 10;
      }
      
      .grid-image-wrapper {
        width: 100%;
        height: 180px;
        cursor: pointer;
        overflow: hidden;

        &:hover {
          .grid-image {
            transform: scale(1.05);
          }
        }
      }

      .grid-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s;
      }
      
      .grid-info {
        padding: 12px;
        
        .grid-title {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 8px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .grid-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: #909399;
          margin-bottom: 6px;
        }
        
        .grid-actions {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }
      }
    }
  }
  
  .pagination-container {
    display: flex;
    justify-content: center;
    margin-top: 20px;
  }
  
  .upload-area {
    :deep(.el-upload-dragger) {
      width: 100%;
      height: 180px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    
    .upload-icon {
      font-size: 60px;
      color: #409EFF;
      margin-bottom: 16px;
    }
    
    .upload-text {
      text-align: center;
      
      em {
        color: #409EFF;
        font-style: normal;
      }
      
      .upload-tip {
        font-size: 12px;
        color: #909399;
        margin-top: 8px;
      }
    }
  }
  
  .upload-list {
    max-height: 300px;
    overflow-y: auto;
    
    .upload-list-title {
      font-weight: 600;
      margin-bottom: 10px;
    }
    
    .upload-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      border: 1px solid #ebeef5;
      border-radius: 4px;
      margin-bottom: 8px;
      
      .file-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .file-size {
        color: #909399;
        font-size: 12px;
      }
      
      .remove-icon {
        cursor: pointer;
        color: #f56c6c;
        
        &:hover {
          color: #f00;
        }
      }
    }
  }

  .preview-container {
    .preview-image {
      margin-bottom: 20px;
      border: 1px solid #ebeef5;
      border-radius: 8px;
      overflow: hidden;
      background: #f5f7fa;
      min-height: 300px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .preview-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      color: #909399;
      text-align: center;

      p {
        margin: 20px 0 10px;
        font-size: 14px;
        color: #606266;
      }
    }

    .preview-info {
      margin-top: 20px;
    }

    .preview-error {
      width: 100%;
      padding: 20px;
    }
  }
}

.form-tip {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

// 加载动画
.is-loading {
  animation: rotating 2s linear infinite;
}

@keyframes rotating {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

