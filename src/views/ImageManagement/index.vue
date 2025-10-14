<template>
  <div class="image-management-container">
    <!-- 操作栏 -->
    <el-card class="action-card" shadow="never">
      <el-space wrap>
        <el-button type="primary" @click="showUploadDialog = true">
          <template #icon><Upload :size="16" /></template>
          批量上传影像
        </el-button>
        <el-button @click="handleBatchDownload">
          <template #icon><Download :size="16" /></template>
          批量下载
        </el-button>
        <el-button type="danger" plain @click="handleBatchDelete">
          <template #icon><Trash2 :size="16" /></template>
          批量删除
        </el-button>
        <el-divider direction="vertical" />
        <el-input
          v-model="searchKeyword"
          placeholder="搜索影像名称或区域"
          style="width: 250px"
          clearable
        >
          <template #prefix><Search :size="16" /></template>
        </el-input>
        <el-button @click="handleSearch">
          <template #icon><Search :size="16" /></template>
          搜索
        </el-button>
          clearable
        />
      </el-space>
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
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="id" label="影像ID" width="100" />
        <el-table-column label="缩略图" width="100">
          <template #default="scope">
            <el-image
              :src="scope.row.thumbnail"
              :preview-src-list="[scope.row.preview]"
              fit="cover"
              style="width: 60px; height: 60px; border-radius: 4px; cursor: pointer"
            />
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
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button size="small" @click="handlePreview(scope.row)">
              <template #icon><Eye :size="14" /></template>
              预览
            </el-button>
            <el-button size="small" @click="handleDownload(scope.row)">
              <template #icon><Download :size="14" /></template>
              下载
            </el-button>
            <el-button size="small" type="danger" @click="handleDelete(scope.row)">
              <template #icon><Trash2 :size="14" /></template>
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 缩略图视图 -->
      <div v-else class="grid-view">
        <div v-for="item in tableData" :key="item.id" class="grid-item">
          <el-checkbox v-model="item.checked" class="item-checkbox" />
          <el-image
            :src="item.thumbnail"
            :preview-src-list="[item.preview]"
            fit="cover"
            class="grid-image"
          />
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
              <el-button size="small" @click="handlePreview(item)">
                <template #icon><Eye :size="14" /></template>
                预览
              </el-button>
              <el-button size="small" @click="handleDownload(item)">
                <template #icon><Download :size="14" /></template>
                下载
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
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, Download, Trash2, Search, Image, List, Grid3X3, Eye, Upload as UploadIcon, File, X } from 'lucide-vue-next'

const searchKeyword = ref('')
const viewMode = ref('table')
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(100)
const showUploadDialog = ref(false)
const uploading = ref(false)
const uploadFiles = ref([])

const filterForm = ref({
  dateRange: [],
  sensor: '',
  cloudCover: 30
})

const tableData = ref([
  {
    id: 'IMG001',
    name: 'Sentinel2_XJ_20240315_L2A',
    thumbnail: 'https://via.placeholder.com/60',
    preview: 'https://via.placeholder.com/800',
    sensor: 'Sentinel-2',
    date: '2024-03-15',
    region: '乌鲁木齐市',
    cloudCover: 5,
    size: '245MB',
    status: 'processed'
  },
  {
    id: 'IMG002',
    name: 'Landsat8_XJ_20240312_T1',
    thumbnail: 'https://via.placeholder.com/60',
    preview: 'https://via.placeholder.com/800',
    sensor: 'Landsat-8',
    date: '2024-03-12',
    region: '喀什地区',
    cloudCover: 15,
    size: '312MB',
    status: 'processed'
  },
  {
    id: 'IMG003',
    name: 'GF1_XJ_20240310_PMS',
    thumbnail: 'https://via.placeholder.com/60',
    preview: 'https://via.placeholder.com/800',
    sensor: '高分一号',
    date: '2024-03-10',
    region: '阿勒泰地区',
    cloudCover: 8,
    size: '189MB',
    status: 'pending'
  }
])

const handleSearch = () => {
  ElMessage.success('搜索功能开发中')
}

const handleFilter = () => {
  ElMessage.success('筛选条件已应用')
}

const resetFilter = () => {
  filterForm.value = {
    dateRange: [],
    sensor: '',
    cloudCover: 30
  }
}

const handleSelectionChange = (selection) => {
  console.log('选中的数据：', selection)
}

const handlePreview = (row) => {
  ElMessage.info(`预览影像：${row.name}`)
}

const handleDownload = (row) => {
  ElMessage.success(`下载影像：${row.name}`)
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要删除影像 ${row.name} 吗？`, '删除确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    ElMessage.success('删除成功')
  })
}

const handleBatchDownload = () => {
  ElMessage.info('批量下载功能开发中')
}

const handleBatchDelete = () => {
  ElMessage.info('批量删除功能开发中')
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

const handleUpload = () => {
  if (uploadFiles.value.length === 0) {
    ElMessage.warning('请先选择文件')
    return
  }
  
  uploading.value = true
  setTimeout(() => {
    uploading.value = false
    showUploadDialog.value = false
    uploadFiles.value = []
    ElMessage.success('上传成功')
  }, 2000)
}
</script>

<style scoped lang="scss">
.image-management-container {
  .action-card, .filter-card {
    margin-bottom: 20px;
    border-radius: 8px;
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
      
      .grid-image {
        width: 100%;
        height: 180px;
        cursor: pointer;
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
}
</style>

