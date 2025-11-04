<template>
  <div class="report-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-text">
          <h2>📊 智能分析报表</h2>
          <p>选择作物识别结果，进行智能分析并生成专业报告</p>
        </div>
        <div class="header-actions" v-if="currentStep > 0 || phase1Data.length > 0">
          <el-button 
            type="warning" 
            :icon="RotateCcw" 
            @click="handleClearData"
            plain
          >
            清除并重新分析
          </el-button>
        </div>
      </div>
    </div>

    <!-- 步骤指示器 -->
    <el-card class="steps-card" shadow="never">
      <el-steps :active="currentStep" finish-status="success" align-center>
        <el-step title="选择数据" description="从识别结果中选择数据" />
        <el-step title="种植情况分析" description="分析所有区域的种植状态" />
        <el-step title="作物详细分析" description="深入分析作物类型分布" />
      </el-steps>
    </el-card>

    <!-- 步骤1: 选择数据源 -->
    <el-card v-show="currentStep === 0" class="step-card" shadow="never">
      <template #header>
        <div class="card-header">
            <FolderOpen :size="20" />
          <span>从识别结果选择</span>
        </div>
      </template>

          <el-alert
        title="数据要求"
            type="info"
            :closable="false"
            style="margin-bottom: 20px"
          >
        <p style="margin: 0;">请选择<strong>作物识别</strong>类型的识别结果进行分析</p>
          </el-alert>

      <!-- 从识别结果选择 -->
        <div class="existing-files-section">
          <el-table 
            :data="filteredExistingFiles" 
            v-loading="loadingFiles"
            @selection-change="handleSelectionChange"
            stripe
          max-height="500"
          >
            <el-table-column type="selection" width="55" />
          <el-table-column prop="name" label="文件名称" min-width="200" />
          <el-table-column prop="type" label="文件类型" width="120" align="center">
              <template #default="{ row }">
              <el-tag :type="row.type === 'GeoJSON' ? 'success' : row.type === 'SHP' ? 'warning' : 'info'" size="small">
                {{ row.type }}
              </el-tag>
              </template>
            </el-table-column>
          <el-table-column prop="regionName" label="区域" width="150" align="center">
              <template #default="{ row }">
              <el-tag size="small" type="info">{{ row.regionName || '未知区域' }}</el-tag>
              </template>
            </el-table-column>
          <el-table-column prop="recognitionType" label="任务来源" width="150" align="center">
              <template #default="{ row }">
              <el-tag type="success" size="small">
                {{ getRecognitionTypeLabel(row.recognitionType) }}
                </el-tag>
              </template>
            </el-table-column>
          <el-table-column prop="uploadTime" label="上传时间" width="180" align="center" />
          </el-table>

        <el-empty v-if="!loadingFiles && filteredExistingFiles.length === 0" description="暂无作物识别结果数据">
            <template #description>
              <p style="margin: 0; color: #909399;">
              暂无作物识别结果数据
              </p>
              <p style="margin: 8px 0 0 0; font-size: 13px; color: #C0C4CC;">
              请前往数据管理界面上传作物识别结果
              </p>
            </template>
          </el-empty>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons" style="margin-top: 30px; text-align: center;">
        <el-button 
          type="primary" 
          size="large"
          :disabled="!canAnalyze"
          :loading="analyzing"
          @click="startAnalysis"
        >
          <template #icon><BarChart :size="18" /></template>
          {{ analyzing ? '分析中...' : '开始分析' }}
        </el-button>
      </div>
    </el-card>

    <!-- 步骤2: 第一阶段分析 - 种植情况分析 -->
    <el-card v-show="currentStep === 1" class="step-card" shadow="never">
          <template #header>
            <div class="card-header">
          <ScanSearch :size="20" />
          <span>第一阶段：种植情况分析</span>
          <el-tag type="info" size="small" style="margin-left: auto;">
            {{ phase1Data.length }} 个区域
          </el-tag>
            </div>
          </template>

      <el-alert
        title="分析说明"
        type="success"
        :closable="false"
        style="margin-bottom: 20px"
      >
        <p>已对所有选中区域进行统一的种植/未种植分析：</p>
        <ul>
          <li><strong>作物识别分析</strong>：1=裸地（未种植），2-10=作物（已种植）</li>
        </ul>
      </el-alert>

      <!-- 统计卡片 -->
      <div class="stats-cards">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #e3f2fd;">
              <MapPin :size="32" style="color: #2196f3;" />
            </div>
            <div class="stat-info">
              <div class="stat-label">分析区域</div>
              <div class="stat-value">{{ phase1Data.length }}</div>
            </div>
          </div>
        </el-card>
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #e8f5e9;">
              <Sprout :size="32" style="color: #4caf50;" />
            </div>
            <div class="stat-info">
              <div class="stat-label">已种植地块</div>
              <div class="stat-value">{{ totalPlantedCount }}</div>
            </div>
          </div>
        </el-card>
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #fff3e0;">
              <BarChart :size="32" style="color: #ff9800;" />
            </div>
            <div class="stat-info">
              <div class="stat-label">平均种植率</div>
              <div class="stat-value">{{ averagePlantingRate }}%</div>
            </div>
          </div>
        </el-card>
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #fce4ec;">
              <PieChart :size="32" style="color: #e91e63;" />
            </div>
            <div class="stat-info">
              <div class="stat-label">撂荒地块</div>
              <div class="stat-value">{{ totalFallowCount }}</div>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 详细数据表格 -->
      <el-card shadow="never" style="margin-top: 20px;">
          <template #header>
            <div class="card-header">
            <Ticket :size="16" />
            <span>各区域种植情况详细数据</span>
            </div>
          </template>
        <el-table :data="phase1Data" stripe border>
          <el-table-column prop="regionName" label="区域" width="150" align="center" fixed />
          <el-table-column prop="recognitionType" label="任务来源" width="150" align="center">
            <template #default="{ row }">
              <el-tag :type="row.recognitionType === 'crop_recognition' ? 'success' : 'warning'" size="small">
                {{ getRecognitionTypeLabel(row.recognitionType) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="totalCount" label="总地块数" width="120" align="center" />
          <el-table-column prop="plantedCount" label="已种植" width="120" align="center">
            <template #default="{ row }">
              <el-tag type="success" size="small">{{ row.plantedCount }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="fallowCount" label="未种植" width="120" align="center">
            <template #default="{ row }">
              <el-tag type="warning" size="small">{{ row.fallowCount }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="plantingRate" label="种植率" width="120" align="center">
            <template #default="{ row }">
              <el-progress :percentage="row.plantingRate" :color="getProgressColor(row.plantingRate)" />
            </template>
          </el-table-column>
          <el-table-column prop="plantedArea" label="已种植面积(亩)" width="150" align="center" />
          <el-table-column prop="fallowArea" label="撂荒面积(亩)" width="150" align="center" />
        </el-table>
        </el-card>

      <!-- 图表展示 -->
      <div class="charts-section">
        <!-- 各区域种植率对比 -->
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="card-header">
              <BarChart :size="16" />
              <span>各区域种植率对比</span>
            </div>
          </template>
          <div id="planting-rate-chart" class="chart-container"></div>
        </el-card>

        <!-- 种植/撂荒地块统计 -->
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header">
              <BarChart :size="16" />
              <span>种植/撂荒地块统计</span>
              </div>
            </template>
          <div id="planting-status-chart" class="chart-container"></div>
          </el-card>

        <!-- 总体种植情况分布 -->
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header">
              <PieChart :size="16" />
              <span>总体种植情况分布</span>
              </div>
            </template>
          <div id="overall-pie-chart" class="chart-container"></div>
          </el-card>

        <!-- 撂荒面积对比 -->
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header">
              <BarChart :size="16" />
              <span>撂荒面积对比</span>
              </div>
            </template>
          <div id="fallow-area-chart" class="chart-container"></div>
          </el-card>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons" style="margin-top: 30px; text-align: center;">
        <el-button size="large" @click="currentStep = 0">
          <template #icon><RotateCcw :size="18" /></template>
          重新选择数据
        </el-button>
        <el-button 
          type="primary" 
          size="large"
          @click="enterPhase2"
        >
          <template #icon><Sprout :size="18" /></template>
          进入作物详细分析
        </el-button>
      </div>
    </el-card>

    <!-- 步骤3: 第二阶段分析 - 作物详细分析 -->
    <el-card v-show="currentStep === 2" class="step-card" shadow="never">
            <template #header>
              <div class="card-header">
          <Sprout :size="20" />
          <span>第二阶段：作物详细分析</span>
          <el-tag type="success" size="small" style="margin-left: auto;">
            {{ phase2Data.length }} 个区域
          </el-tag>
              </div>
            </template>

      <el-alert
        title="分析说明"
        type="success"
        :closable="false"
        style="margin-bottom: 20px"
      >
        <p>仅对<strong>作物识别来源</strong>的文件进行详细作物类型分析（值2-10对应不同作物类型）</p>
      </el-alert>

      <!-- 作物统计卡片 -->
      <div class="stats-cards">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #e8f5e9;">
              <Sprout :size="32" style="color: #4caf50;" />
            </div>
            <div class="stat-info">
              <div class="stat-label">作物种类</div>
              <div class="stat-value">{{ totalCropTypes }}</div>
            </div>
          </div>
          </el-card>
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #fff3e0;">
              <BarChart :size="32" style="color: #ff9800;" />
            </div>
            <div class="stat-info">
              <div class="stat-label">总种植面积</div>
              <div class="stat-value">{{ totalCropArea }} 亩</div>
            </div>
          </div>
        </el-card>
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #e3f2fd;">
              <PieChart :size="32" style="color: #2196f3;" />
            </div>
            <div class="stat-info">
              <div class="stat-label">主要作物</div>
              <div class="stat-value">{{ dominantCrop }}</div>
            </div>
          </div>
        </el-card>
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #f3e5f5;">
              <MapPin :size="32" style="color: #9c27b0;" />
            </div>
            <div class="stat-info">
              <div class="stat-label">分析区域</div>
              <div class="stat-value">{{ phase2Data.length }}</div>
            </div>
          </div>
        </el-card>
    </div>

      <!-- 详细数据表格 -->
      <el-card ref="phase2DetailTableCard" shadow="never" style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
            <Ticket :size="16" />
            <span>各区域作物分布详细数据</span>
        </div>
      </template>
        <el-table :data="phase2Data" stripe border>
          <el-table-column prop="regionName" label="区域" width="150" align="center" fixed />
          <el-table-column prop="cropTypes" label="作物种类数" width="120" align="center" />
          <el-table-column label="作物分布" min-width="300">
            <template #default="{ row }">
              <div v-if="row.cropDistribution && row.cropDistribution.length > 0" style="display: flex; flex-wrap: wrap; gap: 6px;">
                <el-tag 
                  v-for="crop in row.cropDistribution.filter(c => c.name !== '裸地')" 
                  :key="crop.name"
                  :style="{ 
                    backgroundColor: crop.color, 
                    color: crop.name === '棉花' ? '#333' : '#fff',
                    border: 'none',
                    fontWeight: '500',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }"
                  size="small"
                >
                  {{ crop.name }}: {{ crop.count }}个 ({{ crop.area }}亩)
            </el-tag>
              </div>
              <span v-else style="color: #909399;">无数据</span>
          </template>
        </el-table-column>
          <el-table-column prop="totalArea" label="总种植面积(亩)" width="150" align="center" />
          <el-table-column prop="dominantCrop" label="主要作物" width="120" align="center">
            <template #default="{ row }">
              <el-tag type="success" size="small">{{ row.dominantCrop }}</el-tag>
          </template>
        </el-table-column>
        </el-table>
      </el-card>

      <!-- 图表展示 -->
      <div class="charts-section">
        <!-- 作物类型分布 -->
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="card-header">
              <PieChart :size="16" />
              <span>作物类型分布</span>
            </div>
              </template>
          <div id="crop-type-pie-chart" class="chart-container"></div>
        </el-card>

        <!-- 各区域作物种类数量 -->
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="card-header">
              <BarChart :size="16" />
              <span>各区域作物种类数量</span>
            </div>
          </template>
          <div id="crop-variety-chart" class="chart-container"></div>
        </el-card>

        <!-- 作物面积排名 -->
        <el-card shadow="never" class="chart-card-wide">
          <template #header>
            <div class="card-header">
              <BarChart :size="16" />
              <span>作物面积排名</span>
            </div>
          </template>
          <div id="crop-area-ranking-chart" class="chart-container"></div>
        </el-card>

        <!-- 各区域作物分布对比 -->
        <el-card shadow="never" class="chart-card-large">
          <template #header>
            <div class="card-header">
              <BarChart :size="16" />
              <span>各区域作物分布对比</span>
            </div>
          </template>
          <div id="region-crop-compare-chart" class="chart-container-large"></div>
        </el-card>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons" style="margin-top: 30px; text-align: center;">
        <el-button size="large" @click="currentStep = 1">
          <template #icon><RotateCcw :size="18" /></template>
          返回上一步
        </el-button>
        <el-button 
          type="success" 
          size="large"
          @click="handlePreviewReport"
        >
          <template #icon><Download :size="18" /></template>
          预览/导出报告
        </el-button>
      </div>
    </el-card>

    <!-- PDF预览对话框 - 带完整配置面板 -->
    <el-dialog
      v-model="showPdfPreview"
      title="📄 PDF预览与导出"
      width="95%"
      top="5vh"
      :close-on-click-modal="false"
      destroy-on-close
      class="pdf-preview-dialog"
    >
      <div class="preview-container">
        <!-- 左侧：配置面板 -->
        <div class="config-sidebar">
          <div class="sidebar-header">
            <div class="title">🎨 样式配置</div>
            <div class="button-group">
              <el-button size="small" @click="resetConfig">
                <RotateCcw :size="14" />
                重置
              </el-button>
              <el-button size="small" @click="applyConfig" type="primary">
                应用配置
              </el-button>
            </div>
          </div>
          
          <!-- 标签页切换 -->
          <el-tabs v-model="activeConfigTab" class="config-tabs">
            <el-tab-pane label="🔤 字体配置" name="font">
              <div class="font-items">
                <div class="font-item">
                  <label>封面标题</label>
                  <el-input-number v-model="fontConfig.coverTitle" :min="20" :max="60" :step="2" size="small" controls-position="right" />
                </div>
                <div class="font-item">
                  <label>主标题</label>
                  <el-input-number v-model="fontConfig.title" :min="16" :max="40" :step="2" size="small" controls-position="right" />
                </div>
                <div class="font-item">
                  <label>小标题</label>
                  <el-input-number v-model="fontConfig.subtitle" :min="14" :max="32" :step="2" size="small" controls-position="right" />
                </div>
                <div class="font-item">
                  <label>表格表头</label>
                  <el-input-number v-model="fontConfig.tableHeader" :min="12" :max="28" :step="1" size="small" controls-position="right" />
                </div>
                <div class="font-item">
                  <label>表格内容</label>
                  <el-input-number v-model="fontConfig.tableCell" :min="10" :max="24" :step="1" size="small" controls-position="right" />
                </div>
                <div class="font-item">
                  <label>说明文字</label>
                  <el-input-number v-model="fontConfig.description" :min="10" :max="20" :step="1" size="small" controls-position="right" />
                </div>
                <div class="font-item">
                  <label>卡片数值</label>
                  <el-input-number v-model="fontConfig.cardValue" :min="20" :max="48" :step="2" size="small" controls-position="right" />
                </div>
                
                <!-- 图表字体配置 -->
                <el-divider content-position="left" style="margin: 15px 0 10px 0;">
                  <span style="font-size: 12px; color: #909399;">📊 图表字体</span>
                </el-divider>
                
                <div class="font-item">
                  <label>图例大小</label>
                  <el-input-number v-model="fontConfig.chartLegend" :min="8" :max="24" :step="1" size="small" controls-position="right" />
                </div>
                <div class="font-item">
                  <label>柱状图数值</label>
                  <el-input-number v-model="fontConfig.chartBarLabel" :min="8" :max="28" :step="1" size="small" controls-position="right" />
                </div>
                <div class="font-item">
                  <label>饼图数值</label>
                  <el-input-number v-model="fontConfig.chartPieLabel" :min="8" :max="28" :step="1" size="small" controls-position="right" />
                </div>
                <div class="font-item">
                  <label>坐标轴文字</label>
                  <el-input-number v-model="fontConfig.chartAxisLabel" :min="8" :max="28" :step="1" size="small" controls-position="right" />
                </div>
              </div>
              
              <el-alert type="info" :closable="false" style="margin-top: 15px;">
                <template #title>
                  <div style="font-size: 11px; line-height: 1.8; color: #606266;">
                    <div style="margin-bottom: 8px; font-weight: 600; color: #409EFF;">💡 图表字体说明：</div>
                    <div>• <strong>图例大小</strong>：所有图表右侧或底部的颜色块+文字说明</div>
                    <div>• <strong>柱状图数值</strong>：柱子上方或内部显示的数字</div>
                    <div>• <strong>饼图数值</strong>：饼图扇区上显示的百分比或数值</div>
                    <div>• <strong>坐标轴文字</strong>：柱状图X轴Y轴的所有文字（包括刻度和名称，如"作物种类数"、"面积(亩)"等）</div>
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #E4E7ED; color: #909399;">
                      调整后点击"应用配置"查看效果
                    </div>
                  </div>
                </template>
              </el-alert>
            </el-tab-pane>
            
            <el-tab-pane label="🎨 配色方案" name="color">
              <div class="color-schemes">
                <el-radio-group v-model="selectedColorScheme" class="scheme-list">
                  <el-radio 
                    v-for="(scheme, key) in COLOR_SCHEMES" 
                    :key="key" 
                    :label="key" 
                    class="scheme-radio"
                  >
                    <div class="scheme-option">
                      <span class="scheme-name">{{ scheme.name }}</span>
                      <div class="scheme-colors">
                        <div 
                          v-for="(color, index) in scheme.colors" 
                          :key="index" 
                          class="color-dot" 
                          :style="{ background: color }"
                        ></div>
                      </div>
                    </div>
                  </el-radio>
                </el-radio-group>
              </div>
              
              <el-alert type="success" :closable="false" style="margin-top: 15px; font-size: 12px;">
                <template #title>
                  <div style="line-height: 1.8;">
                    🎨 选择配色方案后点击"应用配置"查看效果。
                  </div>
                </template>
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #d0f0e4;">
                  <div style="font-weight: 600; margin-bottom: 8px;">📊 五个色块含义说明：</div>
                  <div style="line-height: 1.8; font-size: 12px;">
                    <div style="color: #059669;">① <strong>主色</strong>：表格表头、标题左侧竖线、提示框边框等主要元素</div>
                    <div style="color: #0891b2;">② <strong>次色</strong>：渐变色卡片、图表装饰等次要元素</div>
                    <div style="color: #10b981;">③ <strong>成功色</strong>：增长趋势、正向数据、未变化地块等积极信息</div>
                    <div style="color: #f59e0b;">④ <strong>警告色</strong>：变化地块、需要关注的数据</div>
                    <div style="color: #ef4444;">⑤ <strong>危险色</strong>：减少趋势、负向数据、重要警告</div>
                  </div>
                </div>
              </el-alert>
            </el-tab-pane>
          </el-tabs>
        </div>
        
        <!-- 右侧：PDF预览 -->
        <div class="preview-area">
          <div v-if="pdfPreviewUrl && !generating" class="pdf-viewer">
            <iframe 
              :key="pdfPreviewUrl"
              :src="pdfPreviewUrl" 
              frameborder="0"
            />
          </div>
          <div v-else-if="generating" class="preview-loading">
            <div class="loading-animation">
              <el-icon :size="60" class="rotating-icon"><Loading /></el-icon>
            </div>
            <el-progress 
              :percentage="generatingProgress" 
              :stroke-width="16" 
              striped 
              striped-flow 
              :color="'#667eea'"
              style="width: 80%; margin-top: 30px;"
            >
              <template #default="{ percentage }">
                <span style="font-size: 18px; font-weight: 600; color: #667eea;">{{ percentage }}%</span>
              </template>
            </el-progress>
            <p style="margin-top: 20px; color: #667eea; font-size: 16px; font-weight: 500;">{{ generatingMessage }}</p>
          </div>
          <div v-else class="preview-placeholder">
            <el-empty description="点击应用配置按钮生成PDF预览">
              <template #image>
                <div style="font-size: 48px;">📄</div>
              </template>
            </el-empty>
          </div>
        </div>
      </div>
      
      <template #footer>
        <div style="display: flex; align-items: center; gap: 15px; width: 100%;">
          <div style="flex: 1; display: flex; align-items: center; gap: 10px;">
            <span style="white-space: nowrap; font-weight: 500;">文件名称：</span>
            <el-input 
              v-model="pdfFilename" 
              placeholder="请输入文件名（留空使用默认名称）"
              style="flex: 1;"
              clearable
            />
            <span style="white-space: nowrap; color: #909399;">.pdf</span>
          </div>
          <div style="display: flex; gap: 10px;">
            <el-button @click="closePdfPreview">取消</el-button>
            <el-button 
              type="primary" 
              @click="handleExportPdf" 
              :disabled="!pdfBlob || generating"
              :loading="exporting"
            >
              <template #icon><Download :size="16" /></template>
              {{ exporting ? '导出中...' : '导出PDF' }}
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// 定义组件名称，用于keep-alive缓存
defineOptions({
  name: 'Report'
})
import { UploadFilled, Loading } from '@element-plus/icons-vue'
import {
  Download, RotateCcw, PieChart, BarChart,
  FolderOpen, MapPin,
  Sprout, Ticket
} from 'lucide-vue-next'
import * as echarts from 'echarts'
import { getRecognitionResults, readGeojsonContent } from '@/api/analysis'
import { getCropName, getCropColor } from '@/config/cropMapping'
import { extractRegionName } from '@/config/regionMapping'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// ==================== 状态管理 ====================
const currentStep = ref(0)
const analyzing = ref(false)
const generating = ref(false)
const generatingProgress = ref(0)
const generatingMessage = ref('')
const exporting = ref(false)

// ==================== 从识别结果选择 ====================
const existingFiles = ref([])
const selectedExistingFiles = ref([])
const loadingFiles = ref(false)

// ==================== 分析数据 ====================
const phase1Data = ref([]) // 第一阶段：所有文件的种植情况分析
const phase2Data = ref([]) // 第二阶段：作物详细分析

// ==================== PDF预览相关 ====================
const showPdfPreview = ref(false)
const pdfPreviewUrl = ref('')
const pdfBlob = ref(null)
const pdfFilename = ref('')
const activeConfigTab = ref('font')


// ==================== 字体配置 ====================
const defaultFontConfig = {
  coverTitle: 28,
  title: 20,
  subtitle: 16,
  tableHeader: 14,
  tableCell: 12,
  description: 11,
  cardValue: 24,
  // 图表字体
  chartBarLabel: 12,
  chartPieLabel: 12,
  chartLegend: 12,
  chartAxisLabel: 12
}
const fontConfig = ref({ ...defaultFontConfig })

// ==================== 配色方案 ====================
const selectedColorScheme = ref('classic')
const COLOR_SCHEMES = {
  classic: {
    name: '经典蓝紫（默认）',
    primary: '#4f46e5',
    secondary: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    colors: ['#4f46e5', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']
  },
  dream: {
    name: '梦幻紫',
    primary: '#9333ea',
    secondary: '#a855f7',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    colors: ['#9333ea', '#a855f7', '#10b981', '#f59e0b', '#ef4444']
  },
  business: {
    name: '商务深蓝',
    primary: '#1e40af',
    secondary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    colors: ['#1e40af', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']
  },
  ocean: {
    name: '海洋蓝',
    primary: '#0891b2',
    secondary: '#06b6d4',
    success: '#14b8a6',
    warning: '#f59e0b',
    danger: '#ef4444',
    colors: ['#0891b2', '#06b6d4', '#14b8a6', '#f59e0b', '#ef4444']
  },
  fresh: {
    name: '清新绿色',
    primary: '#059669',
    secondary: '#10b981',
    success: '#14b8a6',
    warning: '#f59e0b',
    danger: '#ef4444',
    colors: ['#059669', '#10b981', '#14b8a6', '#f59e0b', '#ef4444']
  },
  sunset: {
    name: '日落橙',
    primary: '#ea580c',
    secondary: '#f97316',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    colors: ['#ea580c', '#f97316', '#10b981', '#f59e0b', '#ef4444']
  },
  elegant: {
    name: '典雅灰色',
    primary: '#374151',
    secondary: '#6b7280',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    colors: ['#374151', '#6b7280', '#10b981', '#f59e0b', '#ef4444']
  }
}

// ==================== ECharts 实例 ====================
let plantingRateChart = null
let plantingStatusChart = null
let overallPieChart = null
let fallowAreaChart = null
let cropTypePieChart = null
let cropVarietyChart = null
let cropAreaRankingChart = null
let regionCropCompareChart = null

// 第二阶段详细数据表格ref
const phase2DetailTableCard = ref(null)

// ==================== 计算属性 ====================

// 任务来源标签
const getRecognitionTypeLabel = (recognitionType) => {
  const typeMap = {
    'crop_recognition': '作物识别',
    'planting_situation': '种植情况识别',
    'crop_info': '作物识别',
    'planting_status': '种植情况识别'
  }
  return typeMap[recognitionType] || '未知任务'
}

// 只显示GeoJSON格式的作物识别文件（排除种植情况识别）
const filteredExistingFiles = computed(() => {
  return existingFiles.value.filter(file => {
    // 只要GeoJSON格式
    const isGeoJSON = file.type === 'GeoJSON' || file.type === 'geojson'
    
    // 只要作物识别任务（recognitionType为crop_recognition或crop_info）
    // 排除种植情况识别（planting_situation或planting_status）
    const isCropRecognition = file.recognitionType === 'crop_recognition' || 
                              file.recognitionType === 'crop_info'
    
    return isGeoJSON && isCropRecognition
  })
})

// 是否可以开始分析
const canAnalyze = computed(() => {
  return selectedExistingFiles.value.length > 0
})

// 第一阶段统计数据
const totalPlantedCount = computed(() => {
  return phase1Data.value.reduce((sum, item) => sum + item.plantedCount, 0)
})

const totalFallowCount = computed(() => {
  return phase1Data.value.reduce((sum, item) => sum + item.fallowCount, 0)
})

const averagePlantingRate = computed(() => {
  if (phase1Data.value.length === 0) return 0
  const sum = phase1Data.value.reduce((total, item) => total + item.plantingRate, 0)
  return (sum / phase1Data.value.length).toFixed(1)
})

// 第二阶段统计数据
const totalCropTypes = computed(() => {
  const cropSet = new Set()
  phase2Data.value.forEach(region => {
    if (region.cropDistribution) {
      region.cropDistribution.forEach(crop => {
        // 排除裸地
        if (crop.name !== '裸地') {
          cropSet.add(crop.name)
        }
      })
    }
  })
  return cropSet.size
})

const totalCropArea = computed(() => {
  // 只统计值为2-10的作物面积（排除裸地class=1）
  let total = 0
  phase2Data.value.forEach(region => {
    if (region.cropDistribution) {
      region.cropDistribution.forEach(crop => {
        // 排除裸地（class=1）
        if (crop.name !== '裸地') {
          total += parseFloat(crop.area || 0)
        }
      })
    }
  })
  return total.toFixed(2)
})

const dominantCrop = computed(() => {
  const cropAreas = {} // 改为统计面积而不是数量
  phase2Data.value.forEach(region => {
    if (region.cropDistribution) {
      region.cropDistribution.forEach(crop => {
        // 排除裸地
        if (crop.name !== '裸地') {
          cropAreas[crop.name] = (cropAreas[crop.name] || 0) + parseFloat(crop.area || 0)
        }
      })
    }
  })
  
  let maxCrop = '无'
  let maxArea = 0
  Object.entries(cropAreas).forEach(([crop, area]) => {
    if (area > maxArea) {
      maxArea = area
      maxCrop = crop
    }
  })
  
  return maxCrop
})

// 进度条颜色
const getProgressColor = (percentage) => {
  if (percentage < 30) return '#F56C6C'
  if (percentage < 60) return '#E6A23C'
  if (percentage < 80) return '#409EFF'
  return '#67C23A'
}

// ==================== 文件处理 ====================

// 加载已有识别结果
const loadExistingFiles = async () => {
  loadingFiles.value = true
  try {
    const response = await getRecognitionResults()
    const files = response.data || response || []
    
    existingFiles.value = files.map(file => {
      const fileName = file.filename || file.name || ''
      let recognitionType = file.recognitionType || file.metadata?.recognitionType || 'crop_recognition'
      let regionName = file.regionName || file.metadata?.regionName || extractRegionName(fileName)

      return {
        name: fileName,
        type: file.type || file.fileType || 'GeoJSON',
        regionName: regionName,
        recognitionType: recognitionType,
        uploadTime: file.uploadTime || file.createTime || file.metadata?.uploadTime || new Date().toLocaleString(),
        path: file.path || file.relativePath,
        metadata: file.metadata,
        data: null
      }
    })

    console.log('加载的文件列表:', existingFiles.value)
    console.log('过滤后的作物识别文件:', filteredExistingFiles.value)
  } catch (error) {
    console.error('加载识别结果失败:', error)
    ElMessage.error('加载识别结果失败，请重试')
    existingFiles.value = []
  } finally {
    loadingFiles.value = false
  }
}

// 处理选择变化
const handleSelectionChange = (selection) => {
  selectedExistingFiles.value = selection
}

// ==================== 数据分析 ====================

// 开始分析
const startAnalysis = async () => {
  analyzing.value = true
  
  try {
// 加载选中文件的数据
    const filesToAnalyze = []
  for (const file of selectedExistingFiles.value) {
    try {
        let geojsonFileName = file.name
        
        // 处理SHP和KMZ
        if (file.type === 'SHP' || file.name.toLowerCase().endsWith('.shp')) {
          const baseName = file.name.replace(/\.shp$/i, '')
          geojsonFileName = `${baseName}.geojson`
        } else if (file.type === 'KMZ' || file.name.toLowerCase().endsWith('.kmz')) {
          const baseName = file.name.replace(/\.kmz$/i, '')
          geojsonFileName = `${baseName}.geojson`
        }
        
        const response = await readGeojsonContent(geojsonFileName)
        file.data = response.data
        filesToAnalyze.push(file)
    } catch (error) {
      console.error(`加载文件 ${file.name} 失败:`, error)
      ElMessage.warning(`文件 ${file.name} 加载失败，已跳过`)
    }
  }
  
    if (filesToAnalyze.length === 0) {
      ElMessage.error('没有可分析的文件')
      analyzing.value = false
      return
    }

    // 第一阶段分析：统一分析种植情况（所有文件都是作物识别：1=裸地，2-10=作物）
    phase1Data.value = filesToAnalyze.map(file => {
      const geojson = file.data
      if (!geojson || !geojson.features) {
        return null
      }

      const features = geojson.features
      let plantedCount = 0
      let fallowCount = 0
      let plantedArea = 0
      let fallowArea = 0

      features.forEach(feature => {
        const classValue = feature.properties?.class ?? feature.properties?.gridcode
        // 读取面积字段：优先使用area_mu（亩），其次area_m2转换，最后dcmj
      let area = 0
        if (feature.properties?.area_mu) {
          area = parseFloat(feature.properties.area_mu)
        } else if (feature.properties?.area_m2) {
          area = parseFloat(feature.properties.area_m2) / 666.67 // 平方米转亩
        } else if (feature.properties?.dcmj) {
          area = parseFloat(feature.properties.dcmj)
        } else {
          area = 0.1 // 最后的默认值
        }

        // 作物识别：1=裸地（未种植），2-10=作物（已种植）
        if (classValue === 1) {
          fallowCount++
          fallowArea += area
        } else if (classValue >= 2 && classValue <= 10) {
          plantedCount++
          plantedArea += area
        }
      })

      const totalCount = plantedCount + fallowCount
      const plantingRate = totalCount > 0 ? ((plantedCount / totalCount) * 100).toFixed(1) : 0

      return {
        regionName: file.regionName,
        recognitionType: 'crop_recognition', // 所有文件都是作物识别
        totalCount: totalCount,
        plantedCount: plantedCount,
        fallowCount: fallowCount,
        plantingRate: parseFloat(plantingRate),
        plantedArea: plantedArea.toFixed(2),
        fallowArea: fallowArea.toFixed(2),
        rawData: file.data
      }
    }).filter(item => item !== null)

    console.log('第一阶段分析完成，数据:', phase1Data.value)
    
    currentStep.value = 1
    
    // 等待DOM更新后初始化图表
    setTimeout(() => {
      initPhase1Charts()
    }, 300)

    ElMessage.success(`第一阶段分析完成，共${phase1Data.value.length}个区域`)
  } catch (error) {
    console.error('分析失败:', error)
    ElMessage.error('分析失败：' + error.message)
  } finally {
    analyzing.value = false
  }
}

// 进入第二阶段
const enterPhase2 = () => {
  // 第二阶段分析：所有文件的详细作物分析
  phase2Data.value = phase1Data.value.map(file => {
    console.log('第二阶段分析文件:', file.regionName, '数据:', file.rawData)
    
    if (!file.rawData || !file.rawData.features) {
      console.error('文件数据缺失:', file.regionName)
      return null
    }
    
    const features = file.rawData.features
    const cropStats = {}

    features.forEach(feature => {
      const classValue = feature.properties?.class ?? feature.properties?.gridcode
      
      // 读取面积字段：优先使用area_mu（亩），其次area_m2转换，最后dcmj
      let area = 0
      if (feature.properties?.area_mu) {
        area = parseFloat(feature.properties.area_mu)
      } else if (feature.properties?.area_m2) {
        area = parseFloat(feature.properties.area_m2) / 666.67 // 平方米转亩
      } else if (feature.properties?.dcmj) {
        area = parseFloat(feature.properties.dcmj)
      } else {
        area = 0.1 // 最后的默认值
      }

      // 统计作物（1-10都要统计，但1是裸地）
      if (classValue >= 1 && classValue <= 10) {
        const cropName = getCropName(classValue)
        const cropColor = getCropColor(cropName) // 传入作物名称而不是代码
        
        if (!cropStats[classValue]) {
          cropStats[classValue] = {
            name: cropName,
            code: classValue,
            count: 0,
            area: 0,
            color: cropColor
          }
        }
        cropStats[classValue].count++
        cropStats[classValue].area += area
      }
    })

    const cropDistribution = Object.values(cropStats).map(crop => ({
      ...crop,
      area: crop.area.toFixed(2)
    }))

    // 只统计非裸地的作物面积和种类
    const nonBareCropDistribution = cropDistribution.filter(crop => crop.name !== '裸地')
    const totalArea = nonBareCropDistribution.reduce((sum, crop) => sum + parseFloat(crop.area), 0)
    const dominantCrop = nonBareCropDistribution.length > 0 
      ? nonBareCropDistribution.reduce((max, crop) => parseFloat(crop.area) > parseFloat(max.area) ? crop : max).name
      : '无'

    console.log('区域分析结果:', file.regionName, {
      cropTypes: nonBareCropDistribution.length,
      allCropDistribution: cropDistribution,
      nonBareCropDistribution: nonBareCropDistribution,
      totalArea: totalArea.toFixed(2),
      dominantCrop
    })

    return {
      regionName: file.regionName,
      cropTypes: nonBareCropDistribution.length, // 不包含裸地的作物种类数
      cropDistribution: cropDistribution, // 包含所有类型（含裸地），用于显示
      totalArea: totalArea.toFixed(2), // 不包含裸地的总面积
      dominantCrop: dominantCrop
    }
  }).filter(item => item !== null)

  console.log('=' .repeat(60))
  console.log('第二阶段总数据:', phase2Data.value)
  console.log('总作物种类（不含裸地）:', totalCropTypes.value)
  console.log('总种植面积（不含裸地）:', totalCropArea.value, '亩')
  console.log('主要作物（按面积）:', dominantCrop.value)
  console.log('分析区域数:', phase2Data.value.length)
  console.log('=' .repeat(60))

  if (phase2Data.value.length === 0) {
    ElMessage.warning('没有可进行第二阶段分析的数据')
    return
  }

  currentStep.value = 2

  // 等待DOM更新后初始化图表，并滚动到第二阶段卡片顶部
  setTimeout(() => {
    initPhase2Charts()
    
    // 查找第二阶段的卡片元素并滚动到其顶部
    const stepCards = document.querySelectorAll('.step-card')
    if (stepCards.length >= 3) {
      // 第三个step-card是第二阶段的卡片
      stepCards[2].scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, 300)

  ElMessage.success(`第二阶段分析完成，共${phase2Data.value.length}个区域，${totalCropTypes.value}种作物`)
}

// ==================== 图表初始化 ====================

// 第一阶段图表
const initPhase1Charts = () => {
  initPlantingRateChart()
  initPlantingStatusChart()
  initOverallPieChart()
  initFallowAreaChart()
}

// 种植率对比图
const initPlantingRateChart = () => {
  const chartDom = document.getElementById('planting-rate-chart')
  if (!chartDom) return
  
  if (plantingRateChart) plantingRateChart.dispose()
  plantingRateChart = echarts.init(chartDom)

  const regions = phase1Data.value.map(item => item.regionName)
  const rates = phase1Data.value.map(item => item.plantingRate)
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: regions,
      axisLabel: {
        rotate: 0,
        interval: 0
      }
    },
    yAxis: {
      type: 'value',
      name: '种植率(%)',
      nameTextStyle: {
        fontSize: 14
      },
      max: 100
    },
    series: [{
      name: '种植率',
      type: 'bar',
      data: rates,
        itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#67C23A' },
          { offset: 1, color: '#95de64' }
        ]),
        borderRadius: [8, 8, 0, 0]
        },
        label: {
          show: true,
        position: 'top',
        formatter: '{c}%'
      }
    }]
  }

  plantingRateChart.setOption(option)
}

// 种植状态统计图
const initPlantingStatusChart = () => {
  const chartDom = document.getElementById('planting-status-chart')
  if (!chartDom) return
  
  if (plantingStatusChart) plantingStatusChart.dispose()
  plantingStatusChart = echarts.init(chartDom)

  const regions = phase1Data.value.map(item => item.regionName)
  const plantedCounts = phase1Data.value.map(item => item.plantedCount)
  const fallowCounts = phase1Data.value.map(item => item.fallowCount)

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    legend: {
      data: ['已种植', '未种植']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: regions,
      axisLabel: {
        rotate: 0,
        interval: 0
      }
    },
    yAxis: {
      type: 'value',
      name: '地块数',
      nameTextStyle: {
        fontSize: 14
      }
    },
    series: [
      {
        name: '已种植',
        type: 'bar',
        stack: 'total',
        data: plantedCounts,
        itemStyle: { color: '#67C23A' },
        label: {
          show: true,
          position: 'inside',
          formatter: params => params.value > 0 ? params.value : ''
        }
      },
      {
        name: '未种植',
        type: 'bar',
        stack: 'total',
        data: fallowCounts,
        itemStyle: { color: '#F56C6C' },
        label: {
          show: true,
          position: 'inside',
          formatter: params => params.value > 0 ? params.value : ''
        }
      }
    ]
  }

  plantingStatusChart.setOption(option)
}

// 总体饼图
const initOverallPieChart = () => {
  const chartDom = document.getElementById('overall-pie-chart')
  if (!chartDom) return
  
  if (overallPieChart) overallPieChart.dispose()
  overallPieChart = echarts.init(chartDom)

  const totalPlanted = phase1Data.value.reduce((sum, item) => sum + item.plantedCount, 0)
  const totalFallow = phase1Data.value.reduce((sum, item) => sum + item.fallowCount, 0)
  
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [{
      name: '种植情况',
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
        formatter: '{b}: {c}\n({d}%)'
        },
        data: [
        { value: totalPlanted, name: '已种植', itemStyle: { color: '#67C23A' } },
        { value: totalFallow, name: '未种植', itemStyle: { color: '#F56C6C' } }
      ]
    }]
  }

  overallPieChart.setOption(option)
}

