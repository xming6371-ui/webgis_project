<template>
  <div class="report-container">
    <!-- 步骤条 -->
    <el-card class="steps-card" shadow="never">
      <el-steps :active="currentStep" finish-status="success" align-center>
        <el-step title="选择任务和数据" description="选择分析类型和数据来源" />
        <el-step title="查看报表" description="统计分析结果" />
      </el-steps>
    </el-card>

    <!-- 步骤1: 选择任务和数据 -->
    <el-card v-show="currentStep === 0" class="task-data-card" shadow="never">
      <!-- 第一部分：选择任务类型 -->
      <div class="section">
        <div class="section-header">
          <span class="section-title">
            <ListChecks :size="20" />
            1. 选择分析任务类型
          </span>
        </div>

        <el-radio-group v-model="taskType" size="large" class="task-selector">
          <el-card 
            class="task-option"
            :class="{ 'is-selected': taskType === 'planting' }"
            shadow="hover"
            @click="taskType = 'planting'"
          >
            <el-radio value="planting" size="large">
              <div class="task-content">
                <div class="task-icon">
                  <Sprout :size="32" />
                </div>
                <div class="task-info">
                  <h3>种植情况识别</h3>
                  <p>分析文件中的作物类别信息，统计各类作物的种植面积、分布情况等</p>
                  <el-space wrap style="margin-top: 10px">
                    <el-tag size="small" type="success">作物类型分布</el-tag>
                    <el-tag size="small" type="success">面积统计</el-tag>
                    <el-tag size="small" type="success">区域对比</el-tag>
                    <el-tag size="small" type="success">作物密度分析</el-tag>
                  </el-space>
                </div>
              </div>
            </el-radio>
          </el-card>

          <el-card 
            class="task-option"
            :class="{ 'is-selected': taskType === 'cultivation' }"
            shadow="hover"
            @click="taskType = 'cultivation'"
          >
            <el-radio value="cultivation" size="large">
              <div class="task-content">
                <div class="task-icon">
                  <ScanSearch :size="32" />
                </div>
                <div class="task-info">
                  <h3>作物识别</h3>
                  <p>识别区域内的种植/未种植状态，统计撂荒地、种植密度等信息</p>
                  <el-space wrap style="margin-top: 10px">
                    <el-tag size="small" type="warning">种植率统计</el-tag>
                    <el-tag size="small" type="warning">撂荒地分析</el-tag>
                    <el-tag size="small" type="warning">种植密度</el-tag>
                    <el-tag size="small" type="warning">区域覆盖率</el-tag>
                  </el-space>
                </div>
              </div>
            </el-radio>
          </el-card>
        </el-radio-group>
      </div>

      <!-- 第二部分：选择数据来源 -->
      <div class="section" v-if="taskType">
        <div class="section-header">
          <span class="section-title">
            <Database :size="20" />
            2. 选择数据来源
          </span>
        </div>

        <div class="data-source-selector">
          <el-card 
            class="source-option"
            :class="{ 'is-selected': dataSource === 'upload' }"
            shadow="hover"
            @click="dataSource = 'upload'"
          >
            <div class="source-content">
              <div class="source-icon">
                <Upload :size="28" />
              </div>
              <div class="source-text">
                <h4>上传新文件</h4>
                <p>支持 GeoJSON、SHP、KMZ 格式</p>
              </div>
            </div>
          </el-card>

          <el-card 
            class="source-option"
            :class="{ 'is-selected': dataSource === 'existing' }"
            shadow="hover"
            @click="dataSource = 'existing'; loadExistingFiles()"
          >
            <div class="source-content">
              <div class="source-icon">
                <FolderOpen :size="28" />
              </div>
              <div class="source-text">
                <h4>从识别结果选择</h4>
                <p>选择已有的{{ taskType === 'planting' ? '种植情况识别' : '作物识别' }}数据</p>
              </div>
            </div>
          </el-card>
        </div>

        <!-- 上传文件区域 -->
        <div v-if="dataSource === 'upload'" class="upload-section">
          <el-alert
            title="文件格式说明"
            type="info"
            :closable="false"
            style="margin-bottom: 20px"
          >
            <p>支持的文件格式：</p>
            <ul>
              <li><strong>推荐：GeoJSON</strong> (.geojson) - 可直接上传，处理速度最快</li>
              <li>Shapefile (.shp) - 需要包含 .dbf, .shx, .prj 等配套文件</li>
              <li>KMZ (.kmz) - Google Earth 格式</li>
            </ul>
            <p style="margin-top: 10px; color: #E6A23C;">
              <el-icon><InfoFilled /></el-icon>
              建议：如果您有 SHP 或 KMZ 文件，建议先转换为 GeoJSON 格式以获得更好的处理效果
            </p>
          </el-alert>

          <el-upload
            ref="uploadRef"
            class="upload-area"
            drag
            :auto-upload="false"
            :on-change="handleFileChange"
            :file-list="fileList"
            multiple
            accept=".geojson,.json,.shp,.kmz"
          >
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">
              拖拽文件到此处，或<em>点击上传</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">
                可同时上传多个区域的文件，每个文件代表一个区域的数据
              </div>
            </template>
          </el-upload>

          <div class="uploaded-files" v-if="uploadedRegions.length > 0">
            <el-divider content-position="left">
              <el-icon><FolderOpen /></el-icon>
              已上传区域 ({{ uploadedRegions.length }})
            </el-divider>
            <el-space wrap>
              <el-tag
                v-for="region in uploadedRegions"
                :key="region.id"
                size="large"
                closable
                @close="removeRegion(region.id)"
                effect="plain"
              >
                <template #icon><MapPin :size="14" /></template>
                {{ region.regionName !== region.name ? `${region.regionName} (${region.name})` : region.name }} - {{ region.featureCount }} 个地块
              </el-tag>
            </el-space>
          </div>
        </div>

        <!-- 从识别结果选择区域 -->
        <div v-if="dataSource === 'existing'" class="existing-files-section">
          <el-alert 
            v-if="existingFiles.length > 0 && filteredExistingFiles.length === 0"
            type="warning"
            :closable="false"
            style="margin-bottom: 16px;"
          >
            <template #title>
              找到 {{ existingFiles.length }} 个文件，但没有{{ taskType === 'planting' ? '种植情况识别' : '作物识别' }}类型的数据
            </template>
          </el-alert>

          <el-table 
            :data="filteredExistingFiles" 
            v-loading="loadingFiles"
            @selection-change="handleSelectionChange"
            stripe
            max-height="400"
          >
            <el-table-column type="selection" width="55" />
            <el-table-column prop="name" label="文件名称" min-width="200">
              <template #default="{ row }">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <FileText :size="16" />
                  <span>{{ row.name }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="type" label="文件类型" width="100">
              <template #default="{ row }">
                <el-tag size="small">{{ row.type }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="regionName" label="区域" width="150" align="center">
              <template #default="{ row }">
                <el-tag size="small" type="info">{{ row.regionName || '未知区域' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="uploadTime" label="上传时间" width="180" />
            <el-table-column prop="taskSource" label="任务来源" width="140">
              <template #default="{ row }">
                <el-tag 
                  :type="row.taskSource === 'planting' ? 'success' : 'warning'" 
                  size="small"
                  effect="light"
                >
                  <template #icon>
                    <Sprout v-if="row.taskSource === 'planting'" :size="12" />
                    <ScanSearch v-else :size="12" />
                  </template>
                  {{ row.taskSource === 'planting' ? '种植情况识别' : '作物识别' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>

          <div v-if="selectedExistingFiles.length > 0" style="margin-top: 16px;">
            <el-alert type="success" :closable="false">
              已选择 {{ selectedExistingFiles.length }} 个文件
            </el-alert>
          </div>

          <el-empty v-if="!loadingFiles && filteredExistingFiles.length === 0" description="暂无相关识别结果数据">
            <template #description>
              <p style="margin: 0; color: #909399;">
                暂无{{ taskType === 'planting' ? '种植情况识别' : '作物识别' }}类型的数据
              </p>
              <p style="margin: 8px 0 0 0; font-size: 13px; color: #C0C4CC;">
                请前往数据管理界面上传相应类型的识别结果，或选择"上传新文件"
              </p>
            </template>
          </el-empty>
        </div>
      </div>

      <div class="step-actions" v-if="taskType && dataSource">
        <el-button 
          type="primary" 
          :disabled="!canProceed" 
          @click="analyzeData" 
          :loading="analyzing"
          size="large"
        >
          {{ analyzing ? '分析中...' : '开始分析' }}
          <el-icon class="el-icon--right"><TrendingUp /></el-icon>
        </el-button>
      </div>
    </el-card>

    <!-- 步骤2: 报表展示 - 种植情况识别 -->
    <div v-show="currentStep === 1 && taskType === 'planting'" class="report-content">
    <el-card class="action-card" shadow="never">
      <el-space wrap>
        <el-button type="primary" @click="showReportPreview = true" :disabled="selectedReportItems.length === 0">
          <template #icon><FilePlus :size="16" /></template>
          预览报告 ({{ selectedReportItems.length }})
        </el-button>
        <el-button type="success" @click="handleExportReport" :disabled="selectedReportItems.length === 0">
          <template #icon><Download :size="16" /></template>
          导出报告
        </el-button>
        <el-button @click="clearReportSelection" :disabled="selectedReportItems.length === 0">
          清空选择
        </el-button>
        <el-divider direction="vertical" />
        <el-button @click="resetAnalysis">
          <template #icon><RotateCcw :size="16" /></template>
          重新分析
        </el-button>
      </el-space>
    </el-card>

    <!-- 图表区域 -->
    <el-row :gutter="20">
      <!-- 各区域作物种植对比（堆叠柱状图） -->
      <el-col :span="24">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="card-header">
              <span><BarChart :size="16" style="margin-right: 8px" /> 各区域作物种植对比</span>
              <el-button 
                size="small"
                :type="isChartSelected('region-compare') ? 'success' : 'default'"
                @click="toggleReportItem('region-compare', 'chart', '各区域作物种植对比')"
              >
                <el-icon><Check v-if="isChartSelected('region-compare')" /></el-icon>
                {{ isChartSelected('region-compare') ? '已添加' : '添加到报告' }}
              </el-button>
            </div>
          </template>
          <div id="region-compare" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <!-- 作物总面积排行 -->
      <el-col :xs="24" :lg="12">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="card-header">
              <span><BarChart :size="16" style="margin-right: 8px" /> 作物种植总面积排行</span>
              <el-button 
                size="small"
                :type="isChartSelected('crop-ranking') ? 'success' : 'default'"
                @click="toggleReportItem('crop-ranking', 'chart', '作物种植总面积排行')"
              >
                <el-icon><Check v-if="isChartSelected('crop-ranking')" /></el-icon>
                {{ isChartSelected('crop-ranking') ? '已添加' : '添加到报告' }}
              </el-button>
            </div>
          </template>
          <div id="crop-ranking" class="chart-container"></div>
        </el-card>
      </el-col>

      <!-- 各区域作物种类数量 -->
      <el-col :xs="24" :lg="12">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="card-header">
              <span><BarChart :size="16" style="margin-right: 8px" /> 各区域作物种类数量对比</span>
              <el-button 
                size="small"
                :type="isChartSelected('crop-variety-count') ? 'success' : 'default'"
                @click="toggleReportItem('crop-variety-count', 'chart', '各区域作物种类数量对比')"
              >
                <el-icon><Check v-if="isChartSelected('crop-variety-count')" /></el-icon>
                {{ isChartSelected('crop-variety-count') ? '已添加' : '添加到报告' }}
              </el-button>
            </div>
          </template>
          <div id="crop-variety-count" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>
    </div>

    <!-- 步骤2: 报表展示 - 作物识别 -->
    <div v-show="currentStep === 1 && taskType === 'cultivation'" class="report-content">
      <el-card class="action-card" shadow="never">
        <el-space wrap>
          <el-button type="primary" @click="showReportPreview = true" :disabled="selectedReportItems.length === 0">
            <template #icon><FilePlus :size="16" /></template>
            预览报告 ({{ selectedReportItems.length }})
          </el-button>
          <el-button type="success" @click="handleExportReport" :disabled="selectedReportItems.length === 0">
            <template #icon><Download :size="16" /></template>
            导出报告
          </el-button>
          <el-button @click="clearReportSelection" :disabled="selectedReportItems.length === 0">
            清空选择
          </el-button>
          <el-divider direction="vertical" />
          <el-button @click="resetAnalysis">
            <template #icon><RotateCcw :size="16" /></template>
            重新分析
          </el-button>
        </el-space>
      </el-card>

      <!-- 种植率统计 -->
      <el-row :gutter="20">
        <el-col :xs="24" :lg="12">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header">
                <span><BarChart :size="16" style="margin-right: 8px" /> 各区域地块统计</span>
                <el-button 
                  size="small"
                  :type="isChartSelected('cultivation-status') ? 'success' : 'default'"
                  @click="toggleReportItem('cultivation-status', 'chart', '各区域地块统计')"
                >
                  <el-icon><Check v-if="isChartSelected('cultivation-status')" /></el-icon>
                  {{ isChartSelected('cultivation-status') ? '已添加' : '添加到报告' }}
                </el-button>
              </div>
            </template>
            <div id="cultivation-status" class="chart-container"></div>
          </el-card>
        </el-col>

        <!-- 撂荒地统计 -->
        <el-col :xs="24" :lg="12">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header">
                <span><BarChart :size="16" style="margin-right: 8px" /> 撂荒地区域统计</span>
                <el-button 
                  size="small"
                  :type="isChartSelected('fallow-stats') ? 'success' : 'default'"
                  @click="toggleReportItem('fallow-stats', 'chart', '撂荒地区域统计')"
                >
                  <el-icon><Check v-if="isChartSelected('fallow-stats')" /></el-icon>
                  {{ isChartSelected('fallow-stats') ? '已添加' : '添加到报告' }}
                </el-button>
              </div>
            </template>
            <div id="fallow-stats" class="chart-container"></div>
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="20" style="margin-top: 20px">
        <!-- 区域覆盖率对比 -->
        <el-col :xs="24" :lg="12">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header">
                <span><LineChart :size="16" style="margin-right: 8px" /> 区域种植覆盖率</span>
                <el-button 
                  size="small"
                  :type="isChartSelected('coverage-rate') ? 'success' : 'default'"
                  @click="toggleReportItem('coverage-rate', 'chart', '区域种植覆盖率')"
                >
                  <el-icon><Check v-if="isChartSelected('coverage-rate')" /></el-icon>
                  {{ isChartSelected('coverage-rate') ? '已添加' : '添加到报告' }}
                </el-button>
              </div>
            </template>
            <div id="coverage-rate" class="chart-container"></div>
          </el-card>
        </el-col>

        <!-- 总体面积分布 -->
        <el-col :xs="24" :lg="12">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header">
                <span><PieChart :size="16" style="margin-right: 8px" /> 总体面积分布</span>
                <el-button 
                  size="small"
                  :type="isChartSelected('density-distribution') ? 'success' : 'default'"
                  @click="toggleReportItem('density-distribution', 'chart', '总体面积分布')"
                >
                  <el-icon><Check v-if="isChartSelected('density-distribution')" /></el-icon>
                  {{ isChartSelected('density-distribution') ? '已添加' : '添加到报告' }}
                </el-button>
              </div>
            </template>
            <div id="density-distribution" class="chart-container"></div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 数据表格 -->
    <el-card v-show="currentStep === 1" shadow="never" class="table-card" style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span><Ticket :size="16" style="margin-right: 8px" /> 详细数据表</span>
          <el-button 
            size="small"
            :type="isChartSelected('data-table') ? 'success' : 'default'"
            @click="toggleReportItem('data-table', 'table', '详细数据表')"
          >
            <el-icon><Check v-if="isChartSelected('data-table')" /></el-icon>
            {{ isChartSelected('data-table') ? '已添加' : '添加到报告' }}
          </el-button>
        </div>
      </template>
      
      <!-- 种植情况识别表格 -->
      <el-table v-if="taskType === 'planting'" :data="plantingTableData" style="width: 100%" border stripe>
        <el-table-column prop="region" label="区域名称" width="200" fixed />
        <el-table-column prop="totalArea" label="总面积（亩）" width="140" align="right" />
        <el-table-column prop="plotCount" label="地块数量" width="100" align="right" />
        <el-table-column prop="mainCrop" label="主要作物" width="120" align="center">
          <template #default="scope">
            <el-tag :color="getCropColor(scope.row.mainCrop)" style="color: #333;">
              {{ scope.row.mainCrop }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="mainCropArea" label="主要作物面积（亩）" width="160" align="right" />
        <el-table-column prop="cropCount" label="作物种类" width="100" align="center">
          <template #default="scope">
            <el-tag :type="scope.row.cropCount >= 5 ? 'success' : scope.row.cropCount >= 3 ? 'warning' : 'info'">
              {{ scope.row.cropCount }} 种
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="详细作物分布（亩）" min-width="300">
          <template #default="scope">
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              <template v-for="(area, cropName) in scope.row.cropStats" :key="cropName">
                <el-tag v-if="area > 0" size="small" :color="getCropColor(cropName)" style="color: #333;">
                  {{ cropName }}: {{ area.toFixed(2) }}
                </el-tag>
              </template>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 作物识别表格 -->
      <el-table v-if="taskType === 'cultivation'" :data="cultivationTableData" style="width: 100%" border stripe>
        <el-table-column prop="region" label="区域名称" width="150" fixed />
        <el-table-column prop="totalArea" label="总面积（亩）" width="130" align="right" />
        <el-table-column prop="plotCount" label="地块数量" width="100" align="right" />
        <el-table-column prop="plantedArea" label="已种植（亩）" width="130" align="right" />
        <el-table-column prop="fallowArea" label="撂荒地（亩）" width="130" align="right" />
        <el-table-column prop="cultivationRate" label="种植率" width="120" align="center">
          <template #default="scope">
            <el-progress :percentage="scope.row.cultivationRate" :color="getProgressColor(scope.row.cultivationRate)" />
          </template>
        </el-table-column>
        <el-table-column prop="density" label="种植密度" width="110" align="center">
          <template #default="scope">
            <el-tag :type="getDensityType(scope.row.density)">
              {{ scope.row.density }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ scope.row.status }}
            </el-tag>
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

    <!-- 报告预览对话框 -->
    <el-dialog
      v-model="showReportPreview"
      title="报告预览"
      width="900px"
      :close-on-click-modal="false"
      class="report-preview-dialog"
    >
      <div class="report-preview-content">
        <el-alert type="info" :closable="false" style="margin-bottom: 20px">
          <template #title>
            已选择 {{ selectedReportItems.length }} 项内容，点击"导出报告"生成PDF文件
          </template>
        </el-alert>
        
        <!-- 自定义文件名 -->
        <div style="margin-bottom: 20px;">
          <el-form label-width="100px">
            <el-form-item label="报告标题">
              <el-input 
                v-model="reportTitle" 
                placeholder="请输入报告标题"
                clearable
              />
            </el-form-item>
            <el-form-item label="文件名">
              <el-input 
                v-model="customFileName" 
                placeholder="留空则使用默认文件名"
                clearable
              >
                <template #append>
                  <span>.pdf</span>
                </template>
              </el-input>
              <div style="font-size: 12px; color: #909399; margin-top: 5px;">
                💡 默认: {{ getDefaultFileName() }}
              </div>
            </el-form-item>
          </el-form>
        </div>
        
        <el-divider />
        
        <div class="report-header">
          <h2 style="text-align: center; margin: 20px 0;">{{ reportTitle }}</h2>
        </div>

        <div v-if="selectedReportItems.length === 0" class="empty-state">
          <el-empty description="还没有选择任何图表或表格">
            <el-button type="primary" @click="showReportPreview = false">
              返回选择
            </el-button>
          </el-empty>
        </div>

        <div v-else class="selected-items-list">
          <h3>报告内容：</h3>
          <el-timeline>
            <el-timeline-item
              v-for="(item, index) in selectedReportItems"
              :key="item.id"
              :timestamp="`第 ${index + 1} 项`"
              placement="top"
            >
              <el-card shadow="hover">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div style="flex: 1;">
                    <el-tag :type="item.type === 'chart' ? 'primary' : 'success'" size="small">
                      {{ item.type === 'chart' ? '📊 图表' : '📋 表格' }}
                    </el-tag>
                    <span style="margin-left: 12px; font-weight: 500; font-size: 15px;">{{ item.title }}</span>
                  </div>
                  <el-button 
                    size="small" 
                    type="danger" 
                    text
                    @click="toggleReportItem(item.id, item.type, item.title)"
                  >
                    <el-icon><Delete /></el-icon>
                    移除
                  </el-button>
                </div>
                
                <!-- 简要说明 -->
                <div style="margin-top: 8px; padding-left: 32px; color: #909399; font-size: 13px;">
                  {{ item.type === 'chart' ? '将在报告中以图片形式展示' : '将在报告中以列表形式展示关键数据' }}
                </div>
              </el-card>
            </el-timeline-item>
          </el-timeline>
        </div>
      </div>

      <template #footer>
        <el-button @click="showReportPreview = false">关闭预览</el-button>
        <el-button type="primary" @click="handleExportReport" :loading="generating">
          <el-icon><Download /></el-icon>
          {{ generating ? '生成中...' : '导出PDF报告' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 生成报告对话框 -->
    <el-dialog
      v-model="showReportDialog"
      title="生成分析报告"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form :model="reportForm" label-width="100px">
        <el-form-item label="报告标题">
          <el-input v-model="reportForm.title" placeholder="请输入报告标题" />
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="reportForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="行政区域">
          <el-cascader
            v-model="reportForm.region"
            :options="regionOptions"
            placeholder="请选择行政区域"
            style="width: 100%"
            clearable
          />
        </el-form-item>
        <el-form-item label="包含图表">
          <el-checkbox-group v-model="reportForm.charts">
            <el-checkbox label="crop">作物类型分布</el-checkbox>
            <el-checkbox label="diff">差异类型统计</el-checkbox>
            <el-checkbox label="trend">监测趋势分析</el-checkbox>
            <el-checkbox label="region">行政区对比</el-checkbox>
            <el-checkbox label="monthly">月度统计</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="包含表格">
          <el-switch v-model="reportForm.includeTable" />
        </el-form-item>
        <el-form-item label="输出格式">
          <el-radio-group v-model="reportForm.format">
            <el-radio label="pdf">PDF</el-radio>
            <el-radio label="word">Word</el-radio>
            <el-radio label="excel">Excel</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showReportDialog = false">取消</el-button>
        <el-button type="primary" :loading="generating" @click="handleGenerateReport">
          {{ generating ? '生成中...' : '生成报告' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled, InfoFilled } from '@element-plus/icons-vue'
import {
  FilePlus, Download, RotateCcw, PieChart, BarChart,
  LineChart, Ticket, Upload, FolderOpen, MapPin,
  ListChecks, Sprout, ScanSearch,
  Database, FileText, Check, Delete
} from 'lucide-vue-next'
import * as echarts from 'echarts'
import { getRecognitionResults, readGeojsonContent } from '@/api/analysis'
import { getCropName, getCropColor, CROP_TYPE_MAP } from '@/config/cropMapping'
import { extractRegionName } from '@/config/regionMapping'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// 步骤控制
const currentStep = ref(0)
const taskType = ref('')
const dataSource = ref('') // 'upload' or 'existing'
const analyzing = ref(false)

// 文件上传
const uploadRef = ref(null)
const fileList = ref([])
const uploadedRegions = ref([])

// 从识别结果选择
const existingFiles = ref([])
const selectedExistingFiles = ref([])
const loadingFiles = ref(false)

// 报表相关
const showReportDialog = ref(false)
const showReportPreview = ref(false)
const generating = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

// 报告生成相关
const selectedReportItems = ref([]) // 选中的图表和表格
const reportTitle = ref('农作物种植情况分析报告')
const customFileName = ref('') // 自定义文件名

// 根据任务类型过滤已有文件
const filteredExistingFiles = computed(() => {
  if (!taskType.value) return []
  
  // 任务类型映射：界面使用的值 -> 数据管理界面存储的值
  const taskTypeMap = {
    'planting': 'planting_situation',  // 种植情况识别
    'cultivation': 'crop_recognition'  // 作物识别
  }
  
  const targetType = taskTypeMap[taskType.value]
  return existingFiles.value.filter(file => {
    // 匹配 recognitionType 字段
    return file.recognitionType === targetType || file.taskSource === targetType
  })
})

// 判断是否可以继续
const canProceed = computed(() => {
  if (dataSource.value === 'upload') {
    return uploadedRegions.value.length > 0
  } else if (dataSource.value === 'existing') {
    return selectedExistingFiles.value.length > 0
  }
  return false
})

const reportForm = ref({
  title: '2024年农作物监测分析报告',
  dateRange: [],
  region: [],
  charts: ['crop', 'diff', 'trend'],
  includeTable: true,
  format: 'pdf'
})

const regionOptions = [
  {
    value: 'xj',
    label: '新疆维吾尔自治区',
    children: [
      { value: 'wlmq', label: '乌鲁木齐市' },
      { value: 'ks', label: '喀什地区' },
      { value: 'alt', label: '阿勒泰地区' }
    ]
  }
]

// 种植情况识别表格数据
const plantingTableData = ref([])

// 作物识别表格数据
const cultivationTableData = ref([])

// 图表实例
let cropChart = null
let cropVarietyCountChart = null
let trendChart = null
let regionChart = null
let cropRankingChart = null
let cultivationStatusChart = null
let fallowStatsChart = null
let coverageRateChart = null
let densityDistributionChart = null

// 文件上传处理
const handleFileChange = (file, fileList) => {
  const fileExtension = file.name.split('.').pop().toLowerCase()
  
  if (!['geojson', 'json', 'shp', 'kmz'].includes(fileExtension)) {
    ElMessage.warning('不支持的文件格式，请上传 GeoJSON、SHP 或 KMZ 文件')
    return
  }

  if (fileExtension !== 'geojson' && fileExtension !== 'json') {
    ElMessage.info('检测到非 GeoJSON 文件，建议转换为 GeoJSON 格式以获得更好的处理效果')
  }

  // 读取文件内容
  const reader = new FileReader()
  reader.onload = async (e) => {
    try {
      const content = e.target.result
      let geojson = null

      if (fileExtension === 'geojson' || fileExtension === 'json') {
        geojson = JSON.parse(content)
      } else {
        ElMessage.warning(`${file.name} 需要先转换为 GeoJSON 格式`)
        return
      }

      // 解析 GeoJSON 数据
      const featureCount = geojson.features ? geojson.features.length : 0
      const fileName = file.name.replace(/\.(geojson|json)$/i, '')
      
      // 尝试从 GeoJSON 中提取区域名称
      let regionName = fileName
      if (geojson.features && geojson.features.length > 0) {
        // 尝试从第一个 feature 的 properties 中获取区域名
        const firstFeature = geojson.features[0]
        const props = firstFeature.properties || {}
        regionName = props.name || props.region || props.area_name || props.区域 || fileName
      }
      
      // 如果 GeoJSON 有顶层 properties
      if (geojson.properties) {
        regionName = geojson.properties.name || geojson.properties.region || regionName
      }

      // 检查是否有面积字段
      const hasArea = geojson.features && geojson.features.length > 0 && 
                      (geojson.features[0].properties?.area_m2 !== undefined || 
                       geojson.features[0].properties?.area_mu !== undefined ||
                       geojson.features[0].properties?.area !== undefined || 
                       geojson.features[0].properties?.AREA !== undefined)
      
      if (!hasArea) {
        ElMessage.warning(`${fileName} 缺少面积字段（area_m2, area_mu, area, AREA），将尝试使用后端计算面积`)
        // TODO: 调用后端 API 使用 geopandas 计算面积
      }

      uploadedRegions.value.push({
        id: Date.now() + Math.random(),
        name: fileName,
        regionName: regionName,
        featureCount: featureCount,
        data: geojson,
        hasArea: hasArea
      })

      ElMessage.success(`成功上传 ${regionName}，包含 ${featureCount} 个地块`)
    } catch (error) {
      ElMessage.error(`解析文件失败: ${error.message}`)
    }
  }

  reader.readAsText(file.raw)
}

const removeRegion = (id) => {
  const index = uploadedRegions.value.findIndex(r => r.id === id)
  if (index > -1) {
    const region = uploadedRegions.value[index]
    uploadedRegions.value.splice(index, 1)
    ElMessage.success(`已移除 ${region.name}`)
  }
}

// 加载已有识别结果文件
const loadExistingFiles = async () => {
  loadingFiles.value = true
  try {
    const response = await getRecognitionResults()
    console.log('识别结果API返回:', response)
    
    // 处理返回的数据
    const files = response.data || response || []
    existingFiles.value = files.map(file => {
      // 从文件对象中提取 recognitionType（数据管理界面使用的字段）
      let recognitionType = file.recognitionType || file.metadata?.recognitionType
      
      // 转换 recognitionType 为 taskSource 用于显示
      const typeMap = {
        'crop_recognition': 'cultivation',      // 作物识别
        'planting_situation': 'planting',       // 种植情况识别
        // 兼容旧版
        'crop_info': 'cultivation',
        'planting_status': 'planting'
      }
      
      const taskSource = typeMap[recognitionType] || detectTaskSourceFromName(file.filename || file.name)

      // 提取区域名称 - 使用区域映射配置
      const fileName = file.filename || file.name || ''
      let regionName = file.regionName || file.metadata?.regionName
      
      // 如果没有区域名称，使用区域映射从文件名提取
      if (!regionName || regionName === '未知区域') {
        regionName = extractRegionName(fileName)
      }

      return {
        name: file.filename || file.name,
        type: file.type || file.fileType || 'GeoJSON',
        featureCount: file.featureCount || file.metadata?.featureCount || 0,
        regionName: regionName,  // 添加区域名称
        uploadTime: file.uploadTime || file.createTime || file.metadata?.uploadTime || new Date().toLocaleString(),
        recognitionType: recognitionType,  // 保留原始值用于过滤
        taskSource: taskSource,            // 转换后的值用于显示
        path: file.path || file.relativePath,
        metadata: file.metadata,
        data: null
      }
    })

    console.log('处理后的文件列表:', existingFiles.value)
    console.log('当前任务类型:', taskType.value)
    console.log('过滤后的文件:', filteredExistingFiles.value)
  } catch (error) {
    console.error('加载识别结果失败:', error)
    ElMessage.error('加载识别结果失败，请重试')
    existingFiles.value = []
  } finally {
    loadingFiles.value = false
  }
}

// 根据文件名检测任务类型
const detectTaskSourceFromName = (filename) => {
  if (!filename) return 'planting'
  
  const name = filename.toLowerCase()
  
  // 作物识别关键词
  if (name.includes('cultivation') || 
      name.includes('作物识别') || 
      name.includes('撂荒') ||
      name.includes('种植状态') ||
      name.includes('fallow')) {
    return 'cultivation'
  }
  
  // 种植情况识别关键词
  if (name.includes('planting') || 
      name.includes('种植情况') || 
      name.includes('作物类型') ||
      name.includes('crop_type') ||
      name.includes('作物分类')) {
    return 'planting'
  }
  
  // 默认返回 planting
  return 'planting'
}

// 处理文件选择变化
const handleSelectionChange = (selection) => {
  selectedExistingFiles.value = selection
}

// 步骤控制
const resetAnalysis = () => {
  currentStep.value = 0
  taskType.value = ''
  dataSource.value = ''
  uploadedRegions.value = []
  selectedExistingFiles.value = []
  plantingTableData.value = []
  cultivationTableData.value = []
  ElMessage.info('已重置，可以重新选择任务和数据')
}

// 数据分析
const analyzeData = async () => {
  analyzing.value = true
  
  try {
    console.log('===== 开始数据分析 =====')
    console.log('任务类型:', taskType.value)
    console.log('数据来源:', dataSource.value)
    
    // 如果是从识别结果选择，需要先加载文件数据
    if (dataSource.value === 'existing') {
      await loadSelectedFilesData()
    }

    console.log('已上传区域数量:', uploadedRegions.value.length)
    console.log('区域详情:', uploadedRegions.value.map(r => ({
      文件名: r.name,
      区域名: r.regionName,
      地块数: r.featureCount
    })))

    // 模拟数据分析过程
    await new Promise(resolve => setTimeout(resolve, 1000))

    if (taskType.value === 'planting') {
      analyzePlantingData()
    } else if (taskType.value === 'cultivation') {
      analyzeCultivationData()
    }

    currentStep.value = 1
    ElMessage.success('数据分析完成！请查看浏览器控制台（F12）了解详细分析结果')
    
    // 等待 DOM 更新后初始化图表
    setTimeout(() => {
      if (taskType.value === 'planting') {
        initPlantingCharts()
      } else if (taskType.value === 'cultivation') {
        initCultivationCharts()
      }
      console.log('===== 图表初始化完成 =====')
    }, 200)
  } catch (error) {
    console.error('数据分析失败:', error)
    ElMessage.error('数据分析失败：' + error.message)
  } finally {
    analyzing.value = false
  }
}

// 加载选中文件的数据
const loadSelectedFilesData = async () => {
  uploadedRegions.value = []
  
  for (const file of selectedExistingFiles.value) {
    try {
      // 读取 GeoJSON 文件内容
      const response = await readGeojsonContent(file.name)
      const geojson = response.data
      
      const fileName = file.name.replace(/\.(geojson|json)$/i, '')
      
      // 优先使用文件列表中已有的区域名称（已经通过区域映射提取）
      let regionName = file.regionName
      
      // 如果文件列表中没有或是未知区域，尝试从文件名或GeoJSON中提取
      if (!regionName || regionName === '未知区域') {
        // 首先尝试使用区域映射从文件名提取
        regionName = extractRegionName(file.name)
        
        // 如果仍是未知区域，尝试从 GeoJSON 属性中提取
        if (regionName === '未知区域') {
          if (geojson.features && geojson.features.length > 0) {
            const firstFeature = geojson.features[0]
            const props = firstFeature.properties || {}
            regionName = props.name || props.region || props.area_name || props.区域 || regionName
          }
          
          if (geojson.properties) {
            regionName = geojson.properties.name || geojson.properties.region || regionName
          }
          
          // 也可以从文件元数据中获取区域名
          if (file.metadata?.regionName) {
            regionName = file.metadata.regionName
          }
        }
      }
      
      uploadedRegions.value.push({
        id: Date.now() + Math.random(),
        name: fileName,
        regionName: regionName,
        featureCount: geojson.features ? geojson.features.length : 0,
        data: geojson
      })
    } catch (error) {
      console.error(`加载文件 ${file.name} 失败:`, error)
      ElMessage.warning(`文件 ${file.name} 加载失败，已跳过`)
    }
  }
  
  if (uploadedRegions.value.length === 0) {
    throw new Error('没有成功加载任何文件数据')
  }
}

// 分析种植情况数据
const analyzePlantingData = () => {
  console.log('===== 开始分析种植情况数据 =====')
  
  plantingTableData.value = uploadedRegions.value.map((region, index) => {
    // 从 GeoJSON 数据中提取作物信息
    const features = region.data.features || []
    console.log(`区域 ${region.name}:`, {
      总地块数: features.length,
      示例地块属性: features[0]?.properties
    })
    
    // 统计各类作物面积（使用 class 或 gridcode 字段，1-10代表不同作物）
    const cropStats = {}
    
    // 初始化所有作物类型
    Object.entries(CROP_TYPE_MAP).forEach(([code, name]) => {
      cropStats[name] = 0
    })

    features.forEach((f, idx) => {
      const props = f.properties || {}
      // 读取 class 或 gridcode 字段
      const gridcode = props.class !== undefined ? props.class : 
                      props.gridcode !== undefined ? props.gridcode : 
                      props.CLASS !== undefined ? props.CLASS :
                      props.GRIDCODE
      
      // 读取面积字段（统一转换为亩）
      // 1公顷 = 15亩 = 10000平方米，1亩 ≈ 666.67平方米
      let area = 0
      if (props.area_mu !== undefined) {
        area = parseFloat(props.area_mu) // 亩
      } else if (props.area_m2 !== undefined) {
        area = parseFloat(props.area_m2) / 666.67 // 平方米转亩
      } else if (props.area !== undefined) {
        area = parseFloat(props.area) / 666.67 // 假设是平方米
      } else if (props.AREA !== undefined) {
        area = parseFloat(props.AREA) / 666.67
      } else if (props.Area !== undefined) {
        area = parseFloat(props.Area) / 666.67
      }
      
      if (idx < 3) {
        console.log(`${region.name} 地块 ${idx}:`, {
          'gridcode/class': gridcode,
          '类型': typeof gridcode,
          'area_m2': props.area_m2,
          'area_mu': props.area_mu,
          '面积(亩)': area,
          '作物名': getCropName(gridcode),
          '所有字段': Object.keys(props)
        })
      }
      
      // 将 gridcode 转换为作物名称
      const cropName = getCropName(gridcode)
      if (cropStats[cropName] !== undefined) {
        cropStats[cropName] += area
      }
    })

    // 计算总面积和作物种类
    const totalArea = Object.values(cropStats).reduce((sum, val) => sum + val, 0)
    const cropCount = Object.values(cropStats).filter(v => v > 0).length
    
    // 找出主要作物（面积最大的）
    let mainCrop = '无'
    let mainCropArea = 0
    Object.entries(cropStats).forEach(([cropName, area]) => {
      if (area > mainCropArea && cropName !== '裸地' && cropName !== '其它耕地') {
        mainCrop = cropName
        mainCropArea = area
      }
    })

    // 提取区域名称
    const regionName = region.regionName || region.name
    
    // 显示格式：区域名 (文件名)
    const displayName = region.regionName && region.regionName !== region.name ? 
                        `${region.regionName} (${region.name})` : 
                        region.name

    console.log(`${region.name} 作物统计:`, {
      总面积: totalArea.toFixed(2),
      作物种类: cropCount,
      主要作物: mainCrop,
      主要作物面积: mainCropArea.toFixed(2),
      详细统计: Object.fromEntries(
        Object.entries(cropStats).filter(([_, area]) => area > 0)
      )
    })

    return {
      region: displayName,
      regionName: regionName,
      fileName: region.name,
      totalArea: totalArea.toFixed(2),
      plotCount: features.length,
      cropStats: cropStats, // 保存所有作物统计
      mainCrop: mainCrop,
      mainCropArea: mainCropArea.toFixed(2),
      cropCount: cropCount
    }
  })

  console.log('种植情况分析完成，结果:', plantingTableData.value)
  total.value = plantingTableData.value.length
}

// 分析作物识别数据
const analyzeCultivationData = () => {
  console.log('开始分析作物识别数据，共', uploadedRegions.value.length, '个区域')
  
  cultivationTableData.value = uploadedRegions.value.map((region, index) => {
    const features = region.data.features || []
    console.log(`区域 ${region.name}:`, {
      总地块数: features.length,
      示例地块属性: features[0]?.properties
    })
    
    // 统计种植和撂荒情况（使用 class 字段：1=已种植，0=未种植）
    let plantedArea = 0
    let fallowArea = 0
    let plantedCount = 0
    let fallowCount = 0
    let unknownCount = 0

    features.forEach((f, idx) => {
      const props = f.properties || {}
      // 读取 class 字段，1=已种植，0=未种植
      const classValue = props.class !== undefined ? props.class : props.CLASS
      
      // 读取面积字段并转换为亩
      // 1公顷 = 15亩 = 10000平方米
      let area = 0
      if (props.area_mu !== undefined) {
        area = parseFloat(props.area_mu) // 亩
      } else if (props.area_m2 !== undefined) {
        area = parseFloat(props.area_m2) / 666.67 // 平方米转亩 (1亩≈666.67平方米)
      } else if (props.area !== undefined) {
        area = parseFloat(props.area) / 666.67 // 假设是平方米
      } else if (props.AREA !== undefined) {
        area = parseFloat(props.AREA) / 666.67
      } else if (props.Area !== undefined) {
        area = parseFloat(props.Area) / 666.67
      }
      
      // 打印前3个地块的详细信息
      if (idx < 3) {
        console.log(`${region.name} 地块 ${idx}:`, {
          'class 值': classValue,
          'class 类型': typeof classValue,
          'area_m2': props.area_m2,
          'area_mu': props.area_mu,
          '面积(亩)': area,
          '所有属性字段': Object.keys(props),
          '属性详情': props
        })
      }
      
      if (classValue === 1 || classValue === '1' || classValue === true) {
        plantedArea += area
        plantedCount++
      } else if (classValue === 0 || classValue === '0' || classValue === false) {
        fallowArea += area
        fallowCount++
      } else {
        unknownCount++
        if (idx < 3) {
          console.warn(`${region.name} 地块 ${idx} class 值无法识别:`, {
            classValue: classValue,
            type: typeof classValue
          })
        }
      }
    })

    const totalArea = plantedArea + fallowArea
    const cultivationRate = totalArea > 0 ? Math.round((plantedArea / totalArea) * 100) : 0
    
    console.log(`${region.name} 统计结果:`, {
      已种植面积: plantedArea.toFixed(2),
      撂荒面积: fallowArea.toFixed(2),
      总面积: totalArea.toFixed(2),
      种植率: cultivationRate + '%',
      已种植地块: plantedCount,
      撂荒地块: fallowCount,
      未知地块: unknownCount
    })
    
    let density = '低'
    if (cultivationRate >= 80) density = '高'
    else if (cultivationRate >= 50) density = '中'

    let status = '良好'
    if (cultivationRate < 60) status = '警告'
    if (cultivationRate < 40) status = '异常'

    // 提取区域名称
    const regionName = region.regionName || region.name
    
    // 显示格式：区域名 (文件名)
    const displayName = region.regionName && region.regionName !== region.name ? 
                        `${region.regionName} (${region.name})` : 
                        region.name

    return {
      region: displayName,
      regionName: regionName,
      fileName: region.name,
      totalArea: totalArea.toFixed(2),
      plotCount: features.length,
      plantedArea: plantedArea.toFixed(2),
      fallowArea: fallowArea.toFixed(2),
      plantedCount: plantedCount,
      fallowCount: fallowCount,
      cultivationRate: cultivationRate,
      density: density,
      status: status
    }
  })

  console.log('作物识别分析完成，结果:', cultivationTableData.value)
  total.value = cultivationTableData.value.length
}

const getProgressColor = (percentage) => {
  if (percentage >= 90) return '#67C23A'
  if (percentage >= 70) return '#E6A23C'
  return '#F56C6C'
}

const getDiversityType = (diversity) => {
  if (diversity === '高') return 'success'
  if (diversity === '中') return 'warning'
  return 'info'
}

const getDensityType = (density) => {
  if (density === '高') return 'success'
  if (density === '中') return 'warning'
  return 'danger'
}

const getStatusType = (status) => {
  if (status === '良好') return 'success'
  if (status === '警告') return 'warning'
  return 'danger'
}

// 切换报告项的选择状态
const toggleReportItem = (id, type, title) => {
  const index = selectedReportItems.value.findIndex(item => item.id === id)
  if (index > -1) {
    selectedReportItems.value.splice(index, 1)
    ElMessage.info(`已从报告中移除: ${title}`)
  } else {
    selectedReportItems.value.push({ id, type, title })
    ElMessage.success(`已添加到报告: ${title}`)
  }
}

// 判断图表/表格是否已选择
const isChartSelected = (id) => {
  return selectedReportItems.value.some(item => item.id === id)
}

// 清空报告选择
const clearReportSelection = () => {
  selectedReportItems.value = []
  ElMessage.info('已清空报告选择')
}

// 获取默认文件名
const getDefaultFileName = () => {
  const taskTypeName = taskType.value === 'planting' ? '种植情况' : '作物识别'
  const date = new Date()
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  return `${taskTypeName}_分析报告_${dateStr}.pdf`
}

// 获取最终文件名
const getFinalFileName = () => {
  if (customFileName.value && customFileName.value.trim()) {
    let filename = customFileName.value.trim()
    // 如果用户输入的文件名已经包含.pdf，就不再添加
    if (!filename.toLowerCase().endsWith('.pdf')) {
      filename += '.pdf'
    }
    return filename
  }
  return getDefaultFileName()
}

const handleExportChart = (chartId) => {
  const chartDom = document.getElementById(chartId)
  if (!chartDom) return
  
  const chart = echarts.getInstanceByDom(chartDom)
  if (!chart) return
  
  const url = chart.getDataURL({
    pixelRatio: 2,
    backgroundColor: '#fff'
  })
  
  const link = document.createElement('a')
  link.download = `${chartId}_${Date.now()}.png`
  link.href = url
  link.click()
  
  ElMessage.success('图表导出成功')
}


const handleGenerateReport = () => {
  generating.value = true
  setTimeout(() => {
    generating.value = false
    showReportDialog.value = false
    ElMessage.success('报告生成成功！')
  }, 2000)
}

// 导出报告
const handleExportReport = async () => {
  if (selectedReportItems.value.length === 0) {
    ElMessage.warning('请先选择要添加到报告的图表或表格')
    return
  }
  
  generating.value = true
  try {
    // 收集所有选中的图表图片
    const chartImages = []
    for (const item of selectedReportItems.value) {
      if (item.type === 'chart') {
        const chartDom = document.getElementById(item.id)
        if (chartDom) {
          const chart = echarts.getInstanceByDom(chartDom)
          if (chart) {
            const url = chart.getDataURL({
              pixelRatio: 2,
              backgroundColor: '#fff'
            })
            chartImages.push({
              title: item.title,
              image: url
            })
          }
        }
      }
    }
    
    // 这里调用PDF生成功能
    await generatePDFReport(chartImages)
    
    ElMessage.success('报告导出成功！')
  } catch (error) {
    console.error('导出报告失败:', error)
    ElMessage.error('导出报告失败：' + error.message)
  } finally {
    generating.value = false
  }
}

// 生成PDF报告
const generatePDFReport = async (chartImages) => {
  console.log('开始生成PDF报告，包含图表:', chartImages.length)
  
  try {
    // 创建一个临时的HTML容器用于生成封面和表格
    const container = document.createElement('div')
    container.style.width = '794px' // A4纸张宽度（像素，96dpi）
    container.style.padding = '40px'
    container.style.backgroundColor = '#fff'
    container.style.fontFamily = 'Arial, "Microsoft YaHei", sans-serif'
    document.body.appendChild(container)
    
    // 创建PDF实例
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })
    
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    
    // 生成封面
    const date = new Date().toLocaleDateString('zh-CN')
    const taskTypeName = taskType.value === 'planting' ? '种植情况识别分析' : '作物识别分析'
    const regions = uploadedRegions.value.map(r => r.regionName).join('、')
    
    container.innerHTML = `
      <div style="text-align: center; padding: 80px 20px;">
        <h1 style="font-size: 32px; color: #4f46e5; margin-bottom: 30px;">${reportTitle.value}</h1>
        <div style="font-size: 18px; color: #6b7280; margin-bottom: 20px;">生成日期: ${date}</div>
        <div style="font-size: 16px; color: #4b5563; margin-bottom: 15px;">分析类型: ${taskTypeName}</div>
        <div style="font-size: 16px; color: #4b5563;">分析区域: ${regions}</div>
      </div>
    `
    
    // 将封面转为图片
    const coverCanvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false
    })
    
    const coverImgData = coverCanvas.toDataURL('image/png')
    const coverImgWidth = pageWidth
    const coverImgHeight = (coverCanvas.height * pageWidth) / coverCanvas.width
    
    pdf.addImage(coverImgData, 'PNG', 0, 0, coverImgWidth, coverImgHeight)
    
    // 添加每个图表
    for (let i = 0; i < chartImages.length; i++) {
      const item = chartImages[i]
      
      pdf.addPage()
      
      // 创建图表页面
      container.innerHTML = `
        <div style="padding: 20px;">
          <h2 style="font-size: 20px; color: #1f2937; margin-bottom: 20px;">${i + 1}. ${item.title}</h2>
          <img src="${item.image}" style="width: 100%; border-radius: 8px;" />
        </div>
      `
      
      const chartCanvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      })
      
      const chartImgData = chartCanvas.toDataURL('image/png')
      const chartImgWidth = pageWidth
      const chartImgHeight = (chartCanvas.height * pageWidth) / chartCanvas.width
      
      // 如果图片太高，需要缩放
      if (chartImgHeight > pageHeight) {
        const scale = pageHeight / chartImgHeight
        pdf.addImage(chartImgData, 'PNG', 0, 0, chartImgWidth * scale, pageHeight)
      } else {
        pdf.addImage(chartImgData, 'PNG', 0, 0, chartImgWidth, chartImgHeight)
      }
    }
    
    // 添加表格（如果选中了）
    const hasTable = selectedReportItems.value.some(item => item.type === 'table')
    if (hasTable) {
      const tableData = taskType.value === 'planting' ? plantingTableData.value : cultivationTableData.value
      
      // 构建详细的表格HTML - 紧凑排版
      let tableHTML = `
        <div style="padding: 20px; font-family: Arial, 'Microsoft YaHei', sans-serif;">
          <h2 style="font-size: 22px; color: #1f2937; margin-bottom: 8px; border-bottom: 3px solid #4f46e5; padding-bottom: 8px;">详细数据表</h2>
          <div style="font-size: 13px; color: #6b7280; margin-bottom: 15px;">共分析 ${tableData.length} 个区域</div>
      `
      
      if (taskType.value === 'planting') {
        // 种植情况识别 - 显示详细的作物面积（紧凑版）
        tableData.forEach((row, index) => {
          tableHTML += `
            <div style="margin-bottom: 15px; padding: 12px; background: #f9fafb; border-radius: 6px; border-left: 4px solid #4f46e5;">
              <div style="font-size: 15px; color: #1f2937; font-weight: bold; margin-bottom: 6px;">
                ${index + 1}. ${row.regionName}
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px; font-size: 12px;">
                <div style="color: #4b5563;">📊 总面积: <strong>${row.totalArea}</strong> 亩</div>
                <div style="color: #4b5563;">📍 地块: <strong>${row.plotCount}</strong> 个</div>
                <div style="color: #4b5563;">🌾 作物: <strong>${row.cropCount}</strong> 种</div>
                <div style="color: #4b5563;">⭐ 主作: <strong>${row.mainCrop}</strong> (${row.mainCropArea}亩)</div>
              </div>
              <div style="font-size: 12px; color: #374151; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e5e7eb;">
                <strong>作物分布：</strong>
                <div style="margin-top: 4px; line-height: 1.6; display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
          `
          
          // 显示每种作物的面积
          const crops = Object.entries(row.cropStats)
            .filter(([name, area]) => area > 0)
            .sort((a, b) => b[1] - a[1]) // 按面积从大到小排序
          
          crops.forEach(([cropName, area]) => {
            const percentage = ((area / parseFloat(row.totalArea)) * 100).toFixed(1)
            tableHTML += `<div>• ${cropName}: ${area.toFixed(2)} 亩 (${percentage}%)</div>`
          })
          
          tableHTML += `
                </div>
              </div>
            </div>
          `
        })
      } else {
        // 作物识别 - 显示种植率等信息（紧凑版）
        tableData.forEach((row, index) => {
          tableHTML += `
            <div style="margin-bottom: 15px; padding: 12px; background: #f9fafb; border-radius: 6px; border-left: 4px solid ${row.cultivationRate >= 80 ? '#10b981' : row.cultivationRate >= 60 ? '#f59e0b' : '#ef4444'};">
              <div style="font-size: 15px; color: #1f2937; font-weight: bold; margin-bottom: 6px;">
                ${index + 1}. ${row.regionName}
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; font-size: 12px;">
                <div style="color: #4b5563;">📊 总: <strong>${row.totalArea}</strong> 亩</div>
                <div style="color: #4b5563;">📍 地块: <strong>${row.plotCount}</strong> 个</div>
                <div style="color: ${row.cultivationRate >= 80 ? '#10b981' : row.cultivationRate >= 60 ? '#f59e0b' : '#ef4444'};">
                  ✅ 种植率: <strong>${row.cultivationRate}%</strong>
                </div>
                <div style="color: #10b981;">🌱 已种: <strong>${row.plantedArea}</strong> 亩</div>
                <div style="color: #ef4444;">⚠️ 撂荒: <strong>${row.fallowArea}</strong> 亩</div>
                <div style="color: #6b7280;">📈 密度: <strong>${row.density}</strong></div>
              </div>
            </div>
          `
        })
      }
      
      tableHTML += '</div>'
      
      // 渲染表格内容
      container.innerHTML = tableHTML
      
      const tableCanvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        width: 794,
        windowWidth: 794,
        height: container.scrollHeight
      })
      
      const tableImgData = tableCanvas.toDataURL('image/png')
      const tableImgWidth = pageWidth
      const tableImgHeight = (tableCanvas.height * pageWidth) / tableCanvas.width
      
      // 智能分页：如果内容超过一页，分多页显示
      if (tableImgHeight > pageHeight) {
        // 内容太长，需要分页
        const totalPages = Math.ceil(tableImgHeight / pageHeight)
        
        for (let page = 0; page < totalPages; page++) {
          pdf.addPage()
          
          // 计算当前页的裁剪区域
          const sourceY = page * (tableCanvas.height / totalPages)
          const sourceHeight = tableCanvas.height / totalPages
          
          // 创建临时canvas来裁剪当前页
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = tableCanvas.width
          tempCanvas.height = sourceHeight
          const tempCtx = tempCanvas.getContext('2d')
          
          tempCtx.drawImage(
            tableCanvas,
            0, sourceY, tableCanvas.width, sourceHeight,
            0, 0, tableCanvas.width, sourceHeight
          )
          
          const pageImgData = tempCanvas.toDataURL('image/png')
          pdf.addImage(pageImgData, 'PNG', 0, 0, pageWidth, pageHeight)
        }
      } else {
        // 内容适合一页
        pdf.addPage()
        pdf.addImage(tableImgData, 'PNG', 0, 0, tableImgWidth, tableImgHeight)
      }
    }
    
    // 清理临时容器
    document.body.removeChild(container)
    
    // 保存PDF
    const filename = getFinalFileName()
    pdf.save(filename)
    
    console.log('PDF报告生成成功')
  } catch (error) {
    console.error('PDF生成失败:', error)
    throw error
  }
}

// 初始化种植情况识别图表
const initPlantingCharts = () => {
  initRegionChart()  // 区域对比（堆叠柱状图）
  initCropRankingChart()  // 作物总面积排行
  initCropVarietyCountChart()  // 各区域作物种类数量对比
}

// 初始化作物识别图表
const initCultivationCharts = () => {
  initCultivationStatusChart()
  initFallowStatsChart()
  initCoverageRateChart()
  initDensityDistributionChart()
}

const initCropVarietyCountChart = () => {
  const chartDom = document.getElementById('crop-variety-count')
  if (!chartDom) return
  cropVarietyCountChart = echarts.init(chartDom)
  
  // 获取各区域的作物种类数量 - 只使用区域名称
  const regions = plantingTableData.value.map(row => row.regionName)
  const cropCounts = plantingTableData.value.map(row => row.cropCount)
  
  console.log('各区域作物种类数量:', regions.map((region, idx) => ({
    区域: region,
    作物种类: cropCounts[idx]
  })))
  
  const option = {
    title: {
      text: '各区域作物种类数量对比',
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold'
      },
      top: 10
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params) => {
        const item = params[0]
        const row = plantingTableData.value[item.dataIndex]
        let result = `<div style="font-weight: bold; margin-bottom: 8px;">${item.name}</div>`
        result += `<div style="margin: 4px 0;">作物种类: <span style="font-weight: bold; color: #409EFF;">${item.value} 种</span></div>`
        result += `<div style="margin: 4px 0;">总面积: ${row.totalArea} 亩</div>`
        result += `<div style="margin: 4px 0;">地块数量: ${row.plotCount} 个</div>`
        return result
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: 60,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: regions,
      axisLabel: {
        interval: 0,
        rotate: 0,
        formatter: (value) => {
          return value.length > 15 ? value.substring(0, 15) + '...' : value
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '作物种类（种）',
      minInterval: 1,
      axisLabel: {
        formatter: '{value} 种'
      }
    },
    series: [
      {
        name: '作物种类',
        type: 'bar',
        data: cropCounts.map((count, idx) => ({
          value: count,
          itemStyle: {
            color: count >= 5 ? '#67C23A' : count >= 3 ? '#E6A23C' : '#F56C6C',
            borderRadius: [8, 8, 0, 0]
          }
        })),
        label: {
          show: true,
          position: 'top',
          formatter: (params) => {
            return `${params.value} 种`
          },
          fontSize: 12,
          fontWeight: 'bold'
        },
        barMaxWidth: 60
      }
    ]
  }
  
  cropVarietyCountChart.setOption(option)
}

const initRegionChart = () => {
  const chartDom = document.getElementById('region-compare')
  if (!chartDom) return
  regionChart = echarts.init(chartDom)
  
  // 获取所有区域名称 - 只使用区域名称
  const regions = plantingTableData.value.map(row => row.regionName)
  
  // 获取所有有数据的作物（排除裸地和其它耕地）
  const allCrops = new Set()
  plantingTableData.value.forEach(row => {
    Object.entries(row.cropStats).forEach(([cropName, area]) => {
      if (area > 0 && cropName !== '裸地' && cropName !== '其它耕地') {
        allCrops.add(cropName)
      }
    })
  })
  
  console.log('区域对比图 - 作物列表:', Array.from(allCrops))
  console.log('区域对比图 - 区域列表:', regions)
  
  // 构建系列数据（堆叠柱状图）
  const series = Array.from(allCrops).map(cropName => {
    const data = plantingTableData.value.map(row => (row.cropStats[cropName] || 0).toFixed(2))
    console.log(`${cropName} 数据:`, data)
    return {
      name: cropName,
      type: 'bar',
      stack: 'total',
      data: data,
      itemStyle: {
        color: getCropColor(cropName)
      },
      label: {
        show: false  // 不显示堆叠条内的数字，避免拥挤
      }
    }
  })

  const option = {
    title: {
      text: '各区域作物种植对比',
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold'
      },
      top: 10
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params) => {
        let result = `<div style="font-weight: bold; margin-bottom: 8px;">${params[0].axisValue}</div>`
        let total = 0
        params.forEach(item => {
          if (item.value > 0) {
            total += parseFloat(item.value)
            result += `
              <div style="display: flex; align-items: center; margin: 4px 0;">
                <span style="display: inline-block; width: 10px; height: 10px; background: ${item.color}; border-radius: 50%; margin-right: 8px;"></span>
                <span style="flex: 1;">${item.seriesName}:</span>
                <span style="font-weight: bold; margin-left: 8px;">${item.value} 亩</span>
              </div>
            `
          }
        })
        result += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee; font-weight: bold;">总计: ${total.toFixed(2)} 亩</div>`
        return result
      }
    },
    legend: {
      data: Array.from(allCrops),
      top: 45,
      type: 'scroll'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: 90,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: regions,
      axisLabel: {
        interval: 0,
        rotate: 0,
        formatter: (value) => {
          return value.length > 20 ? value.substring(0, 20) + '...' : value
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '面积 (亩)'
    },
    series: series
  }
  
  regionChart.setOption(option)
}

const initCropRankingChart = () => {
  const chartDom = document.getElementById('crop-ranking')
  if (!chartDom) return
  cropRankingChart = echarts.init(chartDom)
  
  // 统计所有作物的总面积（排除裸地和其它耕地）
  const cropTotalArea = {}
  plantingTableData.value.forEach(row => {
    Object.entries(row.cropStats).forEach(([cropName, area]) => {
      if (area > 0 && cropName !== '裸地' && cropName !== '其它耕地') {
        cropTotalArea[cropName] = (cropTotalArea[cropName] || 0) + area
      }
    })
  })
  
  // 转换为数组并排序
  const cropRanking = Object.entries(cropTotalArea)
    .map(([name, area]) => ({ name, area }))
    .sort((a, b) => b.area - a.area)
  
  console.log('作物排行榜数据:', cropRanking)
  
  const option = {
    title: {
      text: '作物种植总面积排行',
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold'
      },
      top: 10
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params) => {
        const item = params[0]
        return `
          <div style="font-weight: bold; margin-bottom: 4px;">${item.name}</div>
          <div>总面积: <span style="font-weight: bold;">${item.value.toFixed(2)}</span> 亩</div>
        `
      }
    },
    grid: {
      left: '15%',
      right: '10%',
      bottom: '3%',
      top: 60,
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: '面积 (亩)'
    },
    yAxis: {
      type: 'category',
      data: cropRanking.map(c => c.name),
      axisLabel: {
        fontSize: 12
      }
    },
    series: [
      {
        name: '面积',
        type: 'bar',
        data: cropRanking.map(c => ({
          value: c.area,
          itemStyle: {
            color: getCropColor(c.name)
          }
        })),
        label: {
          show: true,
          position: 'right',
          formatter: (params) => {
            return `${params.value.toFixed(2)} 亩`
          }
        },
        barMaxWidth: 40
      }
    ]
  }
  
  cropRankingChart.setOption(option)
}

