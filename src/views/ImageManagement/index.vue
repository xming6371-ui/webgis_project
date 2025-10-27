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
          <el-form-item label="区域">
            <el-select v-model="filterForm.region" placeholder="全部区域" style="width: 140px" clearable>
              <el-option label="全部" value="" />
              <el-option v-for="region in availableRegions" :key="region" :label="region" :value="region" />
            </el-select>
          </el-form-item>
          <el-form-item label="优化状态">
            <el-select v-model="filterForm.optimizationStatus" placeholder="全部状态" style="width: 140px" clearable>
              <el-option label="全部" value="" />
              <el-option label="已优化" value="optimized" />
              <el-option label="处理中" value="processing" />
              <el-option label="未优化" value="unoptimized" />
            </el-select>
          </el-form-item>
          <el-form-item>
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
        <el-table-column prop="displayIndex" label="序号" width="80" align="center" />
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
        <el-table-column prop="uploadTime" label="上传时间" width="160">
          <template #default="scope">
            {{ formatDate(scope.row.uploadTime) }}
          </template>
        </el-table-column>
        <el-table-column prop="name" label="影像名称" min-width="200" />
        <el-table-column prop="year" label="年份" width="80" />
        <el-table-column prop="period" label="期次" width="80">
          <template #default="scope">
            第{{ scope.row.period }}期
          </template>
        </el-table-column>
        <el-table-column prop="sensor" label="传感器" width="100" />
        <el-table-column prop="date" label="采集日期" width="110" />
        <el-table-column prop="region" label="区域" width="80" />
        <el-table-column prop="size" label="文件大小" width="100" />
      <el-table-column label="优化状态" width="120" align="center">
        <template #default="scope">
          <!-- 优化结果文件 -->
          <el-tag v-if="scope.row.isOptimizedResult" type="success" size="small">
            <el-icon style="margin-right: 4px"><Check /></el-icon>
            优化结果
          </el-tag>
          <!-- 已优化（覆盖原文件的情况） -->
          <el-tag v-else-if="scope.row.isOptimized" type="success" size="small">
            <el-icon style="margin-right: 4px"><Check /></el-icon>
            已优化
          </el-tag>
          <!-- 正在处理中（只有正在优化的文件） -->
          <el-tag v-else-if="optimizingFileIds.has(scope.row.id)" type="warning" size="small">
            <el-icon style="margin-right: 4px"><Clock /></el-icon>
            处理中
          </el-tag>
          <!-- 未优化（等待优化） -->
          <el-tag v-else type="info" size="small">
            <el-icon style="margin-right: 4px"><Warning /></el-icon>
            未优化
          </el-tag>
        </template>
      </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="scope">
            <!-- 只有未优化的文件才显示优化按钮 -->
            <el-button 
              v-if="!scope.row.isOptimized && !scope.row.isOptimizedResult"
              size="small" 
              type="warning" 
              link 
              @click="handleOptimize(scope.row)"
            >
              <Zap :size="14" style="margin-right: 4px" />
              优化TIF
            </el-button>
            <el-button 
              size="small" 
              type="primary" 
              link 
              @click="handleEdit(scope.row)"
            >
              <Edit :size="14" style="margin-right: 4px" />
              编辑
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              link 
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
          <span class="card-title">
            <FileArchive :size="16" style="margin-right: 8px" /> 
            结果队列
          </span>
          
          <!-- 操作按钮组 - 在右上角 -->
          <div style="display: flex; align-items: center; gap: 10px">
            <!-- 上传结果文件按钮 - 仅在识别结果选项卡显示 -->
            <el-button 
              v-if="activeQueueTab === 'recognition'" 
              type="success" 
              size="small" 
              @click="showResultUploadDialog = true"
            >
              <Upload :size="14" style="margin-right: 4px" />
              上传文件
            </el-button>

            <!-- 批量删除按钮 - 对当前选项卡的数据生效 -->
            <el-button 
              type="danger" 
              size="small"
              @click="handleBatchDeleteResults"
              :disabled="selectedResultRows.length === 0"
            >
              <Trash2 :size="14" style="margin-right: 4px" />
              批量删除 ({{ selectedResultRows.length }})
            </el-button>

            <!-- 刷新按钮 - 刷新所有结果队列 -->
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
            <!-- 筛选条件 -->
            <div class="filter-section" style="margin-bottom: 16px;">
              <el-form :model="recognitionFilterForm" inline size="default">
                <el-form-item label="格式">
                  <el-select 
                    v-model="recognitionFilterForm.format" 
                    placeholder="全部格式" 
                    style="width: 140px" 
                    clearable
                  >
                    <el-option label="全部" value="" />
                    <el-option label="GeoJSON" value="GEOJSON" />
                    <el-option label="SHP" value="SHP" />
                    <el-option label="KMZ" value="KMZ" />
                  </el-select>
                </el-form-item>
                <el-form-item label="区域">
                  <el-select 
                    v-model="recognitionFilterForm.region" 
                    placeholder="全部区域" 
                    style="width: 140px" 
                    clearable
                  >
                    <el-option label="全部" value="" />
                    <el-option label="包头湖" value="包头湖" />
                    <el-option label="经济牧场" value="经济牧场" />
                    <el-option label="库尔楚" value="库尔楚" />
                    <el-option label="普惠牧场" value="普惠牧场" />
                    <el-option label="普惠农场" value="普惠农场" />
                    <el-option label="原种场" value="原种场" />
                  </el-select>
                </el-form-item>
                <el-form-item label="识别任务">
                  <el-select 
                    v-model="recognitionFilterForm.recognitionType" 
                    placeholder="全部任务" 
                    style="width: 160px" 
                    clearable
                  >
                    <el-option label="全部" value="" />
                    <el-option label="作物识别" value="crop_recognition" />
                    <el-option label="种植情况识别" value="planting_situation" />
                  </el-select>
                </el-form-item>
                <el-form-item label="搜索">
                  <el-input
                    v-model="resultSearchKeyword"
                    placeholder="搜索文件名、任务名"
                    style="width: 200px"
                    clearable
                    :prefix-icon="Search"
                  />
                </el-form-item>
                <el-form-item>
                  <el-button @click="resetRecognitionFilter">重置</el-button>
                </el-form-item>
                <el-form-item>
                  <span style="color: #909399; font-size: 14px;">共 {{ filteredRecognitionResults.length }} 条结果</span>
                </el-form-item>
              </el-form>
            </div>
            
            <el-table 
              :data="paginatedRecognitionResults" 
              style="width: 100%"
              @selection-change="handleResultSelectionChange"
            >
              <el-table-column type="selection" width="55" />
              <el-table-column type="index" label="序号" width="60" align="center" />
              <el-table-column prop="name" label="文件名称" min-width="280" show-overflow-tooltip />
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
              <el-table-column prop="year" label="年份" width="80" align="center">
                <template #default="scope">
                  <span v-if="scope.row.year">{{ scope.row.year }}</span>
                  <span v-else style="color: #909399;">-</span>
                </template>
              </el-table-column>
              <el-table-column prop="period" label="期次" width="85" align="center">
                <template #default="scope">
                  <span v-if="scope.row.period">第{{ scope.row.period }}期</span>
                  <span v-else style="color: #909399;">-</span>
                </template>
              </el-table-column>
              <el-table-column prop="regionName" label="区域" width="110" align="center">
                <template #default="scope">
                  <el-tag v-if="scope.row.regionName" type="primary" size="small">
                    {{ scope.row.regionName }}
                  </el-tag>
                  <span v-else style="color: #909399;">-</span>
                </template>
              </el-table-column>
              <el-table-column label="来源任务" width="130" align="center">
                <template #default="scope">
                  {{ getRecognitionTypeLabel(scope.row.recognitionType) }}
                </template>
              </el-table-column>
              <el-table-column prop="size" label="大小" width="100" align="center" />
              <el-table-column prop="createTime" label="创建时间" width="180" align="center" />
              <el-table-column label="操作" min-width="320" fixed="right" align="center">
                <template #default="scope">
                  <div style="display: flex; gap: 5px; flex-wrap: wrap; justify-content: center;">
                    <!-- 编辑按钮 -->
                    <el-button 
                      size="small" 
                      type="primary" 
                      @click="handleEditRecognitionResult(scope.row)"
                    >
                      <Edit :size="14" style="margin-right: 4px" />
                      编辑
                    </el-button>
                    
                    <!-- 下载按钮 -->
                    <el-button 
                      size="small" 
                      type="success" 
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
            <el-text type="info">从任务管理中执行分析后，结果会自动保存在这里</el-text>
          </el-empty>

          <div v-else>
            <!-- 筛选条件 -->
            <div class="filter-section" style="margin-bottom: 16px;">
              <el-form :model="analysisFilterForm" inline size="default">
                <el-form-item label="格式">
                  <el-select 
                    v-model="analysisFilterForm.format" 
                    placeholder="全部格式" 
                    style="width: 140px" 
                    clearable
                  >
                    <el-option label="全部" value="" />
                    <el-option label="JSON" value="JSON" />
                    <el-option label="PDF" value="PDF" />
                  </el-select>
                </el-form-item>
                <el-form-item label="搜索">
                  <el-input
                    v-model="analysisSearchKeyword"
                    placeholder="搜索文件名、分析类型"
                    style="width: 200px"
                    clearable
                    :prefix-icon="Search"
                  />
                </el-form-item>
                <el-form-item>
                  <el-button @click="resetAnalysisFilter">重置</el-button>
                </el-form-item>
                <el-form-item>
                  <span style="color: #909399; font-size: 14px;">共 {{ filteredAnalysisResults.length }} 条结果</span>
                </el-form-item>
              </el-form>
            </div>
            <el-table 
              :data="paginatedAnalysisResults" 
              style="width: 100%"
              v-loading="analysisResultsLoading"
              element-loading-text="正在加载分析结果..."
              @selection-change="handleResultSelectionChange"
            >
              <el-table-column type="selection" width="55" />
              <el-table-column prop="filename" label="文件名称" min-width="300" show-overflow-tooltip />
              <el-table-column prop="format" label="格式" width="100" align="center">
                <template #default="scope">
                  <el-tag 
                    :type="scope.row.canLoadToMap ? 'success' : 'info'" 
                    size="small"
                  >
                    {{ scope.row.format }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="type" label="分析类型" width="130" align="center">
                <template #default="scope">
                  <el-tag size="small" :type="getAnalysisTypeTagType(scope.row.type)">
                    {{ getAnalysisTypeText(scope.row.type) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="用途" width="110" align="center">
                <template #default="scope">
                  <el-tag 
                    size="small" 
                    :type="scope.row.canLoadToMap ? 'success' : 'warning'"
                  >
                    {{ scope.row.canLoadToMap ? '可视化' : '仅查看' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="size" label="文件大小" width="130" align="center" />
              <el-table-column prop="createTime" label="创建时间" width="190" align="center" />
              <el-table-column label="操作" min-width="300" fixed="right" align="center">
                <template #default="scope">
                  <div style="display: flex; gap: 6px; justify-content: center; flex-wrap: nowrap;">
                    <el-button 
                      v-if="scope.row.canLoadToMap" 
                      size="small" 
                      type="success" 
                      @click="handleVisualizeResult(scope.row)"
                      style="padding: 5px 10px;"
                    >
                      <Eye :size="14" style="margin-right: 4px" />
                      可视化
                    </el-button>
                    <el-button 
                      size="small" 
                      type="primary" 
                      @click="handleDownloadAnalysisResult(scope.row)"
                      style="padding: 5px 10px;"
                    >
                      <Download :size="14" style="margin-right: 4px" />
                      下载
                    </el-button>
                    <el-button 
                      size="small" 
                      type="danger" 
                      @click="handleDeleteAnalysisResult(scope.row)"
                      style="padding: 5px 10px;"
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
      width="750px"
      :close-on-click-modal="false"
    >
      <!-- 🆕 模式切换（只在有多个文件时显示） -->
      <el-alert 
        v-if="uploadFiles.length > 1"
        :title="`已选择 ${uploadFiles.length} 个文件`"
        type="info"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        <div style="display: flex; align-items: center; gap: 15px; margin-top: 10px;">
          <span style="font-weight: 600;">填写模式：</span>
          <el-radio-group v-model="uploadMode" size="default">
            <el-radio label="batch">
              <span style="display: flex; align-items: center; gap: 5px;">
                批量填写
                <el-tooltip content="所有文件使用相同的元数据（推荐，快速）" placement="top">
                  <el-icon><QuestionFilled /></el-icon>
                </el-tooltip>
              </span>
            </el-radio>
            <el-radio label="individual">
              <span style="display: flex; align-items: center; gap: 5px;">
                逐个填写
                <el-tooltip content="为每个文件单独填写不同的元数据" placement="top">
                  <el-icon><QuestionFilled /></el-icon>
                </el-tooltip>
              </span>
            </el-radio>
          </el-radio-group>
        </div>
      </el-alert>
      
      <!-- 批量模式：单个表单 -->
      <el-form v-if="uploadMode === 'batch'" :model="uploadForm" label-width="100px" style="margin-bottom: 20px">
        <el-form-item label="年份" required>
          <el-date-picker
            v-model="uploadForm.year"
            type="year"
            placeholder="选择年份（自动识别）"
            format="YYYY"
            value-format="YYYY"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="月份" required>
          <el-select v-model="uploadForm.month" placeholder="请选择月份（自动识别）" style="width: 100%" clearable>
            <el-option label="1月" value="01" />
            <el-option label="2月" value="02" />
            <el-option label="3月" value="03" />
            <el-option label="4月" value="04" />
            <el-option label="5月" value="05" />
            <el-option label="6月" value="06" />
            <el-option label="7月" value="07" />
            <el-option label="8月" value="08" />
            <el-option label="9月" value="09" />
            <el-option label="10月" value="10" />
            <el-option label="11月" value="11" />
            <el-option label="12月" value="12" />
          </el-select>
        </el-form-item>
        <el-form-item label="期次" required>
          <el-select v-model="uploadForm.period" placeholder="请选择期次" style="width: 100%" clearable>
            <el-option label="第一期" value="1" />
            <el-option label="第二期" value="2" />
            <el-option label="第三期" value="3" />
            <el-option label="第四期" value="4" />
          </el-select>
        </el-form-item>
        <el-form-item label="区域">
          <el-select v-model="uploadForm.region" placeholder="选择区域" style="width: 100%" clearable>
            <el-option label="包头湖" value="包头湖" />
            <el-option label="经济牧场" value="经济牧场" />
            <el-option label="库尔楚" value="库尔楚" />
            <el-option label="普惠牧场" value="普惠牧场" />
            <el-option label="普惠农场" value="普惠农场" />
            <el-option label="原种场" value="原种场" />
          </el-select>
        </el-form-item>
        <el-form-item label="传感器">
          <el-input v-model="uploadForm.sensor" placeholder="如: Sentinel-2, Landsat-8" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input 
            v-model="uploadForm.description" 
            type="textarea" 
            :rows="2"
            placeholder="填写影像描述信息（可选）" 
          />
        </el-form-item>
        
        <!-- 优化选项 -->
        <el-divider content-position="left">优化设置</el-divider>
        
        <el-form-item label="是否优化" required>
          <el-radio-group v-model="uploadForm.needOptimize">
            <el-radio :label="true">是（推荐）- 投影转换、压缩、加金字塔</el-radio>
            <el-radio :label="false">否 - 保留原始文件</el-radio>
          </el-radio-group>
          <div style="color: #999; font-size: 12px; margin-top: 5px">
            💡 优化后文件更小、加载更快、坐标正确
          </div>
        </el-form-item>
        
        <el-form-item v-if="uploadForm.needOptimize" label="覆盖原文件" required>
          <el-radio-group v-model="uploadForm.overwriteOriginal">
            <el-radio :label="true">是 - 直接覆盖原文件</el-radio>
            <el-radio :label="false">否 - 保存为新文件</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item v-if="uploadForm.needOptimize && !uploadForm.overwriteOriginal" label="优化文件名">
          <el-input 
            v-model="uploadForm.optimizedFileName" 
            placeholder="默认为原文件名 + _optimized"
          >
            <template #append>.tif</template>
          </el-input>
          <div style="color: #999; font-size: 12px; margin-top: 5px">
            留空则自动在原文件名后添加 _optimized 后缀
          </div>
        </el-form-item>
      </el-form>
      
      <!-- 逐个模式：Tab切换每个文件 -->
      <div v-else-if="uploadMode === 'individual' && uploadFiles.length > 0">
        <el-tabs v-model="currentFileIndex" type="card" style="margin-bottom: 20px;">
          <el-tab-pane 
            v-for="(file, index) in uploadFiles" 
            :key="index" 
            :name="index"
          >
            <template #label>
              <span style="display: flex; align-items: center; gap: 8px;">
                <el-icon><Document /></el-icon>
                文件 {{ index + 1 }}
                <el-tag size="small" type="info">{{ file.name }}</el-tag>
              </span>
            </template>
            
            <el-form :model="fileMetadataList[index]" label-width="100px">
              <el-form-item label="年份" required>
                <el-date-picker
                  v-model="fileMetadataList[index].year"
                  type="year"
                  placeholder="选择年份（自动识别）"
                  format="YYYY"
                  value-format="YYYY"
                  style="width: 100%"
                />
              </el-form-item>
              <el-form-item label="月份" required>
                <el-select v-model="fileMetadataList[index].month" placeholder="请选择月份（自动识别）" style="width: 100%" clearable>
                  <el-option label="1月" value="01" />
                  <el-option label="2月" value="02" />
                  <el-option label="3月" value="03" />
                  <el-option label="4月" value="04" />
                  <el-option label="5月" value="05" />
                  <el-option label="6月" value="06" />
                  <el-option label="7月" value="07" />
                  <el-option label="8月" value="08" />
                  <el-option label="9月" value="09" />
                  <el-option label="10月" value="10" />
                  <el-option label="11月" value="11" />
                  <el-option label="12月" value="12" />
                </el-select>
              </el-form-item>
              <el-form-item label="期次" required>
                <el-select v-model="fileMetadataList[index].period" placeholder="请选择期次" style="width: 100%" clearable>
                  <el-option label="第一期" value="1" />
                  <el-option label="第二期" value="2" />
                  <el-option label="第三期" value="3" />
                  <el-option label="第四期" value="4" />
                </el-select>
              </el-form-item>
              <el-form-item label="区域">
                <el-select v-model="fileMetadataList[index].region" placeholder="选择区域" style="width: 100%" clearable>
                  <el-option label="包头湖" value="包头湖" />
                  <el-option label="经济牧场" value="经济牧场" />
                  <el-option label="库尔楚" value="库尔楚" />
                  <el-option label="普惠牧场" value="普惠牧场" />
                  <el-option label="普惠农场" value="普惠农场" />
                  <el-option label="原种场" value="原种场" />
                </el-select>
              </el-form-item>
              <el-form-item label="传感器">
                <el-input v-model="fileMetadataList[index].sensor" placeholder="如: Sentinel-2, Landsat-8" />
              </el-form-item>
              <el-form-item label="描述">
                <el-input 
                  v-model="fileMetadataList[index].description" 
                  type="textarea" 
                  :rows="2"
                  placeholder="填写影像描述信息（可选）" 
                />
              </el-form-item>
            </el-form>
            
            <!-- 导航按钮 -->
            <div style="display: flex; justify-content: space-between; margin-top: 15px;">
              <el-button 
                v-if="index > 0"
                @click="currentFileIndex = index - 1"
              >
                <el-icon><ArrowLeft /></el-icon>
                上一个
              </el-button>
              <div v-else></div>
              
              <el-tag type="info">{{ index + 1 }} / {{ uploadFiles.length }}</el-tag>
              
              <el-button 
                v-if="index < uploadFiles.length - 1"
                @click="currentFileIndex = index + 1"
                type="primary"
              >
                下一个
                <el-icon><ArrowRight /></el-icon>
              </el-button>
              <div v-else></div>
            </div>
          </el-tab-pane>
        </el-tabs>
        
        <!-- 优化选项（逐个模式也需要） -->
        <el-divider content-position="left">优化设置（应用到所有文件）</el-divider>
        
        <el-form :model="uploadForm" label-width="100px">
          <el-form-item label="是否优化" required>
            <el-radio-group v-model="uploadForm.needOptimize">
              <el-radio :label="true">是（推荐）- 投影转换、压缩、加金字塔</el-radio>
              <el-radio :label="false">否 - 保留原始文件</el-radio>
            </el-radio-group>
          </el-form-item>
          
          <el-form-item v-if="uploadForm.needOptimize" label="覆盖原文件" required>
            <el-radio-group v-model="uploadForm.overwriteOriginal">
              <el-radio :label="true">是 - 直接覆盖原文件</el-radio>
              <el-radio :label="false">否 - 保存为新文件</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>
      </div>

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
            <el-descriptions-item label="文件大小">
              {{ currentPreview.size }}
              <span v-if="currentPreview.isOptimized && currentPreview.optimizedSize" style="color: #67c23a; font-size: 12px; margin-left: 5px">
                (优化后: {{ currentPreview.optimizedSize }})
              </span>
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

    <!-- 手动优化对话框 -->
    <el-dialog
      v-model="showOptimizeDialog"
      title="优化TIF文件"
      width="600px"
      :close-on-click-modal="false"
    >
      <div v-if="currentOptimizeImage" style="margin-bottom: 20px">
        <el-alert type="info" :closable="false">
          <template #title>
            <div style="font-size: 14px">
              <strong>当前文件：</strong>{{ currentOptimizeImage.name }}<br/>
              <strong>文件大小：</strong>{{ currentOptimizeImage.size }}<br/>
              <strong>说明：</strong>优化将进行投影转换(EPSG:3857)、LZW压缩、添加金字塔，文件大小通常可减少80-95%
            </div>
          </template>
        </el-alert>
      </div>

      <el-form :model="optimizeForm" label-width="120px">
        <el-form-item label="是否覆盖原文件" required>
          <el-radio-group v-model="optimizeForm.overwriteOriginal">
            <el-radio :label="true">是 - 直接覆盖原文件</el-radio>
            <el-radio :label="false">否 - 保存为新文件</el-radio>
          </el-radio-group>
          <div style="color: #999; font-size: 12px; margin-top: 5px">
            ⚠️ 覆盖原文件后无法恢复
          </div>
        </el-form-item>

        <el-form-item v-if="!optimizeForm.overwriteOriginal" label="优化文件名">
          <el-input 
            v-model="optimizeForm.customFileName" 
            placeholder="默认为原文件名 + _optimized"
          >
            <template #append>.tif</template>
          </el-input>
          <div style="color: #999; font-size: 12px; margin-top: 5px">
            留空则自动在原文件名后添加 _optimized 后缀
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showOptimizeDialog = false">取消</el-button>
        <el-button type="primary" :loading="optimizing" @click="handleConfirmOptimize">
          {{ optimizing ? '优化中...' : '开始优化' }}
        </el-button>
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
          <el-select v-model="editForm.region" placeholder="选择区域" style="width: 100%" clearable>
            <el-option label="包头湖" value="包头湖" />
            <el-option label="经济牧场" value="经济牧场" />
            <el-option label="库尔楚" value="库尔楚" />
            <el-option label="普惠牧场" value="普惠牧场" />
            <el-option label="普惠农场" value="普惠农场" />
            <el-option label="原种场" value="原种场" />
          </el-select>
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

    <!-- 编辑识别结果对话框 -->
    <el-dialog
      v-model="showEditRecognitionDialog"
      title="编辑识别结果信息"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form :model="editRecognitionForm" label-width="120px">
        <el-form-item label="文件名称">
          <el-input v-model="editRecognitionForm.name" disabled />
        </el-form-item>
        
        <el-form-item label="年份" required>
          <el-select v-model="editRecognitionForm.year" placeholder="选择年份" style="width: 100%" clearable>
            <el-option
              v-for="year in [2020, 2021, 2022, 2023, 2024, 2025]"
              :key="year"
              :label="`${year}年`"
              :value="year"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="期次" required>
          <el-select v-model="editRecognitionForm.period" placeholder="选择期次" style="width: 100%" clearable>
            <el-option
              v-for="period in [1, 2, 3, 4, 5, 6]"
              :key="period"
              :label="`第${period}期`"
              :value="period"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="区域" required>
          <el-select v-model="editRecognitionForm.regionCode" placeholder="选择区域" style="width: 100%" clearable>
            <el-option label="包头湖" value="BTH" />
            <el-option label="经济牧场" value="JJMC" />
            <el-option label="库尔楚" value="KEC" />
            <el-option label="普惠牧场" value="PHMC" />
            <el-option label="普惠农场" value="PHNC" />
            <el-option label="原种场" value="YZC" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="来源任务" required>
          <el-select v-model="editRecognitionForm.recognitionType" placeholder="选择来源任务" style="width: 100%" clearable>
            <el-option label="作物识别" value="crop_recognition" />
            <el-option label="种植情况识别" value="planting_situation" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="任务名称">
          <el-input v-model="editRecognitionForm.taskName" placeholder="输入任务名称" maxlength="100" />
        </el-form-item>
        
        <el-alert
          title="提示"
          type="info"
          :closable="false"
          style="margin-top: 10px;"
        >
          <div style="font-size: 13px;">
            修改后将自动生成或更新同名的JSON元数据文件，用于保存这些信息。
          </div>
        </el-alert>
      </el-form>
      
      <template #footer>
        <el-button @click="showEditRecognitionDialog = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="handleSaveRecognitionEdit"
          :loading="savingRecognitionEdit"
        >
          保存
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
        <div>支持上传：<el-tag size="small" style="margin: 0 5px;">SHP (ZIP压缩包)</el-tag><el-tag size="small" style="margin: 0 5px;">GeoJSON</el-tag><el-tag size="small" style="margin: 0 5px;">JSON</el-tag><el-tag size="small" style="margin: 0 5px;">KMZ</el-tag></div>
        <div style="margin-top: 5px;">文件大小限制：500MB</div>
        <div style="margin-top: 8px; padding: 8px; background: #fff3cd; border-radius: 4px; border: 1px solid #ffc107;">
          <strong style="color: #856404;">📦 重要提示：</strong>
          <div style="color: #856404; font-size: 13px; margin-top: 4px;">
            • SHP文件需要将整个文件夹（包含.shp, .shx, .dbf, .prj等所有文件）打包成<strong>ZIP压缩包</strong>后上传<br/>
            • ZIP文件名将作为文件夹名称保存，建议使用有意义的名称（如：YZC_2024_1.zip）<br/>
            • 其他格式文件可直接上传
          </div>
        </div>
      </el-alert>

      <el-upload
        ref="resultUploadRef"
        :auto-upload="false"
        :on-change="handleResultFileChange"
        :on-remove="handleResultFileRemove"
        :file-list="resultFileList"
        drag
        multiple
        accept=".zip,.geojson,.json,.kmz"
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
          type="success"
          :closable="false"
        >
          <div style="color: #666;">
            总大小: {{ formatTotalSize(resultFileList) }}
          </div>
        </el-alert>
      </div>
        
      <!-- 🆕 元数据填写表单 - 始终显示，不管是否选择文件 -->
      <el-divider content-position="left" style="margin-top: 20px;">
        <span style="font-size: 14px; color: #303133; font-weight: 600;">
          📝 文件信息（可选，建议填写）
        </span>
      </el-divider>
      
      <el-form :model="uploadMetadataForm" label-width="90px" size="default">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="年份">
              <el-select v-model="uploadMetadataForm.year" placeholder="选择年份" clearable style="width: 100%">
                <el-option
                  v-for="year in [2020, 2021, 2022, 2023, 2024, 2025]"
                  :key="year"
                  :label="`${year}年`"
                  :value="year"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="期次">
              <el-select v-model="uploadMetadataForm.period" placeholder="选择期次" clearable style="width: 100%">
                <el-option
                  v-for="period in [1, 2, 3, 4, 5, 6]"
                  :key="period"
                  :label="`第${period}期`"
                  :value="period"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="区域">
              <el-select v-model="uploadMetadataForm.regionCode" placeholder="选择区域" clearable style="width: 100%">
                <el-option label="包头湖" value="BTH" />
                <el-option label="经济牧场" value="JJMC" />
                <el-option label="库尔楚" value="KEC" />
                <el-option label="普惠牧场" value="PHMC" />
                <el-option label="普惠农场" value="PHNC" />
                <el-option label="原种场" value="YZC" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="来源任务">
              <el-select v-model="uploadMetadataForm.recognitionType" placeholder="选择任务" clearable style="width: 100%">
                <el-option label="作物识别" value="crop_recognition" />
                <el-option label="种植情况识别" value="planting_situation" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="任务名称">
          <el-input 
            v-model="uploadMetadataForm.taskName" 
            placeholder="输入任务名称（可选）" 
            maxlength="100" 
            clearable
          />
        </el-form-item>
        
        <el-alert
          title="💡 提示"
          type="info"
          :closable="false"
          style="margin-top: 10px;"
        >
          <div style="font-size: 12px; color: #666;">
            以上信息为可选项，填写后会随文件一起保存，便于在监测主控台进行筛选和管理。如果不填写，系统会使用默认值。
          </div>
        </el-alert>
      </el-form>

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
import { Upload, Download, Trash2, Search, Image, List, Grid3X3, Upload as UploadIcon, File, X, Edit, Settings, FileArchive, RefreshCw, Eye, Zap } from 'lucide-vue-next'
import { Picture, DataAnalysis, SuccessFilled, InfoFilled, Check, Clock, Warning, QuestionFilled, Document, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { useAnalysisStore } from '@/stores/analysis'
import { getImageList, refreshImageList, uploadImage, updateImage, deleteImage, batchDeleteImage, optimizeImage } from '@/api/image'
import { 
  getRecognitionResults, 
  convertShpToGeojson, 
  downloadAnalysisFile, 
  deleteAnalysisFile,
  getSavedAnalysisResults,
  loadAnalysisResult,
  downloadReport,
  deleteAnalysisResult,
  saveRecognitionMetadata
} from '@/api/analysis'
import * as GeoTIFF from 'geotiff'

const router = useRouter()
const analysisStore = useAnalysisStore()

const searchKeyword = ref('')
const viewMode = ref('table')
const currentPage = ref(1)
const pageSize = ref(10)
const showUploadDialog = ref(false)
const uploading = ref(false)
const uploadFiles = ref([])
const selectedRows = ref([])
const loading = ref(false)

// 🆕 多文件上传模式
const uploadMode = ref('batch') // 'batch': 批量填写, 'individual': 逐个填写
const currentFileIndex = ref(0) // 当前正在编辑的文件索引（逐个模式）
const fileMetadataList = ref([]) // 每个文件的元数据列表
const showPreviewDialog = ref(false)
const showOptimizeDialog = ref(false)  // 手动优化对话框

// 自动刷新定时器（用于检测优化完成）
const autoRefreshTimer = ref(null)
const autoRefreshEnabled = ref(false)

// 记录上次的优化状态，用于检测变化
const lastOptimizationStatus = ref(new Map())

// 记录正在优化的文件ID（只有这些文件才显示"处理中"）
const optimizingFileIds = ref(new Set())
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
const analysisResultsLoading = ref(false) // 分析结果加载状态

// 搜索关键词
const resultSearchKeyword = ref('')
const analysisSearchKeyword = ref('') // 分析结果搜索关键词

// 分析结果筛选表单
const analysisFilterForm = ref({
  format: ''  // 格式筛选
})

// 结果队列选中的行
const selectedResultRows = ref([])

// 识别结果筛选表单
const recognitionFilterForm = ref({
  format: '',  // 格式筛选
  region: '',  // 区域筛选
  recognitionType: ''  // 识别任务类型筛选
})

// 过滤后的识别结果（computed，实时响应搜索和格式筛选）
const filteredRecognitionResults = computed(() => {
  let data = [...recognitionResults.value]
  
  // 格式筛选
  if (recognitionFilterForm.value.format) {
    data = data.filter(item => 
      item.type && item.type.toUpperCase() === recognitionFilterForm.value.format
    )
  }
  
  // 区域筛选
  if (recognitionFilterForm.value.region) {
    data = data.filter(item => 
      item.regionName && item.regionName === recognitionFilterForm.value.region
    )
  }
  
  // 识别任务类型筛选
  if (recognitionFilterForm.value.recognitionType) {
    data = data.filter(item => 
      item.recognitionType && item.recognitionType === recognitionFilterForm.value.recognitionType
    )
  }
  
  // 关键词搜索
  if (resultSearchKeyword.value) {
    const keyword = resultSearchKeyword.value.toLowerCase().trim()
    data = data.filter(item => 
      item.name.toLowerCase().includes(keyword) ||
      (item.taskName && item.taskName.toLowerCase().includes(keyword)) ||
      (item.type && item.type.toLowerCase().includes(keyword)) ||
      (item.regionName && item.regionName.toLowerCase().includes(keyword))
    )
  }
  
  return data
})

// 过滤后的分析结果（computed，实时响应搜索和格式筛选）
const filteredAnalysisResults = computed(() => {
  let data = [...analysisResults.value]
  
  // 格式筛选
  if (analysisFilterForm.value.format) {
    data = data.filter(item => item.format === analysisFilterForm.value.format)
  }
  
  // 关键词搜索
  if (analysisSearchKeyword.value) {
    const keyword = analysisSearchKeyword.value.toLowerCase().trim()
    data = data.filter(item => 
      (item.filename && item.filename.toLowerCase().includes(keyword)) ||
      (item.type && item.type.toLowerCase().includes(keyword))
    )
  }
  
  return data
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

// 🆕 上传文件的元数据表单
const uploadMetadataForm = ref({
  year: null,
  period: null,
  regionCode: '',
  recognitionType: '',
  taskName: ''
})

// 编辑识别结果相关
const showEditRecognitionDialog = ref(false)
const savingRecognitionEdit = ref(false)
const editRecognitionForm = ref({
  id: '',
  name: '',
  year: '',
  period: '',
  regionCode: '',
  recognitionType: '',
  taskName: '',
  relativePath: ''
})

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
  analysisResultsLoading.value = true
  
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
    
    // 从后端API加载分析结果（扫描data_analysis_results目录）
    try {
      const response = await getSavedAnalysisResults()
      if (response.code === 200) {
        analysisResults.value = response.data || []
        console.log('✅ 从后端加载分析结果:', analysisResults.value.length, '个')
      }
    } catch (error) {
      console.error('从后端加载分析结果失败:', error)
      analysisResults.value = []
    }
  } catch (error) {
    console.error('加载结果队列失败:', error)
    recognitionResults.value = []
    analysisResults.value = []
  } finally {
    analysisResultsLoading.value = false
  }
}

// 兼容旧方法名
const loadAnalysisResults = loadAllResults

// 获取分析类型标签
const getAnalysisTypeLabel = (type) => {
  const map = {
    difference: '差异检测',
    temporal: '时序变化',
    statistics: '统计汇总',
    recognition: '识别结果'
  }
  return map[type] || type
}

// 获取文件类型标签颜色
const getFileTypeTagType = (type) => {
  const map = {
    'SHP': 'success',
    'KMZ': 'warning',
    'EXCEL': 'primary',
    'CSV': 'info',
    'GEOJSON': 'success'
  }
  return map[type] || 'info'
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
  const validExtensions = ['.zip', '.geojson', '.json', '.kmz']
  const isValidType = validExtensions.some(ext => fileName.endsWith(ext))
  
  if (!isValidType) {
    ElMessage.error(`不支持的文件格式: ${file.name}，请上传 .zip（SHP文件夹压缩包）、.geojson、.json 或 .kmz 文件`)
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
  // 🆕 重置元数据表单
  uploadMetadataForm.value = {
    year: null,
    period: null,
    regionCode: '',
    recognitionType: '',
    taskName: ''
  }
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
        
        // 🆕 如果填写了元数据，一起发送给后端
        const hasMetadata = uploadMetadataForm.value.year || 
                          uploadMetadataForm.value.period || 
                          uploadMetadataForm.value.regionCode || 
                          uploadMetadataForm.value.recognitionType || 
                          uploadMetadataForm.value.taskName
        
        if (hasMetadata) {
          // 区域代码到名称的映射
          const regionCodeToName = {
            'BTH': '包头湖',
            'JJMC': '经济牧场',
            'KEC': '库尔楚',
            'PHMC': '普惠牧场',
            'PHNC': '普惠农场',
            'YZC': '原种场'
          }
          
          const metadata = {
            year: uploadMetadataForm.value.year,
            period: uploadMetadataForm.value.period,
            regionCode: uploadMetadataForm.value.regionCode,
            regionName: regionCodeToName[uploadMetadataForm.value.regionCode],
            recognitionType: uploadMetadataForm.value.recognitionType,
            taskName: uploadMetadataForm.value.taskName
          }
          
          // 将元数据作为JSON字符串发送
          formData.append('metadata', JSON.stringify(metadata))
        }
        
        // 🔧 修复：使用相对路径，让 Nginx 代理转发到后端
        const response = await fetch('/api/analysis/upload', {
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
    
    // 关闭对话框并重置表单
    resultFileList.value = []
    showResultUploadDialog.value = false
    uploadMetadataForm.value = {
      year: null,
      period: null,
      regionCode: '',
      recognitionType: '',
      taskName: ''
    }
    
  } catch (error) {
    console.error('上传过程出错:', error)
    ElMessage.error('上传失败: ' + error.message)
  } finally {
    isUploading.value = false
  }
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
  size: '',
  uploadTime: '',
  description: ''
})

// 手动优化相关状态
const currentOptimizeImage = ref(null)
const optimizeForm = ref({
  overwriteOriginal: false,
  customFileName: ''
})
const optimizing = ref(false)

const filterForm = ref({
  dateRange: [],
  sensor: '',
  optimizationStatus: '', // 优化状态筛选：all/optimized/unoptimized/processing/result
  region: '' // 🆕 区域筛选
})

// 上传表单数据
const uploadForm = ref({
  year: '',
  month: '',
  period: '',
  region: '',
  sensor: '',
  description: '',
  needOptimize: false, // 是否优化（默认不优化，保留原始文件）
  overwriteOriginal: false, // 是否覆盖原文件（默认不覆盖）
  optimizedFileName: '' // 优化后的文件名（留空则自动添加_optimized）
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
  
  // 🆕 区域过滤
  if (filterForm.value.region) {
    data = data.filter(item => item.region && item.region.toLowerCase().includes(filterForm.value.region.toLowerCase()))
  }
  
  // 时间范围过滤
  if (filterForm.value.dateRange && filterForm.value.dateRange.length === 2) {
    const [start, end] = filterForm.value.dateRange
    data = data.filter(item => {
      const itemDate = new Date(item.date)
      return itemDate >= start && itemDate <= end
    })
  }
  
  // 优化状态过滤
  if (filterForm.value.optimizationStatus) {
    const status = filterForm.value.optimizationStatus
    data = data.filter(item => {
      if (status === 'optimized') {
        // 已优化（包括优化结果）
        return item.isOptimized === true || item.isOptimizedResult === true
      } else if (status === 'processing') {
        // 处理中
        return optimizingFileIds.value.has(item.id)
      } else if (status === 'unoptimized') {
        // 未优化
        return !item.isOptimized && !item.isOptimizedResult && !optimizingFileIds.value.has(item.id)
      }
      return true
    })
  }
  
  // 按上传时间排序（升序，最早的在前面）
  data.sort((a, b) => {
    const aTime = new Date(a.uploadTime || 0).getTime()
    const bTime = new Date(b.uploadTime || 0).getTime()
    return aTime - bTime  // 升序：最早的在前面
  })
  
  // ✅ 添加显示序号（1,2,3...），但保留真实ID用于操作
  data = data.map((item, index) => ({
    ...item,
    displayIndex: index + 1  // 显示序号（从1开始）
  }))
  
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

// 🆕 从数据中提取可用的区域列表
const availableRegions = computed(() => {
  const regions = new Set()
  allData.value.forEach(item => {
    if (item.region && item.region.trim()) {
      regions.add(item.region.trim())
    }
  })
  return Array.from(regions).sort()
})

// 加载影像列表
const loadImageList = async (silent = false) => {
  try {
    if (!silent) loading.value = true
    const res = await getImageList()
    const newData = res.data || []
    
    // 🆕 显示缓存信息
    if (res.cached && !silent) {
      console.log(`✅ 使用缓存数据（${res.cacheAge}秒前）`)
      // 可选：显示轻量级提示
      // ElMessage.info({ message: `数据已缓存 (${res.cacheAge}秒前)`, duration: 1500 })
    } else if (!silent) {
      console.log('🔄 已从服务器同步最新数据')
    }
    
    // 检测优化状态变化
    if (autoRefreshEnabled.value) {
      newData.forEach(image => {
        const lastStatus = lastOptimizationStatus.value.get(image.id)
        const currentStatus = image.isOptimized || image.isOptimizedResult
        
        // 检测优化结果文件的出现（isOptimizedResult为新生成的优化文件）
        if (image.isOptimizedResult && image.sourceFileId && optimizingFileIds.value.has(image.sourceFileId)) {
          ElNotification({
            title: '✅ 优化完成',
            message: `${image.description || image.name}\n原始: ${image.originalSize}\n优化后: ${image.optimizedSize}\n可以在监测主控台流畅使用了！`,
            type: 'success',
            duration: 10000,
            position: 'bottom-right'
          })
          
          // 从优化列表中移除原文件ID
          optimizingFileIds.value.delete(image.sourceFileId)
          console.log(`✅ 优化完成，移除源文件ID: ${image.sourceFileId}`)
          console.log(`📄 生成优化文件: ${image.id} - ${image.name}`)
        }
        // 检测覆盖原文件的情况（直接优化）
        else if (lastStatus === false && currentStatus === true && optimizingFileIds.value.has(image.id) && !image.isOptimizedResult) {
          ElNotification({
            title: '✅ 优化完成',
            message: `${image.name}\n原始: ${image.originalSize || image.size}\n优化后: ${image.optimizedSize}\n已覆盖原文件！`,
            type: 'success',
            duration: 10000,
            position: 'bottom-right'
          })
          
          // 从优化列表中移除
          optimizingFileIds.value.delete(image.id)
          console.log(`✅ 优化完成（覆盖），移除ID: ${image.id}`)
        }
        
        // 更新状态记录
        lastOptimizationStatus.value.set(image.id, currentStatus)
      })
    }
    
    allData.value = newData
  } catch (error) {
    console.error('加载影像列表失败：', error)
    if (!silent) ElMessage.error('加载影像列表失败')
  } finally {
    if (!silent) loading.value = false
  }
}

// 开始自动刷新（用于监测优化完成）
const startAutoRefresh = () => {
  if (autoRefreshTimer.value) {
    clearInterval(autoRefreshTimer.value)
  }
  
  autoRefreshEnabled.value = true
  
  // ✅ 提升响应速度：每5秒静默刷新一次，及时检测优化完成
  autoRefreshTimer.value = setInterval(() => {
    loadImageList(true) // silent = true，不显示加载状态
    
    // ✅ 如果所有优化都完成了，自动停止刷新
    if (optimizingFileIds.value.size === 0) {
      console.log('✅ 所有优化已完成，停止自动刷新')
      stopAutoRefresh()
    }
  }, 5000)  // 从30秒改为5秒，提升响应速度
  
  console.log('🔄 已启动自动刷新（每5秒检测优化状态）')
}

// 停止自动刷新
const stopAutoRefresh = () => {
  if (autoRefreshTimer.value) {
    clearInterval(autoRefreshTimer.value)
    autoRefreshTimer.value = null
  }
  autoRefreshEnabled.value = false
  console.log('⏹️ 已停止自动刷新')
}

// 刷新列表（强制从服务器重新同步，并重置所有筛选条件）
const handleRefresh = async () => {
  try {
    loading.value = true
    
    // 🔧 修复：重置所有筛选条件
    searchKeyword.value = ''
    filterForm.value = {
      dateRange: [],
      sensor: '',
      optimizationStatus: '',
      region: ''
    }
    currentPage.value = 1
    
    // 🆕 使用强制刷新API，清除后端缓存
    const res = await refreshImageList()
    allData.value = res.data || []
    
    console.log('🔄 强制刷新完成，已从服务器同步最新数据并重置筛选条件')
    ElMessage.success('刷新成功，已重置所有筛选条件')
  } catch (error) {
    console.error('刷新失败：', error)
    ElMessage.error('刷新失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  ElMessage.success('搜索完成')
}

const resetFilter = () => {
  // 🔧 修复：重置所有筛选条件，包括搜索框和区域
  searchKeyword.value = ''
  filterForm.value = {
    dateRange: [],
    sensor: '',
    optimizationStatus: '',
    region: ''
  }
  currentPage.value = 1
  ElMessage.success('所有筛选条件已重置')
}

// 重置识别结果筛选条件
const resetRecognitionFilter = () => {
  recognitionFilterForm.value = {
    format: '',
    region: '',
    recognitionType: ''
  }
  resultSearchKeyword.value = ''
  recognitionCurrentPage.value = 1
  ElMessage.success('筛选条件已重置')
}

// 获取识别任务类型标签
const getRecognitionTypeLabel = (recognitionType) => {
  if (!recognitionType) return '未知任务'
  
  const typeMap = {
    'crop_recognition': '作物识别',
    'planting_situation': '种植情况识别',
    // 兼容旧版
    'crop_info': '作物识别',
    'planting_status': '种植情况识别'
  }
  
  return typeMap[recognitionType] || '未知任务'
}

// 编辑识别结果
const handleEditRecognitionResult = (row) => {
  // 区域名称映射回区域代码
  const regionNameToCode = {
    '包头湖': 'BTH',
    '经济牧场': 'JJMC',
    '库尔楚': 'KEC',
    '普惠牧场': 'PHMC',
    '普惠农场': 'PHNC',
    '原种场': 'YZC'
  }
  
  editRecognitionForm.value = {
    id: row.id,
    name: row.name,
    year: row.year || '',
    period: row.period || '',
    regionCode: row.regionCode || regionNameToCode[row.regionName] || '',
    recognitionType: row.recognitionType || 'crop_recognition',
    taskName: row.taskName || '',
    relativePath: row.relativePath || ''
  }
  
  showEditRecognitionDialog.value = true
}

// 保存识别结果编辑
const handleSaveRecognitionEdit = async () => {
  // 验证必填项
  if (!editRecognitionForm.value.year || !editRecognitionForm.value.period || !editRecognitionForm.value.regionCode) {
    ElMessage.warning('请填写年份、期次和区域')
    return
  }
  
  savingRecognitionEdit.value = true
  
  try {
    // 准备元数据
    const regionCodeToName = {
      'BTH': '包头湖',
      'JJMC': '经济牧场',
      'KEC': '库尔楚',
      'PHMC': '普惠牧场',
      'PHNC': '普惠农场',
      'YZC': '原种场'
    }
    
    const metadata = {
      year: editRecognitionForm.value.year,
      period: editRecognitionForm.value.period,
      regionCode: editRecognitionForm.value.regionCode,
      regionName: regionCodeToName[editRecognitionForm.value.regionCode],
      recognitionType: editRecognitionForm.value.recognitionType,
      taskName: editRecognitionForm.value.taskName || `${editRecognitionForm.value.year}年第${editRecognitionForm.value.period}期${regionCodeToName[editRecognitionForm.value.regionCode]}`,
      updatedAt: new Date().toISOString()
    }
    
    // 调用后端API保存元数据
    const response = await saveRecognitionMetadata(
      editRecognitionForm.value.name,
      editRecognitionForm.value.relativePath,
      metadata
    )
    
    if (response.code === 200) {
      ElMessage.success('保存成功')
      showEditRecognitionDialog.value = false
      
      // 刷新列表
      await loadAllResults()
    } else {
      ElMessage.error('保存失败: ' + (response.message || '未知错误'))
    }
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败: ' + (error.message || '网络错误'))
  } finally {
    savingRecognitionEdit.value = false
  }
}

// 重置分析结果筛选条件
const resetAnalysisFilter = () => {
  analysisFilterForm.value = {
    format: ''
  }
  analysisSearchKeyword.value = ''
  analysisCurrentPage.value = 1
  ElMessage.success('筛选条件已重置')
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

// 打开优化对话框
const handleOptimize = (row) => {
  currentOptimizeImage.value = row
  optimizeForm.value = {
    overwriteOriginal: false,
    customFileName: ''
  }
  showOptimizeDialog.value = true
}

// 确认优化
const handleConfirmOptimize = async () => {
  if (!currentOptimizeImage.value) return
  
  try {
    optimizing.value = true
    
    // ✅ 在不覆盖原文件的情况下，检查文件名冲突
    if (!optimizeForm.value.overwriteOriginal) {
      const customFileName = optimizeForm.value.customFileName
      const defaultFileName = currentOptimizeImage.value.name.replace(/\.tif$/i, '_optimized.tif')
      const finalFileName = customFileName ? `${customFileName}.tif` : defaultFileName
      
      // 检查文件名是否已存在
      const existingFile = allData.value.find(img => img.name === finalFileName)
      if (existingFile) {
        // ✅ 文件名冲突，提示用户
        await ElMessageBox.confirm(
          `优化文件"${finalFileName}"已存在。\n\n是否替换已有的优化文件？\n\n✅ 确定：将删除旧的优化文件，生成新的\n❌ 取消：您可以修改自定义文件名或选择覆盖原文件`,
          '优化文件已存在',
          {
            confirmButtonText: '替换已有文件',
            cancelButtonText: '取消',
            type: 'warning',
            distinguishCancelAndClose: true
          }
        )
        
        // 用户选择替换已有文件，继续优化（后端会自动删除旧文件）
        // 不需要设置 overwriteOriginal = true
      }
    }
    
    // 调用优化API
    const response = await optimizeImage(currentOptimizeImage.value.id, {
      overwriteOriginal: optimizeForm.value.overwriteOriginal,
      customFileName: optimizeForm.value.customFileName
    })
    
    if (response.code === 200) {
      ElNotification({
        title: '✅ 优化已启动',
        message: '系统正在后台优化文件，通常需要1-10分钟，完成后会自动通知您',
        type: 'success',
        duration: 8000,
        position: 'bottom-right'
      })
      
      // 添加到优化监测列表
      optimizingFileIds.value.add(currentOptimizeImage.value.id)
      lastOptimizationStatus.value.set(currentOptimizeImage.value.id, false)
      
      // 启动自动刷新，监测优化完成
      startAutoRefresh()
      
      showOptimizeDialog.value = false
    } else {
      // ✅ 处理后端返回的冲突错误
      if (response.message && response.message.includes('文件名冲突')) {
        ElMessageBox.alert(
          response.message + '\n\n请修改自定义文件名或选择覆盖原文件。',
          '文件名冲突',
          {
            confirmButtonText: '知道了',
            type: 'warning'
          }
        )
      } else {
        ElMessage.error('优化失败: ' + (response.message || '未知错误'))
      }
    }
  } catch (error) {
    console.error('优化失败：', error)
    // ✅ 用户取消了冲突对话框
    if (error === 'cancel' || error === 'close') {
      ElMessage.info('已取消优化')
    } else if (error.message && error.message.includes('文件名冲突')) {
      ElMessageBox.alert(
        error.message + '\n\n请修改自定义文件名或选择覆盖原文件。',
        '文件名冲突',
        {
          confirmButtonText: '知道了',
          type: 'warning'
        }
      )
    } else {
      ElMessage.error('优化失败：' + (error.message || '未知错误'))
    }
  } finally {
    optimizing.value = false
  }
}

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
    size: row.size,
    uploadTime: row.uploadTime,
    description: row.description || ''
  }
  showEditDialog.value = true
}

// 保存编辑
const handleSaveEdit = async () => {
  try {
    // 验证必填字段
    if (!editForm.value.year || !editForm.value.period || !editForm.value.cropType) {
      ElMessage.warning('请填写年份、期次和作物类型')
      return
    }
    
    // 🔧 修复：调用后端API保存数据（持久化到imageData.json）
    const updateData = {
      year: editForm.value.year,
      period: editForm.value.period,
      cropType: editForm.value.cropType,
      region: editForm.value.region,
      sensor: editForm.value.sensor,
      date: editForm.value.date,
      description: editForm.value.description
    }
    
    // 调用后端更新接口
    const response = await updateImage(editForm.value.id, updateData)
    
    if (response.code === 200) {
      ElMessage.success('修改成功')
      showEditDialog.value = false
      
      // ✅ 直接更新前端列表中的数据（不触发全量同步）
      const index = allData.value.findIndex(img => img.id === editForm.value.id)
      if (index >= 0) {
        allData.value[index] = {
          ...allData.value[index],
          ...updateData
        }
      }
    } else {
      ElMessage.error('保存失败: ' + (response.message || '未知错误'))
    }
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败：' + (error.message || '网络错误'))
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
      
      // ✅ 直接从前端列表中移除（不触发全量同步）
      allData.value = allData.value.filter(img => img.id !== row.id)
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
      
      // ✅ 直接从前端列表中移除（不触发全量同步）
      allData.value = allData.value.filter(img => !ids.includes(img.id))
      selectedRows.value = []
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
  
  // 🆕 从文件名自动识别年份和月份
  const autoMetadata = parseFileNameMetadata(file.name)
  
  // 🆕 初始化该文件的元数据（逐个模式使用）
  fileMetadataList.value.push({
    year: autoMetadata.year || '',
    month: autoMetadata.month || '',
    period: '',
    region: '',
    sensor: '',
    description: ''
  })
  
  // 🆕 如果是第一个文件，自动填充批量表单
  if (uploadFiles.value.length === 1 && autoMetadata.year) {
    uploadForm.value.year = autoMetadata.year
    if (autoMetadata.month) {
      uploadForm.value.month = autoMetadata.month
    }
  }
  
  ElMessage.success(` 已添加: ${file.name}`)
}

const removeFile = (index) => {
  uploadFiles.value.splice(index, 1)
  // 🆕 同时删除对应的元数据
  fileMetadataList.value.splice(index, 1)
  // 如果当前选中的索引超出范围，调整到最后一个
  if (currentFileIndex.value >= uploadFiles.value.length) {
    currentFileIndex.value = Math.max(0, uploadFiles.value.length - 1)
  }
}

// 🆕 从文件名自动识别年份和月份
const parseFileNameMetadata = (filename) => {
  const result = {
    year: '',
    month: ''
  }
  
  // 移除文件扩展名
  const nameWithoutExt = filename.replace(/\.(tif|tiff|img|jp2)$/i, '')
  
  // 尝试匹配各种日期格式
  // 格式1: YYYYMMDD (如: BTH20250611RGB.tif → 20250611)
  let match = nameWithoutExt.match(/(\d{4})(\d{2})(\d{2})/)
  if (match) {
    result.year = match[1]
    result.month = match[2]
    return result
  }
  
  // 格式2: YYYY_MM (如: 2024_06_data.tif)
  match = nameWithoutExt.match(/(\d{4})[_-](\d{2})/)
  if (match) {
    result.year = match[1]
    result.month = match[2]
    return result
  }
  
  // 格式3: YYYY-MM-DD (如: 2024-06-11_data.tif)
  match = nameWithoutExt.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    result.year = match[1]
    result.month = match[2]
    return result
  }
  
  // 格式4: 只有年份 (如: 2024_kle_vh_kndvi.tif)
  match = nameWithoutExt.match(/(\d{4})/)
  if (match) {
    result.year = match[1]
    // 月份留空
    return result
  }
  
  return result
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
  
  // 🆕 根据上传模式进行不同的验证
  if (uploadMode.value === 'batch') {
    // 批量模式：验证批量表单
    if (!uploadForm.value.year) {
      ElMessage.warning('请选择年份')
      return
    }
    if (!uploadForm.value.month) {
      ElMessage.warning('请选择月份')
      return
    }
    if (!uploadForm.value.period) {
      ElMessage.warning('请选择期次')
      return
    }
  } else {
    // 逐个模式：验证每个文件的元数据
    for (let i = 0; i < fileMetadataList.value.length; i++) {
      const meta = fileMetadataList.value[i]
      if (!meta.year) {
        ElMessage.warning(`文件${i + 1}（${uploadFiles.value[i].name}）缺少年份信息`)
        currentFileIndex.value = i // 跳转到该文件
        return
      }
      if (!meta.month) {
        ElMessage.warning(`文件${i + 1}（${uploadFiles.value[i].name}）缺少月份信息`)
        currentFileIndex.value = i
        return
      }
      if (!meta.period) {
        ElMessage.warning(`文件${i + 1}（${uploadFiles.value[i].name}）缺少期次信息`)
        currentFileIndex.value = i
        return
      }
    }
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
  
  // ✅ 检查优化文件名冲突（当启用自动优化且不覆盖原文件时）
  if (uploadForm.value.needOptimize && !uploadForm.value.overwriteOriginal) {
    const optimizedConflicts = []
    
    uploadFiles.value.forEach(file => {
      let optimizedName
      if (uploadForm.value.optimizedFileName) {
        // 如果有自定义文件名，多个文件会导致冲突
        if (uploadFiles.value.length > 1) {
          optimizedName = `${uploadForm.value.optimizedFileName}_${file.name}`
        } else {
          optimizedName = `${uploadForm.value.optimizedFileName}.tif`
        }
      } else {
        // 默认添加_optimized后缀
        optimizedName = file.name.replace(/\.(tif|tiff)$/i, '_optimized.tif')
      }
      
      // 检查优化后的文件名是否已存在
      const existing = allData.value.find(img => img.name === optimizedName)
      if (existing) {
        optimizedConflicts.push({ original: file.name, optimized: optimizedName })
      }
    })
    
    if (optimizedConflicts.length > 0) {
      const conflictList = optimizedConflicts.map(c => `  • ${c.original} → ${c.optimized}`).join('\n')
      const confirmMessage = `以下优化文件已存在：\n\n${conflictList}\n\n是否替换已有的优化文件？\n\n✅ 确定：将删除旧的优化文件，生成新的\n❌ 取消：您可以修改自定义文件名或取消自动优化`
      
      try {
        await ElMessageBox.confirm(confirmMessage, '优化文件已存在', {
          confirmButtonText: '替换已有文件',
          cancelButtonText: '取消上传',
          type: 'warning',
          distinguishCancelAndClose: true
        })
        
        // 用户选择替换已有文件，继续上传（后端会自动删除旧文件）
        // 不需要设置 overwriteOriginal = true
      } catch (error) {
        // 用户取消了
        ElMessage.info('已取消上传')
        return
      }
    }
  }
  
  // ✅ 提前声明通知变量，方便catch块访问
  let uploadingNotification = null
  
  try {
    uploading.value = true
    
    // 🆕 计算总文件大小，显示上传信息
    const totalSize = uploadFiles.value.reduce((sum, file) => sum + file.size, 0)
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2)
    
    // 🆕 显示上传提示（包含预估时间）
    let uploadEstimate = '预计需要几秒钟'
    if (totalSize > 100 * 1024 * 1024) { // 大于100MB
      uploadEstimate = '预计需要1-3分钟'
    } else if (totalSize > 500 * 1024 * 1024) { // 大于500MB
      uploadEstimate = '预计需要3-10分钟'
    }
    
    // ✅ 保存通知实例，以便稍后关闭
    uploadingNotification = ElNotification({
      title: '📤 正在上传',
      message: `正在上传 ${uploadFiles.value.length} 个文件（共${totalSizeMB}MB）\n${uploadEstimate}，请稍候...`,
      type: 'info',
      duration: 0, // 不自动关闭
      position: 'bottom-right'
    })
    
    const formData = new FormData()
    
    // 添加文件
    uploadFiles.value.forEach(file => {
      formData.append('files', file)
    })
    
    // 🆕 根据模式添加元数据
    if (uploadMode.value === 'batch') {
      // 批量模式：所有文件使用相同的元数据
      formData.append('year', uploadForm.value.year)
      formData.append('month', uploadForm.value.month)
      formData.append('period', uploadForm.value.period)
      formData.append('region', uploadForm.value.region || '')
      formData.append('sensor', uploadForm.value.sensor || '')
      formData.append('description', uploadForm.value.description || '')
    } else {
      // 逐个模式：每个文件有独立的元数据
      formData.append('uploadMode', 'individual')
      formData.append('fileMetadataList', JSON.stringify(fileMetadataList.value))
    }
    
    // 添加优化选项
    formData.append('needOptimize', uploadForm.value.needOptimize.toString())
    formData.append('overwriteOriginal', uploadForm.value.overwriteOriginal.toString())
    formData.append('optimizedFileName', uploadForm.value.optimizedFileName || '')
    
    const uploadResponse = await uploadImage(formData)
    
    // ✅ 关闭上传中的通知
    uploadingNotification.close()
    
    // ✅ 上传成功提示
    ElMessage.success({
      message: `成功上传 ${uploadFiles.value.length} 个文件`,
      duration: 3000
    })
    
    // ✅ 根据是否优化显示不同的提示
    if (uploadForm.value.needOptimize) {
      ElNotification({
        title: '🚀 自动优化中',
        message: uploadForm.value.overwriteOriginal 
          ? '影像文件已上传成功，系统正在后台自动优化并覆盖原文件（投影转换、压缩等）\n\n💡 优化通常需要1-10分钟，完成后会自动通知您'
          : '影像文件已上传成功，系统正在后台自动优化（投影转换、压缩等）\n\n💡 优化通常需要1-10分钟，完成后会自动通知您',
        type: 'info',
        duration: 10000,
        position: 'bottom-right'
      })
    } else {
      ElNotification({
        title: '✅ 上传完成',
        message: '影像文件已上传成功，已保留原始文件',
        type: 'success',
        duration: 5000,
        position: 'bottom-right'
      })
    }
    
    // ✅ 直接添加新文件到列表（不触发全量同步）
    if (uploadResponse.data && uploadResponse.data.images) {
      uploadResponse.data.images.forEach(newImage => {
        // 检查是否是覆盖已有文件
        const existingIndex = allData.value.findIndex(img => img.id === newImage.id)
        if (existingIndex >= 0) {
          // 更新现有文件
          allData.value[existingIndex] = newImage
        } else {
          // 添加新文件
          allData.value.push(newImage)
        }
        
        // 只有选择优化时才添加到优化列表
        if (uploadForm.value.needOptimize && !newImage.isOptimized) {
          optimizingFileIds.value.add(newImage.id)
          lastOptimizationStatus.value.set(newImage.id, false)
        }
      })
      
      // 启动自动刷新，监测优化完成
      if (uploadForm.value.needOptimize) {
        startAutoRefresh()
      }
    }
    
    showUploadDialog.value = false
    uploadFiles.value = []
    
    // 🆕 重置逐个模式的数据
    fileMetadataList.value = []
    currentFileIndex.value = 0
    uploadMode.value = 'batch'
    
    // 重置表单
    uploadForm.value = {
      year: '',
      month: '',
      period: '',
      region: '',
      sensor: '',
      description: '',
      needOptimize: false,
      overwriteOriginal: false,
      optimizedFileName: ''
    }
  } catch (error) {
    // ✅ 关闭上传中的通知（如果失败）
    if (uploadingNotification) {
      uploadingNotification.close()
    }
    
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
// ==================== 分析结果处理函数 ====================

// 获取分析类型文本
const getAnalysisTypeText = (type) => {
  const map = {
    'temporal': '时序分析',
    'difference': '差异检测'
  }
  return map[type] || type
}

// 获取分析类型标签颜色
const getAnalysisTypeTagType = (type) => {
  const map = {
    'temporal': 'warning',
    'difference': 'success'
  }
  return map[type] || 'info'
}

// 可视化分析结果（加载到地图）
const handleVisualizeResult = async (row) => {
  if (!row.canLoadToMap) {
    ElMessage.warning('此文件不支持可视化')
    return
  }

  const loadingMsg = ElMessage({
    message: '正在加载分析结果...',
    type: 'info',
    duration: 0
  })

  try {
    const response = await loadAnalysisResult(row.type, row.filename)
    
    if (response.code === 200) {
      // response.data 包含整个保存的JSON对象（包括version, id, type, metadata, data）
      // 我们需要提取其中的data字段传递给store
      const savedData = response.data
      const analysisData = savedData.data || savedData // 提取实际分析数据
      
      if (row.type === 'temporal') {
        analysisStore.setTemporalResult(analysisData)
      } else if (row.type === 'difference') {
        analysisStore.setDifferenceResult(analysisData)
      }
      
      loadingMsg.close()
      ElMessage.success('分析结果加载成功')
      
      // 跳转到结果查看页面
      await router.push({ 
        name: 'ResultCompare', 
        query: { mode: row.type === 'temporal' ? 'temporal' : 'difference' } 
      })
    } else {
      loadingMsg.close()
      ElMessage.error('加载失败: ' + (response.message || '未知错误'))
    }
  } catch (error) {
    loadingMsg.close()
    console.error('加载分析结果失败:', error)
    ElMessage.error('加载失败: ' + (error.message || '网络错误'))
  }
}

// 下载分析结果
const handleDownloadAnalysisResult = async (row) => {
  try {
    if (row.canLoadToMap) {
      // JSON格式，从服务器加载并下载
      const response = await loadAnalysisResult(row.type, row.filename)
      if (response.code === 200) {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = row.filename
        link.click()
        URL.revokeObjectURL(url)
        ElMessage.success('下载成功')
      }
    } else {
      // Excel格式，直接下载
      const response = await downloadReport(row.filename)
      const blob = new Blob([response], { type: 'application/vnd.ms-excel' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = row.filename
      link.click()
      URL.revokeObjectURL(url)
      ElMessage.success('下载成功')
    }
  } catch (error) {
    console.error('下载失败:', error)
    ElMessage.error('下载失败: ' + (error.message || '网络错误'))
  }
}

// 删除分析结果
const handleDeleteAnalysisResult = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除 ${row.filename} 吗？此操作将永久删除该文件！`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const response = await deleteAnalysisResult(row.type, row.filename)
    if (response.code === 200) {
      ElMessage.success('删除成功')
      await loadAllResults()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败: ' + (error.message || '网络错误'))
    }
  }
}

// ==================== 组件生命周期 ====================

onMounted(() => {
  loadImageList() // 加载影像列表
  loadAllResults() // 加载所有分析结果
})

// 组件卸载时清理定时器
onUnmounted(() => {
  stopAutoRefresh()
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

// 结果队列Tab样式
.result-queue-card {
  .card-title {
    display: flex;
    align-items: center;
    font-weight: 600;
    font-size: 15px;
  }
  
  .queue-tabs {
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

