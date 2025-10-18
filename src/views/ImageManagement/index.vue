<template>
  <div class="image-management-container">

    <!-- 影像目录（包含筛选） -->
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span><Image :size="16" style="margin-right: 8px" /> 影像目录 (共 {{ tableData.length }} 条)</span>
          <div style="display: flex; align-items: center; gap: 10px">
            <!-- 上传影像按钮 -->
            <el-button 
              type="primary" 
              size="small" 
              @click="showUploadDialog = true"
            >
              <Upload :size="14" style="margin-right: 4px" />
              上传影像
            </el-button>
            
            <!-- 批量删除按钮 -->
            <el-button 
              type="danger" 
              size="small" 
              @click="handleBatchDelete"
              :disabled="selectedRows.length === 0"
            >
              <Trash2 :size="14" style="margin-right: 4px" />
              批量删除 ({{ selectedRows.length }})
            </el-button>
            
            <!-- 刷新按钮 -->
            <el-button 
              type="success" 
              size="small" 
              @click="handleRefresh"
              :loading="loading"
              plain
            >
              <RefreshCw :size="14" style="margin-right: 6px" />
              刷新
            </el-button>
            
            <!-- 视图模式切换 -->
            <el-radio-group v-model="viewMode" size="small">
              <el-radio-button label="table"><List :size="14" style="margin-right: 6px" /> 列表</el-radio-button>
              <el-radio-button label="grid"><Grid3X3 :size="14" style="margin-right: 6px" /> 缩略图</el-radio-button>
            </el-radio-group>
          </div>
        </div>
      </template>

      <!-- 筛选和搜索区域 -->
      <div class="filter-section">
        <el-form :inline="true" :model="filterForm" size="default">
          <el-form-item label="搜索">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索影像名称或区域"
              style="width: 250px"
              clearable
              @keyup.enter="handleSearch"
            >
              <template #prefix><Search :size="16" /></template>
            </el-input>
          </el-form-item>
          <el-form-item label="时间范围">
            <el-date-picker
              v-model="filterForm.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              style="width: 260px"
            />
          </el-form-item>
          <el-form-item label="传感器">
            <el-select v-model="filterForm.sensor" placeholder="请选择" style="width: 140px" clearable>
              <el-option label="全部" value="" />
              <el-option label="Sentinel-2" value="sentinel2" />
              <el-option label="Landsat-8" value="landsat8" />
              <el-option label="高分系列" value="gaofen" />
            </el-select>
          </el-form-item>
          <el-form-item label="云量">
            <el-slider v-model="filterForm.cloudCover" :max="100" style="width: 180px" />
            <span style="margin-left: 10px">≤ {{ filterForm.cloudCover }}%</span>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleFilter">应用筛选</el-button>
            <el-button @click="resetFilter">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

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

    <!-- 结果队列（带Tab切换） -->
    <el-card shadow="never" class="result-queue-card" style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <span>
            <FileArchive :size="16" style="margin-right: 8px" /> 
            结果队列
          </span>
          <div style="display: flex; gap: 10px; align-items: center;">
            <!-- 搜索框 -->
            <el-input
              v-model="resultSearchKeyword"
              placeholder="搜索文件名称或任务名称..."
              size="small"
              clearable
              style="width: 220px;"
            >
              <template #prefix>
                <Search :size="14" />
              </template>
            </el-input>

            <!-- 上传结果文件按钮 -->
            <el-button type="success" size="small" @click="showResultUploadDialog = true">
              <Upload :size="14" style="margin-right: 4px" />
              上传文件
            </el-button>

            <!-- 批量删除按钮 -->
            <el-button 
              type="danger" 
              size="small"
              @click="handleBatchDeleteResults"
              :disabled="selectedResultRows.length === 0"
            >
              <Trash2 :size="14" style="margin-right: 4px" />
              批量删除 ({{ selectedResultRows.length }})
            </el-button>

            <!-- 刷新按钮 -->
            <el-button 
              type="success" 
              size="small" 
              @click="loadAllResults"
              plain
            >
              <RefreshCw :size="14" style="margin-right: 4px" />
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <!-- Tab切换 -->
      <el-tabs v-model="activeQueueTab" class="queue-tabs">
        <!-- 识别结果队列 -->
        <el-tab-pane name="recognition">
          <template #label>
            <span class="tab-label">
              <el-icon><Picture /></el-icon>
              识别结果 ({{ recognitionResults.length }})
            </span>
          </template>
          
          <el-empty v-if="recognitionResults.length === 0" description="暂无识别结果文件">
            <el-text type="info">识别任务完成后，结果会自动保存到这里</el-text>
          </el-empty>

          <div v-else>
            <el-table 
              :data="paginatedRecognitionResults" 
              style="width: 100%"
              @selection-change="handleResultSelectionChange"
            >
              <el-table-column type="selection" width="55" />
              <el-table-column prop="name" label="文件名称" min-width="180" show-overflow-tooltip />
              <el-table-column prop="type" label="格式" width="80" align="center">
                <template #default="scope">
                  <el-tag 
                    :type="scope.row.type === 'SHP' ? 'warning' : scope.row.type === 'KMZ' ? 'info' : 'success'" 
                    size="small"
                  >
                    {{ scope.row.type }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="taskName" label="来源任务" min-width="150" show-overflow-tooltip />
              <el-table-column prop="size" label="文件大小" width="100" align="center" />
              <el-table-column prop="createTime" label="创建时间" width="160" />
              <el-table-column label="操作" width="300" fixed="right">
                <template #default="scope">
                  <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                    <!-- SHP文件显示转换GeoJSON按钮 -->
                    <el-button 
                      v-if="scope.row.type === 'SHP'" 
                      size="small" 
                      type="warning" 
                      @click="handleConvertToGeojson(scope.row)"
                      :loading="convertingFiles.has(scope.row.name)"
                    >
                      <RefreshCw :size="14" style="margin-right: 4px" />
                      转GeoJSON
                    </el-button>
                    
                    <!-- 下载按钮 -->
                    <el-button 
                      size="small" 
                      type="primary" 
                      @click="handleDownloadFile(scope.row)"
                    >
                      <Download :size="14" style="margin-right: 4px" />
                      下载
                    </el-button>
                    
                    <!-- 删除按钮 -->
                    <el-button 
                      size="small" 
                      type="danger" 
                      @click="handleDeleteResult(scope.row, 'recognition')"
                    >
                      <Trash2 :size="14" style="margin-right: 4px" />
                      删除
                    </el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>

            <div class="pagination-container">
              <el-pagination
                v-model:current-page="recognitionCurrentPage"
                v-model:page-size="recognitionPageSize"
                :page-sizes="[10, 20, 50]"
                layout="total, sizes, prev, pager, next, jumper"
                :total="filteredRecognitionResults.length"
              />
            </div>
          </div>
        </el-tab-pane>

        <!-- 分析结果队列 -->
        <el-tab-pane name="analysis">
          <template #label>
            <span class="tab-label">
              <el-icon><DataAnalysis /></el-icon>
              分析结果 ({{ analysisResults.length }})
            </span>
          </template>
          
          <el-empty v-if="analysisResults.length === 0" description="暂无分析结果文件">
            <el-text type="info">从任务管理中导出分析结果后，会自动出现在这里</el-text>
          </el-empty>

          <div v-else>
            <el-table 
              :data="paginatedAnalysisResults" 
              style="width: 100%"
              @selection-change="handleResultSelectionChange"
            >
              <el-table-column type="selection" width="55" />
              <el-table-column prop="name" label="文件名称" min-width="180" show-overflow-tooltip />
              <el-table-column prop="type" label="格式" width="80" align="center">
                <template #default="scope">
                  <el-tag 
                    :type="scope.row.type === 'SHP' ? 'success' : 'primary'" 
                    size="small"
                  >
                    {{ scope.row.type }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="taskName" label="来源任务" min-width="150" show-overflow-tooltip />
              <el-table-column prop="analysisType" label="分析类型" width="110" align="center">
                <template #default="scope">
                  <el-tag size="small">{{ getAnalysisTypeLabel(scope.row.analysisType) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="recordCount" label="记录数" width="90" align="center" />
              <el-table-column prop="size" label="文件大小" width="100" align="center" />
              <el-table-column prop="createTime" label="创建时间" width="160" />
              <el-table-column label="操作" width="200" fixed="right">
                <template #default="scope">
                  <el-button size="small" type="primary" @click="handleDownloadResult(scope.row)">
                    <Download :size="14" style="margin-right: 4px" />
                    下载
                  </el-button>
                  <el-button size="small" type="danger" @click="handleDeleteResult(scope.row, 'analysis')">
                    <Trash2 :size="14" style="margin-right: 4px" />
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>

            <div class="pagination-container">
              <el-pagination
                v-model:current-page="analysisCurrentPage"
                v-model:page-size="analysisPageSize"
                :page-sizes="[10, 20, 50]"
                layout="total, sizes, prev, pager, next, jumper"
                :total="filteredAnalysisResults.length"
              />
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
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

    <!-- 下载确认对话框 -->
    <el-dialog
      v-model="showDownloadDialog"
      title="确认下载"
      width="500px"
      :close-on-click-modal="false"
    >
      <div v-if="downloadFileInfo" style="padding: 20px 0;">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="文件名称">
            <strong>{{ downloadFileInfo.name }}</strong>
          </el-descriptions-item>
          <el-descriptions-item label="文件格式">
            <el-tag :type="downloadFileInfo.type === 'SHP' ? 'warning' : downloadFileInfo.type === 'KMZ' ? 'info' : 'success'">
              {{ downloadFileInfo.type }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="文件大小">
            {{ downloadFileInfo.size }}
          </el-descriptions-item>
          <el-descriptions-item label="来源任务">
            {{ downloadFileInfo.taskName }}
          </el-descriptions-item>
        </el-descriptions>

        <el-alert
          v-if="downloadFileInfo.type === 'SHP'"
          title="提示：SHP文件将会打包下载"
          type="info"
          :closable="false"
          style="margin-top: 20px;"
        >
          <div>下载的压缩包（.zip）将包含以下文件：</div>
          <div style="margin-top: 5px; color: #666;">
            • .shp (矢量要素几何)
            <br>• .shx (索引文件)
            <br>• .dbf (属性数据表)
            <br>• .prj (坐标系统)
          </div>
        </el-alert>

        <!-- 保存位置选择 -->
        <div style="margin-top: 20px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <span style="font-weight: 600; color: #303133;">保存位置：</span>
            <el-button 
              type="primary" 
              size="small"
              @click="selectSavePath"
            >
              <Settings :size="14" style="margin-right: 4px;" />
              选择自定义路径
            </el-button>
          </div>
          
          <!-- 显示已选择的路径 -->
          <div v-if="selectedSavePath" style="padding: 12px; background: #f0f9ff; border-radius: 4px; border: 1px solid #91d5ff;">
            <div style="display: flex; align-items: center; gap: 8px; color: #1890ff;">
              <el-icon><SuccessFilled /></el-icon>
              <span style="font-weight: 500;">已选择保存路径</span>
            </div>
            <div style="margin-top: 8px; color: #606266; font-size: 13px; word-break: break-all;">
              文件名：{{ selectedSavePath }}
            </div>
          </div>
          
          <!-- 未选择路径的提示 -->
          <div v-else style="padding: 12px; background: #fafafa; border-radius: 4px; border: 1px solid #e8e8e8;">
            <div style="color: #909399; font-size: 13px;">
              <el-icon style="vertical-align: middle;"><InfoFilled /></el-icon>
              未选择自定义路径，将使用浏览器默认下载位置
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="showDownloadDialog = false" :disabled="isDownloading">取消</el-button>
        <el-button 
          type="primary" 
          @click="confirmDownload"
          :loading="isDownloading"
          :disabled="isDownloading"
        >
          <Download v-if="!isDownloading" :size="16" style="margin-right: 4px;" />
          {{ isDownloading ? '下载中...' : '确认下载' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 上传结果文件对话框 -->
    <el-dialog
      v-model="showResultUploadDialog"
      title="上传分析结果文件"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-alert
        title="支持的文件格式"
        type="info"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        <div>支持上传：<el-tag size="small" style="margin: 0 5px;">SHP</el-tag><el-tag size="small" style="margin: 0 5px;">GeoJSON</el-tag><el-tag size="small" style="margin: 0 5px;">JSON</el-tag><el-tag size="small" style="margin: 0 5px;">KMZ</el-tag></div>
        <div style="margin-top: 5px;">文件大小限制：500MB</div>
      </el-alert>

      <el-upload
        ref="resultUploadRef"
        :auto-upload="false"
        :on-change="handleResultFileChange"
        :on-remove="handleResultFileRemove"
        :file-list="resultFileList"
        drag
        multiple
        accept=".shp,.geojson,.json,.kmz"
      >
        <div class="upload-area">
          <UploadIcon :size="50" style="color: #409eff; margin-bottom: 10px;" />
          <div class="upload-text">
            <div>将文件拖到此处，或<em>点击选择文件</em></div>
            <div style="color: #999; font-size: 12px; margin-top: 5px;">
              支持批量选择，点击"开始上传"后统一上传
            </div>
          </div>
        </div>
      </el-upload>

      <div v-if="resultFileList.length > 0" style="margin-top: 15px;">
        <el-alert
          :title="`已选择 ${resultFileList.length} 个文件`"
          type="info"
          :closable="false"
        >
          <div style="color: #666;">
            总大小: {{ formatTotalSize(resultFileList) }}
          </div>
        </el-alert>
      </div>

      <template #footer>
        <el-button @click="cancelUpload">取消</el-button>
        <el-button 
          type="primary" 
          :disabled="resultFileList.length === 0"
          :loading="isUploading"
          @click="startUpload"
        >
          <Upload :size="16" style="margin-right: 4px;" />
          {{ isUploading ? '上传中...' : '开始上传' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { Upload, Download, Trash2, Search, Image, List, Grid3X3, Upload as UploadIcon, File, X, Edit, Settings, FileArchive, RefreshCw } from 'lucide-vue-next'
import { Loading, Picture, DataAnalysis, SuccessFilled, InfoFilled } from '@element-plus/icons-vue'
import { getImageList, uploadImage, deleteImage, batchDeleteImage, downloadImage, optimizeImage, getOptimizeProgress } from '@/api/image'
import { getRecognitionResults, convertShpToGeojson, downloadAnalysisFile, deleteAnalysisFile } from '@/api/analysis'
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

// 结果队列相关
const activeQueueTab = ref('recognition') // 'recognition' 或 'analysis'

// 识别结果队列
const recognitionResults = ref([])
const recognitionCurrentPage = ref(1)
const recognitionPageSize = ref(10)

// 分析结果队列
const analysisResults = ref([])

// 搜索关键词
const resultSearchKeyword = ref('')

// 结果队列选中的行
const selectedResultRows = ref([])

// 过滤后的识别结果（computed，实时响应搜索）
const filteredRecognitionResults = computed(() => {
  if (!resultSearchKeyword.value) {
    return recognitionResults.value
  }
  
  const keyword = resultSearchKeyword.value.toLowerCase().trim()
  return recognitionResults.value.filter(item => 
    item.name.toLowerCase().includes(keyword) ||
    (item.taskName && item.taskName.toLowerCase().includes(keyword)) ||
    (item.type && item.type.toLowerCase().includes(keyword))
  )
})

// 过滤后的分析结果（computed，实时响应搜索）
const filteredAnalysisResults = computed(() => {
  if (!resultSearchKeyword.value) {
    return analysisResults.value
  }
  
  const keyword = resultSearchKeyword.value.toLowerCase().trim()
  return analysisResults.value.filter(item => 
    item.name.toLowerCase().includes(keyword) ||
    (item.taskName && item.taskName.toLowerCase().includes(keyword)) ||
    (item.type && item.type.toLowerCase().includes(keyword))
  )
})

// 结果文件上传相关
const showResultUploadDialog = ref(false)
const resultUploadRef = ref()
const uploadHeaders = ref({})
const baseUrl = import.meta.env.VITE_BASE_URL || 'http://localhost:8080'
const resultFileList = ref([])
const isUploading = ref(false)
const analysisCurrentPage = ref(1)
const analysisPageSize = ref(10)

// 分页后的识别结果（支持搜索过滤）
const paginatedRecognitionResults = computed(() => {
  const start = (recognitionCurrentPage.value - 1) * recognitionPageSize.value
  const end = start + recognitionPageSize.value
  return filteredRecognitionResults.value.slice(start, end)
})

// 分页后的分析结果（支持搜索过滤）
const paginatedAnalysisResults = computed(() => {
  const start = (analysisCurrentPage.value - 1) * analysisPageSize.value
  const end = start + analysisPageSize.value
  return filteredAnalysisResults.value.slice(start, end)
})


// 加载所有结果队列
const loadAllResults = async () => {
  try {
    // 从后端API加载识别结果（扫描data_shp和data_geojson目录）
    try {
      const response = await getRecognitionResults()
      if (response.code === 200) {
        recognitionResults.value = response.data || []
        console.log('✅ 从后端加载识别结果:', recognitionResults.value.length, '个')
      }
    } catch (error) {
      console.error('从后端加载识别结果失败:', error)
      recognitionResults.value = []
    }
    
    // 从localStorage加载分析结果（差异检测、时序分析等）
    const QUEUE_KEY = 'analysis_result_queue'
    const stored = localStorage.getItem(QUEUE_KEY)
    if (stored) {
      const allResults = JSON.parse(stored)
      analysisResults.value = allResults.filter(r => r.analysisType !== 'recognition')
      console.log('✅ 从localStorage加载分析结果:', analysisResults.value.length, '个')
    } else {
      analysisResults.value = []
    }
  } catch (error) {
    console.error('加载结果队列失败:', error)
    recognitionResults.value = []
    analysisResults.value = []
  }
}

// 兼容旧方法名
const loadAnalysisResults = loadAllResults

// 获取分析类型标签
const getAnalysisTypeLabel = (type) => {
  const map = {
    difference: '差异检测',
    temporal: '时序变化',
    statistics: '统计汇总'
  }
  return map[type] || type
}

// 转换SHP为GeoJSON
const convertingFiles = ref(new Set())

const handleConvertToGeojson = async (row) => {
  convertingFiles.value.add(row.name)
  try {
    const response = await convertShpToGeojson(row.name)
    
    if (response.code === 200) {
      ElNotification({
        title: '转换成功',
        message: '✅ GeoJSON文件已生成，可以在识别结果中查看',
        type: 'success',
        duration: 3000
      })
      // 重新加载结果列表
      await loadAllResults()
    } else if (response.code === 400 && response.data?.existed) {
      // 文件已存在
      ElMessage.warning(response.message)
    } else {
      ElMessage.error('转换失败: ' + (response.message || '未知错误'))
    }
  } catch (error) {
    console.error('转换失败:', error)
    ElMessage.error('转换失败: ' + (error.message || '网络错误'))
  } finally {
    convertingFiles.value.delete(row.name)
  }
}

// 下载确认对话框
const showDownloadDialog = ref(false)
const downloadFileInfo = ref(null)
const selectedSavePath = ref('')
const fileHandleRef = ref(null)
const isDownloading = ref(false)

const handleDownloadFile = async (row) => {
  downloadFileInfo.value = row
  selectedSavePath.value = ''
  fileHandleRef.value = null
  showDownloadDialog.value = true
}

// 选择保存路径
const selectSavePath = async () => {
  try {
    if (!('showSaveFilePicker' in window)) {
      ElMessage.warning('您的浏览器不支持自定义保存路径功能，将使用默认下载位置')
      return
    }
    
    const row = downloadFileInfo.value
    let fileType = 'geojson'
    if (row.type === 'SHP') {
      fileType = 'shp'
    } else if (row.type === 'KMZ') {
      fileType = 'kmz'
    }
    
    const filename = row.name
    const downloadFilename = fileType === 'shp' ? filename.replace('.shp', '.zip') : filename
    
    const options = {
      suggestedName: downloadFilename,
      types: []
    }
    
    // 根据文件类型设置建议的文件扩展名
    if (fileType === 'shp') {
      options.types = [{
        description: 'SHP压缩包',
        accept: { 'application/zip': ['.zip'] }
      }]
    } else if (fileType === 'geojson') {
      options.types = [{
        description: 'GeoJSON文件',
        accept: { 'application/json': ['.geojson', '.json'] }
      }]
    } else if (fileType === 'kmz') {
      options.types = [{
        description: 'KMZ文件',
        accept: { 'application/vnd.google-earth.kmz': ['.kmz'] }
      }]
    }
    
    const fileHandle = await window.showSaveFilePicker(options)
    fileHandleRef.value = fileHandle
    selectedSavePath.value = fileHandle.name
    ElMessage.success('保存路径已选择')
  } catch (error) {
    if (error.name === 'AbortError') {
      // 用户取消选择
      return
    }
    console.error('选择路径失败:', error)
    ElMessage.error('选择路径失败: ' + error.message)
  }
}

// 执行下载
const confirmDownload = async () => {
  isDownloading.value = true
  try {
    const row = downloadFileInfo.value
    let fileType = 'geojson'
    if (row.type === 'SHP') {
      fileType = 'shp'
    } else if (row.type === 'KMZ') {
      fileType = 'kmz'
    }
    const filename = row.name
    
    // SHP文件下载时，文件名应该是zip
    const downloadFilename = fileType === 'shp' ? filename.replace('.shp', '.zip') : filename
    
    // 显示下载提示
    ElMessage.info('正在准备下载文件，请稍候...')
    
    // 开始下载文件
    const response = await downloadAnalysisFile(fileType, filename)
    
    // 检查响应是否是blob
    if (!(response instanceof Blob)) {
      throw new Error('下载失败：响应格式错误')
    }
    
    // 如果用户已经选择了保存路径
    if (fileHandleRef.value) {
      const writable = await fileHandleRef.value.createWritable()
      await writable.write(response)
      await writable.close()
      
      showDownloadDialog.value = false
      
      ElNotification({
        title: '下载成功',
        message: `✅ ${downloadFilename} 已保存到您选择的位置`,
        type: 'success',
        duration: 2000
      })
    } else {
      // 使用传统方式下载到浏览器默认位置
      const url = window.URL.createObjectURL(response)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', downloadFilename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      showDownloadDialog.value = false
      
      ElNotification({
        title: '下载成功',
        message: `✅ ${downloadFilename} 已保存到浏览器默认下载位置`,
        type: 'success',
        duration: 2000
      })
    }
  } catch (error) {
    console.error('下载失败:', error)
    
    // 如果错误响应是blob，尝试读取错误信息
    if (error.response && error.response.data instanceof Blob) {
      try {
        const text = await error.response.data.text()
        ElMessage.error('下载失败: ' + text)
      } catch {
        ElMessage.error('下载失败: 请检查文件是否存在')
      }
    } else {
      ElMessage.error('下载失败: ' + (error.response?.data?.message || error.message || '请求失败'))
    }
  } finally {
    isDownloading.value = false
  }
}


// 结果队列选择变化
const handleResultSelectionChange = (selection) => {
  selectedResultRows.value = selection
}

// 批量删除结果文件
const handleBatchDeleteResults = async () => {
  if (selectedResultRows.value.length === 0) {
    ElMessage.warning('请先选择要删除的文件')
    return
  }
  
  const queueType = activeQueueTab.value
  const queueName = queueType === 'recognition' ? '识别结果' : '分析结果'
  
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedResultRows.value.length} 个${queueName}文件吗？此操作将永久删除这些文件！`,
      '批量删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    let successCount = 0
    let failCount = 0
    
    for (const row of selectedResultRows.value) {
      try {
        // 如果是识别结果（SHP、GeoJSON、KMZ），调用后端API删除
        if (queueType === 'recognition' && (row.type === 'SHP' || row.type === 'GeoJSON' || row.type === 'KMZ')) {
          let fileType = 'geojson'
          if (row.type === 'SHP') {
            fileType = 'shp'
          } else if (row.type === 'KMZ') {
            fileType = 'kmz'
          }
          
          const response = await deleteAnalysisFile(fileType, row.name)
          if (response.code === 200) {
            successCount++
          } else {
            failCount++
          }
        } else {
          // 分析结果，从localStorage删除
          const QUEUE_KEY = 'analysis_result_queue'
          const stored = localStorage.getItem(QUEUE_KEY)
          if (stored) {
            let allQueue = JSON.parse(stored)
            allQueue = allQueue.filter(item => item.id !== row.id)
            localStorage.setItem(QUEUE_KEY, JSON.stringify(allQueue))
            successCount++
          }
        }
      } catch (error) {
        console.error(`删除失败: ${row.name}`, error)
        failCount++
      }
    }
    
    // 显示结果
    if (failCount === 0) {
      ElMessage.success(`成功删除 ${successCount} 个文件`)
    } else {
      ElMessage.warning(`删除完成: 成功 ${successCount} 个，失败 ${failCount} 个`)
    }
    
    // 重新加载结果
    await loadAllResults()
    
    // 清空选择
    selectedResultRows.value = []
    
  } catch (error) {
    if (error !== 'cancel') {
      console.error('批量删除失败:', error)
      ElMessage.error('批量删除失败')
    }
  }
}

// 文件选择回调
const handleResultFileChange = (file, fileList) => {
  // 验证文件
  const fileName = file.name.toLowerCase()
  const validExtensions = ['.shp', '.geojson', '.json', '.kmz']
  const isValidType = validExtensions.some(ext => fileName.endsWith(ext))
  
  if (!isValidType) {
    ElMessage.error(`不支持的文件格式: ${file.name}`)
    // 从列表中移除
    const index = fileList.findIndex(f => f.uid === file.uid)
    if (index > -1) {
      fileList.splice(index, 1)
    }
    return
  }
  
  const isLt500M = file.size / 1024 / 1024 < 500
  if (!isLt500M) {
    ElMessage.error(`文件过大: ${file.name}（限制500MB）`)
    const index = fileList.findIndex(f => f.uid === file.uid)
    if (index > -1) {
      fileList.splice(index, 1)
    }
    return
  }
  
  resultFileList.value = fileList
}

// 移除文件回调
const handleResultFileRemove = (file, fileList) => {
  resultFileList.value = fileList
}

// 计算总大小
const formatTotalSize = (fileList) => {
  const totalBytes = fileList.reduce((sum, file) => sum + (file.size || 0), 0)
  const totalMB = totalBytes / (1024 * 1024)
  if (totalMB < 1) {
    return `${(totalBytes / 1024).toFixed(2)} KB`
  }
  return `${totalMB.toFixed(2)} MB`
}

// 取消上传
const cancelUpload = () => {
  resultFileList.value = []
  showResultUploadDialog.value = false
}

// 开始上传
const startUpload = async () => {
  if (resultFileList.value.length === 0) {
    return
  }
  
  isUploading.value = true
  let successCount = 0
  let failCount = 0
  
  try {
    for (const fileItem of resultFileList.value) {
      try {
        const formData = new FormData()
        formData.append('file', fileItem.raw)
        
        const response = await fetch(`${baseUrl}/analysis/upload`, {
          method: 'POST',
          body: formData
        })
        
        const result = await response.json()
        
        if (result.code === 200) {
          successCount++
          console.log(`✅ 上传成功: ${fileItem.name}`)
        } else {
          failCount++
          console.error(`❌ 上传失败: ${fileItem.name}`, result.message)
        }
      } catch (error) {
        failCount++
        console.error(`❌ 上传失败: ${fileItem.name}`, error)
      }
    }
    
    // 显示结果
    if (failCount === 0) {
      ElNotification({
        title: '上传完成',
        message: `✅ 成功上传 ${successCount} 个文件`,
        type: 'success',
        duration: 3000
      })
    } else {
      ElNotification({
        title: '上传完成',
        message: `成功: ${successCount} 个，失败: ${failCount} 个`,
        type: 'warning',
        duration: 3000
      })
    }
    
    // 刷新列表
    await loadAllResults()
    
    // 关闭对话框
    resultFileList.value = []
    showResultUploadDialog.value = false
    
  } catch (error) {
    console.error('上传过程出错:', error)
    ElMessage.error('上传失败: ' + error.message)
  } finally {
    isUploading.value = false
  }
}

// 下载分析结果
const handleDownloadResult = (row) => {
  ElMessage.info(`正在下载: ${row.name}`)
  // 实际项目中应该从后端下载文件
  setTimeout(() => {
    ElMessage.success(`${row.name} 下载完成`)
  }, 1000)
}

// 删除单个分析结果
const handleDeleteResult = async (row, queueType) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除 ${row.name} 吗？此操作将永久删除该文件！`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 如果是识别结果（SHP、GeoJSON、KMZ），调用后端API删除
    if (queueType === 'recognition' && (row.type === 'SHP' || row.type === 'GeoJSON' || row.type === 'KMZ')) {
      let fileType = 'geojson'
      if (row.type === 'SHP') {
        fileType = 'shp'
      } else if (row.type === 'KMZ') {
        fileType = 'kmz'
      }
      
      const response = await deleteAnalysisFile(fileType, row.name)
      if (response.code === 200) {
        ElMessage.success('删除成功')
        await loadAllResults() // 刷新列表
      }
    } else {
      // 分析结果，从localStorage删除
      const QUEUE_KEY = 'analysis_result_queue'
      const stored = localStorage.getItem(QUEUE_KEY)
      if (stored) {
        let allQueue = JSON.parse(stored)
        allQueue = allQueue.filter(item => item.id !== row.id)
        localStorage.setItem(QUEUE_KEY, JSON.stringify(allQueue))
        ElMessage.success('删除成功')
        await loadAllResults()
      }
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败: ' + (error.message || '请求失败'))
    }
  }
}


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

// 刷新列表
const handleRefresh = async () => {
  try {
    await loadImageList()
    ElMessage.success('刷新成功')
  } catch (error) {
    ElMessage.error('刷新失败')
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
  // 文件格式检测
  const fileName = file.name.toLowerCase()
  const validExtensions = ['.tif', '.tiff', '.img', '.jp2']
  const isValidFormat = validExtensions.some(ext => fileName.endsWith(ext))
  
  if (!isValidFormat) {
    ElMessage.error(`文件格式不支持: ${file.name}，只支持 .tif、.tiff、.img、.jp2 格式`)
    return
  }
  
  // 文件大小检测（2GB限制）
  const maxSize = 2 * 1024 * 1024 * 1024 // 2GB in bytes
  if (file.size > maxSize) {
    ElMessage.error(`文件过大: ${file.name}，单个文件不能超过 2GB`)
    return
  }
  
  // 检查是否已经添加过同名文件
  const isDuplicate = uploadFiles.value.some(f => f.name === file.name)
  if (isDuplicate) {
    ElMessage.warning(`文件已存在: ${file.name}`)
    return
  }
  
  uploadFiles.value.push(file.raw)
  ElMessage.success(`✅ 已添加: ${file.name}`)
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

// 监听tab切换，清空选择
watch(activeQueueTab, () => {
  selectedResultRows.value = []
})

// 监听搜索关键词变化，重置页码和清空选择（实现实时搜索效果）
watch(resultSearchKeyword, () => {
  recognitionCurrentPage.value = 1
  analysisCurrentPage.value = 1
  selectedResultRows.value = []
})

// 组件挂载时加载数据
onMounted(() => {
  loadImageList() // 加载影像列表
  loadAllResults() // 加载本地存储的分析结果
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
  .filter-section {
    padding: 16px;
    background: #f8f9fa;
    border-radius: 6px;
    margin-bottom: 16px;
    border: 1px solid #e8e8e8;
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

// 结果队列Tab样式
.result-queue-card {
  .queue-tabs {
    margin-top: 10px;
    
    .tab-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
    }
    
    :deep(.el-tabs__item) {
      font-size: 15px;
      font-weight: 500;
    }
    
    :deep(.el-tabs__item.is-active) {
      color: #409EFF;
      font-weight: 600;
    }
    
    :deep(.el-tabs__nav-wrap::after) {
      background-color: #e4e7ed;
    }
  }
}
</style>