// 作物识别图表初始化 - 改为堆叠柱状图显示各区域地块数量
const initCultivationStatusChart = () => {
  const chartDom = document.getElementById('cultivation-status')
  if (!chartDom) return
  cultivationStatusChart = echarts.init(chartDom)
  
  // 只使用区域名称
  const regions = cultivationTableData.value.map(row => row.regionName)
  const plantedCounts = cultivationTableData.value.map(row => row.plantedCount)
  const fallowCounts = cultivationTableData.value.map(row => row.fallowCount)
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params) => {
        let result = `${params[0].name}<br/>`
        params.forEach(item => {
          result += `${item.marker}${item.seriesName}: ${item.value} 个地块<br/>`
        })
        return result
      }
    },
    legend: {
      data: ['已种植', '撂荒地'],
      bottom: '0%'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '12%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: regions,
      axisLabel: {
        interval: 0,
        rotate: 0,
        formatter: (value) => {
          return value.length > 15 ? value.substring(0, 15) + '...' : value
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '地块数量'
    },
    series: [
      {
        name: '已种植',
        type: 'bar',
        stack: 'total',
        data: plantedCounts,
        itemStyle: {
          color: '#67C23A'
        },
        label: {
          show: true,
          position: 'inside',
          formatter: (params) => params.value > 0 ? params.value : ''
        }
      },
      {
        name: '撂荒地',
        type: 'bar',
        stack: 'total',
        data: fallowCounts,
        itemStyle: {
          color: '#F56C6C'
        },
        label: {
          show: true,
          position: 'inside',
          formatter: (params) => params.value > 0 ? params.value : ''
        }
      }
    ]
  }
  
  cultivationStatusChart.setOption(option)
}