// 撂荒面积对比图
const initFallowAreaChart = () => {
  const chartDom = document.getElementById('fallow-area-chart')
  if (!chartDom) return
  
  const regions = phase1Data.value.map(item => item.regionName)
  const fallowAreas = phase1Data.value.map(item => parseFloat(item.fallowArea))
  
  // 根据区域数量动态调整图表高度
  // 每个柱子分配45px高度，最小300px，最大600px
  const barHeight = 45
  const calculatedHeight = Math.max(300, Math.min(600, regions.length * barHeight + 80))
  chartDom.style.height = `${calculatedHeight}px`
  
  if (fallowAreaChart) fallowAreaChart.dispose()
  fallowAreaChart = echarts.init(chartDom)

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: params => {
        const value = parseFloat(params[0].value).toFixed(2)
        return `${params[0].name}<br/>撂荒面积: ${value} 亩`
      }
    },
    grid: {
      left: '5%',
      right: '4%',
      bottom: '12%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: '面积(亩)',
      nameTextStyle: {
        fontSize: 14
      },
      nameGap: 25
    },
    yAxis: {
      type: 'category',
      data: regions
    },
    series: [{
      name: '撂荒面积',
        type: 'bar',
      data: fallowAreas,
      barMaxWidth: 40,  // 限制柱子最大宽度
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
        formatter: params => {
          return parseFloat(params.value).toFixed(2) + ' 亩'
        }
      }
    }]
  }

  fallowAreaChart.setOption(option)
}

