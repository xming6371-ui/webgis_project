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
        <el-table-column prop="sensor" label="传感器" width="120" />
        <el-table-column prop="date" label="采集日期" width="120" />
        <el-table-column prop="region" label="区域" width="150" />
        <el-table-column prop="cloudCover" label="云量" width="80">
          <template #default="scope">
            <el-tag :type="scope.row.cloudCover < 10 ? 'success' : scope.row.cloudCover < 30 ? '' : 'warning'">
              {{ scope.row.cloudCover }}%
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="size" label="文件大小" width="100" />
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'processed' ? 'success' : 'info'">
              {{ scope.row.status === 'processed' ? '已处理' : '待处理' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button size="small" type="primary" link @click="handlePreview(scope.row)">
              <Eye :size="14" style="margin-right: 4px" />
              预览
            </el-button>
            <el-button size="small" type="danger" link @click="handleDelete(scope.row)">
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
      title="批量上传影像"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-upload
        class="upload-area"
        drag
        multiple
        :auto-upload="false"
        :on-change="handleFileChange"
        accept=".tif,.tiff,.img,.jp2"
      >
        <UploadIcon :size="60" class="upload-icon" />
        <div class="upload-text">
          <div>拖拽文件到此处或<em>点击上传</em></div>
          <div class="upload-tip">支持 .tif, .tiff, .img, .jp2 格式，单个文件不超过 2GB</div>
        </div>
      </el-upload>
      
      <el-divider />
      
      <div v-if="uploadFiles.length > 0" class="upload-list">
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
        <el-button type="primary" :loading="uploading" @click="handleUpload">
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
            <el-descriptions-item label="传感器">{{ currentPreview.sensor }}</el-descriptions-item>
            <el-descriptions-item label="采集日期">{{ currentPreview.date }}</el-descriptions-item>
            <el-descriptions-item label="区域">{{ currentPreview.region }}</el-descriptions-item>
            <el-descriptions-item label="云量">
              <el-tag :type="currentPreview.cloudCover < 10 ? 'success' : currentPreview.cloudCover < 30 ? '' : 'warning'">
                {{ currentPreview.cloudCover }}%
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="文件大小">{{ currentPreview.size }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="currentPreview.status === 'processed' ? 'success' : 'info'">
                {{ currentPreview.status === 'processed' ? '已处理' : '待处理' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="上传时间" :span="2">
              {{ formatDate(currentPreview.uploadTime) }}
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
      <template #footer>
        <el-button @click="showPreviewDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, Download, Trash2, Search, Image, List, Grid3X3, Eye, Upload as UploadIcon, File, X } from 'lucide-vue-next'
import { getImageList, uploadImage, deleteImage, batchDeleteImage, downloadImage } from '@/api/image'
import * as GeoTIFF from 'geotiff'

const searchKeyword = ref('')
const viewMode = ref('table')
const currentPage = ref(1)
const pageSize = ref(10)
const showUploadDialog = ref(false)
const uploading = ref(false)
const uploadFiles = ref([])
const selectedRows = ref([])
const loading = ref(false)
const showPreviewDialog = ref(false)
const currentPreview = ref(null)
const previewImageUrl = ref('')
const loadingPreview = ref(false)
const previewError = ref('')

const filterForm = ref({
  dateRange: [],
  sensor: '',
  cloudCover: 30
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
  
  // 云量过滤
  data = data.filter(item => item.cloudCover <= filterForm.value.cloudCover)
  
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
  
  try {
    uploading.value = true
    const formData = new FormData()
    uploadFiles.value.forEach(file => {
      formData.append('files', file)
    })
    
    await uploadImage(formData)
    
    ElMessage.success(`成功上传 ${uploadFiles.value.length} 个文件`)
    showUploadDialog.value = false
    uploadFiles.value = []
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
</style>