const initFallowStatsChart = () => {
  const chartDom = document.getElementById('fallow-stats')
  if (!chartDom) return
  fallowStatsChart = echarts.init(chartDom)
  
  // 只使用区域名称
  const regions = cultivationTableData.value.map(row => row.regionName)
  const fallowData = cultivationTableData.value.map(row => parseFloat(row.fallowArea))
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params) => {
        const data = params[0]
        const row = cultivationTableData.value[data.dataIndex]
        return `${data.name}<br/>撂荒面积: ${data.value} 亩<br/>撂荒地块: ${row.fallowCount} 个`
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: '面积(亩)'
    },
    yAxis: {
      type: 'category',
      data: regions,
      axisLabel: {
        interval: 0,
        formatter: (value) => {
          // 如果名称太长，截断显示
          return value.length > 20 ? value.substring(0, 20) + '...' : value
        }
      }
    },
    series: [
      {
        name: '撂荒面积',
        type: 'bar',
        data: fallowData,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#fa709a' },
            { offset: 1, color: '#fee140' }
          ]),
          borderRadius: [0, 8, 8, 0]
        },
        label: {
          show: true,
          position: 'right',
          formatter: '{c} 亩'
        }
      }
    ]
  }
  
  fallowStatsChart.setOption(option)
}