// 第二阶段图表
const initPhase2Charts = () => {
  console.log('初始化第二阶段图表，数据:', phase2Data.value)
  console.log('作物种类:', totalCropTypes.value)
  console.log('总面积:', totalCropArea.value)
  
  initCropTypePieChart()
  initCropVarietyChart()
  initCropAreaRankingChart()
  initRegionCropCompareChart()
}

// 作物类型分布饼图
const initCropTypePieChart = () => {
  const chartDom = document.getElementById('crop-type-pie-chart')
  if (!chartDom) {
    console.log('图表DOM不存在: crop-type-pie-chart')
    return
  }
  
  if (cropTypePieChart) cropTypePieChart.dispose()
  cropTypePieChart = echarts.init(chartDom)

  const cropStats = {}
  phase2Data.value.forEach(region => {
    console.log('处理区域:', region.regionName, '作物分布:', region.cropDistribution)
    if (region.cropDistribution && region.cropDistribution.length > 0) {
      region.cropDistribution.forEach(crop => {
        // 排除裸地
        if (crop.name !== '裸地') {
          if (!cropStats[crop.name]) {
            cropStats[crop.name] = { count: 0, area: 0, color: crop.color }
          }
          cropStats[crop.name].count += crop.count
          cropStats[crop.name].area += parseFloat(crop.area)
        }
      })
    }
  })

  console.log('作物类型饼图统计数据（排除裸地）:', cropStats)

  const data = Object.entries(cropStats).map(([name, stats]) => ({
    value: stats.count,
    name: name,
    itemStyle: { color: stats.color }
  }))
  
  console.log('饼图数据:', data)
  
  if (data.length === 0) {
    console.warn('饼图无数据！')
  }
  
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      type: 'scroll',
      pageIconSize: 12,
      pageIconColor: '#2196f3',
      pageTextStyle: {
        color: '#666'
      }
    },
    series: [{
      name: '作物类型',
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['60%', '50%'],
          itemStyle: {
        borderRadius: 10,
        borderColor: '#fff',
        borderWidth: 2
      },
        label: {
          show: true,
        formatter: '{b}: {c}\n({d}%)'
      },
      data: data
    }]
  }

  cropTypePieChart.setOption(option)
}

// 各区域作物种类数量
const initCropVarietyChart = () => {
  const chartDom = document.getElementById('crop-variety-chart')
  if (!chartDom) return
  
  if (cropVarietyChart) cropVarietyChart.dispose()
  cropVarietyChart = echarts.init(chartDom)

  const regions = phase2Data.value.map(item => item.regionName)
  const cropTypes = phase2Data.value.map(item => item.cropTypes)
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: regions,
      axisLabel: {
        rotate: 0,
        interval: 0
      }
    },
    yAxis: {
      type: 'value',
      name: '作物种类数',
      nameTextStyle: {
        fontSize: 14
      }
    },
    series: [{
      name: '作物种类',
        type: 'bar',
      data: cropTypes,
        itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#2196f3' },
          { offset: 1, color: '#64b5f6' }
        ]),
        borderRadius: [8, 8, 0, 0]
        },
        label: {
          show: true,
        position: 'top'
      }
    }]
  }

  cropVarietyChart.setOption(option)
}

// 作物面积排名
const initCropAreaRankingChart = () => {
  const chartDom = document.getElementById('crop-area-ranking-chart')
  if (!chartDom) return
  
  const cropStats = {}
  phase2Data.value.forEach(region => {
    if (region.cropDistribution) {
      region.cropDistribution.forEach(crop => {
        // 排除裸地
        if (crop.name !== '裸地') {
          if (!cropStats[crop.name]) {
            cropStats[crop.name] = { area: 0, color: crop.color }
          }
          cropStats[crop.name].area += parseFloat(crop.area)
        }
      })
    }
  })

  const sortedCrops = Object.entries(cropStats)
    .map(([name, stats]) => ({
      name: name,
      area: stats.area.toFixed(2),
      color: stats.color
    }))
    .sort((a, b) => b.area - a.area)

  const cropNames = sortedCrops.map(item => item.name)
  const cropAreas = sortedCrops.map(item => parseFloat(item.area))
  const cropColors = sortedCrops.map(item => item.color)
  
  // 改为纵向柱状图，固定高度
  chartDom.style.height = '350px'
  
  if (cropAreaRankingChart) cropAreaRankingChart.dispose()
  cropAreaRankingChart = echarts.init(chartDom)
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: params => `${params[0].name}<br/>种植面积: ${params[0].value} 亩`
    },
    grid: {
      left: '3%',
      right: '3%',
      bottom: '15%',  // 增加底部空间，容纳横向标签
      top: '8%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: cropNames,
      axisLabel: {
        interval: 0,  // 显示所有标签
        rotate: 0,    // 横向显示，不旋转
        fontSize: 12
      }
    },
    yAxis: {
      type: 'value',
      name: '面积(亩)',
      nameTextStyle: {
        fontSize: 14
      },
      // 智能计算最大值：按照合理的间隔向上取整
      max: function(value) {
        const maxValue = value.max
        // 根据数量级确定合理的间隔
        let interval
        if (maxValue <= 1000) {
          interval = 100
        } else if (maxValue <= 10000) {
          interval = 1000
        } else if (maxValue <= 50000) {
          interval = 5000
        } else if (maxValue <= 100000) {
          interval = 10000
        } else if (maxValue <= 500000) {
          interval = 50000
        } else {
          interval = 100000
        }
        // 向上取整到最近的间隔倍数
        return Math.ceil(maxValue / interval) * interval
      }
    },
    series: [{
      name: '种植面积',
      type: 'bar',
      data: cropAreas.map((area, index) => ({
        value: area,
        itemStyle: { color: cropColors[index] }
      })),
      barMaxWidth: 50,  // 限制柱子最大宽度
      label: {
        show: true,
        position: 'top',
        formatter: '{c} 亩',
        fontSize: 11
      },
      itemStyle: {
        borderRadius: [8, 8, 0, 0]  // 顶部圆角
      }
    }]
  }
  
  cropAreaRankingChart.setOption(option)
}

// 各区域作物分布对比
const initRegionCropCompareChart = () => {
  const chartDom = document.getElementById('region-crop-compare-chart')
  if (!chartDom) return
  
  if (regionCropCompareChart) regionCropCompareChart.dispose()
  regionCropCompareChart = echarts.init(chartDom)

  // 收集所有作物类型（排除裸地）
  const allCrops = new Set()
  phase2Data.value.forEach(region => {
    if (region.cropDistribution) {
      region.cropDistribution.forEach(crop => {
        if (crop.name !== '裸地') {
          allCrops.add(crop.name)
        }
      })
    }
  })

  const cropList = Array.from(allCrops)
  const regions = phase2Data.value.map(item => item.regionName)

  // 根据区域数量动态设置柱子宽度和字体大小：区域越少，柱子越粗，字体越大
  const regionCount = regions.length
  let barWidthPercent = '60%'
  let barMaxWidth = 60  // 默认最大宽度60px
  let labelFontSize = 14  // 默认标签字体大小
  if (regionCount <= 2) {
    barWidthPercent = '80%' // 2个或更少区域，柱子占80%，更粗
    barMaxWidth = 100  // 最大宽度100px
    labelFontSize = 16  // 字体更大
  } else if (regionCount <= 4) {
    barWidthPercent = '70%' // 3-4个区域，柱子占70%
    barMaxWidth = 80  // 最大宽度80px
    labelFontSize = 15  // 字体稍大
  } else {
    barWidthPercent = '60%' // 5个或更多区域，柱子占60%
    barMaxWidth = 60  // 最大宽度60px
    labelFontSize = 14  // 默认字体
  }

  // 改为横向堆叠柱状图，每个区域占一行
  const series = cropList.map(cropName => {
    const data = phase2Data.value.map(region => {
      if (region.cropDistribution) {
        const crop = region.cropDistribution.find(c => c.name === cropName)
        return crop ? crop.count : 0
      }
      return 0
    })

    const color = phase2Data.value.find(region => 
      region.cropDistribution?.some(c => c.name === cropName)
    )?.cropDistribution.find(c => c.name === cropName)?.color || '#999'

    return {
      name: cropName,
      type: 'bar',
      stack: 'total', // 使用堆叠
      barWidth: barWidthPercent, // 根据区域数量动态调整柱子宽度
      barMaxWidth: barMaxWidth, // 柱子最大宽度
      data: data,
      itemStyle: { 
        color: color,
        borderRadius: 0,
        shadowBlur: 2,
        shadowColor: 'rgba(0, 0, 0, 0.1)',
        shadowOffsetY: 1
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 8,
          shadowOffsetX: 0,
          shadowOffsetY: 4,
          shadowColor: 'rgba(0, 0, 0, 0.2)',
          borderWidth: 2,
          borderColor: 'rgba(255, 255, 255, 0.8)'
        }
      },
      label: {
        show: true,
        position: 'inside',
        fontSize: labelFontSize,  // 根据区域数量动态调整字体大小
        fontWeight: '700',
        color: '#fff',
        // 只显示值较大的标签，避免小值标签重叠（根据区域数量调整阈值）
        formatter: params => {
          if (params.value === 0) return ''
          // 根据区域数量设置阈值：区域越多，阈值越高
          const threshold = regionCount <= 2 ? 20 : regionCount <= 4 ? 50 : 100
          return params.value >= threshold ? params.value : ''
        },
        distance: 0
      }
    }
  })
  
  const option = {
    backgroundColor: '#ffffff',
    title: {
      show: false
    },
    tooltip: {
      trigger: 'axis',
      confine: false,  // 允许tooltip溢出容器
      axisPointer: { 
        type: 'shadow',
        shadowStyle: {
          color: 'rgba(33, 150, 243, 0.08)'
        }
      },
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
      borderColor: '#2196f3',
      borderWidth: 2,
      textStyle: {
        color: '#333',
        fontSize: 14
      },
      padding: [15, 18],
      formatter: params => {
        let result = `<div style="font-weight: 700; font-size: 16px; margin-bottom: 12px; color: #2196f3; border-bottom: 2px solid #e3f2fd; padding-bottom: 8px;">${params[0].axisValue}</div>`
        let total = 0
        params.forEach(item => {
          if (item.value > 0) {
            total += item.value
            result += `
              <div style="display: flex; align-items: center; margin: 8px 0;">
                <span style="display: inline-block; width: 16px; height: 16px; background: ${item.color}; border-radius: 3px; margin-right: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.15);"></span>
                <span style="flex: 1; font-size: 14px;">${item.seriesName}</span>
                <span style="font-weight: 700; margin-left: 25px; color: #2196f3; font-size: 15px;">${item.value}</span>
              </div>
            `
          }
        })
        result += `<div style="margin-top: 12px; padding-top: 10px; border-top: 2px solid #e3f2fd; font-weight: 700; font-size: 16px; color: #2196f3;">总计: ${total}</div>`
        return result
      }
    },
    legend: {
      data: cropList,
      type: 'scroll',
      top: 10,
      right: 20,
      orient: 'vertical',
      itemWidth: 22,
      itemHeight: 16,
      itemGap: 15,
      textStyle: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500'
      },
      pageIconColor: '#2196f3',
      pageIconInactiveColor: '#ccc',
      pageIconSize: 16,
      pageTextStyle: {
        color: '#666',
        fontSize: 13
      },
      itemStyle: {
        borderWidth: 0,
        shadowBlur: 3,
        shadowColor: 'rgba(0, 0, 0, 0.1)',
        shadowOffsetY: 1
      }
    },
    grid: {
      left: '3%',
      right: '25%',
      bottom: '8%',
      top: '8%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: '地块数',
      nameTextStyle: {
        fontSize: 15,
        color: '#666',
        fontWeight: '600',
        padding: [0, 0, 0, 10]
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: '#ddd',
          width: 2
        }
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500'
      },
      splitLine: {
        lineStyle: {
          color: '#f5f5f5',
          type: 'solid',
          width: 1
        }
      }
    },
    yAxis: {
      type: 'category',
      data: regions,
      axisLine: {
        lineStyle: {
          color: '#ddd',
          width: 2
        }
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        fontSize: 16,
        color: '#333',
        fontWeight: '700',
        margin: 15
      },
      splitLine: {
        show: false
      }
    },
    series: series
  }

  regionCropCompareChart.setOption(option)
}

// ==================== PDF预览和导出 ====================

// 重置配置
const resetConfig = () => {
  fontConfig.value = { ...defaultFontConfig }
  selectedColorScheme.value = 'classic'
  ElMessage.success('配置已重置')
}

// 应用配置
const applyConfig = async () => {
  console.log('🔄 应用新配置并重新生成PDF预览...')
  console.log('📝 字体配置:', fontConfig.value)
  console.log('🎨 配色方案:', selectedColorScheme.value)
  
  const loadingMsg = ElMessage({ 
    message: '正在应用新配置，重新生成PDF...', 
    type: 'info', 
    duration: 0 
  })
  
  try {
    await generateReportPdf()
    loadingMsg.close()
    ElMessage.success('配置已应用，PDF预览已更新！')
  } catch (error) {
    console.error('应用配置失败:', error)
    loadingMsg.close()
    ElMessage.error('应用配置失败：' + error.message)
  }
}

// 清除数据并重新分析
const handleClearData = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清除所有分析数据并重新开始吗？此操作不可恢复。',
      '⚠️ 确认清除',
      {
        confirmButtonText: '确定清除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )
    
    // 清除所有数据
    currentStep.value = 0
    selectedExistingFiles.value = []
    phase1Data.value = []
    phase2Data.value = []
    analyzing.value = false
    
    // 清除PDF数据
    if (pdfPreviewUrl.value) {
      URL.revokeObjectURL(pdfPreviewUrl.value)
    }
    pdfPreviewUrl.value = ''
    pdfBlob.value = null
    showPdfPreview.value = false
    
    // 销毁所有图表
    disposeCharts()
    
    ElMessage.success('已清除所有数据，请重新选择数据进行分析')
    
    console.log('🔄 数据已清除，回到初始状态')
  } catch (error) {
    // 用户取消操作
    if (error !== 'cancel') {
      console.error('清除数据失败:', error)
    }
  }
}

// 处理预览报告
const handlePreviewReport = async () => {
  console.log('🔍 打开PDF预览对话框...')
  
  // 设置默认文件名
  const date = new Date()
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  const timeStr = `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`
  pdfFilename.value = `Region_Comparison_${dateStr}_${timeStr}`
  
  showPdfPreview.value = true
  
  // 如果还没有生成过PDF，立即生成
  if (!pdfPreviewUrl.value) {
    console.log('首次打开，自动生成PDF预览...')
    await generateReportPdf()
  }
}

// 生成报告PDF
const generateReportPdf = async () => {
  generating.value = true
  generatingProgress.value = 0
  generatingMessage.value = '正在准备数据...'
  
  if (pdfPreviewUrl.value) {
    URL.revokeObjectURL(pdfPreviewUrl.value)
  }
  pdfPreviewUrl.value = ''
  pdfBlob.value = null
  
  try {
    const colors = COLOR_SCHEMES[selectedColorScheme.value]
    // 确保所有字体值都是有效的数字
    const fonts = {
      coverTitle: Number(fontConfig.value.coverTitle) || 40,
      title: Number(fontConfig.value.title) || 28,
      subtitle: Number(fontConfig.value.subtitle) || 22,
      tableHeader: Number(fontConfig.value.tableHeader) || 20,
      tableCell: Number(fontConfig.value.tableCell) || 15,
      description: Number(fontConfig.value.description) || 14,
      cardValue: Number(fontConfig.value.cardValue) || 32,
      // 图表字体
      chartLegend: Number(fontConfig.value.chartLegend) || 12,
      chartBarLabel: Number(fontConfig.value.chartBarLabel) || 12,
      chartPieLabel: Number(fontConfig.value.chartPieLabel) || 12,
      chartAxisLabel: Number(fontConfig.value.chartAxisLabel) || 12
    }
    
    console.log('字体配置:', fonts)
    console.log('配色方案:', colors)
    
    generatingMessage.value = '正在生成封面...'
    generatingProgress.value = 10
    
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    
    console.log('PDF页面尺寸:', pageWidth, pageHeight)
    
    // 1. 封面
    await addCoverPage(pdf, pageWidth, pageHeight, fonts, colors)
    generatingProgress.value = 20
    
    // 2. 第一阶段内容
    generatingMessage.value = '正在生成第一阶段分析内容...'
    await addPhase1Content(pdf, pageWidth, pageHeight, fonts, colors)
    generatingProgress.value = 40
    
    // 3. 第一阶段图表
    generatingMessage.value = '正在导出第一阶段图表...'
    await addPhase1Charts(pdf, pageWidth, pageHeight, fonts, colors)
    generatingProgress.value = 60
    
    // 4. 第二阶段内容和图表（如果存在）
    if (currentStep.value === 2 && phase2Data.value.length > 0) {
      generatingMessage.value = '正在生成第二阶段分析内容和表格...'
      await addPhase2Content(pdf, pageWidth, pageHeight, fonts, colors)
      generatingProgress.value = 75
      
      generatingMessage.value = '正在导出第二阶段图表...'
      await addPhase2Charts(pdf, pageWidth, pageHeight, fonts, colors)
      generatingProgress.value = 90
    }
    
    generatingMessage.value = '正在生成PDF...'
    generatingProgress.value = 95
    
    // 生成PDF Blob
    pdfBlob.value = pdf.output('blob')
    pdfPreviewUrl.value = URL.createObjectURL(pdfBlob.value)
    
    generatingProgress.value = 100
    generatingMessage.value = '报告生成成功！'
    ElMessage.success('报告生成成功！')
  } catch (error) {
    console.error('生成PDF失败:', error)
    console.error('错误堆栈:', error.stack)
    ElMessage.error('生成PDF失败：' + error.message)
  } finally {
    generating.value = false
  }
}