const initCoverageRateChart = () => {
  const chartDom = document.getElementById('coverage-rate')
  if (!chartDom) return
  coverageRateChart = echarts.init(chartDom)
  
  // 只使用区域名称
  const regions = cultivationTableData.value.map(row => row.regionName)
  const rateData = cultivationTableData.value.map(row => row.cultivationRate)
  
  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const data = params[0]
        const row = cultivationTableData.value[data.dataIndex]
        return `${data.name}<br/>种植率: ${data.value}%<br/>已种植: ${row.plantedArea} 亩<br/>撂荒地: ${row.fallowArea} 亩`
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: regions,
      axisLabel: {
        interval: 0,
        rotate: 0,
        formatter: (value) => {
          return value.length > 15 ? value.substring(0, 15) + '...' : value
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '种植率(%)',
      max: 100
    },
    series: [
      {
        name: '种植覆盖率',
        type: 'bar',
        data: rateData,
        itemStyle: {
          color: (params) => {
            if (params.value >= 80) return '#67C23A'
            if (params.value >= 50) return '#E6A23C'
            return '#F56C6C'
          },
          borderRadius: [8, 8, 0, 0]
        },
        label: {
          show: true,
          position: 'top',
          formatter: '{c}%'
        }
      }
    ]
  }
  
  coverageRateChart.setOption(option)
}