// 添加封面页
const addCoverPage = async (pdf, pageWidth, pageHeight, fonts, colors) => {
  try {
    console.log('开始生成封面页...')
    const container = document.createElement('div')
    const containerWidth = Math.max(pageWidth - 80, 100)
    container.style.cssText = `
      position: fixed; left: -9999px; top: 0;
      width: ${containerWidth}px; background: white;
      padding: 40px; font-family: "Microsoft YaHei", Arial, sans-serif;
    `
    
    const date = new Date().toLocaleString('zh-CN')
    const coverTitleSize = Math.max(fonts.coverTitle, 20)
    const titleSize = Math.max(fonts.title * 0.6, 12)
    const subtitleSize = Math.max(fonts.subtitle, 12)
    
    container.innerHTML = `
      <div style="text-align: center; padding: 100px 0;">
        <h1 style="font-size: ${coverTitleSize}px; color: #303133; margin-bottom: 30px;">
          农作物种植分析报告
        </h1>
        <div style="font-size: ${titleSize}px; color: #606266; margin-bottom: 20px;">
          生成时间: ${date}
        </div>
        <div style="font-size: ${subtitleSize}px; color: #909399;">
          分析区域: ${phase1Data.value.length} 个
        </div>
      </div>
    `
    document.body.appendChild(container)
    await new Promise(resolve => setTimeout(resolve, 300))
    
    console.log('开始渲染封面canvas...')
    const canvas = await html2canvas(container, { 
      scale: 2, 
      backgroundColor: '#ffffff',
      logging: false
    })
    console.log('Canvas尺寸:', canvas.width, canvas.height)
    
    const imgData = canvas.toDataURL('image/jpeg', 0.95)
    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    
    console.log('添加封面图片到PDF...', imgWidth, imgHeight)
    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight)
    document.body.removeChild(container)
    console.log('封面页生成成功')
  } catch (error) {
    console.error('生成封面页失败:', error)
    throw new Error('生成封面页失败: ' + error.message)
  }
}

// 添加第一阶段内容
const addPhase1Content = async (pdf, pageWidth, pageHeight, fonts, colors) => {
  try {
    console.log('开始生成第一阶段内容...')
    pdf.addPage()
    const container = document.createElement('div')
    const containerWidth = Math.max(pageWidth - 80, 100)
    container.style.cssText = `
      position: fixed; left: -9999px; top: 0;
      width: ${containerWidth}px; background: white;
      padding: 40px; font-family: "Microsoft YaHei", Arial, sans-serif;
    `
    
    const regions = phase1Data.value.map(item => item.regionName).join('、')
    // 缩小字体以容纳表格
    const titleSize = Math.max(fonts.title * 0.75, 13)
    const subtitleSize = Math.max(fonts.subtitle * 0.7, 11)
    const descSize = Math.max(fonts.description * 0.75, 9)
    const tableHeaderSize = Math.max(fonts.tableHeader * 0.65, 8)
    const tableCellSize = Math.max(fonts.tableCell * 0.65, 7)
    
    // 构建详细数据表格HTML
    const tableRows = phase1Data.value.map(item => `
      <tr>
        <td style="padding: 4px 2px; border: 1px solid #ddd; text-align: center; font-size: ${tableCellSize}px;">${item.regionName}</td>
        <td style="padding: 4px 2px; border: 1px solid #ddd; text-align: center; font-size: ${tableCellSize}px;">
          <span style="color: ${item.recognitionType === 'crop_recognition' ? colors.success : colors.warning}; font-weight: bold;">
            ${getRecognitionTypeLabel(item.recognitionType)}
          </span>
        </td>
        <td style="padding: 4px 2px; border: 1px solid #ddd; text-align: center; font-size: ${tableCellSize}px;">${item.totalCount}</td>
        <td style="padding: 4px 2px; border: 1px solid #ddd; text-align: center; font-size: ${tableCellSize}px; color: ${colors.success};">${item.plantedCount}</td>
        <td style="padding: 4px 2px; border: 1px solid #ddd; text-align: center; font-size: ${tableCellSize}px; color: ${colors.warning};">${item.fallowCount}</td>
        <td style="padding: 4px 2px; border: 1px solid #ddd; text-align: center; font-size: ${tableCellSize}px; font-weight: bold;">${item.plantingRate}%</td>
        <td style="padding: 4px 2px; border: 1px solid #ddd; text-align: center; font-size: ${tableCellSize}px;">${typeof item.plantedArea === 'number' ? item.plantedArea.toFixed(2) : item.plantedArea}</td>
        <td style="padding: 4px 2px; border: 1px solid #ddd; text-align: center; font-size: ${tableCellSize}px;">${typeof item.fallowArea === 'number' ? item.fallowArea.toFixed(2) : item.fallowArea}</td>
      </tr>
    `).join('')
    
    container.innerHTML = `
      <div>
        <h2 style="font-size: ${titleSize}px; color: ${colors.primary}; margin-bottom: 12px; border-bottom: 2px solid ${colors.primary}; padding-bottom: 6px;">
          第一阶段：种植情况分析
        </h2>
        <div style="background: #f5f7fa; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
          <h3 style="font-size: ${subtitleSize}px; margin-bottom: 6px;">分析区域:</h3>
          <p style="font-size: ${descSize}px; line-height: 1.5; margin: 0;">${regions}</p>
        </div>
        <div style="background: #f0f9ff; padding: 10px; border-radius: 6px; margin-bottom: 12px;">
          <h3 style="font-size: ${subtitleSize}px; margin-bottom: 6px;">分析结果:</h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; font-size: ${descSize}px;">
            <div>• 总地块数: <strong>${totalPlantedCount.value + totalFallowCount.value}</strong> 个</div>
            <div>• 已种植地块: <strong style="color: ${colors.success};">${totalPlantedCount.value}</strong> 个</div>
            <div>• 未种植地块: <strong style="color: ${colors.danger};">${totalFallowCount.value}</strong> 个</div>
            <div>• 平均种植率: <strong style="color: ${colors.primary};">${averagePlantingRate.value}%</strong></div>
          </div>
        </div>
        <div style="margin-top: 12px;">
          <h3 style="font-size: ${subtitleSize}px; margin-bottom: 8px; color: ${colors.primary};">
            📊 各区域种植情况详细数据
          </h3>
          <table style="width: 100%; border-collapse: collapse; background: white; font-size: ${tableCellSize}px;">
            <thead>
              <tr style="background: linear-gradient(135deg, ${colors.primary}, ${colors.secondary});">
                <th style="padding: 5px 2px; border: 1px solid #ddd; text-align: center; color: white; font-size: ${tableHeaderSize}px; font-weight: bold;">区域</th>
                <th style="padding: 5px 2px; border: 1px solid #ddd; text-align: center; color: white; font-size: ${tableHeaderSize}px; font-weight: bold;">任务来源</th>
                <th style="padding: 5px 2px; border: 1px solid #ddd; text-align: center; color: white; font-size: ${tableHeaderSize}px; font-weight: bold;">总地块数</th>
                <th style="padding: 5px 2px; border: 1px solid #ddd; text-align: center; color: white; font-size: ${tableHeaderSize}px; font-weight: bold;">已种植</th>
                <th style="padding: 5px 2px; border: 1px solid #ddd; text-align: center; color: white; font-size: ${tableHeaderSize}px; font-weight: bold;">未种植</th>
                <th style="padding: 5px 2px; border: 1px solid #ddd; text-align: center; color: white; font-size: ${tableHeaderSize}px; font-weight: bold;">种植率</th>
                <th style="padding: 5px 2px; border: 1px solid #ddd; text-align: center; color: white; font-size: ${tableHeaderSize}px; font-weight: bold;">已种植面积(亩)</th>
                <th style="padding: 5px 2px; border: 1px solid #ddd; text-align: center; color: white; font-size: ${tableHeaderSize}px; font-weight: bold;">撂荒面积(亩)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      </div>
    `
    document.body.appendChild(container)
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff', logging: false })
    const imgData = canvas.toDataURL('image/jpeg', 0.95)
    const imgWidth = containerWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    pdf.addImage(imgData, 'JPEG', 40, 40, imgWidth, imgHeight)
    document.body.removeChild(container)
    console.log('第一阶段内容生成成功')
  } catch (error) {
    console.error('生成第一阶段内容失败:', error)
    throw new Error('生成第一阶段内容失败: ' + error.message)
  }
}

// 添加第一阶段图表（智能排版）
const addPhase1Charts = async (pdf, pageWidth, pageHeight, fonts, colors) => {
  const charts = [
    { instance: plantingRateChart, title: '各区域种植率对比', pdfConfig: {} },
    { instance: plantingStatusChart, title: '种植/撂荒地块统计', pdfConfig: {} },
    { instance: overallPieChart, title: '总体种植情况分布', pdfConfig: {} },
    { instance: fallowAreaChart, title: '各区域撂荒面积对比', pdfConfig: {} }
  ]
  
  // 第一阶段图表从新页面开始
  pdf.addPage()
  let currentY = 40 // 当前Y位置
  
  for (let i = 0; i < charts.length; i++) {
    const chart = charts[i]
    try {
      console.log(`正在导出图表 [${i}]: ${chart.title}`)
      
      if (!chart.instance) {
        console.warn(`图表实例未找到: ${chart.title}`)
        continue
      }
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // 临时应用字体配置
      let originalOption = chart.instance.getOption()
      const tempOption = JSON.parse(JSON.stringify(originalOption))
      
      
      // 应用图例字体大小
      if (tempOption.legend) {
        if (Array.isArray(tempOption.legend)) {
          tempOption.legend.forEach(leg => {
            if (leg.textStyle) leg.textStyle.fontSize = fonts.chartLegend
            else leg.textStyle = { fontSize: fonts.chartLegend }
          })
        } else {
          if (tempOption.legend.textStyle) {
            tempOption.legend.textStyle.fontSize = fonts.chartLegend
          } else {
            tempOption.legend.textStyle = { fontSize: fonts.chartLegend }
          }
        }
      }
      
      // 应用series字体配置
      if (tempOption.series && tempOption.series.length > 0) {
        tempOption.series.forEach(series => {
          // 柱状图数值
          if (series.type === 'bar' && series.label) {
            series.label.fontSize = fonts.chartBarLabel
          }
          // 饼图数值
          if (series.type === 'pie' && series.label) {
            series.label.fontSize = fonts.chartPieLabel
          }
        })
      }
      
      // 应用坐标轴文字（包括刻度标签和名称）
      if (tempOption.xAxis) {
        if (Array.isArray(tempOption.xAxis)) {
          tempOption.xAxis.forEach(axis => {
            // 刻度标签
            if (!axis.axisLabel) axis.axisLabel = {}
            axis.axisLabel.fontSize = fonts.chartAxisLabel
            // 坐标轴名称
            if (axis.name) {
              if (!axis.nameTextStyle) axis.nameTextStyle = {}
              axis.nameTextStyle.fontSize = fonts.chartAxisLabel
            }
          })
        } else {
          // 刻度标签
          if (!tempOption.xAxis.axisLabel) tempOption.xAxis.axisLabel = {}
          tempOption.xAxis.axisLabel.fontSize = fonts.chartAxisLabel
          // 坐标轴名称
          if (tempOption.xAxis.name) {
            if (!tempOption.xAxis.nameTextStyle) tempOption.xAxis.nameTextStyle = {}
            tempOption.xAxis.nameTextStyle.fontSize = fonts.chartAxisLabel
          }
        }
      }
      if (tempOption.yAxis) {
        if (Array.isArray(tempOption.yAxis)) {
          tempOption.yAxis.forEach(axis => {
            // 刻度标签
            if (!axis.axisLabel) axis.axisLabel = {}
            axis.axisLabel.fontSize = fonts.chartAxisLabel
            // 坐标轴名称
            if (axis.name) {
              if (!axis.nameTextStyle) axis.nameTextStyle = {}
              axis.nameTextStyle.fontSize = fonts.chartAxisLabel
            }
          })
        } else {
          // 刻度标签
          if (!tempOption.yAxis.axisLabel) tempOption.yAxis.axisLabel = {}
          tempOption.yAxis.axisLabel.fontSize = fonts.chartAxisLabel
          // 坐标轴名称
          if (tempOption.yAxis.name) {
            if (!tempOption.yAxis.nameTextStyle) tempOption.yAxis.nameTextStyle = {}
            tempOption.yAxis.nameTextStyle.fontSize = fonts.chartAxisLabel
          }
        }
      }
      
      chart.instance.setOption(tempOption, true)
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // 直接从ECharts实例获取图片
      const imgData = chart.instance.getDataURL({
        type: 'jpeg',
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      })
      
      // 恢复原始配置
      chart.instance.setOption(originalOption, true)
      
      // 获取图表原始尺寸
      const chartWidth = chart.instance.getWidth()
      const chartHeight = chart.instance.getHeight()
      
      // 计算PDF中的尺寸
      const imgWidth = pageWidth - 80
      const imgHeight = (chartHeight * imgWidth) / chartWidth
      
      // 创建标题（用html2canvas渲染中文）
      const titleContainer = document.createElement('div')
      titleContainer.style.cssText = `
        position: fixed;
        left: -9999px;
        width: ${imgWidth}px;
        padding: 15px 0;
        background: white;
        font-family: "Microsoft YaHei", Arial, sans-serif;
        text-align: center;
      `
      titleContainer.innerHTML = `
        <h3 style="font-size: ${fonts.subtitle}px; color: ${colors.primary}; margin: 0; padding-bottom: 8px; border-bottom: 2px solid ${colors.primary};">
          ${chart.title}
        </h3>
      `
      document.body.appendChild(titleContainer)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const titleCanvas = await html2canvas(titleContainer, { scale: 2, backgroundColor: '#ffffff', logging: false })
      const titleImgData = titleCanvas.toDataURL('image/jpeg', 0.95)
      const titleImgHeight = (titleCanvas.height * imgWidth) / titleCanvas.width
      
      const totalHeight = titleImgHeight + imgHeight + 20
      
      // 布局规则：
      // 索引0（各区域种植率对比）：第一页上半部，currentY = 40
      // 索引1（种植/撂荒地块统计）：和索引0同一页下半部，间距+30
      // 索引2（总体种植情况分布）：新页面上半部，currentY = 40
      // 索引3（各区域撂荒面积对比）：和索引2同一页下半部，间距+30
      if (i === 1) {
        // 第二个图表：和第一个在同一页
        currentY += 30
      } else if (i === 2) {
        // 第三个图表：新页面
        pdf.addPage()
        currentY = 40
      } else if (i === 3) {
        // 第四个图表：和第三个在同一页
        currentY += 30
      }
      // i === 0（第一个图表）使用初始值 currentY = 40
      
      // 添加标题
      pdf.addImage(titleImgData, 'JPEG', 40, currentY, imgWidth, titleImgHeight)
      currentY += titleImgHeight + 10
      
      // 添加图表
      pdf.addImage(imgData, 'JPEG', 40, currentY, imgWidth, imgHeight)
      
      currentY += imgHeight
      
      // 清理
      document.body.removeChild(titleContainer)
      console.log(`图表导出成功: ${chart.title}，当前Y: ${currentY}`)
    } catch (error) {
      console.error(`导出图表失败 (${chart.title}):`, error)
    }
  }
}

// 添加第二阶段内容
const addPhase2Content = async (pdf, pageWidth, pageHeight, fonts, colors) => {
  try {
    console.log('开始生成第二阶段内容和表格...')
    pdf.addPage()
    
    // 1. 先生成文字说明部分
    const textContainer = document.createElement('div')
    const containerWidth = Math.max(pageWidth - 60, 100)
    textContainer.style.cssText = `
      position: fixed; left: -9999px; top: 0;
      width: ${containerWidth}px; background: white;
      padding: 20px; font-family: "Microsoft YaHei", Arial, sans-serif;
    `
    
    const regions = phase2Data.value.map(item => item.regionName).join('、')
    const regionCount = phase2Data.value.length
    
    // 根据区域数量动态调整字体和间距
    // 区域越多，字体和padding越小
    let scaleFactor = 1.0
    if (regionCount >= 6) {
      scaleFactor = 0.65  // 6个或更多区域：最小化
    } else if (regionCount >= 5) {
      scaleFactor = 0.75  // 5个区域：较小
    } else if (regionCount >= 4) {
      scaleFactor = 0.85  // 4个区域：中等偏小
    } else {
      scaleFactor = 1.0   // 3个或更少：正常大小
    }
    
    console.log(`📊 区域数量: ${regionCount}, 缩放因子: ${scaleFactor}`)
    
    // 应用缩放因子到所有尺寸
    const titleSize = Math.max(fonts.title * 0.8 * scaleFactor, 12)
    const subtitleSize = Math.max(fonts.subtitle * 0.75 * scaleFactor, 10)
    const descSize = Math.max(fonts.description * 0.8 * scaleFactor, 8)
    const tableTitleSize = Math.max(fonts.subtitle * 0.75 * scaleFactor, 10)
    const tableHeaderSize = Math.max(fonts.tableHeader * 0.8 * scaleFactor, 8)
    const tableCellSize = Math.max(fonts.tableCell * 0.8 * scaleFactor, 7)
    
    // 动态调整padding和间距
    const headerPadding = Math.max(10 * scaleFactor, 5)
    const cellPadding = Math.max(8 * scaleFactor, 4)
    const marginBottom = Math.max(14 * scaleFactor, 8)
    const lineHeight = Math.max(1.6, 1.3)
    
    // 构建表格HTML（每个区域一行，作物分布用简洁的文本展示）
    const tableRows = phase2Data.value.map(item => {
      // 构建作物分布文本（只显示作物名称和面积，过滤裸地）
      const cropText = item.cropDistribution
        ?.filter(c => c.name !== '裸地')
        .map(crop => `${crop.name}(${crop.area}亩)`)
        .join('、') || '无数据'
      
      return `
        <tr>
          <td style="padding: ${cellPadding}px; border: 1px solid #ddd; text-align: center; font-size: ${tableCellSize}px; font-weight: 500;">${item.regionName}</td>
          <td style="padding: ${cellPadding}px; border: 1px solid #ddd; text-align: center; font-size: ${tableCellSize}px;">${item.cropTypes}</td>
          <td style="padding: ${cellPadding}px; border: 1px solid #ddd; text-align: left; font-size: ${tableCellSize}px; line-height: ${lineHeight};">${cropText}</td>
          <td style="padding: ${cellPadding}px; border: 1px solid #ddd; text-align: center; font-size: ${tableCellSize}px; font-weight: 500;">${item.totalArea}</td>
          <td style="padding: ${cellPadding}px; border: 1px solid #ddd; text-align: center; font-size: ${tableCellSize}px; color: ${colors.success}; font-weight: 600;">${item.dominantCrop}</td>
        </tr>
      `
    }).join('')
    
    textContainer.innerHTML = `
      <div>
        <h2 style="font-size: ${titleSize}px; color: ${colors.success}; margin-bottom: ${marginBottom}px; border-bottom: 2px solid ${colors.success}; padding-bottom: ${Math.max(8 * scaleFactor, 4)}px;">
          第二阶段：作物详细分析
        </h2>
        <div style="background: #f5f7fa; padding: ${Math.max(12 * scaleFactor, 6)}px; border-radius: 6px; margin-bottom: ${Math.max(12 * scaleFactor, 6)}px;">
          <h3 style="font-size: ${subtitleSize}px; margin-bottom: ${Math.max(8 * scaleFactor, 4)}px;">分析区域:</h3>
          <p style="font-size: ${descSize}px; line-height: ${lineHeight}; margin: 0;">${regions}</p>
        </div>
        <div style="background: #f0f9ff; padding: ${Math.max(12 * scaleFactor, 6)}px; border-radius: 6px; margin-bottom: ${marginBottom}px;">
          <h3 style="font-size: ${subtitleSize}px; margin-bottom: ${Math.max(8 * scaleFactor, 4)}px;">分析结果:</h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: ${Math.max(8 * scaleFactor, 4)}px; font-size: ${descSize}px;">
            <div>• 作物种类: <strong>${totalCropTypes.value}</strong> 种</div>
            <div>• 总种植面积: <strong style="color: ${colors.success};">${totalCropArea.value}</strong> 亩</div>
            <div>• 主要作物: <strong style="color: ${colors.primary};">${dominantCrop.value}</strong></div>
            <div>• 分析区域: <strong>${phase2Data.value.length}</strong> 个</div>
          </div>
        </div>
        <div style="margin-top: ${marginBottom}px;">
          <h3 style="font-size: ${tableTitleSize}px; margin-bottom: ${Math.max(10 * scaleFactor, 6)}px; color: ${colors.success}; font-weight: 600;">
            📊 各区域作物分布详细数据
          </h3>
          <table style="width: 100%; border-collapse: collapse; background: white;">
            <thead>
              <tr style="background: linear-gradient(135deg, ${colors.success}, ${colors.secondary});">
                <th style="padding: ${headerPadding}px ${Math.max(8 * scaleFactor, 4)}px; border: 1px solid #ddd; text-align: center; color: white; font-size: ${tableHeaderSize}px; font-weight: bold;">区域</th>
                <th style="padding: ${headerPadding}px ${Math.max(8 * scaleFactor, 4)}px; border: 1px solid #ddd; text-align: center; color: white; font-size: ${tableHeaderSize}px; font-weight: bold;">作物<br/>种类数</th>
                <th style="padding: ${headerPadding}px ${Math.max(8 * scaleFactor, 4)}px; border: 1px solid #ddd; text-align: center; color: white; font-size: ${tableHeaderSize}px; font-weight: bold;">作物分布</th>
                <th style="padding: ${headerPadding}px ${Math.max(8 * scaleFactor, 4)}px; border: 1px solid #ddd; text-align: center; color: white; font-size: ${tableHeaderSize}px; font-weight: bold;">总种植<br/>面积(亩)</th>
                <th style="padding: ${headerPadding}px ${Math.max(8 * scaleFactor, 4)}px; border: 1px solid #ddd; text-align: center; color: white; font-size: ${tableHeaderSize}px; font-weight: bold;">主要<br/>作物</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      </div>
    `
    document.body.appendChild(textContainer)
    await new Promise(resolve => setTimeout(resolve, 400))
    
    const canvas = await html2canvas(textContainer, { 
      scale: 2, 
      backgroundColor: '#ffffff', 
      logging: false,
      useCORS: true
    })
    const imgData = canvas.toDataURL('image/jpeg', 0.95)
    const imgWidth = containerWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    
    document.body.removeChild(textContainer)
    
    // 将整个内容（包括表格）放在同一页
    let currentY = 30
    
    // 检查是否需要缩放以适应页面
    const maxHeight = pageHeight - 60
    if (imgHeight <= maxHeight) {
      pdf.addImage(imgData, 'JPEG', 30, currentY, imgWidth, imgHeight)
    } else {
      // 如果内容太高，缩放以适应
      const scale = maxHeight / imgHeight
      const scaledWidth = imgWidth * scale
      const scaledHeight = maxHeight
      const offsetX = (pageWidth - scaledWidth) / 2
      pdf.addImage(imgData, 'JPEG', offsetX, currentY, scaledWidth, scaledHeight)
    }
    
    console.log('第二阶段内容和表格生成成功')
  } catch (error) {
    console.error('生成第二阶段内容失败:', error)
    throw new Error('生成第二阶段内容失败: ' + error.message)
  }
}

// 添加第二阶段详细数据表格（截取UI）
const addPhase2DetailTable = async (pdf, pageWidth, pageHeight, fonts, colors) => {
  try {
    console.log('开始截取第二阶段详细数据表格...')
    
    if (!phase2DetailTableCard.value) {
      console.warn('表格元素未找到')
      return
    }
    
    pdf.addPage()
    
    // 等待DOM渲染
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // 截取表格元素
    const tableElement = phase2DetailTableCard.value.$el
    const canvas = await html2canvas(tableElement, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true
    })
    
    const imgData = canvas.toDataURL('image/jpeg', 0.95)
    
    // 计算图片尺寸
    const imgWidth = pageWidth - 60
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    
    // 检查是否需要缩放以适应页面
    const maxHeight = pageHeight - 60
    if (imgHeight <= maxHeight) {
      pdf.addImage(imgData, 'JPEG', 30, 30, imgWidth, imgHeight)
    } else {
      // 如果超高，按比例缩小
      const scale = maxHeight / imgHeight
      const scaledWidth = imgWidth * scale
      const scaledHeight = maxHeight
      const offsetX = (pageWidth - scaledWidth) / 2
      pdf.addImage(imgData, 'JPEG', offsetX, 30, scaledWidth, scaledHeight)
    }
    
    console.log('第二阶段详细数据表格截取成功')
  } catch (error) {
    console.error('截取表格失败:', error)
    throw new Error('截取表格失败: ' + error.message)
  }
}