const initDensityDistributionChart = () => {
  const chartDom = document.getElementById('density-distribution')
  if (!chartDom) return
  densityDistributionChart = echarts.init(chartDom)
  
  // 计算总体已种植面积和撂荒面积
  let totalPlanted = 0
  let totalFallow = 0
  
  cultivationTableData.value.forEach(row => {
    totalPlanted += parseFloat(row.plantedArea) || 0
    totalFallow += parseFloat(row.fallowArea) || 0
  })
  
  const totalArea = totalPlanted + totalFallow
  const plantedPercent = totalArea > 0 ? ((totalPlanted / totalArea) * 100).toFixed(1) : 0
  const fallowPercent = totalArea > 0 ? ((totalFallow / totalArea) * 100).toFixed(1) : 0
  
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        return `${params.name}<br/>面积: ${params.value} 亩<br/>占比: ${params.percent}%`
      }
    },
    legend: {
      bottom: '5%',
      left: 'center'
    },
    series: [
      {
        name: '面积分布',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: (params) => {
            return `${params.name}\n${params.value} 亩\n${params.percent}%`
          }
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        data: [
          { 
            value: totalPlanted.toFixed(2), 
            name: '已种植', 
            itemStyle: { color: '#67C23A' } 
          },
          { 
            value: totalFallow.toFixed(2), 
            name: '撂荒地', 
            itemStyle: { color: '#F56C6C' } 
          }
        ]
      }
    ]
  }
  
  densityDistributionChart.setOption(option)
}