// 添加第二阶段图表（智能排版）
const addPhase2Charts = async (pdf, pageWidth, pageHeight, fonts, colors) => {
  const charts = [
    { 
      instance: cropTypePieChart, 
      title: '作物类型分布',
      pdfConfig: {}  // 空配置，用于触发字体应用
    },
    { 
      instance: cropVarietyChart, 
      title: '各区域作物种类数量',
      pdfConfig: {}  // 空配置，用于触发字体应用
    },
    { 
      instance: cropAreaRankingChart, 
      title: '作物面积排名',
      pdfSize: { width: 1200, height: 600 },  // PDF截图前临时设置的图表尺寸（更大）
      pdfConfig: { 
        barCategoryGap: '1%',      // 柱子间距1%（更紧凑）
        labelFontSize: 16,         // 标签字体16px（更大）
        axisLabelFontSize: 15      // 坐标轴字体15px（更大）
      } 
    },
    { 
      instance: regionCropCompareChart, 
      title: '各区域作物分布对比',
      pdfSize: { width: 1200, height: 600 },  // PDF截图前临时设置的图表尺寸（更大）
      pdfConfig: {
        gridRight: '14%',          // 减少右侧空白到14%
        labelFontSize: 18          // 标签字体18px（更大）
      }
    }
  ]
  
  // 第一个图表从新页面开始
  pdf.addPage()
  let currentY = 20
  
  for (let i = 0; i < charts.length; i++) {
    const chart = charts[i]
    try {
      console.log(`正在导出第二阶段图表 [${i}]: ${chart.title}`)
      
      if (!chart.instance) {
        console.warn(`图表实例未找到: ${chart.title}`)
        continue
      }
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // 如果有PDF专用尺寸，临时调整容器大小
      let originalSize = null
      if (chart.pdfSize) {
        const chartDom = chart.instance.getDom()
        originalSize = {
          width: chartDom.style.width,
          height: chartDom.style.height
        }
        
        // 临时设置更大的尺寸
        chartDom.style.width = chart.pdfSize.width + 'px'
        chartDom.style.height = chart.pdfSize.height + 'px'
        chart.instance.resize()
        await new Promise(resolve => setTimeout(resolve, 100))
        console.log(`图表 ${chart.title} 临时调整尺寸为: ${chart.pdfSize.width}x${chart.pdfSize.height}`)
      }
      
      // 临时应用PDF配置和字体配置
      let originalOption = chart.instance.getOption()
      const tempOption = JSON.parse(JSON.stringify(originalOption))
      let needApplyConfig = false
      
      
      if (chart.pdfConfig) {
        needApplyConfig = true
        
        // 应用PDF配置到series
        if (tempOption.series && tempOption.series.length > 0) {
          tempOption.series.forEach(series => {
            if (series.type === 'bar') {
              // 柱子间距
              if (chart.pdfConfig.barCategoryGap !== undefined) {
                series.barCategoryGap = chart.pdfConfig.barCategoryGap
              }
              // 注意：柱子宽度由后面的字体配置部分统一应用
            }
          })
        }
        
        // 应用PDF配置到grid
        if (tempOption.grid) {
          const gridConfig = chart.pdfConfig
          if (Array.isArray(tempOption.grid)) {
            tempOption.grid.forEach(g => {
              if (gridConfig.gridRight !== undefined) g.right = gridConfig.gridRight
              if (gridConfig.gridLeft !== undefined) g.left = gridConfig.gridLeft
              if (gridConfig.gridTop !== undefined) g.top = gridConfig.gridTop
              if (gridConfig.gridBottom !== undefined) g.bottom = gridConfig.gridBottom
            })
          } else {
            if (gridConfig.gridRight !== undefined) tempOption.grid.right = gridConfig.gridRight
            if (gridConfig.gridLeft !== undefined) tempOption.grid.left = gridConfig.gridLeft
            if (gridConfig.gridTop !== undefined) tempOption.grid.top = gridConfig.gridTop
            if (gridConfig.gridBottom !== undefined) tempOption.grid.bottom = gridConfig.gridBottom
          }
        }
        
      }
      
      // 应用字体配置到所有图表（无论是否有pdfConfig）
      needApplyConfig = true
      
      // 如果图表有pdfSize（高清截图），需要放大字体以匹配缩放后的效果
      // 计算字体缩放系数：高清图是1200px宽，普通UI图约600px宽，所以需要2倍字体
      const fontScale = chart.pdfSize ? 2 : 1
      
      // 应用图例字体大小
      if (tempOption.legend) {
        if (Array.isArray(tempOption.legend)) {
          tempOption.legend.forEach(leg => {
            if (leg.textStyle) leg.textStyle.fontSize = Math.round(fonts.chartLegend * fontScale)
            else leg.textStyle = { fontSize: Math.round(fonts.chartLegend * fontScale) }
          })
        } else {
          if (tempOption.legend.textStyle) {
            tempOption.legend.textStyle.fontSize = Math.round(fonts.chartLegend * fontScale)
          } else {
            tempOption.legend.textStyle = { fontSize: Math.round(fonts.chartLegend * fontScale) }
          }
        }
      }
      
      // 应用series字体配置
      if (tempOption.series && tempOption.series.length > 0) {
        tempOption.series.forEach(series => {
          // 柱状图数值
          if (series.type === 'bar' && series.label) {
            series.label.fontSize = Math.round(fonts.chartBarLabel * fontScale)
          }
          // 饼图数值
          if (series.type === 'pie' && series.label) {
            series.label.fontSize = Math.round(fonts.chartPieLabel * fontScale)
          }
        })
      }
      
      // 应用坐标轴文字（包括刻度标签和名称）
      if (tempOption.xAxis) {
        if (Array.isArray(tempOption.xAxis)) {
          tempOption.xAxis.forEach(axis => {
            // 刻度标签
            if (!axis.axisLabel) axis.axisLabel = {}
            axis.axisLabel.fontSize = Math.round(fonts.chartAxisLabel * fontScale)
            // 坐标轴名称
            if (axis.name) {
              if (!axis.nameTextStyle) axis.nameTextStyle = {}
              axis.nameTextStyle.fontSize = Math.round(fonts.chartAxisLabel * fontScale)
            }
          })
        } else {
          // 刻度标签
          if (!tempOption.xAxis.axisLabel) tempOption.xAxis.axisLabel = {}
          tempOption.xAxis.axisLabel.fontSize = Math.round(fonts.chartAxisLabel * fontScale)
          // 坐标轴名称
          if (tempOption.xAxis.name) {
            if (!tempOption.xAxis.nameTextStyle) tempOption.xAxis.nameTextStyle = {}
            tempOption.xAxis.nameTextStyle.fontSize = Math.round(fonts.chartAxisLabel * fontScale)
          }
        }
      }
      if (tempOption.yAxis) {
        if (Array.isArray(tempOption.yAxis)) {
          tempOption.yAxis.forEach(axis => {
            // 刻度标签
            if (!axis.axisLabel) axis.axisLabel = {}
            axis.axisLabel.fontSize = Math.round(fonts.chartAxisLabel * fontScale)
            // 坐标轴名称
            if (axis.name) {
              if (!axis.nameTextStyle) axis.nameTextStyle = {}
              axis.nameTextStyle.fontSize = Math.round(fonts.chartAxisLabel * fontScale)
            }
          })
        } else {
          // 刻度标签
          if (!tempOption.yAxis.axisLabel) tempOption.yAxis.axisLabel = {}
          tempOption.yAxis.axisLabel.fontSize = Math.round(fonts.chartAxisLabel * fontScale)
          // 坐标轴名称
          if (tempOption.yAxis.name) {
            if (!tempOption.yAxis.nameTextStyle) tempOption.yAxis.nameTextStyle = {}
            tempOption.yAxis.nameTextStyle.fontSize = Math.round(fonts.chartAxisLabel * fontScale)
          }
        }
      }
      
      // 应用配置
      if (needApplyConfig) {
        chart.instance.setOption(tempOption, true)
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      
      // 获取当前（可能是临时放大后的）图表尺寸
      const chartWidth = chart.instance.getWidth()
      const chartHeight = chart.instance.getHeight()
      
      // 直接从ECharts实例获取图片
      const imgData = chart.instance.getDataURL({
        type: 'jpeg',
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      })
      
      // 恢复原始配置和尺寸
      if (needApplyConfig) {
        chart.instance.setOption(originalOption, true)
      }
      
      if (originalSize) {
        const chartDom = chart.instance.getDom()
        chartDom.style.width = originalSize.width
        chartDom.style.height = originalSize.height
        chart.instance.resize()
      }
      
      // 计算PDF中的尺寸（等比例缩放，保持页边距）
      let imgWidth = pageWidth - 80  // 统一边距（左右各留40px），保持页边距一致
      let imgHeight = (chartHeight * imgWidth) / chartWidth
      
      // 创建标题（用html2canvas渲染中文）
      const titleContainer = document.createElement('div')
      titleContainer.style.cssText = `
        position: fixed;
        left: -9999px;
        width: ${imgWidth}px;
        padding: 15px 0;
        background: white;
        font-family: "Microsoft YaHei", Arial, sans-serif;
        text-align: center;
      `
      titleContainer.innerHTML = `
        <h3 style="font-size: ${fonts.subtitle}px; color: ${colors.success}; margin: 0; padding-bottom: 8px; border-bottom: 2px solid ${colors.success};">
          ${chart.title}
        </h3>
      `
      document.body.appendChild(titleContainer)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const titleCanvas = await html2canvas(titleContainer, { scale: 2, backgroundColor: '#ffffff', logging: false })
      const titleImgData = titleCanvas.toDataURL('image/jpeg', 0.95)
      const titleImgHeight = (titleCanvas.height * imgWidth) / titleCanvas.width
      
      const totalHeight = titleImgHeight + imgHeight + 20
      
      // 布局规则：
      // 索引0（作物类型分布）：第一页上半部，currentY = 20
      // 索引1（各区域作物种类数量）：和索引0同一页下半部，间距+30
      // 索引2（作物面积排名）：新页面，currentY = 20
      // 索引3（各区域作物分布对比）：尝试和索引2同一页，如果放不下则新页面
      if (i === 1) {
        // 第二个图表：和第一个在同一页
        currentY += 30
      } else if (i === 2) {
        // 第三个图表（作物面积排名）：新页面
        pdf.addPage()
        currentY = 20
      } else if (i === 3) {
        // 第四个图表（各区域作物分布对比）：尝试和上一个图表在同一页
        const spaceNeeded = totalHeight + 30  // 需要的空间 = 图表总高度 + 间距
        const availableSpace = pageHeight - currentY - 20  // 剩余空间
        
        if (spaceNeeded > availableSpace) {
          // 放不下，新开一页
          pdf.addPage()
          currentY = 20
          console.log(`图表 ${chart.title} 放不下，新开一页`)
        } else {
          // 放得下，继续在当前页
          currentY += 30
          console.log(`图表 ${chart.title} 和上一个图表在同一页`)
        }
      }
      // i === 0（第一个图表）使用初始值 currentY = 20
      
      // 如果图表超出页面宽度，自动缩放以适应
      let finalImgWidth = imgWidth
      let finalImgHeight = imgHeight
      let finalTitleWidth = imgWidth
      let finalTitleHeight = titleImgHeight
      
      // 统一边距处理
      const maxWidth = pageWidth - 60  // 左右各留30px边距
      if (finalImgWidth > maxWidth) {
        const scaleRatio = maxWidth / finalImgWidth
        finalImgWidth = maxWidth
        finalImgHeight = imgHeight * scaleRatio
        finalTitleWidth = maxWidth
        finalTitleHeight = titleImgHeight * scaleRatio
        console.log(`图表 ${chart.title} 超出页面，自动缩放至 ${(scaleRatio * 100).toFixed(1)}%`)
      }
      
      // 计算居中位置
      const offsetX = (pageWidth - finalImgWidth) / 2
      
      // 添加标题
      pdf.addImage(titleImgData, 'JPEG', offsetX, currentY, finalTitleWidth, finalTitleHeight)
      
      // 标题和图表之间的间距：统一使用10px
      const titleGap = 10
      currentY += finalTitleHeight + titleGap
      
      // 添加图表
      pdf.addImage(imgData, 'JPEG', offsetX, currentY, finalImgWidth, finalImgHeight)
      
      currentY += finalImgHeight
      
      // 清理
      document.body.removeChild(titleContainer)
      console.log(`第二阶段图表导出成功: ${chart.title}，当前Y: ${currentY}，最终尺寸: ${finalImgWidth}x${finalImgHeight}`)
    } catch (error) {
      console.error(`导出第二阶段图表失败 (${chart.title}):`, error)
    }
  }
}

// 添加第二阶段详细数据表格
const addPhase2DataTable = async (pdf, pageWidth, pageHeight, fonts, colors) => {
  try {
    console.log('开始生成详细数据表格...')
    
    const titleSize = Math.max(fonts.title, 14)
    const descSize = Math.max(fonts.description, 9)
    
    // 每页2个区域，计算总页数
    const itemsPerPage = 2
    const totalPages = Math.ceil(phase2Data.value.length / itemsPerPage)
    
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      pdf.addPage()
      
      const startIndex = pageIndex * itemsPerPage
      const endIndex = Math.min(startIndex + itemsPerPage, phase2Data.value.length)
      const pageData = phase2Data.value.slice(startIndex, endIndex)
      
      const container = document.createElement('div')
      const containerWidth = pageWidth - 25
      container.style.cssText = `
        position: fixed; left: -9999px; top: 0;
        width: ${containerWidth}px; background: white;
        padding: 12px; font-family: "Microsoft YaHei", Arial, sans-serif;
      `
      
      // 构建页面HTML
      let pageHTML = ''
      
      // 第一页添加标题
      if (pageIndex === 0) {
        pageHTML += `
          <h2 style="font-size: ${titleSize}px; color: ${colors.primary}; margin-bottom: 10px; border-bottom: 2px solid ${colors.primary}; padding-bottom: 5px; text-align: center;">
            各区域作物分布详细数据
          </h2>
        `
      } else {
        pageHTML += `<div style="height: 6px;"></div>`
      }
      
      // 使用CSS Grid横向布局，每行2列
      pageHTML += `
        <div style="
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-top: 6px;
        ">
      `
      
      // 为每个区域创建卡片
      pageData.forEach((row, index) => {
        const actualIndex = startIndex + index
        const bgColor = actualIndex % 2 === 0 ? '#f9fafb' : '#ffffff'
        
        // 构建作物分布列表
        const cropItems = row.cropDistribution
          ?.filter(c => c.name !== '裸地')
          .map(crop => {
            const textColor = crop.name === '棉花' ? '#333' : '#fff'
            return `
              <div style="
                background: ${crop.color};
                color: ${textColor};
                padding: 3px 6px;
                margin: 1px;
                border-radius: 3px;
                font-size: ${descSize - 2}px;
                font-weight: 500;
                white-space: nowrap;
                text-align: center;
                box-shadow: 0 1px 2px rgba(0,0,0,0.1);
              ">
                ${crop.name}: ${crop.count}个 (${crop.area}亩)
              </div>
            `
          }).join('') || '<div style="color: #909399; text-align: center; padding: 8px;">无数据</div>'
        
        pageHTML += `
          <div style="
            background: ${bgColor};
            border: 1px solid #e5e7eb;
            border-radius: 5px;
            padding: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          ">
            <!-- 区域名称 -->
            <div style="
              text-align: center;
              padding: 5px;
              background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%);
              color: white;
              border-radius: 3px;
              margin-bottom: 6px;
            ">
              <div style="font-size: ${descSize + 3}px; font-weight: 700;">${row.regionName}</div>
            </div>
            
            <!-- 统计信息 -->
            <div style="
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 5px;
              margin-bottom: 5px;
              font-size: ${descSize}px;
            ">
              <div style="text-align: center; padding: 4px; background: #fff; border-radius: 3px; border: 1px solid #e5e7eb;">
                <div style="color: #6b7280; font-size: ${descSize - 2}px;">作物种类</div>
                <div style="font-weight: 700; color: ${colors.secondary}; font-size: ${descSize + 1}px;">${row.cropTypes}</div>
              </div>
              <div style="text-align: center; padding: 4px; background: #fff; border-radius: 3px; border: 1px solid #e5e7eb;">
                <div style="color: #6b7280; font-size: ${descSize - 2}px;">主要作物</div>
                <div style="font-weight: 700; color: ${colors.success}; font-size: ${descSize + 1}px;">${row.dominantCrop}</div>
              </div>
            </div>
            
            <div style="text-align: center; padding: 4px; background: #fff; border-radius: 3px; margin-bottom: 6px; border: 1px solid #e5e7eb;">
              <div style="color: #6b7280; font-size: ${descSize - 2}px;">总种植面积</div>
              <div style="font-weight: 700; color: ${colors.warning}; font-size: ${descSize + 1}px;">${row.totalArea} 亩</div>
            </div>
            
            <!-- 作物分布 -->
            <div style="
              background: white;
              border-radius: 3px;
              padding: 5px;
              border: 1px solid #e5e7eb;
            ">
              <div style="font-size: ${descSize - 1}px; color: #374151; margin-bottom: 3px; font-weight: 600; text-align: center;">作物分布</div>
              <div style="
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 1px;
              ">
                ${cropItems}
              </div>
            </div>
          </div>
        `
      })
      
      pageHTML += `</div>` // 结束grid
      
      container.innerHTML = pageHTML
      document.body.appendChild(container)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 将页面渲染为图片
      const canvas = await html2canvas(container, { 
        scale: 1.9, 
        backgroundColor: '#ffffff', 
        logging: false,
        useCORS: true,
        width: containerWidth,
        windowWidth: containerWidth + 70
      })
      
      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      
      // 计算图片尺寸
      const imgWidth = pageWidth - 25
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      
      // 添加到PDF
      const maxHeight = pageHeight - 25
      if (imgHeight <= maxHeight) {
        pdf.addImage(imgData, 'JPEG', 12, 12, imgWidth, imgHeight)
      } else {
        // 如果超高，按比例缩小
        const scale = maxHeight / imgHeight
        const scaledWidth = imgWidth * scale
        const scaledHeight = maxHeight
        const offsetX = (pageWidth - scaledWidth) / 2
        pdf.addImage(imgData, 'JPEG', offsetX, 12, scaledWidth, scaledHeight)
      }
      
      document.body.removeChild(container)
      console.log(`详细数据表格第 ${pageIndex + 1}/${totalPages} 页生成成功`)
    }
    
    console.log('详细数据表格全部生成成功')
  } catch (error) {
    console.error('生成详细数据表格失败:', error)
    throw new Error('生成详细数据表格失败: ' + error.message)
  }
}

// 关闭预览
const closePdfPreview = () => {
  console.log('关闭PDF预览对话框')
  showPdfPreview.value = false
  // 不清理PDF数据，允许重新打开预览
}

// 导出PDF（同时下载和保存）
const handleExportPdf = async () => {
  console.log('📤 点击了导出PDF按钮')
  
  if (!pdfBlob.value) {
    ElMessage.error('没有可导出的PDF')
    return
  }
  
  exporting.value = true
  
  try {
    // 并行执行下载和保存
    await Promise.all([
      downloadToLocal(),
      saveToDataManagement()
    ])
    
    ElMessage.success({
      message: 'PDF导出成功！\n已下载到本地并保存到数据管理',
      duration: 4000,
      showClose: true
    })
  } catch (error) {
    console.error('导出PDF失败:', error)
    ElMessage.error('导出失败: ' + (error.message || '未知错误'))
  } finally {
    exporting.value = false
  }
}