onMounted(() => {
  // 图表将在数据分析后初始化
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  disposeCharts()
})

const handleResize = () => {
    cropChart?.resize()
    cropVarietyCountChart?.resize()
    trendChart?.resize()
    regionChart?.resize()
  cropRankingChart?.resize()
  cultivationStatusChart?.resize()
  fallowStatsChart?.resize()
  coverageRateChart?.resize()
  densityDistributionChart?.resize()
}

const disposeCharts = () => {
  cropChart?.dispose()
  cropVarietyCountChart?.dispose()
  trendChart?.dispose()
  regionChart?.dispose()
  cropRankingChart?.dispose()
  cultivationStatusChart?.dispose()
  fallowStatsChart?.dispose()
  coverageRateChart?.dispose()
  densityDistributionChart?.dispose()
}
</script>

<style scoped lang="scss">
.report-container {
  .steps-card {
    margin-bottom: 20px;
    border-radius: 8px;
  }

  .task-data-card {
    margin-bottom: 20px;
    border-radius: 8px;
    
    .section {
      margin-bottom: 30px;
      padding-bottom: 30px;
      border-bottom: 1px dashed #EBEEF5;

      &:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
      }

      .section-header {
        margin-bottom: 20px;

        .section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 18px;
          font-weight: 600;
          color: #303133;
        }
      }
    }

    .upload-section,
    .existing-files-section {
      margin-top: 20px;
      animation: slideIn 0.3s ease-in-out;
    }
  }

  .upload-area {
    margin: 20px 0;
    
    :deep(.el-upload-dragger) {
      padding: 40px;
    }
  }

  .uploaded-files {
    margin-top: 20px;
  }

  .data-source-selector {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    width: 100%;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }

    .source-option {
      cursor: pointer;
      transition: all 0.3s ease;
      border: 2px solid #E4E7ED;
      background: #ffffff;

      &.is-selected {
        border-color: #409EFF;
        background: linear-gradient(to bottom right, #f0f7ff, #ffffff);
        box-shadow: 0 4px 16px rgba(64, 158, 255, 0.2);
      }

      &:hover {
        transform: translateY(-3px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
        border-color: #409EFF;
      }

      .source-content {
        display: flex;
        align-items: center;
        gap: 20px;
        padding: 24px 28px;

        .source-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          flex-shrink: 0;

          svg {
            color: #ffffff;
          }
        }

        .source-text {
          flex: 1;
          text-align: left;

          h4 {
            margin: 0 0 6px 0;
            font-size: 16px;
            font-weight: 600;
            color: #303133;
          }

          p {
            margin: 0;
            font-size: 13px;
            color: #909399;
            line-height: 1.5;
          }
        }
      }
    }
  }

  .task-selector {
    display: flex;
    flex-direction: row;
    gap: 24px;
    width: 100%;

    @media (max-width: 768px) {
      flex-direction: column;
    }

    .task-option {
      flex: 1;
      min-height: 320px;
      cursor: pointer;
      transition: all 0.3s;
      border: 2px solid transparent;

      &.is-selected {
        border-color: #409EFF;
        box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
      }

      &:hover {
        transform: translateY(-2px);
      }

      :deep(.el-radio) {
        width: 100%;
        height: 100%;

        .el-radio__label {
          width: 100%;
          height: 100%;
          padding: 0;
          display: block;
        }

        .el-radio__input {
          display: none;
        }
      }

      .task-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 20px;
        padding: 30px 24px;
        height: 100%;

        .task-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 16px;
          color: white;
          flex-shrink: 0;
        }

        .task-info {
          width: 100%;
          flex: 1;
          display: flex;
          flex-direction: column;

          h3 {
            margin: 0 0 12px 0;
            font-size: 20px;
            color: #303133;
            font-weight: 600;
          }

          p {
            margin: 0 0 16px 0;
            color: #606266;
            line-height: 1.8;
            font-size: 14px;
            flex: 1;
          }

          .el-space {
            width: 100%;
            justify-content: center;
          }
        }
      }
    }
  }

  .step-actions {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid #EBEEF5;
  }

  .report-content {
    animation: fadeIn 0.3s ease-in;
  }

  .action-card {
    margin-bottom: 20px;
    border-radius: 8px;
  }
  
  .chart-card, .table-card {
    border-radius: 8px;
    
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
    
    .chart-container {
      height: 350px;
    }
    
    .trend-chart-container {
      height: 400px;
    }
  }
  
  .pagination-container {
    display: flex;
    justify-content: center;
    margin-top: 20px;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 报告预览对话框样式
.report-preview-dialog {
  .report-preview-content {
    max-height: 600px;
    overflow-y: auto;

    .report-header {
      h2 {
        color: #303133;
        font-size: 24px;
        font-weight: 600;
      }
    }

    .selected-items-list {
      h3 {
        margin-bottom: 20px;
        color: #303133;
        font-size: 18px;
      }

      .el-timeline {
        padding-left: 0;
      }
      
      .el-timeline-item {
        padding-bottom: 20px;
      }
    }

    .empty-state {
      padding: 40px 0;
      text-align: center;
    }
  }
}
</style>