// 下载到本地
const downloadToLocal = () => {
  console.log('📥 执行下载到本地')
  
  // 获取文件名
  let filename = pdfFilename.value.trim()
  console.log('用户输入的文件名:', filename)
  
  if (!filename) {
    // 使用默认文件名
    const date = new Date()
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
    const timeStr = `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`
    filename = `Region_Comparison_${dateStr}_${timeStr}`
    console.log('使用默认文件名:', filename)
  }
  
  // 确保文件名以.pdf结尾
  if (!filename.toLowerCase().endsWith('.pdf')) {
    filename = filename + '.pdf'
  }
  
  console.log('最终文件名:', filename)
  
  // 创建下载链接
  const url = URL.createObjectURL(pdfBlob.value)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  
  console.log('✅ PDF下载成功:', filename)
}

// 保存到数据管理
const saveToDataManagement = async () => {
  console.log('💾 执行保存到数据管理')
  
  // 获取文件名
  let filename = pdfFilename.value.trim()
  console.log('用户输入的文件名:', filename)
  
  if (!filename) {
    // 使用默认文件名
    const date = new Date()
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
    const timeStr = `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`
    filename = `Region_Comparison_${dateStr}_${timeStr}`
    console.log('使用默认文件名:', filename)
  }
  
  // 确保文件名以.pdf结尾
  if (!filename.toLowerCase().endsWith('.pdf')) {
    filename = filename + '.pdf'
  }
  
  console.log('最终文件名:', filename)
  
  // 创建FormData用于上传PDF
  const formData = new FormData()
  formData.append('file', pdfBlob.value, filename)
  formData.append('type', 'region_comparison') // 区域对比类型
  formData.append('taskName', '区域对比') // 任务名
  
  console.log('准备上传到后端...')
  
  // 上传到后端
  const response = await fetch('/api/analysis/upload-pdf-report', {
    method: 'POST',
    body: formData
  })
  
  console.log('后端响应状态:', response.status)
  
  const result = await response.json()
  console.log('后端响应结果:', result)
  
  if (result.code === 200) {
    console.log('✅ PDF已成功保存到数据管理:', {
      filename,
      taskName: '区域对比',
      type: 'region_comparison',
      size: `${(pdfBlob.value.size / 1024 / 1024).toFixed(2)} MB`
    })
    
    console.log('💡 提示：前往数据管理界面 → 结果队列 → 分析结果，筛选"区域对比"即可查看')
  } else {
    console.error('❌ 保存失败:', result)
    throw new Error(result.message || '保存失败')
  }
}

// ==================== 生命周期 ====================

// 窗口大小改变时调整图表
const handleResize = () => {
  plantingRateChart?.resize()
  plantingStatusChart?.resize()
  overallPieChart?.resize()
  fallowAreaChart?.resize()
  cropTypePieChart?.resize()
  cropVarietyChart?.resize()
  cropAreaRankingChart?.resize()
  regionCropCompareChart?.resize()
}

// 清理图表
const disposeCharts = () => {
  plantingRateChart?.dispose()
  plantingStatusChart?.dispose()
  overallPieChart?.dispose()
  fallowAreaChart?.dispose()
  cropTypePieChart?.dispose()
  cropVarietyChart?.dispose()
  cropAreaRankingChart?.dispose()
  regionCropCompareChart?.dispose()
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  // 自动加载识别结果
  loadExistingFiles()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  disposeCharts()
  // 清理PDF预览URL
  if (pdfPreviewUrl.value) {
    URL.revokeObjectURL(pdfPreviewUrl.value)
  }
})
</script>

<style scoped lang="scss">
.report-container {
  padding: 20px;
  background: #f5f7fa;
  min-height: calc(100vh - 60px);
}

// PDF预览对话框样式
.preview-container {
  display: flex;
  gap: 20px;
  height: 70vh;
}

.config-sidebar {
  width: 280px;
  flex-shrink: 0;
  background: #f9fafb;
  border-radius: 8px;
  padding: 15px;
  overflow-y: auto;
  
  .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    padding-bottom: 15px;
    border-bottom: 2px solid #e5e7eb;
  }
  
  // Tabs标签居中
  :deep(.el-tabs__header) {
    display: flex;
    justify-content: center;
    
    .el-tabs__nav-wrap {
      display: flex;
      justify-content: center;
    }
  }
  
  .config-content {
    .config-section {
      margin-bottom: 20px;
      
      .section-title {
        font-size: 13px;
        font-weight: 600;
        color: #606266;
        margin-bottom: 10px;
      }
      
      .config-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        
        span {
          font-size: 13px;
          color: #606266;
        }
      }
    }
  }
}
    
// 页面标题
.page-header {
  margin-bottom: 30px;
  
  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
  }
  
  .header-text {
    text-align: center;
    flex: 1;
    
    h2 {
      font-size: 32px;
      font-weight: 600;
      color: #303133;
      margin: 0 0 10px 0;
    }
    
    p {
      font-size: 16px;
      color: #909399;
      margin: 0;
    }
  }
  
  .header-actions {
    .el-button {
      font-size: 14px;
      font-weight: 500;
      padding: 12px 24px;
      
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
      }
    }
  }
}

// 步骤卡片
.steps-card {
        margin-bottom: 20px;

  :deep(.el-card__body) {
    padding: 30px;
  }
}

// 通用卡片
.step-card {
  margin-bottom: 20px;
  
  :deep(.el-card__body) {
    padding: 30px;
  }
}

.card-header {
          display: flex;
          align-items: center;
          gap: 8px;
  font-size: 16px;
          font-weight: 600;
          color: #303133;
    }

// 文件选择区域
    .existing-files-section {
      margin-top: 20px;
}

// 统计卡片
.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
      transition: all 0.3s;
  border: 1px solid transparent;

      &:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    border-color: rgba(64, 158, 255, 0.3);
  }
  
  :deep(.el-card__body) {
          padding: 0;
        }
      }

.stat-content {
        display: flex;
        align-items: center;
  gap: 15px;
  padding: 20px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
  transition: transform 0.3s;
  
  .stat-card:hover & {
    transform: scale(1.1) rotate(5deg);
  }
        }

.stat-info {
          flex: 1;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
  font-weight: 500;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
            color: #303133;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

// 图表区域
.charts-section {
    display: grid;
  grid-template-columns: repeat(2, 1fr);
    gap: 20px;
  margin-top: 20px;
}

.chart-card {
  transition: all 0.3s;
  border: 1px solid #e4e7ed;
  
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
        border-color: #409EFF;
  }
  
  :deep(.el-card__body) {
    padding: 20px;
    background: linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%);
  }
  
  :deep(.el-card__header) {
    background: linear-gradient(135deg, #f5f7fa 0%, #e8f4ff 100%);
    border-bottom: 2px solid #409EFF;
  }
}

.chart-card-wide {
  grid-column: 1 / -1;  // 占据一整行
  transition: all 0.3s;
  border: 1px solid #e4e7ed;
  
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
    border-color: #409EFF;
  }
}

.chart-card-large {
  grid-column: 1 / -1;
  transition: all 0.3s;
  border: 1px solid #e4e7ed;
  overflow: visible;  // 允许tooltip溢出卡片

      &:hover {
        transform: translateY(-3px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
        border-color: #409EFF;
      }

  :deep(.el-card__body) {
    padding: 20px;
    background: linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%);
    overflow: visible;  // 允许tooltip溢出
  }
  
  :deep(.el-card__header) {
    background: linear-gradient(135deg, #f5f7fa 0%, #e8f4ff 100%);
    border-bottom: 2px solid #409EFF;
  }
}

.chart-container {
            width: 100%;
  height: 350px;
  border-radius: 8px;
  overflow: hidden;
}

.chart-container-large {
  width: 100%;
  height: 500px;  // 增加高度，让各区域作物分布对比图更大
  border-radius: 8px;
  overflow: visible;  // 允许tooltip溢出容器
}

// 操作按钮
.action-buttons {
          display: flex;
          justify-content: center;
    gap: 20px;
  
  .el-button {
    min-width: 160px;
    height: 44px;
    font-size: 15px;
    border-radius: 8px;
    transition: all 0.3s;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
  }
}

// 表格样式优化
:deep(.el-table) {
    border-radius: 8px;
  overflow: hidden;
  
  th {
    background: linear-gradient(135deg, #f5f7fa 0%, #e8f4ff 100%);
    color: #303133;
    font-weight: 600;
  }
  
  .el-table__row {
    transition: all 0.3s;
    
    &:hover {
      background: #f0f9ff;
    }
  }
}

// Alert样式优化
:deep(.el-alert) {
    border-radius: 8px;
  border: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  
  &.el-alert--success {
    background: linear-gradient(135deg, #f0f9ff 0%, #e8f5e9 100%);
    
    .el-alert__title {
      color: #2e7d32;
        font-weight: 600;
      }
    }
    
  &.el-alert--info {
    background: linear-gradient(135deg, #e3f2fd 0%, #f0f9ff 100%);
    
    .el-alert__title {
      color: #1976d2;
      font-weight: 600;
    }
  }
}

// 步骤条样式优化
:deep(.el-steps) {
  .el-step__title {
            font-size: 16px;
            font-weight: 600;
          }

  .el-step__description {
            color: #909399;
  }
  
  .is-finish {
    .el-step__icon {
      background: linear-gradient(135deg, #67c23a 0%, #95de64 100%);
      border-color: #67c23a;
    }
  }
  
  .is-process {
    .el-step__icon {
      background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
      border-color: #409eff;
    }
  }
}

// 卡片通用样式
.step-card {
  :deep(.el-card__header) {
    background: linear-gradient(135deg, #f5f7fa 0%, #e8f4ff 100%);
    border-bottom: 2px solid #409EFF;
    padding: 16px 20px;
  }
}

// 进度条样式
:deep(.el-progress) {
  .el-progress-bar__outer {
    border-radius: 8px;
  }
  
  .el-progress-bar__inner {
    border-radius: 8px;
  }
}

// 标签样式
:deep(.el-tag) {
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.3s;

      &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
}

// PDF预览对话框
.pdf-preview-dialog {
  :deep(.el-dialog__body) {
    padding: 0;
    height: 80vh;
  }
  
  .preview-container {
    display: flex;
    height: 100%;
    gap: 0;
  }
  
  // 左侧配置面板
  .config-sidebar {
    width: 360px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-right: none;
    display: flex;
    flex-direction: column;
    box-shadow: 2px 0 12px rgba(0,0,0,0.15);

    .sidebar-header {
      padding: 20px;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      display: flex;
      justify-content: space-between;
      align-items: center;
      
      .title {
        font-size: 18px;
        font-weight: 700;
        color: white;
        text-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }
      
      .button-group {
        display: flex;
        gap: 8px;
        
        .el-button {
          background: rgba(255, 255, 255, 0.9);
          border: none;
          font-weight: 500;
          
          &:hover {
            background: white;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          }
          
          &.el-button--primary {
            background: white;
            color: #667eea;
            font-weight: 600;
          }
        }
      }
    }
    
    .config-tabs {
      flex: 1;
      overflow: hidden;
      
      :deep(.el-tabs__header) {
        margin: 0;
        padding: 16px 20px 0;
        background: white;
      }
      
      :deep(.el-tabs__item) {
        font-size: 14px;
        font-weight: 600;
        color: #606266;
        
        &.is-active {
          color: #667eea;
        }
      }
      
      :deep(.el-tabs__active-bar) {
        background-color: #667eea;
      }
      
      :deep(.el-tabs__content) {
        height: calc(100% - 56px);
        overflow-y: auto;
        padding: 20px;
        background: #f8f9fa;
      }
    }
    
    .font-items {
      display: flex;
      flex-direction: column;
      gap: 14px;
      
      .font-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 16px;
        background: white;
        border-radius: 10px;
        border: 2px solid #e9ecef;
        box-shadow: 0 2px 6px rgba(0,0,0,0.05);
        transition: all 0.3s ease;
        
        &:hover {
          border-color: #667eea;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
        }
        
        label {
          font-size: 15px;
          color: #2d3748;
          font-weight: 600;
        }
        
        :deep(.el-input-number) {
          width: 110px;
          
          .el-input__inner {
            font-weight: 600;
            text-align: center;
          }
        }
      }
    }
    
    .color-schemes {
      .scheme-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        
        // 强制所有 radio 选项的样式
        :deep(.el-radio) {
          margin: 0 !important;
          padding: 0 !important;
          background: white;
          border-radius: 8px;
          border: 2px solid #e9ecef;
          transition: all 0.3s ease;
          overflow: hidden;
          height: 44px !important;
          min-height: 44px !important;
          max-height: 44px !important;
          display: flex !important;
          align-items: center !important;
          width: 100%;
          
          &:hover {
            border-color: #667eea;
            transform: translateX(3px);
            box-shadow: 0 3px 12px rgba(102, 126, 234, 0.2);
          }
          
          &.is-checked {
            border-color: #667eea;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
          }
        }
        
        :deep(.el-radio__input) {
          display: flex !important;
          align-items: center !important;
          padding-left: 12px;
          height: 44px;
          
          .el-radio__inner {
            width: 16px;
            height: 16px;
            border-width: 2px;
          }
          
          &.is-checked {
            .el-radio__inner {
              background: #667eea;
              border-color: #667eea;
              
              &::after {
                width: 6px;
                height: 6px;
              }
            }
            
            & + .el-radio__label {
              color: #667eea;
            }
          }
        }
        
        :deep(.el-radio__label) {
          flex: 1 !important;
          padding: 0 12px !important;
          display: flex !important;
          align-items: center !important;
          height: 44px !important;
        }
      }
      
      .scheme-option {
        display: flex;
        align-items: center;
        width: 100%;
        height: 100%;
        padding-right: 12px;
        
        .scheme-name {
          font-size: 14px;
          font-weight: 600;
          color: #2d3748;
          flex-shrink: 0;
          line-height: 1;
          margin-right: auto;
        }
        
        .scheme-colors {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          
          .color-dot {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
            transition: transform 0.2s ease;
            flex-shrink: 0;
            
            &:hover {
              transform: scale(1.15);
            }
          }
        }
      }
    }
  }
  
  // 右侧PDF预览区域
  .preview-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #f0f2f5;
    position: relative;
    
    .pdf-viewer {
      flex: 1;
      padding: 20px;
      overflow: auto;
      
      iframe {
        width: 100%;
        height: 100%;
        border: none;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
      }
    }
    
    .preview-loading {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 60px 20px;
      
      .loading-animation {
        margin-bottom: 20px;
        
        .rotating-icon {
          animation: rotate 1.5s linear infinite;
          color: #667eea;
        }
      }
      
      @keyframes rotate {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
    }
    
    .preview-placeholder {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
    }
  }
  
  :deep(.el-dialog__footer) {
    border-top: 1px solid #ebeef5;
    padding: 15px 20px;
  }
}

// 响应式
@media (max-width: 1200px) {
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-cards {
    grid-template-columns: 1fr;
  }
  
  .charts-section {
    grid-template-columns: 1fr;
  }
  
  .action-buttons {
    flex-direction: column;
    
    .el-button {
      width: 100%;
    }
  }
}
</style>
