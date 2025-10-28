<template>
  <div class="dashboard-container">
    <!-- 顶部筛选栏 -->
    <el-card class="filter-card" shadow="never">
      <div class="filter-bar">
        <el-space :size="15" wrap>
          <!-- 数据源选择 -->
          <div class="filter-item">
            <span class="filter-label">数据源：</span>
            <el-radio-group v-model="dataSource" size="default" @change="handleDataSourceChange">
              <el-radio-button label="image">影像数据</el-radio-button>
              <el-radio-button label="recognition">识别结果</el-radio-button>
            </el-radio-group>
          </div>
          
          <!-- 影像数据筛选条件 -->
          <template v-if="dataSource === 'image'">
          <div class="filter-item">
            <span class="filter-label">年份期次：</span>
            <el-select 
              v-model="filterForm.year" 
              placeholder="选择年份" 
              style="width: 120px"
              @change="handleYearChange"
            >
              <el-option 
                v-for="year in availableYears" 
                :key="year" 
                :label="`${year}年`" 
                :value="year" 
              />
            </el-select>
            <el-select 
              v-model="filterForm.period" 
              placeholder="选择期次" 
              style="width: 100px; margin-left: 10px"
              @change="handlePeriodChange"
            >
              <el-option 
                v-for="period in availablePeriods" 
                :key="period" 
                :label="`第${period}期`" 
                :value="period" 
              />
            </el-select>
          </div>
          <div class="filter-item">
            <span class="filter-label">影像名称：</span>
            <el-select 
                v-model="filterForm.imageNames" 
                placeholder="选择影像（可多选）" 
                style="width: 280px" 
                multiple
                collapse-tags
                collapse-tags-tooltip
              clearable
              @change="handleImageNameChange"
            >
              <el-option 
                v-for="image in availableImages" 
                :key="image.id" 
                :label="image.name" 
                :value="image.name" 
              >
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>{{ image.name }}</span>
                  <el-tag size="small" style="margin-left: 10px">{{ image.size }}</el-tag>
                </div>
              </el-option>
            </el-select>
          </div>
          <div class="filter-item" v-if="availableCropTypes.length > 0">
            <span class="filter-label">作物类型：</span>
            <el-select 
              v-model="selectedCropTypes" 
              placeholder="选择作物类型（可多选）" 
              style="width: 240px" 
              multiple
              collapse-tags
              collapse-tags-tooltip
              clearable
              @change="handleCropTypeChange"
            >
              <el-option 
                v-for="crop in availableCropTypes" 
                :key="crop.value" 
                :label="crop.label" 
                :value="crop.value"
              >
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span>{{ crop.label }}</span>
                  <div 
                    style="width: 20px; height: 12px; border-radius: 2px; margin-left: 10px;" 
                    :style="{ backgroundColor: crop.color }"
                  ></div>
                </div>
              </el-option>
            </el-select>
          </div>
          </template>
          
          <!-- 识别结果筛选条件 -->
          <template v-else>
            <div class="filter-item">
              <span class="filter-label">年份期次：</span>
              <el-select 
                v-model="recognitionFilter.year" 
                placeholder="选择年份" 
                style="width: 120px"
                clearable
                @change="handleRecognitionYearChange"
              >
                <el-option label="全部年份" value="" />
                <el-option 
                  v-for="year in recognitionYears" 
                  :key="year" 
                  :label="`${year}年`" 
                  :value="year" 
                />
              </el-select>
              <el-select 
                v-model="recognitionFilter.period" 
                placeholder="选择期次" 
                style="width: 100px; margin-left: 10px"
                clearable
                @change="handleRecognitionPeriodChange"
              >
                <el-option label="全部期次" value="" />
                <el-option 
                  v-for="period in recognitionPeriods" 
                  :key="period" 
                  :label="`第${period}期`" 
                  :value="period" 
                />
              </el-select>
            </div>
            <div class="filter-item">
              <span class="filter-label">区域：</span>
              <el-select 
                v-model="recognitionFilter.region" 
                placeholder="选择区域" 
                style="width: 160px" 
                clearable
                @change="handleRecognitionRegionChange"
              >
                <el-option label="全部区域" value="" />
                <el-option label="包头湖" value="BTH" />
                <el-option label="经济牧场" value="JJMC" />
                <el-option label="库尔楚" value="KEC" />
                <el-option label="普惠牧场" value="PHMC" />
                <el-option label="普惠农场" value="PHNC" />
                <el-option label="原种场" value="YZC" />
              </el-select>
            </div>
            <div class="filter-item">
              <span class="filter-label">识别任务：</span>
              <el-select 
                v-model="recognitionFilter.recognitionType" 
                placeholder="选择任务" 
                style="width: 180px" 
                clearable
                @change="handleRecognitionTypeChange"
              >
                <el-option label="全部任务" value="" />
                <el-option label="作物识别" value="crop_recognition" />
                <el-option label="种植情况识别" value="planting_situation" />
              </el-select>
            </div>
            <!-- 🆕 文件格式筛选 -->
            <div class="filter-item">
              <span class="filter-label">文件格式：</span>
              <el-select 
                v-model="recognitionFilter.fileFormat" 
                placeholder="选择格式" 
                style="width: 140px" 
                clearable
                @change="handleFileFormatChange"
              >
                <el-option label="全部格式" value="" />
                <el-option label="KMZ文件" value="KMZ" />
                <el-option label="SHP文件" value="SHP" />
                <el-option label="GeoJSON文件" value="GeoJSON" />
              </el-select>
            </div>
            <div class="filter-item">
              <span class="filter-label">文件名称：</span>
              <el-select 
                v-model="recognitionFilter.fileNames" 
                placeholder="请选择文件（可多选）" 
                style="width: 240px" 
                multiple
                collapse-tags
                collapse-tags-tooltip
                clearable
                filterable
              >
                <el-option 
                  v-for="file in filteredRecognitionFiles" 
                  :key="file.id" 
                  :label="file.name" 
                  :value="file.name" 
                />
              </el-select>
            </div>
          </template>
          
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button type="success" @click="handleRefreshOptions" plain>
            <RefreshCw :size="16" style="margin-right: 6px" />
            刷新选项
          </el-button>
        </el-space>
      </div>
    </el-card>

    <!-- 地图和图表区域 -->
    <el-row :gutter="20" style="margin-top: 0px">
      <!-- 地图区域 -->
      <el-col :xs="24" :lg="18">
        <el-card class="map-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span><el-icon><Location /></el-icon> 监测地图</span>
              <el-space>
                <el-select 
                  v-model="currentBaseMap" 
                  @change="handleBaseMapChange" 
                  placeholder="选择底图"
                  size="small"
                  style="width: 120px"
                >
                  <el-option label="高德路网" value="amap-vector" />
                  <el-option label="高德影像" value="amap-satellite" />
                  <el-option label="高德纯净" value="amap-pure" />
                  <el-option label="无底图" value="none" />
                </el-select>
                <el-button size="small" :icon="ZoomIn" @click="handleZoomIn">放大</el-button>
                <el-button size="small" :icon="ZoomOut" @click="handleZoomOut">缩小</el-button>
                <el-button size="small" :icon="Position" @click="handleZoomToExtent">缩放至</el-button>
              </el-space>
            </div>
          </template>
          <div id="map-container" class="map-container">
            
            <!-- 栅格图层图例（左下角） - 只在识别结果时显示 -->
            <div class="map-legend" v-show="dataSource === 'recognition' && currentRecognitionData">
              <div class="legend-header" @click="legendCollapsed = !legendCollapsed">
                <span class="legend-title">{{ getLegendTitle() }}</span>
                <el-icon 
                  class="legend-toggle" 
                  :class="{ collapsed: legendCollapsed }"
                >
                  <ArrowDown />
                </el-icon>
              </div>
              <div class="legend-content" v-show="!legendCollapsed">
                <!-- 图层控制 -->
                <div class="legend-layer">
                  <div class="layer-header">
                    <el-checkbox v-model="tiffLayerVisible" @change="toggleTiffLayer">
                      {{ getLayerLabel() }}
                    </el-checkbox>
                  </div>
                  <div class="layer-items" v-show="tiffLayerVisible">
                    <!-- 影像数据显示作物图例 -->
                    <template v-if="dataSource === 'image'">
                      <!-- 多影像文件列表（多选时显示） -->
                      <div v-if="loadedImages.length > 1" class="legend-files">
                        <div class="legend-section-title">已加载影像 ({{ loadedImages.length }})</div>
                        <div 
                          v-for="(img, index) in loadedImages" 
                          :key="img.id"
                          class="legend-file-item"
                          :class="{ active: index === currentImageIndex }"
                          @click="switchImage(index)"
                        >
                          <el-icon><Check v-if="index === currentImageIndex" /></el-icon>
                          <span>{{ img.name }}</span>
                    </div>
                        <el-divider style="margin: 8px 0" />
                      </div>
                      
                      <!-- 作物图例 -->
                    <div v-if="availableCropTypes.length === 0" class="legend-empty">
                      暂无作物类型数据
                    </div>
                    <div class="legend-item" v-for="item in availableCropTypes" :key="item.value">
                      <div class="legend-color" :style="{ background: item.color }"></div>
                      <span class="legend-label">{{ item.label }}</span>
                    </div>
                    </template>
                    
                    <!-- 识别结果显示文件信息 -->
                    <template v-else>
                      <!-- 多KMZ文件列表（多选时显示） -->
                      <div v-if="loadedKmzFiles.length > 1" class="legend-files">
                        <div class="legend-section-title">已加载文件 ({{ loadedKmzFiles.length }}) - 可多选</div>
                        <div 
                          v-for="(file, index) in loadedKmzFiles" 
                          :key="file.id"
                          class="legend-file-item"
                          :class="{ active: index === currentKmzIndex }"
                        >
                          <el-checkbox 
                            :model-value="isKmzLayerVisible(file.name)"
                            @change="(val) => toggleKmzLayerVisibility(file.name, val)"
                            @click.stop
                          />
                          <span @click="switchKmzFile(index)" style="flex: 1; cursor: pointer;">{{ file.name }}</span>
                  </div>
                        <el-divider style="margin: 8px 0" />
                </div>
                      
                      <!-- 当前文件信息 -->
                      <div v-if="currentRecognitionData" class="legend-info">
                        <div class="legend-item-text">
                          <span class="legend-label-bold">文件名：</span>
                          <span>{{ currentRecognitionData.name }}</span>
              </div>
                        <div class="legend-item-text" v-if="currentRecognitionData.regionName">
                          <span class="legend-label-bold">区域：</span>
                          <span>{{ currentRecognitionData.regionName }}</span>
                        </div>
                        <div class="legend-item-text" v-if="currentRecognitionData.year">
                          <span class="legend-label-bold">年份期次：</span>
                          <span>{{ currentRecognitionData.year }}年第{{ currentRecognitionData.period }}期</span>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 右侧图表 -->
      <el-col :xs="24" :lg="6">
        <!-- 作物分布图 - 只在识别结果时显示 -->
        <el-card class="chart-card" shadow="never" v-if="dataSource === 'recognition'">
          <template #header>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span><el-icon><PieChart /></el-icon> {{ getChartTitle() }}</span>
              <!-- 切换按钮（多文件时显示） -->
              <div v-if="(dataSource === 'image' && loadedImages.length > 1) || (dataSource === 'recognition' && loadedKmzFiles.length > 1)" 
                   class="file-switch-controls">
                <el-button 
                  :icon="ArrowDown" 
                  :disabled="dataSource === 'image' ? currentImageIndex <= 0 : currentKmzIndex <= 0"
                  size="small" 
                  circle
                  @click="dataSource === 'image' ? switchImage(currentImageIndex - 1) : switchKmzFile(currentKmzIndex - 1)"
                  style="transform: rotate(90deg);"
                />
                <span class="file-index">
                  {{ dataSource === 'image' ? currentImageIndex + 1 : currentKmzIndex + 1 }} 
                  / 
                  {{ dataSource === 'image' ? loadedImages.length : loadedKmzFiles.length }}
                </span>
                <el-button 
                  :icon="ArrowDown" 
                  :disabled="dataSource === 'image' ? currentImageIndex >= loadedImages.length - 1 : currentKmzIndex >= loadedKmzFiles.length - 1"
                  size="small" 
                  circle
                  @click="dataSource === 'image' ? switchImage(currentImageIndex + 1) : switchKmzFile(currentKmzIndex + 1)"
                  style="transform: rotate(-90deg);"
                />
              </div>
            </div>
          </template>
          <div id="crop-chart" class="chart-container"></div>
        </el-card>

        <!-- 统计信息卡片 / 影像信息卡片 -->
        <el-card class="stats-card" shadow="never" :style="{ marginTop: dataSource === 'recognition' ? '20px' : '0' }">
          <template #header>
              <div class="stats-header">
                <span class="stats-title">
                  <el-icon><DataAnalysis /></el-icon> 
                  {{ dataSource === 'image' ? '影像信息' : '统计信息' }}
                </span>
              <!-- 切换按钮（多文件时显示） -->
              <div v-if="(dataSource === 'image' && loadedImages.length > 1) || (dataSource === 'recognition' && loadedKmzFiles.length > 1)" 
                   class="file-switch-controls">
                <el-button 
                  :icon="ArrowDown" 
                  :disabled="dataSource === 'image' ? currentImageIndex <= 0 : currentKmzIndex <= 0"
                  size="small" 
                  circle
                  @click="dataSource === 'image' ? switchImage(currentImageIndex - 1) : switchKmzFile(currentKmzIndex - 1)"
                  style="transform: rotate(90deg);"
                />
                <span class="file-index">
                  {{ dataSource === 'image' ? currentImageIndex + 1 : currentKmzIndex + 1 }} 
                  / 
                  {{ dataSource === 'image' ? loadedImages.length : loadedKmzFiles.length }}
                </span>
                <el-button 
                  :icon="ArrowDown" 
                  :disabled="dataSource === 'image' ? currentImageIndex >= loadedImages.length - 1 : currentKmzIndex >= loadedKmzFiles.length - 1"
                  size="small" 
                  circle
                  @click="dataSource === 'image' ? switchImage(currentImageIndex + 1) : switchKmzFile(currentKmzIndex + 1)"
                  style="transform: rotate(-90deg);"
                />
              </div>
            </div>
          </template>
          <!-- 影像数据信息 -->
          <div v-if="dataSource === 'image'" class="image-info-content">
            <div v-if="!currentImageData" class="stats-empty">
              <el-empty description="请选择影像数据" :image-size="80" />
            </div>
            <div v-else class="info-list">
              <div class="info-item">
                <div class="info-label">
                  <el-icon><DocumentChecked /></el-icon>
                  <span>影像名称</span>
                </div>
                <div class="info-value">{{ currentImageData.name }}</div>
              </div>
              
              <div class="info-item">
                <div class="info-label">
                  <el-icon><Calendar /></el-icon>
                  <span>年份</span>
                </div>
                <div class="info-value">{{ currentImageData.year }}年</div>
              </div>
              
              <div class="info-item">
                <div class="info-label">
                  <el-icon><Grid /></el-icon>
                  <span>期次</span>
                </div>
                <div class="info-value">第{{ currentImageData.period }}期</div>
              </div>
              
              <div class="info-item">
                <div class="info-label">
                  <el-icon><Location /></el-icon>
                  <span>区域</span>
                </div>
                <div class="info-value">{{ currentImageData.region || '未设置' }}</div>
              </div>
              
              <div class="info-item">
                <div class="info-label">
                  <el-icon><Files /></el-icon>
                  <span>文件大小</span>
                </div>
                <div class="info-value">{{ currentImageData.size }}</div>
              </div>
              
              <div class="info-item">
                <div class="info-label">
                  <el-icon><Check /></el-icon>
                  <span>优化状态</span>
                </div>
                <div class="info-value">
                  <el-tag :type="currentImageData.isOptimized ? 'success' : 'info'" size="small">
                    {{ currentImageData.isOptimized ? '已优化' : '未优化' }}
                  </el-tag>
                </div>
              </div>
              
              <div class="info-item">
                <div class="info-label">
                  <el-icon><Clock /></el-icon>
                  <span>上传时间</span>
                </div>
                <div class="info-value">{{ formatUploadTime(currentImageData.uploadTime) }}</div>
              </div>
            </div>
          </div>
          
          <!-- 识别结果统计信息 -->
          <div v-else>
            <div v-if="kpiData.totalArea === '—'" class="stats-empty">
              <el-empty description="暂无统计数据" :image-size="80" />
            </div>
            <div v-else class="stats-content">
              <!-- 当前文件名 -->
              <div v-if="currentRecognitionData" class="current-file-name">
                <el-icon><DocumentChecked /></el-icon>
                <span>{{ currentRecognitionData.name }}</span>
              </div>
              
              <div class="stat-item">
                <div class="stat-icon">
                  <el-icon :size="24" color="#409EFF"><Grid /></el-icon>
                </div>
                <div class="stat-info">
                  <div class="stat-label">总监测面积</div>
                  <div class="stat-value">{{ kpiData.totalArea }} <span class="stat-unit">亩</span></div>
                </div>
              </div>
              
              <div class="stat-item">
                <div class="stat-icon">
                  <el-icon :size="24" color="#67C23A"><DocumentChecked /></el-icon>
                </div>
                <div class="stat-info">
                  <div class="stat-label">地块总数</div>
                  <div class="stat-value">{{ kpiData.plotCount }} <span class="stat-unit">块</span></div>
                </div>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 文件切换卡片（识别结果多文件时显示） -->
        <el-card v-if="dataSource === 'recognition' && loadedKmzFiles.length > 1" class="file-switch-card" shadow="never" style="margin-top: 15px">
          <template #header>
            <span><el-icon><FolderOpened /></el-icon> 已加载文件 ({{ loadedKmzFiles.length }})</span>
          </template>
          <div class="file-list">
            <div 
              v-for="(file, index) in loadedKmzFiles" 
              :key="file.id"
              class="file-item"
              :class="{ active: currentKmzIndex === index }"
              @click="switchKmzFile(index)"
            >
              <div class="file-number">{{ index + 1 }}</div>
              <div class="file-info">
                <div class="file-name">{{ file.name }}</div>
                <div class="file-meta">
                  <el-tag size="small" type="success">{{ file.regionName }}</el-tag>
                  <span class="file-date">{{ file.year }}年 第{{ file.period }}期</span>
                </div>
              </div>
              <el-icon v-if="currentKmzIndex === index" class="check-icon" color="#67C23A"><Check /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Search, Refresh, Grid, SuccessFilled, WarningFilled, DocumentChecked, Location, ZoomIn, ZoomOut, Position, PieChart, DataLine, TrendCharts, ArrowDown, Loading, DataAnalysis, FolderOpened, Check, Calendar, Files, Clock } from '@element-plus/icons-vue'
import { RefreshCw } from 'lucide-vue-next'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'

// OpenLayers 导入
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import { OSM, XYZ } from 'ol/source'
import VectorSource from 'ol/source/Vector'
import KML from 'ol/format/KML'
import { fromLonLat, transformExtent } from 'ol/proj'
import GeoTIFF from 'ol/source/GeoTIFF'
import WebGLTile from 'ol/layer/WebGLTile'
import { defaults as defaultControls } from 'ol/control'
import { Style, Fill, Stroke, Circle } from 'ol/style'
import 'ol/ol.css'
import axios from 'axios'
import { fromUrl } from 'geotiff'  // 用于前端读取和分析TIF文件
import JSZip from 'jszip'  // 用于解压KMZ文件
import GeoJSON from 'ol/format/GeoJSON'  // 用于KMZ转GeoJSON

// 数据源选择
const dataSource = ref('image') // 'image' 或 'recognition'

// 影像数据相关
const imageData = ref([])
const availableYears = ref([])
const availablePeriods = ref([])
const availableImages = ref([]) // 可用的影像列表
const currentImageData = ref(null)
const currentImageIndex = ref(0) // 当前显示的影像索引

const filterForm = ref({
  year: '',
  period: '',
  imageNames: [], // 影像名称（多选）
  region: [],
  keyword: ''
})

// 识别结果相关
const recognitionResults = ref([]) // 所有识别结果
const recognitionYears = ref([]) // 可用年份
const recognitionPeriods = ref([]) // 可用期次
const currentRecognitionData = ref(null) // 当前选中的识别结果

const recognitionFilter = ref({
  year: '',
  period: '',
  region: '',
  recognitionType: '',
  fileFormat: '',  // 🆕 文件格式筛选
  fileNames: []  // 改为数组支持多选
})

// 已加载的KMZ文件列表
const loadedKmzFiles = ref([])
// 当前显示的KMZ文件索引
const currentKmzIndex = ref(0)
// 🆕 KMZ图层可见性状态（响应式）- 用于同步checkbox状态
const kmzLayerVisibility = ref({})

// 选中的作物类型（多选）
// 默认显示所有类型（包括裸地）
const selectedCropTypes = ref([])

// 动态加载的作物类型（从影像中分析得出）
const availableCropTypes = ref([])

// 过滤后的图例（根据选中的作物类型）
const filteredCropLegend = computed(() => {
  if (selectedCropTypes.value.length === 0) {
    // 如果没有选择，显示全部
    return availableCropTypes.value.length > 0 ? availableCropTypes.value : cropLegend
  }
  // 只显示选中的作物类型
  const baseData = availableCropTypes.value.length > 0 ? availableCropTypes.value : cropLegend
  return baseData.filter(crop => selectedCropTypes.value.includes(crop.value))
})

// 根据筛选条件过滤识别结果文件列表
const filteredRecognitionFiles = computed(() => {
  if (!recognitionResults.value || recognitionResults.value.length === 0) {
    return []
  }
  
  let filtered = recognitionResults.value
  
  // 根据年份筛选
  if (recognitionFilter.value.year) {
    filtered = filtered.filter(file => file.year === recognitionFilter.value.year)
  }
  
  // 根据期次筛选
  if (recognitionFilter.value.period) {
    filtered = filtered.filter(file => file.period === recognitionFilter.value.period)
  }
  
  // 根据区域筛选
  if (recognitionFilter.value.region) {
    filtered = filtered.filter(file => file.regionCode === recognitionFilter.value.region)
  }
  
  // 根据识别任务筛选
  if (recognitionFilter.value.recognitionType) {
    filtered = filtered.filter(file => file.recognitionType === recognitionFilter.value.recognitionType)
  }
  
  // 🆕 根据文件格式筛选
  if (recognitionFilter.value.fileFormat) {
    filtered = filtered.filter(file => file.type === recognitionFilter.value.fileFormat)
  }
  
  return filtered
})

const regionOptions = [
  {
    value: 'xj',
    label: '新疆维吾尔自治区',
    children: [
      { value: 'wlmq', label: '乌鲁木齐市' },
      { value: 'ks', label: '喀什地区' },
      { value: 'ale', label: '阿勒泰地区' }
    ]
  }
]

const kpiData = ref({
  totalArea: '0',
  matchRate: '0',
  diffCount: '0',
  plotCount: '0'
})

let cropChart = null
let map = null // OpenLayers 地图实例
let tiffLayers = [] // TIF 图层数组（支持多个）
let kmzLayers = [] // KMZ 图层数组（支持多个）
const loadedImages = ref([]) // 已加载的影像数据

// 底图图层（多种类型）
let baseMapLayers = {
  'amap-vector': null,      // 高德路网图
  'amap-satellite': null,   // 高德影像图
  'amap-annotation': null,  // 高德影像标注
  'amap-pure': null         // 高德纯净图
}

// 图例相关状态
const legendCollapsed = ref(false) // 图例是否收起
const tiffLayerVisible = ref(false) // TIF 图层是否可见（默认关闭）
const currentBaseMap = ref('amap-vector') // 当前底图类型（默认路网图）

// 作物分类图例配置（使用像素值+1后的映射：1-10对应不同作物类型）
// 注意：像素值已经整体+1，0表示NoData（透明）
const cropLegend = [
  { value: 1, label: '裸地', color: '#D2B48C' },      // 原0
  { value: 2, label: '棉花', color: '#E0F8FF' },      // 原1 - 浅天蓝色，便于识别
  { value: 3, label: '小麦', color: '#FFD700' },      // 原2
  { value: 4, label: '玉米', color: '#FFA500' },      // 原3
  { value: 5, label: '番茄', color: '#FF6347' },      // 原4
  { value: 6, label: '甜菜', color: '#FF1493' },      // 原5
  { value: 7, label: '打瓜', color: '#00FF7F' },      // 原6
  { value: 8, label: '辣椒', color: '#DC143C' },      // 原7
  { value: 9, label: '籽用葫芦', color: '#9370DB' },  // 原8
  { value: 10, label: '其它耕地', color: '#808080' }  // 原9
]

// 🎨 hexToRgbObject 辅助函数（返回对象格式）
const hexToRgbObject = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 100, g: 100, b: 100 }
}

// 🎨 动态要素样式函数
let styleDebugCount = 0  // 用于限制调试输出
const getFeatureStyle = (feature, recognitionType) => {
  const props = feature.getProperties()
  let fillColor = 'rgba(100, 100, 100, 0.5)' // 默认灰色
  
  if (recognitionType === 'planting_situation') {
    // 🌾 种植情况识别：读取 gridcode，映射到作物颜色
    let gridcode = null
    if (props.gridcode !== undefined && props.gridcode !== null) {
      gridcode = parseInt(props.gridcode)
    } else if (props.GRIDCODE !== undefined && props.GRIDCODE !== null) {
      gridcode = parseInt(props.GRIDCODE)
    } else if (props.GridCode !== undefined && props.GridCode !== null) {
      gridcode = parseInt(props.GridCode)
    }
    
    // 🐛 调试输出（仅输出前5个要素）
    if (styleDebugCount < 5) {
      console.log(`🎨 [种植情况识别] 要素属性:`, {
        gridcode: props.gridcode,
        GRIDCODE: props.GRIDCODE,
        GridCode: props.GridCode,
        解析后: gridcode,
        所有属性: Object.keys(props).filter(k => k !== 'geometry')
      })
      styleDebugCount++
    }
    
    if (gridcode !== null && gridcode >= 1 && gridcode <= 10) {
      const cropInfo = cropLegend.find(c => c.value === gridcode)
      if (cropInfo) {
        const rgb = hexToRgbObject(cropInfo.color)
        fillColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`
      }
    }
  } else if (recognitionType === 'crop_recognition') {
    // 🌱 作物识别：读取 class，0=未种植（红色），1=已种植（绿色）
    let classValue = null
    if (props.class !== undefined && props.class !== null) {
      classValue = parseInt(props.class)
    } else if (props.CLASS !== undefined && props.CLASS !== null) {
      classValue = parseInt(props.CLASS)
    } else if (props.Class !== undefined && props.Class !== null) {
      classValue = parseInt(props.Class)
    }
    
    // 🐛 调试输出（仅输出前5个要素）
    if (styleDebugCount < 5) {
      console.log(`🎨 [作物识别] 要素属性:`, {
        class: props.class,
        CLASS: props.CLASS,
        Class: props.Class,
        解析后: classValue,
        所有属性: Object.keys(props).filter(k => k !== 'geometry')
      })
      styleDebugCount++
    }
    
    if (classValue === 1) {
      fillColor = 'rgba(103, 194, 58, 0.6)' // 已种植=绿色
    } else if (classValue === 0) {
      fillColor = 'rgba(245, 108, 108, 0.6)' // 未种植=红色
    }
  } else {
    // ⚠️ 未知识别类型，输出警告
    if (styleDebugCount < 2) {
      console.warn(`⚠️ 未知的识别类型: "${recognitionType}"`)
      styleDebugCount++
    }
  }
  
  return new Style({
    fill: new Fill({
      color: fillColor
    }),
    stroke: new Stroke({
      color: 'rgba(0, 0, 0, 0)',  // 🔧 完全透明的边框
      width: 0
    })
  })
}

// 获取影像数据列表
const fetchImageData = async () => {
  try {
    // 🔧 修复：使用后端 API 获取影像数据，而不是直接访问静态文件
    const response = await axios.get('/api/image/list')
    imageData.value = response.data.data || []
    
    // 提取所有年份
    const years = [...new Set(imageData.value.map(img => img.year))]
    availableYears.value = years.sort((a, b) => b - a)
    
    // 不再设置默认年份，让用户主动选择
    // 更新可用期次
    if (filterForm.value.year) {
    updateAvailablePeriods()
    }
    
    // 不再自动加载数据，等待用户点击查询按钮
    console.log('影像数据已加载，等待用户选择筛选条件')
  } catch (error) {
    console.error('获取影像数据失败:', error)
    ElMessage.error('获取影像数据失败')
  }
}

// 更新可用期次
const updateAvailablePeriods = () => {
  const periodsForYear = imageData.value
    .filter(img => img.year === filterForm.value.year)
    .map(img => img.period)
  
  availablePeriods.value = [...new Set(periodsForYear)].sort()
  
  // 如果当前选择的期次不在可用列表中，选择第一个
  if (availablePeriods.value.length > 0 && 
      !availablePeriods.value.includes(filterForm.value.period)) {
    filterForm.value.period = availablePeriods.value[0]
  }
  
  // 更新可用影像列表
  updateAvailableImages()
}

// 更新可用影像列表（根据年份和期次）
const updateAvailableImages = () => {
  availableImages.value = imageData.value.filter(img => 
    img.year === filterForm.value.year &&
    img.period === filterForm.value.period
  )
  
  // 如果当前选择的影像名称不在列表中，清空选择
  if (filterForm.value.imageNames && filterForm.value.imageNames.length > 0) {
    filterForm.value.imageNames = filterForm.value.imageNames.filter(name =>
      availableImages.value.some(img => img.name === name)
    )
  }
  
  console.log('可用影像列表已更新:', availableImages.value.length, '个影像')
}

// 年份变化处理
const handleYearChange = () => {
  filterForm.value.imageNames = [] // 清空影像名称选择
  updateAvailablePeriods()
  // 不再自动加载，等待用户点击查询
}

// 期次变化处理
const handlePeriodChange = () => {
  filterForm.value.imageNames = [] // 清空影像名称选择
  updateAvailableImages()
  // 不再自动加载，等待用户点击查询
}

// 影像名称变化处理
const handleImageNameChange = () => {
  // 不再自动分析，等待查询时再分析
  // 避免频繁分析导致卡顿
}

// 作物类型变化处理
const handleCropTypeChange = () => {
  // 如果图层已经加载且可见，重新应用样式
  if (tiffLayers.length > 0 && tiffLayerVisible.value) {
    console.log('作物类型已更改，重新应用样式')
    
    // 更新所有TIF图层样式
    tiffLayers.forEach(layer => {
      if (layer) {
        layer.setStyle({
      color: generateColorStyle()
        })
      }
    })
    
    // 更新统计图表
    if (currentImageData.value) {
      updateStatistics(currentImageData.value)
    }
    
    ElMessage.success('已更新作物类型筛选')
  }
}

// 加载 TIF 数据到地图（支持多选）
const loadTiffData = async () => {
  // 清空已加载的影像列表
  loadedImages.value = []
  
  // 获取选中的影像
  let matchedImages = []
  
  if (filterForm.value.imageNames && filterForm.value.imageNames.length > 0) {
    // 根据选中的影像名称查找（不限制年份期次，支持跨年跨期选择）
    matchedImages = imageData.value.filter(img =>
      filterForm.value.imageNames.includes(img.name)
    )
  } else {
    // 如果没有选择具体影像，提示用户
    ElMessage.warning('请选择要加载的影像')
    return
  }
  
  if (matchedImages.length === 0) {
    ElMessage.error('未找到选中的影像数据')
    return
  }
  
  console.log(`找到 ${matchedImages.length} 个匹配的影像`)
  
  // 保存已加载的影像
  loadedImages.value = matchedImages
  currentImageIndex.value = 0 // 重置索引到第一个
  
  // 如果TIF图层开关是打开的，加载所有选中的影像
  if (tiffLayerVisible.value) {
    await reloadMultipleTiffLayers(matchedImages)
  }
  
  // 使用第一个影像的统计数据
  if (matchedImages.length > 0) {
    currentImageData.value = matchedImages[0]
    await updateStatistics(matchedImages[0])
  }
  
  console.log(`✅ 已选择 ${matchedImages.length} 个影像`)
}

// 加载识别结果数据（KMZ等）- 支持多选和增量加载
const loadRecognitionData = async () => {
  // 验证必填字段
  if (!recognitionFilter.value.fileNames || recognitionFilter.value.fileNames.length === 0) {
    ElMessage.warning('请选择要查看的文件')
    return
  }
  
  // 根据文件名查找对应的识别结果
  const matchedFiles = recognitionResults.value.filter(file => 
    recognitionFilter.value.fileNames.includes(file.name)
  )
  
  if (matchedFiles.length === 0) {
    ElMessage.error('未找到指定的文件')
    return
  }
  
  console.log(`🔍 选中了 ${matchedFiles.length} 个文件`)
  
  // 🔧 修复：增量添加文件，而不是替换
  // 检查哪些文件是新的
  const existingFileNames = loadedKmzFiles.value.map(f => f.name)
  const newFiles = matchedFiles.filter(f => !existingFileNames.includes(f.name))
  
  if (newFiles.length > 0) {
    // 添加新文件到已加载列表
    loadedKmzFiles.value = [...loadedKmzFiles.value, ...newFiles]
    console.log(`📦 新增 ${newFiles.length} 个文件到待加载列表`)
  } else {
    console.log(`ℹ️ 所有选中的文件都已在列表中`)
  }
  
  // 如果这是第一次加载，设置当前索引和数据
  if (currentKmzIndex.value === 0 && loadedKmzFiles.value.length > 0) {
    currentRecognitionData.value = loadedKmzFiles.value[0]
    updateRecognitionStatisticsPreview(loadedKmzFiles.value[0])
  }
  
  // 如果图层开关已经打开，自动加载新文件
  if (tiffLayerVisible.value && newFiles.length > 0) {
    // 🔧 修复：根据文件类型加载不同格式的文件
    await loadRecognitionFilesIncremental(loadedKmzFiles.value)
    
    // 🔧 加载完成后，确保图表初始化
    nextTick(() => {
      if (!cropChart) {
        setTimeout(() => {
          initCropChart()
          console.log('✅ 查询后图表已初始化')
        }, 100)
      }
    })
  }
  
  console.log(`✅ 已准备 ${loadedKmzFiles.value.length} 个文件，${tiffLayerVisible.value ? '正在加载' : '勾选图层开关以显示'}`)
  ElMessage.success(`已选择 ${matchedFiles.length} 个文件${newFiles.length > 0 ? '，其中' + newFiles.length + '个是新增的' : ''}`)
}

// 前端解析KMZ为GeoJSON（使用JSZip）
const parseKmzToGeoJSON = async (kmzUrl) => {
  try {
    console.log(`🔧 前端解析KMZ: ${kmzUrl}`)
    
    // 1. 下载KMZ文件
    const response = await fetch(kmzUrl)
    const blob = await response.blob()
    
    // 2. 使用JSZip解压
    const zip = await JSZip.loadAsync(blob)
    
    // 3. 查找KML文件（通常是doc.kml）
    let kmlContent = null
    let kmlFileName = null
    
    for (const filename in zip.files) {
      if (filename.toLowerCase().endsWith('.kml')) {
        kmlFileName = filename
        kmlContent = await zip.files[filename].async('text')
        console.log(`   找到KML文件: ${filename}`)
        break
      }
    }
    
    if (!kmlContent) {
      throw new Error('KMZ中未找到KML文件')
    }
    
    // 4. 使用OpenLayers KML格式解析
    const kmlFormat = new KML({
      extractStyles: false
    })
    
    const features = kmlFormat.readFeatures(kmlContent, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857'
    })
    
    console.log(`✅ KML解析成功，包含 ${features.length} 个要素`)
    
    // 输出GeoJSON内容到控制台（用户请求）
    if (features.length > 0) {
      const geojsonFormat = new GeoJSON()
      const geojsonData = JSON.parse(geojsonFormat.writeFeatures(features))
      
      console.log('📄 ===== GeoJSON完整内容 =====')
      console.log('GeoJSON类型:', geojsonData.type)
      console.log('要素总数:', geojsonData.features.length)
      console.log('第一个要素完整信息:', geojsonData.features[0])
      console.log('第一个要素的属性字段:', geojsonData.features[0]?.properties ? Object.keys(geojsonData.features[0].properties) : '无属性')
      console.log('前3个要素的属性示例:')
      geojsonData.features.slice(0, 3).forEach((feature, idx) => {
        console.log(`  要素${idx + 1}属性:`, feature.properties)
      })
      console.log('完整GeoJSON对象:', geojsonData)
      console.log('===========================')
    }
    
    return features
  } catch (error) {
    console.error('❌ KMZ解析失败:', error)
    throw error
  }
}

// 增量加载KMZ文件（只加载新增的文件）
const loadKmzFilesIncremental = async (selectedFiles) => {
  try {
    console.log(`📥 开始增量加载KMZ文件...`)
    console.log(`   已选择: ${selectedFiles.length} 个文件`)
    console.log(`   已加载: ${kmzLayers.length} 个图层`)
    
    // 获取已加载的文件名列表
    const loadedFileNames = kmzLayers.map((layer, idx) => {
      // 从图层的自定义属性中获取文件名
      return layer.get('fileName')
    }).filter(Boolean)
    
    console.log('   已加载文件:', loadedFileNames)
    
    // 找出需要新加载的文件
    const newFiles = selectedFiles.filter(file => !loadedFileNames.includes(file.name))
    
    if (newFiles.length > 0) {
      console.log(`📦 需要加载 ${newFiles.length} 个新文件:`, newFiles.map(f => f.name))
      
      // 显示加载提示
      const loadingMsg = ElMessage.info({
        message: `正在加载 ${newFiles.length} 个KMZ文件...`,
        duration: 0
      })
      
      // 逐个加载新文件
      for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i]
        const layerIndex = kmzLayers.length  // 新图层的索引
        
        console.log(`🔄 [${i + 1}/${newFiles.length}] 加载: ${file.name}`)
        
        try {
          // 🔧 修复：构建文件路径，使用后端 API 而不是直接访问静态文件
          // 如果有 relativePath，需要在文件名中包含它
          const fileName = file.relativePath 
            ? `${file.relativePath}/${file.name}`.replace(/\\/g, '/')
            : file.name
          const filePath = `/api/analysis/download/kmz/${encodeURIComponent(fileName)}`
          
          console.log(`   文件相对路径: ${file.relativePath}`)
          console.log(`   文件名: ${file.name}`)
          console.log(`   文件完整路径: ${filePath}`)
          
          // 使用前端解析KMZ
          const features = await parseKmzToGeoJSON(filePath)
          
            if (features && features.length > 0) {
              // 创建图层
              const geojsonSource = new VectorSource({
                features: features
              })
              
              // 🎨 使用动态样式函数
              const newLayer = new VectorLayer({
                source: geojsonSource,
                style: (feature) => getFeatureStyle(feature, file.recognitionType),
                zIndex: 100 + layerIndex,
                visible: true
              })
              
              // 保存文件名到图层（用于增量加载判断）
              newLayer.set('fileName', file.name)
              newLayer.set('fileData', file)
            
            map.addLayer(newLayer)
            kmzLayers.push(newLayer)
            
            // 🔧 修复：初始化响应式可见性状态
            kmzLayerVisibility.value[file.name] = true
            
            console.log(`✅ [${i + 1}/${newFiles.length}] 加载成功: ${file.name} (${features.length}个要素)`)
            
            // 如果是第一个加载的文件，更新统计信息
            if (kmzLayers.length === 1) {
              currentKmzIndex.value = 0
              currentRecognitionData.value = file
              updateKmzStatistics(file, kmzLayers.length - 1)
            }
          } else {
            console.warn(`⚠️ ${file.name} 解析后无要素`)
          }
        } catch (error) {
          console.error(`❌ ${file.name} 加载失败:`, error)
        }
      }
      
      loadingMsg.close()
      
      // 缩放到第一个新加载的图层
      if (kmzLayers.length > 0) {
        const firstLayer = kmzLayers[0]
        const extent = firstLayer.getSource().getExtent()
        if (extent && extent.every(coord => isFinite(coord))) {
          map.getView().fit(extent, {
            padding: [80, 80, 80, 80],
            duration: 800,
            maxZoom: 15
          })
        }
      }
      
      ElMessage.success(`成功加载 ${newFiles.length} 个文件`)
    } else {
      console.log('✅ 所有文件已加载，仅显示图层')
      
      // 显示所有已加载的图层
      kmzLayers.forEach(layer => layer.setVisible(true))
      
      ElMessage.success('已显示识别结果图层')
    }
    
  } catch (error) {
    console.error('❌ KMZ增量加载失败:', error)
    ElMessage.error(`加载失败: ${error.message}`)
  }
}

// 【已废弃】tryManualKmzParsing函数已删除，直接在loadKmzFilesIncremental中使用parseKmzToGeoJSON
// 【已废弃】原loadAllKmzLayers函数已删除，改用loadKmzFilesIncremental实现增量加载

// 🆕 通用识别结果文件增量加载（支持KMZ、SHP、GeoJSON）
const loadRecognitionFilesIncremental = async (selectedFiles) => {
  try {
    // 🐛 重置样式调试计数器
    styleDebugCount = 0
    
    console.log(`📥 开始增量加载识别结果文件...`)
    console.log(`   已选择: ${selectedFiles.length} 个文件`)
    
    // 按文件类型分组
    const kmzFiles = selectedFiles.filter(f => f.type === 'KMZ')
    const shpFiles = selectedFiles.filter(f => f.type === 'SHP')
    const geojsonFiles = selectedFiles.filter(f => f.type === 'GeoJSON')
    
    console.log(`   KMZ文件: ${kmzFiles.length} 个`)
    console.log(`   SHP文件: ${shpFiles.length} 个`)
    console.log(`   GeoJSON文件: ${geojsonFiles.length} 个`)
    
    // 分别加载不同类型的文件
    if (kmzFiles.length > 0) {
      await loadKmzFilesIncremental(kmzFiles)
    }
    
    if (shpFiles.length > 0) {
      await loadShpFilesIncremental(shpFiles)
    }
    
    if (geojsonFiles.length > 0) {
      await loadGeoJsonFilesIncremental(geojsonFiles)
    }
    
  } catch (error) {
    console.error('❌ 识别结果文件增量加载失败:', error)
    ElMessage.error(`加载失败: ${error.message}`)
  }
}

// 🆕 加载SHP文件（转换为GeoJSON后显示）
const loadShpFilesIncremental = async (selectedFiles) => {
  try {
    console.log(`📥 开始增量加载SHP文件...`)
    
    // 获取已加载的文件名列表
    const loadedFileNames = kmzLayers.map(layer => layer.get('fileName')).filter(Boolean)
    
    // 找出需要新加载的文件
    const newFiles = selectedFiles.filter(file => !loadedFileNames.includes(file.name))
    
    if (newFiles.length > 0) {
      console.log(`📦 需要加载 ${newFiles.length} 个新SHP文件:`, newFiles.map(f => f.name))
      
      const loadingMsg = ElMessage.info({
        message: `正在加载 ${newFiles.length} 个SHP文件...`,
        duration: 0
      })
      
      for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i]
        const layerIndex = kmzLayers.length
        
        console.log(`🔄 [${i + 1}/${newFiles.length}] 加载SHP: ${file.name}`)
        
        try {
          // 🔧 修复：使用封装好的API函数，通过Vite代理访问后端
          // 🔧 修复：传递relativePath参数以支持子文件夹
          const response = await axios.post('/api/analysis/convert-to-geojson', {
            shpFilename: file.name,
            relativePath: file.relativePath || ''
          })
          
          let geojsonData = null
          let geojsonFilename = null
          
          // 🔧 修复：后端转换成功或文件已存在，都需要再读取GeoJSON文件
          if (response.data.code === 200) {
            // 转换成功，获取GeoJSON文件名
            geojsonFilename = response.data.data.geojsonFilename
            console.log(`✅ 转换成功: ${file.name} -> ${geojsonFilename}`)
          } else if (response.data.code === 400 && response.data.data?.existed) {
            // 文件已存在
            geojsonFilename = response.data.data.geojsonFilename
            console.log(`ℹ️ 文件已存在，跳过转换: ${geojsonFilename}`)
          }
          
          // 读取GeoJSON文件内容
          if (geojsonFilename) {
            const geojsonResponse = await axios.get(`/api/analysis/read-geojson/${geojsonFilename}`)
            if (geojsonResponse.data.code === 200) {
              geojsonData = geojsonResponse.data.data
            }
          }
          
          if (geojsonData) {
            // 将GeoJSON转换为OL features
            // 🔧 修复：指定 dataProjection，避免二次投影导致坐标异常
            const features = new GeoJSON().readFeatures(geojsonData, {
              dataProjection: 'EPSG:3857',    // 数据本身就是 Web Mercator
              featureProjection: 'EPSG:3857'  // 目标投影也是 Web Mercator（不转换）
            })
            
            if (features && features.length > 0) {
              // 创建图层
              const geojsonSource = new VectorSource({
                features: features
              })
              
              // 🎨 使用动态样式函数
              const newLayer = new VectorLayer({
                source: geojsonSource,
                style: (feature) => getFeatureStyle(feature, file.recognitionType),
                zIndex: 100 + layerIndex,
                visible: true
              })
              
              newLayer.set('fileName', file.name)
              newLayer.set('fileData', file)
              newLayer.set('fileType', 'SHP')
              
              map.addLayer(newLayer)
              kmzLayers.push(newLayer)
              
              kmzLayerVisibility.value[file.name] = true
              
              console.log(`✅ [${i + 1}/${newFiles.length}] SHP加载成功: ${file.name} (${features.length}个要素)`)
              
              // 如果是第一个文件，更新统计信息
              if (kmzLayers.length === 1) {
                currentKmzIndex.value = 0
                currentRecognitionData.value = file
                updateGeoJsonStatistics(file, features)
              }
            } else {
              console.warn(`⚠️ ${file.name} 转换后无要素`)
            }
          } else {
            console.error(`❌ ${file.name} 转换失败或数据为空`)
          }
        } catch (error) {
          console.error(`❌ ${file.name} 加载失败:`, error)
          ElMessage.error(`${file.name} 加载失败`)
        }
      }
      
      loadingMsg.close()
      
      // 缩放到第一个图层
      if (kmzLayers.length > 0) {
        const firstLayer = kmzLayers[0]
        const extent = firstLayer.getSource().getExtent()
        if (extent && extent.every(coord => isFinite(coord))) {
          map.getView().fit(extent, {
            padding: [80, 80, 80, 80],
            duration: 800,
            maxZoom: 15
          })
        }
      }
      
      ElMessage.success(`成功加载 ${newFiles.length} 个SHP文件`)
    } else {
      console.log('✅ 所有SHP文件已加载')
    }
    
  } catch (error) {
    console.error('❌ SHP增量加载失败:', error)
    ElMessage.error(`SHP加载失败: ${error.message}`)
  }
}

// 🆕 加载GeoJSON文件
const loadGeoJsonFilesIncremental = async (selectedFiles) => {
  try {
    console.log(`📥 开始增量加载GeoJSON文件...`)
    
    const loadedFileNames = kmzLayers.map(layer => layer.get('fileName')).filter(Boolean)
    const newFiles = selectedFiles.filter(file => !loadedFileNames.includes(file.name))
    
    if (newFiles.length > 0) {
      console.log(`📦 需要加载 ${newFiles.length} 个新GeoJSON文件:`, newFiles.map(f => f.name))
      
      const loadingMsg = ElMessage.info({
        message: `正在加载 ${newFiles.length} 个GeoJSON文件...`,
        duration: 0
      })
      
      for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i]
        const layerIndex = kmzLayers.length
        
        console.log(`🔄 [${i + 1}/${newFiles.length}] 加载GeoJSON: ${file.name}`)
        
        try {
          // 读取GeoJSON文件
          const response = await axios.get(`/api/analysis/read-geojson/${file.name}`)
          
          if (response.data.code === 200) {
            const geojsonData = response.data.data
            
            // 将GeoJSON转换为OL features
            // 🔧 修复：指定 dataProjection，避免二次投影导致坐标异常
            const features = new GeoJSON().readFeatures(geojsonData, {
              dataProjection: 'EPSG:3857',    // 数据本身就是 Web Mercator
              featureProjection: 'EPSG:3857'  // 目标投影也是 Web Mercator（不转换）
            })
            
            if (features && features.length > 0) {
              const geojsonSource = new VectorSource({
                features: features
              })
              
              // 🎨 使用动态样式函数
              const newLayer = new VectorLayer({
                source: geojsonSource,
                style: (feature) => getFeatureStyle(feature, file.recognitionType),
                zIndex: 100 + layerIndex,
                visible: true
              })
              
              newLayer.set('fileName', file.name)
              newLayer.set('fileData', file)
              newLayer.set('fileType', 'GeoJSON')
              
              map.addLayer(newLayer)
              kmzLayers.push(newLayer)
              
              kmzLayerVisibility.value[file.name] = true
              
              console.log(`✅ [${i + 1}/${newFiles.length}] GeoJSON加载成功: ${file.name} (${features.length}个要素)`)
              
              if (kmzLayers.length === 1) {
                currentKmzIndex.value = 0
                currentRecognitionData.value = file
                updateGeoJsonStatistics(file, features)
              }
            }
          }
        } catch (error) {
          console.error(`❌ ${file.name} 加载失败:`, error)
          ElMessage.error(`${file.name} 加载失败`)
        }
      }
      
      loadingMsg.close()
      
      if (kmzLayers.length > 0) {
        const firstLayer = kmzLayers[0]
        const extent = firstLayer.getSource().getExtent()
        if (extent && extent.every(coord => isFinite(coord))) {
          map.getView().fit(extent, {
            padding: [80, 80, 80, 80],
            duration: 800,
            maxZoom: 15
          })
        }
      }
      
      ElMessage.success(`成功加载 ${newFiles.length} 个GeoJSON文件`)
    } else {
      console.log('✅ 所有GeoJSON文件已加载')
    }
    
  } catch (error) {
    console.error('❌ GeoJSON增量加载失败:', error)
    ElMessage.error(`GeoJSON加载失败: ${error.message}`)
  }
}

// 🆕 从GeoJSON features更新统计信息
const updateGeoJsonStatistics = (fileData, features) => {
  if (!features || features.length === 0) {
    console.warn('⚠️ GeoJSON文件中没有地理要素')
    return
  }
  
  console.log(`📊 开始统计GeoJSON数据，共 ${features.length} 个要素`)
  
  // 打印第一个feature的属性
  if (features.length > 0) {
    const firstFeature = features[0]
    const firstProps = firstFeature.getProperties()
    console.log('📋 第一个要素的所有属性:', firstProps)
  }
  
  // 计算总面积
  const totalArea = calculateKmzArea(features)
  const plotCount = features.length
  
  // 统计作物类型或种植情况分布
  const typeCounts = {}
  const isPlantingSituation = fileData.recognitionType === 'planting_situation'
  const gridcodeStats = {}  // 🐛 用于统计 gridcode 分布
  
  features.forEach((feature, idx) => {
    const props = feature.getProperties()
    
    // 打印前3个要素的属性作为示例
    if (idx < 3) {
      console.log(`要素 ${idx + 1} 属性:`, Object.keys(props).reduce((obj, key) => {
        if (key !== 'geometry') obj[key] = props[key]
        return obj
      }, {}))
    }
    
    let type = '未知'
    
    if (isPlantingSituation) {
      // 🌾 种植情况识别：读取 gridcode 字段，映射到作物类型（1-10）
      let gridcode = null
      if (props.gridcode !== undefined && props.gridcode !== null) {
        gridcode = parseInt(props.gridcode)
      } else if (props.GRIDCODE !== undefined && props.GRIDCODE !== null) {
        gridcode = parseInt(props.GRIDCODE)
      } else if (props.GridCode !== undefined && props.GridCode !== null) {
        gridcode = parseInt(props.GridCode)
      }
      
      // 🐛 统计原始 gridcode 值分布
      if (gridcode !== null) {
        gridcodeStats[gridcode] = (gridcodeStats[gridcode] || 0) + 1
      }
      
      if (gridcode !== null && gridcode >= 1 && gridcode <= 10) {
        const cropInfo = cropLegend.find(c => c.value === gridcode)
        type = cropInfo ? cropInfo.label : `未知类型(${gridcode})`
      } else if (gridcode !== null) {
        // 🐛 gridcode 超出范围的情况
        type = `超出范围(${gridcode})`
      }
    } else {
      // 🌱 作物识别：读取 class 字段，0=未种植，1=已种植
      if (props.class !== undefined && props.class !== null) {
        const classValue = parseInt(props.class)
        type = classValue === 1 ? '已种植' : '未种植'
      } else if (props.CLASS !== undefined && props.CLASS !== null) {
        const classValue = parseInt(props.CLASS)
        type = classValue === 1 ? '已种植' : '未种植'
      } else if (props.Class !== undefined && props.Class !== null) {
        const classValue = parseInt(props.Class)
        type = classValue === 1 ? '已种植' : '未种植'
      }
    }
    
    typeCounts[type] = (typeCounts[type] || 0) + 1
  })
  
  console.log('🐛 原始 gridcode 值统计:', gridcodeStats)
  console.log('📊 分类统计:', typeCounts)
  
  // 更新KPI数据
  kpiData.value = {
    totalArea: totalArea.toFixed(2),
    plotCount: plotCount,
    matchRate: '—',  // SHP/GeoJSON文件没有匹配率
    diffCount: '—'   // SHP/GeoJSON文件没有差异数
  }
  
  // 更新饼图
  // 🎨 根据识别类型设置不同的颜色
  let chartData
  if (isPlantingSituation) {
    // 种植情况识别：使用 cropLegend 颜色
    chartData = Object.entries(typeCounts).map(([name, value]) => {
      const cropInfo = cropLegend.find(c => c.label === name)
      return {
        name: name,
        value: value,
        itemStyle: {
          color: cropInfo ? cropInfo.color : '#999999'
        }
      }
    })
  } else {
    // 作物识别：已种植=绿色，未种植=红色
    chartData = Object.entries(typeCounts).map(([name, value]) => {
      const color = name === '已种植' ? '#67C23A' : '#F56C6C'
      return {
        name: name,
        value: value,
        itemStyle: {
          color: color
        }
      }
    })
  }
  
  console.log('📊 准备更新饼图，数据:', chartData)
  
  const chartTitle = fileData.recognitionType === 'planting_situation' ? '种植情况分布' : '作物类型分布'
  
  // ✅ 使用完整的配置，确保饼图正确显示
  const option = {
    title: {
      text: chartTitle,
      left: 'center',
      top: 10,
      textStyle: {
        fontSize: 16,
        fontWeight: 600
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}个 ({d}%)'
    },
    legend: {
      orient: 'horizontal',  // 🔧 横向排列
      left: 'center',        // 🔧 居中对齐
      bottom: 5,             // 🔧 放在底部
      width: '90%',          // 🔧 限制宽度，自动换行
      textStyle: {
        fontSize: 10
      },
      itemGap: 6,            // 🔧 图例项之间的间距
      itemWidth: 12,         // 🔧 图例标记宽度
      itemHeight: 12         // 🔧 图例标记高度
    },
    series: [{
      name: chartTitle,
      type: 'pie',
      radius: ['35%', '60%'],  // 🔧 稍微缩小以留出底部空间
      center: ['50%', '45%'],  // 🔧 饼图居中，稍微上移
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 8,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: false  // 🔧 隐藏饼图上的标签和指示线
      },
      labelLine: {
        show: false  // 🔧 隐藏指示线
      },
      emphasis: {
        label: {
          show: false  // 🔧 悬停时也不显示
        },
        scale: true,
        scaleSize: 10
      },
      data: chartData
    }]
  }
  
  // 🔧 确保图表已初始化
  if (!cropChart) {
    console.warn('⚠️ cropChart未初始化，尝试初始化...')
    nextTick(() => {
      try {
        initCropChart()
        if (cropChart) {
          cropChart.setOption(option, true)
          console.log('✅ 图表初始化成功并已更新数据')
        }
      } catch (error) {
        console.error('❌ 图表初始化失败:', error)
      }
    })
  } else {
    cropChart.setOption(option, true)  // 完全替换配置
    console.log('✅ 饼图已更新，数据项数:', chartData.length)
  }
}

// 更新KMZ统计信息
const updateKmzStatistics = (fileData, index) => {
  if (!fileData || !kmzLayers[index]) {
    console.log('没有KMZ数据')
    return
  }
  
  const source = kmzLayers[index].getSource()
  const features = source.getFeatures()
  
  if (features.length === 0) {
    console.warn('⚠️ KMZ文件中没有地理要素')
    ElMessage.warning('KMZ文件中没有地理要素')
    return
  }
  
  console.log(`📊 开始统计KMZ数据，共 ${features.length} 个要素`)
  
  // 打印第一个feature的所有属性，帮助调试
  if (features.length > 0) {
    const firstFeature = features[0]
    const firstProps = firstFeature.getProperties()
    console.log('📋 第一个要素的所有属性:', firstProps)
    console.log('📋 属性字段名:', Object.keys(firstProps).filter(k => k !== 'geometry'))
  }
  
  // 计算统计信息
  const totalArea = calculateKmzArea(features)
  const plotCount = features.length
  
  // 统计作物类型或种植情况分布
  const typeCounts = {}
  const isPlantingSituation = fileData.recognitionType === 'planting_situation'
  const gridcodeStats = {}  // 🐛 用于统计 gridcode 分布
  
  features.forEach((feature, idx) => {
    const props = feature.getProperties()
    
    // 打印前3个要素的属性作为示例
    if (idx < 3) {
      console.log(`要素 ${idx + 1} 属性:`, Object.keys(props).reduce((obj, key) => {
        if (key !== 'geometry') obj[key] = props[key]
        return obj
      }, {}))
    }
    
    let type = '未知'
    
    if (isPlantingSituation) {
      // 🌾 种植情况识别：读取 gridcode 字段，映射到作物类型（1-10）
      let gridcode = null
      if (props.gridcode !== undefined && props.gridcode !== null) {
        gridcode = parseInt(props.gridcode)
      } else if (props.GRIDCODE !== undefined && props.GRIDCODE !== null) {
        gridcode = parseInt(props.GRIDCODE)
      } else if (props.GridCode !== undefined && props.GridCode !== null) {
        gridcode = parseInt(props.GridCode)
      }
      
      // 🐛 统计原始 gridcode 值分布
      if (gridcode !== null) {
        gridcodeStats[gridcode] = (gridcodeStats[gridcode] || 0) + 1
      }
      
      if (gridcode !== null && gridcode >= 1 && gridcode <= 10) {
        const cropInfo = cropLegend.find(c => c.value === gridcode)
        type = cropInfo ? cropInfo.label : `未知类型(${gridcode})`
      } else if (gridcode !== null) {
        // 🐛 gridcode 超出范围的情况
        type = `超出范围(${gridcode})`
      }
    } else {
      // 🌱 作物识别：读取 class 字段，0=未种植，1=已种植
      if (props.class !== undefined && props.class !== null) {
        const classValue = parseInt(props.class)
        type = classValue === 1 ? '已种植' : '未种植'
      } else if (props.CLASS !== undefined && props.CLASS !== null) {
        const classValue = parseInt(props.CLASS)
        type = classValue === 1 ? '已种植' : '未种植'
      } else if (props.Class !== undefined && props.Class !== null) {
        const classValue = parseInt(props.Class)
        type = classValue === 1 ? '已种植' : '未种植'
      }
    }
    
    typeCounts[type] = (typeCounts[type] || 0) + 1
  })
  
  console.log('🐛 原始 gridcode 值统计:', gridcodeStats)
  console.log('📊 分类统计:', typeCounts)
  
  // 更新统计数据
  kpiData.value = {
    totalArea: formatNumber(totalArea.toFixed(0)),
    matchRate: '0',
    diffCount: '0',
    plotCount: formatNumber(plotCount)
  }
  
  // 更新饼图
  // 🎨 根据识别类型设置不同的颜色
  let chartData
  if (isPlantingSituation) {
    // 种植情况识别：使用 cropLegend 颜色
    chartData = Object.entries(typeCounts).map(([name, value]) => {
      const cropInfo = cropLegend.find(c => c.label === name)
      return {
        name: name,
        value: value,
        itemStyle: {
          color: cropInfo ? cropInfo.color : '#999999'
        }
      }
    })
  } else {
    // 作物识别：已种植=绿色，未种植=红色
    chartData = Object.entries(typeCounts).map(([name, value]) => {
      const color = name === '已种植' ? '#67C23A' : '#F56C6C'
      return {
        name: name,
        value: value,
        itemStyle: {
          color: color
        }
      }
    })
  }
  
  // 按数量排序
  chartData.sort((a, b) => b.value - a.value)
  
  console.log('📊 饼图数据:', chartData)
  
  const chartTitle = fileData.recognitionType === 'planting_situation' ? '种植情况分布' : '作物类型分布'
  
  const option = {
    title: {
      text: chartTitle,
      left: 'center',
      top: 10,
      textStyle: {
        fontSize: 16,
        fontWeight: 600
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}个 ({d}%)'
    },
    legend: {
      orient: 'horizontal',  // 🔧 横向排列
      left: 'center',        // 🔧 居中对齐
      bottom: 5,             // 🔧 放在底部
      width: '90%',          // 🔧 限制宽度，自动换行
      textStyle: {
        fontSize: 10
      },
      itemGap: 6,            // 🔧 图例项之间的间距
      itemWidth: 12,         // 🔧 图例标记宽度
      itemHeight: 12         // 🔧 图例标记高度
    },
    series: [{
      name: chartTitle,
      type: 'pie',
      radius: ['35%', '60%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 8,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: false  // 🔧 隐藏标签
      },
      labelLine: {
        show: false  // 🔧 隐藏指示线
      },
      emphasis: {
        label: {
          show: false
        },
        scale: true,
        scaleSize: 10
      },
      data: chartData
    }]
  }
  
  // 🔧 确保图表已初始化
  if (!cropChart) {
    console.warn('⚠️ cropChart未初始化，尝试初始化...')
    nextTick(() => {
      try {
        initCropChart()
        if (cropChart) {
          cropChart.setOption(option, true)
          console.log('✅ 图表初始化成功并已更新数据')
        }
      } catch (error) {
        console.error('❌ 图表初始化失败:', error)
      }
    })
  } else {
    cropChart.setOption(option, true)  // 使用notMerge确保完全替换
    console.log('✅ 饼图已更新')
  }
  
  console.log(`✅ 更新KMZ统计完成: 面积=${totalArea.toFixed(0)}亩, 地块=${plotCount}`)
}

// 切换显示不同的影像统计
const switchImage = async (index) => {
  if (index < 0 || index >= loadedImages.value.length) {
    return
  }
  
  currentImageIndex.value = index
  currentImageData.value = loadedImages.value[index]
  
  // 更新统计信息
  await updateStatistics(loadedImages.value[index])
  
  console.log(`✅ 已切换到: ${loadedImages.value[index].name}`)
}

// 检查KMZ图层是否可见（使用响应式状态）
const isKmzLayerVisible = (fileName) => {
  // 🔧 修复：使用响应式状态，而不是直接查询图层
  return kmzLayerVisibility.value[fileName] ?? false
}

// 切换KMZ图层可见性（支持多选）
const toggleKmzLayerVisibility = (fileName, visible) => {
  const layer = kmzLayers.find(layer => layer.get('fileName') === fileName)
  if (layer) {
    layer.setVisible(visible)
    // 🔧 修复：更新响应式状态，确保checkbox同步
    kmzLayerVisibility.value[fileName] = visible
    console.log(`${visible ? '✅ 显示' : '⭕ 隐藏'} KMZ图层: ${fileName}`)
  }
}

// ⚡ 防抖定时器（避免重复点击）
let switchKmzFileTimer = null
let lastSwitchIndex = -1

// 切换显示不同的KMZ文件统计（优化版：快速响应，异步更新，带防抖）
const switchKmzFile = async (index) => {
  if (index < 0 || index >= loadedKmzFiles.value.length) {
    return
  }
  
  // ⚡ 优化1：立即更新UI（视觉响应优先，无延迟）
  currentKmzIndex.value = index
  currentRecognitionData.value = loadedKmzFiles.value[index]
  
  // ⚡ 优化4：防抖优化 - 如果是同一个索引，取消之前的操作
  if (lastSwitchIndex === index && switchKmzFileTimer) {
    console.log('⏭️ 跳过重复点击')
    return
  }
  
  lastSwitchIndex = index
  
  // 取消之前的延迟操作
  if (switchKmzFileTimer) {
    clearTimeout(switchKmzFileTimer)
  }
  
  // 查找对应的图层索引（因为kmzLayers和loadedKmzFiles可能不一一对应）
  const file = loadedKmzFiles.value[index]
  const layerIndex = kmzLayers.findIndex(layer => layer.get('fileName') === file.name)
  
  if (layerIndex === -1) {
    console.warn(`⚠️ 未找到文件 ${file.name} 对应的图层，图层尚未加载`)
    updateRecognitionStatisticsPreview(file)
    ElMessage.info(`${file.name} 图层未加载，请勾选"种植情况"开关以加载图层`)
    return
  }
  
  // ⚡ 优化2：先执行缩放（快速动画）
  const layer = kmzLayers[layerIndex]
  const source = layer.getSource()
  const extent = source.getExtent()
  
  // 立即缩放到该文件的范围（减少动画时间：500ms → 200ms）
  if (extent && extent.every(coord => isFinite(coord))) {
    map.getView().fit(extent, {
      padding: [80, 80, 80, 80],
      duration: 200,  // ⚡ 从500ms减少到200ms，更快响应
      maxZoom: 15
    })
  }
  
  console.log(`✅ 已切换到: ${file.name}`)
  
  // ⚡ 优化3：延迟更新统计信息（避免阻塞UI，使用requestAnimationFrame）
  switchKmzFileTimer = setTimeout(() => {
    requestAnimationFrame(() => {
      const fileType = layer.get('fileType') || file.type
      
      if (fileType === 'SHP' || fileType === 'GeoJSON') {
        const features = source.getFeatures()
        updateGeoJsonStatistics(file, features)
      } else {
        updateKmzStatistics(file, layerIndex)
      }
      
      console.log(`📊 统计信息已更新 (类型: ${fileType})`)
      switchKmzFileTimer = null
    })
  }, 50)  // 延迟50ms更新统计，优先保证视觉响应
}

// 加载单个KMZ图层到地图（保留用于单独加载场景）
const loadKmzLayer = async (filePath) => {
  try {
    const loadingMsg = ElMessage.info({
      message: '正在加载KMZ数据...',
      duration: 0
    })
    
    console.log('开始加载KMZ:', filePath)
    
    // 移除旧的KMZ图层
    if (kmzLayers.length > 0) {
      kmzLayers.forEach(layer => {
        if (layer && map) {
          map.removeLayer(layer)
        }
      })
      kmzLayers = []
    }
    
    // 创建KML数据源（OpenLayers可以直接读取KMZ）
    const kmzSource = new VectorSource({
      url: filePath,
      format: new KML({
        extractStyles: false,  // 改为false，避免复杂样式导致解析失败
        showPointNames: false
      })
    })
    
    // 创建矢量图层
    const newKmzLayer = new VectorLayer({
      source: kmzSource,
      style: new Style({
        fill: new Fill({
          color: 'rgba(67, 160, 71, 0.5)'
        }),
        stroke: new Stroke({
          color: '#2E7D32',
          width: 2
        }),
        image: new Circle({
          radius: 5,
          fill: new Fill({
            color: '#43A047'
          }),
          stroke: new Stroke({
            color: '#FFFFFF',
            width: 1
          })
        })
      }),
      zIndex: 100,
      visible: false  // 默认不可见，等待用户勾选
    })
    
    // 添加到地图
    map.addLayer(newKmzLayer)
    kmzLayers.push(newKmzLayer)
    
    // 监听数据加载
    let isLoaded = false
    
    kmzSource.on('change', function() {
      const state = kmzSource.getState()
      console.log('KMZ数据源状态:', state)
      
      if (state === 'ready' && !isLoaded) {
        isLoaded = true
        loadingMsg.close()
        
        const features = kmzSource.getFeatures()
        console.log('KMZ features数量:', features.length)
        
        if (features.length > 0) {
          // 使用统一的统计函数
          updateKmzStatistics(currentRecognitionData.value, 0)
          
          // 缩放到范围
          const extent = kmzSource.getExtent()
          if (extent && extent.every(coord => isFinite(coord))) {
            map.getView().fit(extent, {
              padding: [80, 80, 80, 80],
              duration: 800,
              maxZoom: 15
            })
          }
          
          ElMessage.success(`KMZ加载成功！共${features.length}个地块，请勾选图层开关查看`)
        } else {
          ElMessage.warning('KMZ文件中没有地理要素')
        }
      } else if (state === 'error') {
        isLoaded = true
        loadingMsg.close()
        ElMessage.error('KMZ数据加载失败，请检查文件格式')
      }
    })
    
    // 设置超时
    setTimeout(() => {
      if (!isLoaded) {
        loadingMsg.close()
        console.warn('KMZ加载超时，可能文件较大或路径不正确')
        ElMessage.warning('KMZ加载超时，请检查文件路径')
      }
    }, 10000)
    
    console.log('KMZ图层已添加到地图')
  } catch (error) {
    console.error('KMZ图层加载失败:', error)
    ElMessage.error('KMZ加载失败：' + error.message)
  }
}

// 计算KMZ面积（粗略估算）
const calculateKmzArea = (features) => {
  let totalAreaMu = 0
  let precalculatedCount = 0
  let turfCalculatedCount = 0
  
  console.log(`📐 开始计算面积，共 ${features.length} 个地块`)
  
  features.forEach((feature, idx) => {
    const props = feature.getProperties()
    
    // 🆕 优先读取预计算的面积（从 GeoJSON properties 中）
    if (props.area_mu && !isNaN(props.area_mu)) {
      const areaMu = parseFloat(props.area_mu)
      totalAreaMu += areaMu
      precalculatedCount++
      
      if (idx < 3) {
        console.log(`   地块${idx + 1}: ${areaMu.toFixed(2)} 亩 [预计算]`)
      }
    } 
    // 如果没有预计算面积，使用 Turf.js 计算（回退方案）
    else {
      const geom = feature.getGeometry()
      if (geom && (geom.getType() === 'Polygon' || geom.getType() === 'MultiPolygon')) {
        try {
          // 克隆几何体并转换到 WGS84 (EPSG:4326)
          const geomClone = geom.clone()
          geomClone.transform('EPSG:3857', 'EPSG:4326')
          
          // 转换为 GeoJSON 格式
          const geojsonWriter = new GeoJSON()
          const geojsonGeometry = geojsonWriter.writeGeometryObject(geomClone)
          
          // 使用 Turf.js 计算测地线面积
          const areaM2 = area(geojsonGeometry)
          const areaMu = areaM2 * 0.0015  // 精确转换（1 m² = 0.0015 亩）
          
          totalAreaMu += areaMu
          turfCalculatedCount++
          
          if (idx < 3) {
            console.log(`   地块${idx + 1}: ${areaMu.toFixed(2)} 亩 [Turf.js实时计算]`)
          }
        } catch (error) {
          console.error(`❌ 地块${idx + 1}面积计算失败:`, error)
        }
      }
    }
  })
  
  console.log(`✅ 面积统计完成:`)
  console.log(`   ✅ 预计算: ${precalculatedCount} 个地块`)
  console.log(`   🔄 实时计算: ${turfCalculatedCount} 个地块`)
  console.log(`   📊 总面积: ${totalAreaMu.toFixed(2)} 亩`)
  
  return totalAreaMu
}

// 🆕 预览识别结果统计信息（在图层加载前显示基本信息）
const updateRecognitionStatisticsPreview = (fileData) => {
  if (!fileData) {
    console.log('没有识别结果数据')
    return
  }
  
  console.log('📊 更新识别结果预览信息:', fileData.name)
  
  // 先显示"加载中"状态
  kpiData.value = {
    totalArea: '—',
    matchRate: '—',
    diffCount: '—',
    plotCount: '—'
  }
  
  // 确保cropChart已初始化
  if (!cropChart) {
    console.warn('⚠️ cropChart未初始化，尝试初始化...')
    initCropChart()
  }
  
  // 更新饼图为"暂无数据"状态，提示用户勾选图层
  if (cropChart) {
    const chartTitle = fileData.recognitionType === 'planting_situation' ? '种植情况' : '作物类型'
    
    cropChart.setOption({
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c}个'
      },
      legend: {
        bottom: '0%',
        left: 'center',
        type: 'plain',  // 🔧 修复：使用plain类型，避免截断显示
        orient: 'horizontal'
      },
      series: [{
        name: chartTitle,
        type: 'pie',
        radius: ['35%', '60%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: false,
        // 不设置minAngle，让所有数据都能显示
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: [
          { value: 1, name: '请勾选图层开关加载数据' }
        ]
      }]
    }, true)
  }
  
  console.log('✅ 识别结果预览信息已更新')
}

// 更新识别结果统计数据（已废弃，使用updateKmzStatistics替代）
const updateRecognitionStatistics = (fileData) => {
  if (!fileData) {
    console.log('没有识别结果数据')
    return
  }
  
  // 更新 KPI 卡片数据（暂时使用默认值）
  kpiData.value = {
    totalArea: '0',
    matchRate: '0',
    diffCount: '0',
    plotCount: '0'
  }
  
  // 更新饼图 - 暂时显示示例数据
  if (cropChart) {
    // TODO: 从KMZ文件中解析实际的种植情况数据
    // 目前先显示示例数据
    const sampleData = [
      { value: 60, name: '已种植' },
      { value: 40, name: '未种植' }
    ]
    
    cropChart.setOption({
      series: [{
        name: fileData.recognitionType === 'planting_situation' ? '种植情况' : '作物类型',
        data: sampleData
        // 不设置minAngle，让所有数据都能显示
      }]
    }, true)  // 使用notMerge确保完全替换
  }
  
  console.log('识别结果统计数据已更新（示例）')
}

// 生成动态颜色样式（根据选中的作物类型）
const generateColorStyle = () => {
  const colorArray = ['case']
  
  // NoData (0) 始终透明（像素值已+1，0表示NoData）
  colorArray.push(['==', ['band', 1], 0], [0, 0, 0, 0])
  
  // 遍历所有作物类型
  cropLegend.forEach(crop => {
    // 检查是否选中该作物类型
    const isSelected = selectedCropTypes.value.length === 0 || selectedCropTypes.value.includes(crop.value)
    
    if (isSelected) {
      // 选中的作物显示对应颜色
      const color = hexToRgb(crop.color)
      colorArray.push(['==', ['band', 1], crop.value], [...color, 1])
    } else {
      // 未选中的作物显示为透明
      colorArray.push(['==', ['band', 1], crop.value], [0, 0, 0, 0])
    }
  })
  
  // 默认值：其他所有值都透明
  colorArray.push([0, 0, 0, 0])
  
  return colorArray
}

// 将十六进制颜色转换为 RGB 数组
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0]
}

// 重新加载多个 TIF 图层
const reloadMultipleTiffLayers = async (images) => {
  try {
    ElMessage.info(`正在加载 ${images.length} 个影像...`)
    
    // 移除所有旧图层
    tiffLayers.forEach(layer => {
      if (layer && map) {
        map.removeLayer(layer)
      }
    })
    tiffLayers = []
    
    // 为每个影像创建图层
    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      const pathToLoad = image.optimizedPath || image.filePath || image.originalPath
      
      console.log(`加载第 ${i + 1}/${images.length} 个影像:`, image.name)
      
      // 创建 GeoTIFF 数据源
      const source = new GeoTIFF({
        sources: [{
          url: pathToLoad
        }],
        normalize: false,
        interpolate: false,
        transition: 0,
        wrapX: false
      })
      
      // 创建 WebGL Tile 图层
      const layer = new WebGLTile({
        source: source,
        visible: true,
        style: {
          color: generateColorStyle()
        },
        opacity: 0.85 / (i + 1), // 多图层时降低透明度避免重叠
        zIndex: 10 + i
      })
      
      // 添加到地图
      map.addLayer(layer)
      tiffLayers.push(layer)
    }
    
    console.log(`${images.length} 个TIF图层加载成功`)
    ElMessage.success(`${images.length} 个影像加载成功`)
  } catch (error) {
    console.error('TIF 图层加载失败:', error)
    ElMessage.error('影像加载失败：' + error.message)
  }
}

// 重新加载单个 TIF 图层（保留用于兼容性）
const reloadTiffLayer = async (filePath) => {
  try {
    ElMessage.info('正在加载影像数据...')
    
    // 移除所有旧图层
    tiffLayers.forEach(layer => {
      if (layer && map) {
        map.removeLayer(layer)
      }
    })
    tiffLayers = []
    
    // 创建新的 GeoTIFF 数据源
    const tiffSource = new GeoTIFF({
      sources: [{
        url: filePath
      }],
      normalize: false,
      interpolate: false,
      transition: 0,
      wrapX: false
    })
    
    // 创建新的 WebGL Tile 图层，使用动态颜色样式
    const tiffLayer = new WebGLTile({
      source: tiffSource,
      visible: true,
      style: {
        color: generateColorStyle()
      },
      opacity: 0.85
    })
    
    // 添加到地图
    map.addLayer(tiffLayer)
    tiffLayers.push(tiffLayer)
    
    console.log('TIF 图层重新加载成功')
    ElMessage.success('影像加载成功')
  } catch (error) {
    console.error('TIF 图层加载失败:', error)
    ElMessage.error('影像加载失败：' + error.message)
  }
}

// 作物类型映射（与前端cropLegend保持一致）
const CROP_TYPE_MAP = {
  1: '裸地',
  2: '棉花',
  3: '小麦',
  4: '玉米',
  5: '番茄',
  6: '甜菜',
  7: '打瓜',
  8: '辣椒',
  9: '籽用葫芦',
  10: '其它耕地'
}

// 使用geotiff.js分析TIF文件（纯前端方案）
const analyzeTifFile = async (tifUrl) => {
  try {
    console.log('📊 开始分析TIF文件:', tifUrl)
    
    // 🔍 第1步：测试文件URL是否可访问
    console.log('   🔍 步骤1：测试文件URL可访问性...')
    try {
      const testResponse = await fetch(tifUrl, { method: 'HEAD' })
      console.log(`   ✅ HEAD响应状态: ${testResponse.status} ${testResponse.statusText}`)
      console.log(`   📋 响应头:`)
      console.log(`      - Content-Length: ${testResponse.headers.get('Content-Length')}`)
      console.log(`      - Content-Type: ${testResponse.headers.get('Content-Type')}`)
      console.log(`      - Accept-Ranges: ${testResponse.headers.get('Accept-Ranges')}`)
      
      if (!testResponse.ok) {
        throw new Error(`文件不可访问 (HTTP ${testResponse.status})`)
      }
      
      if (testResponse.headers.get('Accept-Ranges') !== 'bytes') {
        console.warn('⚠️ 警告：服务器不支持 Range 请求，geotiff.js 可能无法正常工作')
      }
    } catch (fetchError) {
      console.error('❌ HEAD请求失败:', fetchError)
      throw new Error(`无法访问文件: ${fetchError.message}`)
    }
    
    // 🔍 第2步：使用 geotiff.js 读取TIF文件
    console.log('   🔍 步骤2：使用 geotiff.js 读取TIF数据...')
    const tiff = await fromUrl(tifUrl)
    console.log('   ✅ GeoTIFF 对象创建成功')
    
    const image = await tiff.getImage()
    console.log('   ✅ 获取图像对象成功')
    
    // 获取像元数据
    const data = await image.readRasters()
    const values = data[0] // 第一个波段
    
    console.log(`   读取了 ${values.length} 个像元`)
    
    // 获取地理变换参数（用于计算面积）
    const geoTransform = image.getGeoKeys()
    const pixelSize = image.getResolution() // [宽度, 高度]
    const pixelAreaM2 = Math.abs(pixelSize[0] * pixelSize[1]) // 平方米
    const pixelAreaMu = pixelAreaM2 / 666.67 // 转换为亩
    
    console.log(`   像元大小: ${pixelSize[0]}m × ${pixelSize[1]}m = ${pixelAreaM2.toFixed(2)}平方米 = ${pixelAreaMu.toFixed(4)}亩`)
    
    // 统计每个像元值的数量（参考temporalAnalysis的方法）
    const counts = {}
    let totalPixels = 0
    
    for (let i = 0; i < values.length; i++) {
      const val = values[i]
      
      // 跳过NoData值（通常是0或负数）
      if (val > 0 && val <= 10) {
        counts[val] = (counts[val] || 0) + 1
        totalPixels++
      }
    }
    
    console.log('   像元值分布:', counts)
    
    // 映射到作物类型并计算百分比
    const cropDistribution = {}
    let totalArea = 0
    
    Object.entries(counts).forEach(([value, count]) => {
      const valueInt = parseInt(value)
      const cropName = CROP_TYPE_MAP[valueInt] || `未知类型(${valueInt})`
      const percentage = (count / totalPixels) * 100
      const area = count * pixelAreaMu
      
      cropDistribution[cropName] = percentage.toFixed(2)
      totalArea += area
    })
    
    console.log('✅ 作物分布统计:', cropDistribution)
    console.log(`   总面积: ${totalArea.toFixed(0)} 亩, 有效像元: ${totalPixels}`)
    
    // 🔧 修复：显示像元总数而不是估算的地块数
    // TIF栅格数据本身不包含地块边界信息，无法准确计算地块数
    
    return {
      totalArea: totalArea.toFixed(0),
      plotCount: totalPixels.toString(),  // 显示有效像元总数
      pixelCount: totalPixels,  // 保存像元数用于调试
      matchRate: '0',
      diffCount: '0',
      cropDistribution: cropDistribution,
      // 添加详细信息供调试
      pixelAreaMu: pixelAreaMu,
      counts: counts
    }
  } catch (error) {
    console.error('❌ TIF分析失败:', error)
    throw error
  }
}

// 更新统计数据
const updateStatistics = async (imageData) => {
  if (!imageData) {
    console.log('没有影像数据')
    return
  }
  
  console.log('影像数据:', imageData)
  
  let stats = null
  
  // 优先使用元数据中的统计数据（后端已预分析）
  if (imageData.statistics) {
    stats = imageData.statistics
    console.log('✅ 使用元数据中的统计数据（后端已预分析）')
    console.log('   分析时间:', stats.analyzedAt || '未知')
    // 显示快速加载提示
    ElMessage.success({
      message: '✅ 已加载预分析数据（快速模式）',
      duration: 2000
    })
  } else {
    // 元数据中没有统计数据，使用前端实时分析（较慢）
    console.log('⚠️ 元数据中无统计数据，开始实时分析（较慢）')
    
    // 🔍 输出详细的影像信息
    console.log('📂 影像详细信息:')
    console.log('   - ID:', imageData.id)
    console.log('   - 文件名:', imageData.name)
    console.log('   - 年份:', imageData.year)
    console.log('   - 期次:', imageData.period)
    console.log('   - filePath:', imageData.filePath)
    console.log('   - originalPath:', imageData.originalPath)
    console.log('   - optimizedPath:', imageData.optimizedPath)
    console.log('   - isOptimized:', imageData.isOptimized)
    
    const loadingMsg = ElMessage.info({
      message: '正在分析影像数据，请稍候...',
      duration: 0
    })
    
    // 在 try 外部定义 tifUrl，方便 catch 块使用
    // 🔧 修复：对文件名进行URL编码，处理括号等特殊字符
    const encodedFileName = encodeURIComponent(imageData.name)
    const tifUrl = `/api/image/file/${encodedFileName}`
    
    try {
      // 🔧 修复：构建TIF文件URL，使用后端 API 路径
      console.log('🔗 原始文件名:', imageData.name)
      console.log('🔗 编码后文件名:', encodedFileName)
      console.log('🔗 构建的TIF文件URL:', tifUrl)
      console.log('🌐 当前页面URL:', window.location.href)
      console.log('🌐 完整请求URL:', new URL(tifUrl, window.location.href).href)
      
      // 使用geotiff.js分析
      stats = await analyzeTifFile(tifUrl)
      
      loadingMsg.close()
      
      // 缓存statistics到imageData（下次不用重新分析）
      imageData.statistics = stats
      
      ElMessage.success({
        message: '✅ 影像分析完成',
        duration: 2000
      })
      
    } catch (error) {
      loadingMsg.close()
      console.error('❌ 前端TIF分析失败:', error)
      console.error('   错误类型:', error.constructor.name)
      console.error('   错误消息:', error.message)
      console.error('   错误堆栈:', error.stack)
      
      // 根据错误类型提供具体的解决方案
      let errorMessage = '影像分析失败'
      let solution = ''
      
      if (error.message.includes('404') || error.message.includes('不可访问')) {
        errorMessage = `文件不存在: ${imageData.name}`
        solution = `
        
请检查：
1️⃣ 后端服务是否正在运行（npm run server）
2️⃣ 文件是否存在于 public/data/ 目录
3️⃣ 文件名是否正确: ${imageData.name}

完整URL: ${tifUrl}`
      } else if (error.message.includes('Range') || error.message.includes('不支持')) {
        errorMessage = '服务器不支持 Range 请求'
        solution = `

解决方法：
1️⃣ 停止后端服务（Ctrl+C）
2️⃣ 确保 server/routes/image.js 已保存最新代码
3️⃣ 重新启动后端: npm run server`
      } else if (error.name === 'AggregateError' || error.message.includes('Request failed')) {
        errorMessage = '网络请求失败'
        solution = `

可能的原因：
1️⃣ 后端服务未运行或端口不对
2️⃣ 文件不存在或路径错误
3️⃣ 服务器不支持 Range 请求（需要更新后端代码并重启）

已尝试的URL: ${tifUrl}
后端地址: http://localhost:8080`
      } else {
        errorMessage = `分析失败: ${error.message}`
        solution = '\n\n请查看控制台了解详细错误信息'
      }
      
      ElMessage.error({
        message: errorMessage + solution,
        duration: 10000
      })
      
      // 重置为空状态
      kpiData.value = {
        totalArea: '0',
        matchRate: '0',
        diffCount: '0',
        plotCount: '0'
      }
      
      if (cropChart) {
        cropChart.setOption({
          series: [{
            name: '作物类型',
            data: [{ value: 1, name: '暂无统计数据' }]
          }]
        }, true)  // 使用notMerge确保完全替换
      }
      return
    }
  }
  
  // 更新 KPI 卡片数据
  kpiData.value = {
    totalArea: formatNumber(stats.totalArea || '0'),
    matchRate: stats.matchRate || '0',
    diffCount: stats.diffCount || '0',
    plotCount: formatNumber(stats.plotCount || '0')
  }
  
  // 更新作物分布饼图（根据选中的作物类型过滤）
  // 确保cropChart已初始化
  if (!cropChart) {
    console.warn('⚠️ cropChart未初始化，尝试初始化...')
    initCropChart()
  }
  
  if (cropChart) {
    let cropData = []
    
    console.log('📊 统计数据 cropDistribution:', stats.cropDistribution)
    console.log('📊 原始像元统计 counts:', stats.counts)
    
    if (stats.cropDistribution && Object.keys(stats.cropDistribution).length > 0) {
      // 提取作物类型到availableCropTypes（用于图例显示）
      const actualCropTypes = []
      Object.keys(stats.cropDistribution).forEach(cropName => {
        const cropInfo = cropLegend.find(c => c.label === cropName)
        if (cropInfo) {
          actualCropTypes.push(cropInfo)
        }
      })
      availableCropTypes.value = actualCropTypes
      
      // 🔧 修复：确保所有有数据的作物类型都显示，即使占比很小
      // 并且为每个作物类型指定颜色
      cropData = Object.entries(stats.cropDistribution).map(([name, value]) => {
        // 从cropLegend中找到对应的颜色
        const cropInfo = cropLegend.find(c => c.label === name)
        const dataItem = {
          value: Number(value),
          name: name,
          itemStyle: {
            color: cropInfo ? cropInfo.color : '#999999'  // 🔧 关键：设置每个扇区的颜色
          }
        }
        console.log(`🎨 作物[${name}]: 颜色=${cropInfo ? cropInfo.color : '#999999'}, 值=${value}%`)
        return dataItem
      })
      
      // 按百分比排序，方便查看
      cropData.sort((a, b) => b.value - a.value)
      
      // 🔧 修复：饼图始终显示所有有数据的作物类型，不受筛选影响
      // 筛选条件只影响地图显示，不影响饼图统计
      // 如果需要筛选，建议单独在饼图上添加筛选功能
      
      console.log('📊 最终饼图数据（按百分比排序）:', JSON.stringify(cropData, null, 2))
      console.log(`   共 ${cropData.length} 个作物类型`)
    }
    
    // 如果没有数据，显示提示
    if (cropData.length === 0) {
      cropData = [{ value: 1, name: '暂无数据' }]
    }
    
    // 完整重新设置饼图
    const option = {
      // 🔧 关键修复：显式设置足够多的颜色，确保每个作物类型都有独立的颜色
      color: cropLegend.map(item => item.color),  // 使用cropLegend中定义的所有颜色
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c}%'
      },
      legend: {
        bottom: '0%',
        left: 'center',
        type: 'plain',  // 🔧 修复：使用普通模式，显示所有图例项
        orient: 'horizontal',
        show: true,
        // 超出时自动换行
        textStyle: {
          fontSize: 11
        },
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 8
      },
      series: [{
        name: dataSource.value === 'image' ? '作物类型' : '种植情况',
        type: 'pie',
        radius: ['35%', '60%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: false,
        // 🔧 修复：不设置最小角度限制，确保所有数据都能显示（即使很小）
        // minAngle: 0 也可以，但不设置更好
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold',
            formatter: '{b}\n{c}%'
          }
        },
        labelLine: {
          show: false
        },
        data: cropData
      }]
    }
    
    cropChart.setOption(option, true)  // true表示不合并，完全替换
    console.log('✅ 饼图已完全重新设置，数据项数:', cropData.length)
    console.log('🎨 使用的颜色数组:', cropLegend.map(item => item.color))
  }
  
  console.log('统计数据已更新')
}

// 格式化数字（添加千位分隔符）
const formatNumber = (num) => {
  if (!num) return '0'
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// 格式化上传时间
const formatUploadTime = (uploadTime) => {
  if (!uploadTime) return '未知'
  try {
    const date = new Date(uploadTime)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
  } catch (error) {
    return '未知'
  }
}

// 获取图例标题
const getLegendTitle = () => {
  if (dataSource.value === 'image') {
    return '作物分类图例'
  } else {
    // 识别结果
    if (currentRecognitionData.value && currentRecognitionData.value.recognitionType === 'planting_situation') {
      return '种植情况图例'
    } else {
      return '作物识别图例'
    }
  }
}

// 获取图层标签
const getLayerLabel = () => {
  if (dataSource.value === 'image') {
    return `作物分类 (${filterForm.value.year || '2024'})`
  } else {
    // 识别结果
    if (currentRecognitionData.value) {
      const year = currentRecognitionData.value.year || '未知'
      const type = currentRecognitionData.value.recognitionType === 'planting_situation' ? '种植情况' : '作物识别'
      return `${type} (${year}年)`
    }
    return '识别结果'
  }
}

// 获取饼图标题
const getChartTitle = () => {
  if (dataSource.value === 'image') {
    return '作物类型分布'
  } else {
    // 识别结果
    if (currentRecognitionData.value && currentRecognitionData.value.recognitionType === 'planting_situation') {
      return '种植情况分布'
    } else {
      return '作物类型分布'
    }
  }
}

const handleSearch = () => {
  if (dataSource.value === 'image') {
  loadTiffData()
  } else {
    loadRecognitionData()
  }
}

// 刷新选项（重置筛选条件并重新加载数据）
const handleRefreshOptions = async () => {
  try {
    // 🔧 修复：刷新前先清空所有地图图层
    clearMapLayers()
    
    // 重新加载数据
    if (dataSource.value === 'image') {
      await fetchImageData()
      // 重置影像筛选条件（不设置默认值，显示占位符）
      filterForm.value = {
        year: '',  // 不设置默认值，显示占位符
        period: '',
        imageNames: [],
        region: [],
        keyword: ''
      }
      selectedCropTypes.value = []
      availablePeriods.value = []  // 清空期次选项
      
      // 🔧 重新初始化图表
      nextTick(() => {
        if (cropChart) {
          try {
            cropChart.dispose()
          } catch (e) {
            console.warn('销毁旧图表实例时出错:', e)
          }
          cropChart = null
        }
        setTimeout(() => {
          initCropChart()
          console.log('✅ 影像数据图表已重新初始化')
        }, 100)
      })
    } else {
      // 🔧 清空之前的查询结果
      loadedKmzFiles.value = []
      currentRecognitionData.value = null
      currentKmzIndex.value = 0
      
      await loadRecognitionResults()
      
      // 🔧 重置识别结果筛选条件（使用新对象确保响应式更新）
      // 🔧 不设置默认值，让用户手动选择
      recognitionFilter.value = {
        year: '',  // 不设置默认值，显示占位符
        period: '',
        region: '',
        recognitionType: '',
        fileFormat: '',
        fileNames: []
      }
      
      // 🔧 清空期次选项
      recognitionPeriods.value = []
      
      // 🔧 重新初始化图表为空白状态
      nextTick(() => {
        if (cropChart) {
          try {
            cropChart.dispose()
          } catch (e) {
            console.warn('销毁旧图表实例时出错:', e)
          }
          cropChart = null
        }
        setTimeout(() => {
          initCropChart()
          // 设置为空白状态
          if (cropChart) {
            cropChart.setOption({
              title: {
                text: '种植情况分布',
                left: 'center',
                top: 10,
                textStyle: {
                  fontSize: 16,
                  fontWeight: 600
                }
              },
              series: [{
                type: 'pie',
                radius: ['35%', '60%'],
                center: ['50%', '45%'],
                data: [],
                label: { show: false },
                labelLine: { show: false }
              }]
            })
          }
          console.log('✅ 识别结果图表已重新初始化为空白状态')
        }, 100)
      })
    }
    
    // 重置统计信息
    resetStatistics()
    
    ElMessage.success('已刷新并重置筛选条件')
  } catch (error) {
    console.error('刷新失败:', error)
    ElMessage.error('刷新失败')
  }
}

// 数据源切换处理
const handleDataSourceChange = async () => {
  console.log('数据源切换:', dataSource.value)
  
  // 🔧 直接调用刷新逻辑，确保完全重置
  await handleRefreshOptions()
}

// 重置统计信息为初始状态
const resetStatistics = () => {
  currentImageData.value = null
  currentRecognitionData.value = null
  currentImageIndex.value = 0
  currentKmzIndex.value = 0
  
  // 重置KPI数据为"暂无数据"
  kpiData.value = {
    totalArea: '—',
    matchRate: '—',
    diffCount: '—',
    plotCount: '—'
  }
  
  // 🔧 不在这里重置饼图，让数据源切换时统一处理
  // 避免在图表初始化前操作导致问题
}

// 加载识别结果数据
const loadRecognitionResults = async () => {
  try {
    console.log('🔄 开始加载识别结果数据...')
    const response = await axios.get('/api/analysis/results')
    
    console.log('📡 API响应:', response.data)
    
    if (response.data.code === 200) {
      // 🔧 修复：加载所有格式的识别结果（KMZ、SHP、GeoJSON）
      recognitionResults.value = response.data.data.filter(item => 
        item.type === 'KMZ' || item.type === 'SHP' || item.type === 'GeoJSON'
      )
      
      console.log('✅ 加载识别结果:', recognitionResults.value.length, '个')
      console.log('📋 原始数据条数:', response.data.data.length)
      console.log('   格式分布:', {
        KMZ: recognitionResults.value.filter(i => i.type === 'KMZ').length,
        SHP: recognitionResults.value.filter(i => i.type === 'SHP').length,
        GeoJSON: recognitionResults.value.filter(i => i.type === 'GeoJSON').length
      })
      
      // 🔍 调试：输出前3个文件的完整信息
      if (recognitionResults.value.length > 0) {
        console.log('📦 前3个文件详情:')
        recognitionResults.value.slice(0, 3).forEach((file, idx) => {
          console.log(`   ${idx + 1}. ${file.name}:`, file)
        })
      }
      
      // 提取可用的年份
      const years = new Set()
      recognitionResults.value.forEach(item => {
        console.log(`   检查文件 ${item.name} 的年份: ${item.year}`)
        if (item.year) {
          years.add(item.year)
        }
      })
      recognitionYears.value = Array.from(years).sort((a, b) => b - a)
      
      console.log('📅 提取到的年份列表:', recognitionYears.value)
      console.log('📊 recognitionYears.value:', recognitionYears.value)
      
      // 🔧 修复：不自动选择年份，默认显示全部
      // 用户可以通过下拉框手动选择年份进行筛选
    } else {
      console.error('❌ API返回错误:', response.data)
      ElMessage.error('加载识别结果失败: ' + (response.data.message || '未知错误'))
    }
  } catch (error) {
    console.error('❌ 加载识别结果失败:', error)
    ElMessage.error('加载识别结果失败: ' + error.message)
  }
}

// 更新识别结果的期次选项
const updateRecognitionPeriods = () => {
  const periods = new Set()
  
  recognitionResults.value.forEach(item => {
    if (item.year === recognitionFilter.value.year && item.period) {
      periods.add(item.period)
    }
  })
  
  recognitionPeriods.value = Array.from(periods).sort((a, b) => a - b)
  
  // 设置默认期次
  if (recognitionPeriods.value.length > 0 && !recognitionFilter.value.period) {
    recognitionFilter.value.period = recognitionPeriods.value[0]
  }
}

// 识别结果年份变化
const handleRecognitionYearChange = () => {
  recognitionFilter.value.period = ''
  recognitionFilter.value.fileNames = []
  updateRecognitionPeriods()
}

// 识别结果期次变化
const handleRecognitionPeriodChange = () => {
  // 清空文件名选择
  recognitionFilter.value.fileNames = []
  console.log('选择了识别结果:', recognitionFilter.value)
}

// 识别结果区域变化
const handleRecognitionRegionChange = () => {
  console.log('区域筛选:', recognitionFilter.value.region)
  // 清空文件名选择
  recognitionFilter.value.fileNames = []
}

// 识别任务变化处理
const handleRecognitionTypeChange = () => {
  console.log('识别任务筛选:', recognitionFilter.value.recognitionType)
  // 清空文件名选择
  recognitionFilter.value.fileNames = []
}

// 🆕 文件格式筛选变化处理
const handleFileFormatChange = () => {
  console.log('文件格式筛选:', recognitionFilter.value.fileFormat)
  // 清空文件名选择
  recognitionFilter.value.fileNames = []
}

// 清空地图图层
const clearMapLayers = () => {
  // 清除所有TIF图层
  if (map && tiffLayers.length > 0) {
    tiffLayers.forEach(layer => {
      if (layer) {
        map.removeLayer(layer)
      }
    })
    tiffLayers = []
  }
  
  // 清除KMZ图层
  if (map && kmzLayers.length > 0) {
    kmzLayers.forEach(layer => {
      if (layer) {
        map.removeLayer(layer)
      }
    })
    kmzLayers = []
  }
  
  // 🔧 修复：清空响应式可见性状态
  kmzLayerVisibility.value = {}
  
  // 关闭图层显示
  tiffLayerVisible.value = false
  
  // 清空当前数据
  if (dataSource.value === 'image') {
    currentImageData.value = null
    loadedImages.value = []
  } else {
    currentRecognitionData.value = null
    loadedKmzFiles.value = []
  }
}

// 地图控制函数
const handleZoomIn = () => {
  if (map) {
    const view = map.getView()
    const zoom = view.getZoom()
    view.setZoom(zoom + 1)
  }
}

const handleZoomOut = () => {
  if (map) {
    const view = map.getView()
    const zoom = view.getZoom()
    view.setZoom(zoom - 1)
  }
}

const handleZoomToExtent = async () => {
  if (map) {
    const view = map.getView()
    
    // 🆕 影像数据模式：自动加载图层并缩放
    if (dataSource.value === 'image' && loadedImages.value.length > 0) {
      // 如果图层未加载，先加载
      if (tiffLayers.length === 0) {
        tiffLayerVisible.value = true
        await reloadMultipleTiffLayers(loadedImages.value)
      }
      
      // 缩放到图层范围
      if (tiffLayers.length > 0) {
        const firstLayer = tiffLayers[0]
        const source = firstLayer.getSource()
        
        if (source) {
          source.getView().then((viewConfig) => {
            if (viewConfig && viewConfig.extent) {
              view.fit(viewConfig.extent, {
                padding: [50, 50, 50, 50],
                duration: 500
              })
              ElMessage.success('已缩放至影像范围')
            }
          }).catch(() => {
            view.animate({
              center: fromLonLat([87.6, 43.8]),
              zoom: 6,
              duration: 500
            })
            ElMessage.info('已缩放至默认视图')
          })
        }
      }
    }
    // 识别结果模式：原有逻辑
    else if (tiffLayerVisible.value && tiffLayers.length > 0) {
      const firstLayer = tiffLayers[0]
      const source = firstLayer.getSource()
      
      if (source) {
        source.getView().then((viewConfig) => {
        if (viewConfig && viewConfig.extent) {
          view.fit(viewConfig.extent, {
            padding: [50, 50, 50, 50],
            duration: 500
          })
          ElMessage.success('已缩放至图层范围')
        }
      }).catch(() => {
        view.animate({
          center: fromLonLat([87.6, 43.8]),
          zoom: 6,
          duration: 500
        })
        ElMessage.info('已缩放至默认视图')
      })
      }
    } else {
      // 重置到新疆中心区域
      view.animate({
        center: fromLonLat([87.6, 43.8]),
        zoom: 6,
        duration: 500
      })
      ElMessage.success('已重置到默认视图')
    }
  }
}

// 切换 TIF 图层显示/隐藏
const toggleTiffLayer = async () => {
  if (tiffLayerVisible.value) {
    // 用户打开 TIF 图层
    if (dataSource.value === 'image') {
      // 影像数据
      if (loadedImages.value.length === 0) {
        ElMessage.warning('请先查询影像数据')
      tiffLayerVisible.value = false
      return
    }
    
      if (tiffLayers.length === 0) {
      // 第一次打开，需要加载 TIF 数据
        await reloadMultipleTiffLayers(loadedImages.value)
    } else {
        // 显示已有图层
        tiffLayers.forEach(layer => layer.setVisible(true))
      ElMessage.success('已显示作物分类图层')
    }
    } else {
      // 识别结果（KMZ、SHP、GeoJSON）
      if (loadedKmzFiles.value.length === 0) {
        ElMessage.warning('请先选择识别结果文件')
        tiffLayerVisible.value = false
        return
      }
      
      // 🔧 修复：使用通用加载函数，支持多种文件格式
      await loadRecognitionFilesIncremental(loadedKmzFiles.value)
    }
  } else {
    // 用户关闭图层
    if (dataSource.value === 'image' && tiffLayers.length > 0) {
      tiffLayers.forEach(layer => layer && layer.setVisible(false))
      ElMessage.success('已隐藏图层')
    } else if (dataSource.value === 'recognition' && kmzLayers.length > 0) {
      // 只隐藏，不删除图层
      kmzLayers.forEach(layer => {
        if (layer) {
          layer.setVisible(false)
          // 🔧 修复：更新响应式状态
          const fileName = layer.get('fileName')
          if (fileName) {
            kmzLayerVisibility.value[fileName] = false
          }
        }
      })
      ElMessage.success('已隐藏图层')
    }
  }
}

// 旧的 toggleTiffLayer 代码备份（已不再使用）
const toggleTiffLayerOld = async () => {
  if (tiffLayerVisible.value) {
    // 用户打开 TIF 图层
    if (!tiffLayer) {
      // 第一次打开，需要加载 TIF 数据
      try {
        ElMessage.info('正在加载作物分类数据...')
        console.log('开始加载 TIF 图层...')
        
        // 创建 GeoTIFF 数据源
        // TIF 文件已通过 GDAL 转换为 EPSG:3857 (Web Mercator)
        tiffSource = new GeoTIFF({
          sources: [
              {
                url: '/data/2024_kle_vh_kndvi.tif'
              }
          ],
          normalize: false,
          interpolate: false,
          transition: 0,
          wrapX: false
        })

        // 创建 WebGL Tile 图层，使用 alpha 通道控制透明度
        tiffLayer = new WebGLTile({
          source: tiffSource,
          visible: true,
          style: {
            // 颜色通道：根据像素值显示不同颜色
            // 像素值已+1，范围从1-10（0表示NoData透明）
            color: [
              'case',
              // NoData (0) - 完全透明
              ['==', ['band', 1], 0], [0, 0, 0, 0],
              // 1 - 裸地（原0）
              ['==', ['band', 1], 1], [210, 180, 140, 1],
              // 2 - 棉花（原1）- 浅天蓝色，便于识别
              ['==', ['band', 1], 2], [224, 248, 255, 1],
              // 3 - 小麦（原2）
              ['==', ['band', 1], 3], [255, 215, 0, 1],
              // 4 - 玉米（原3）
              ['==', ['band', 1], 4], [255, 165, 0, 1],
              // 5 - 番茄（原4）
              ['==', ['band', 1], 5], [255, 99, 71, 1],
              // 6 - 甜菜（原5）
              ['==', ['band', 1], 6], [255, 20, 147, 1],
              // 7 - 打瓜（原6）
              ['==', ['band', 1], 7], [0, 255, 127, 1],
              // 8 - 辣椒（原7）
              ['==', ['band', 1], 8], [220, 20, 60, 1],
              // 9 - 籽用葫芦（原8）
              ['==', ['band', 1], 9], [147, 112, 219, 1],
              // 10 - 其它耕地（原9）
              ['==', ['band', 1], 10], [128, 128, 128, 1],
              // 其他所有值：完全透明
              [0, 0, 0, 0]
            ]
          }
        })

        // 添加到地图
        map.addLayer(tiffLayer)
        
        // 暴露到全局用于调试
        window.debugTiffSource = tiffSource
        window.debugTiffLayer = tiffLayer
        window.debugMap = map
        
        console.log('TIF 图层加载成功')
        console.log('调试提示：可以在控制台使用 window.debugTiffSource 查看数据')
        ElMessage.success('作物分类图层加载成功')
      } catch (error) {
        console.error('TIF 图层加载失败:', error)
        ElMessage.error('作物分类图层加载失败：' + error.message)
        tiffLayerVisible.value = false // 加载失败，恢复开关状态
      }
    } else {
      // 已经加载过，直接显示
      tiffLayer.setVisible(true)
      ElMessage.success('已显示作物分类图层')
    }
  } else {
    // 用户关闭 TIF 图层
    if (tiffLayer) {
      tiffLayer.setVisible(false)
      ElMessage.success('已隐藏作物分类图层')
    }
  }
}

// 切换底图类型
const handleBaseMapChange = (value) => {
  console.log('切换底图:', value)
  
  // 隐藏所有底图
  Object.keys(baseMapLayers).forEach(key => {
    if (baseMapLayers[key]) {
      baseMapLayers[key].setVisible(false)
    }
  })
  
  // 根据选择显示对应底图
  if (value === 'none') {
    ElMessage.success('已关闭底图')
  } else if (value === 'amap-satellite') {
    // 影像图需要同时显示影像和标注
    baseMapLayers['amap-satellite'].setVisible(true)
    baseMapLayers['amap-annotation'].setVisible(true)
    console.log('✅ 已切换到高德影像图')
  } else if (value === 'amap-vector') {
    baseMapLayers['amap-vector'].setVisible(true)
    console.log('✅ 已切换到高德路网图')
  } else if (value === 'amap-pure') {
    baseMapLayers['amap-pure'].setVisible(true)
    console.log('✅ 已切换到高德纯净图')
  }
}

const initCropChart = () => {
  const chartDom = document.getElementById('crop-chart')
  
  // 🔧 检查DOM元素是否存在
  if (!chartDom) {
    console.warn('⚠️ 图表DOM元素不存在，跳过初始化')
    return
  }
  
  // 🔧 如果已经存在实例，先销毁
  if (cropChart) {
    cropChart.dispose()
    cropChart = null
  }
  
  try {
    cropChart = echarts.init(chartDom)
    console.log('✅ ECharts实例初始化成功')
  } catch (error) {
    console.error('❌ ECharts初始化失败:', error)
    return
  }
  
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}%'
    },
    legend: {
      bottom: '0%',
      left: 'center',
      type: 'plain',  // 改为普通模式，显示所有图例
      orient: 'horizontal',
      // 🔧 修复：显示所有图例项，即使值为0
      show: true,
      selectedMode: true,
      textStyle: {
        fontSize: 11
      },
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 8
    },
    series: [
      {
        name: '作物类型',
        type: 'pie',
        radius: ['35%', '60%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        // 🔧 修复：不设置最小角度限制，让所有数据都能显示
        data: [
          { value: 0, name: '暂无数据' }
        ]
      }
    ]
  }
  
  cropChart.setOption(option, true)  // 使用notMerge确保完全替换配置
}


const initMap = () => {
  try {
    console.log('开始初始化地图...')
    
    // 创建高德路网图（矢量图）
    baseMapLayers['amap-vector'] = new TileLayer({
      source: new XYZ({
        url: 'https://wprd0{1-4}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&x={x}&y={y}&z={z}',
        wrapX: false
      }),
      visible: currentBaseMap.value === 'amap-vector',
      zIndex: 0
    })
    
    // 创建高德影像图
    baseMapLayers['amap-satellite'] = new TileLayer({
      source: new XYZ({
        url: 'https://webst0{1-4}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
        wrapX: false
      }),
      visible: currentBaseMap.value === 'amap-satellite',
      zIndex: 0
    })
    
    // 创建高德影像标注图层
    baseMapLayers['amap-annotation'] = new TileLayer({
      source: new XYZ({
        url: 'https://webst0{1-4}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}',
        wrapX: false
      }),
      visible: currentBaseMap.value === 'amap-satellite',
      zIndex: 1
    })
    
    // 创建高德纯净图（无标注路网）
    baseMapLayers['amap-pure'] = new TileLayer({
      source: new XYZ({
        url: 'https://wprd0{1-4}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=8&x={x}&y={y}&z={z}',
        wrapX: false
      }),
      visible: currentBaseMap.value === 'amap-pure',
      zIndex: 0
    })

    // 创建地图实例（初始不加载 TIF 图层）
    map = new Map({
      target: 'map-container',
      layers: [
        baseMapLayers['amap-vector'],
        baseMapLayers['amap-satellite'],
        baseMapLayers['amap-annotation'],
        baseMapLayers['amap-pure']
      ],
      view: new View({
        center: fromLonLat([87.6, 43.8]), // 新疆中心
        zoom: 6,
        maxZoom: 18,
        minZoom: 3
      }),
      controls: defaultControls({ 
        zoom: false,        // 去掉默认的 +/- 缩放控件
        attribution: true   // 保留版权信息
      })
    })

    console.log('地图初始化成功（高德地图）')
    ElMessage.success('地图加载成功')
  } catch (error) {
    console.error('地图初始化失败:', error)
    ElMessage.error('地图加载失败：' + error.message)
  }
}

onMounted(() => {
  initMap()
  fetchImageData() // 获取影像数据列表
  
  setTimeout(() => {
    initCropChart()
  }, 100)
  
  window.addEventListener('resize', () => {
    cropChart?.resize()
  })
})

onBeforeUnmount(() => {
  cropChart?.dispose()
  
  // 销毁地图实例
  if (map) {
    map.setTarget(null)
    map = null
  }
})
</script>

<style scoped lang="scss">
.dashboard-container {
  .filter-card {
    margin-bottom: 16px;
    border-radius: 8px;
    
    .filter-bar {
      .filter-item {
        display: inline-flex;
        align-items: center;
        
        .filter-label {
          font-size: 14px;
          color: #606266;
          margin-right: 8px;
          white-space: nowrap;
        }
      }
    }
  }
  
  .kpi-container {
    margin-bottom: 0;
    
    .kpi-card {
      padding: 16px;
      border-radius: 8px;
      color: white;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: all 0.3s;
      cursor: pointer;
      margin-bottom: 20px;
      
      &:hover {
        transform: translateY(-5px);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
      }
      
      .kpi-icon {
        background: rgba(255, 255, 255, 0.2);
        padding: 15px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .kpi-content {
        flex: 1;
        
        .kpi-value {
          font-size: 24px;
          font-weight: bold;
          line-height: 1.2;
          margin-bottom: 2px;
        }
        
        .kpi-label {
          font-size: 12px;
          opacity: 0.9;
        }
      }
    }
  }
  
  .chart-card {
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    transition: all 0.3s;
    
    &:hover {
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
      transform: translateY(-2px);
    }
    
    :deep(.el-card__header) {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 20px;
      border-bottom: none;
      
      .el-icon {
        color: white;
      }
    }
    
    .chart-container {
      height: 340px;
    }
  }
  
  // 🔧 统一右上角按钮样式（适用于所有卡片）
  .file-switch-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(10px);
    
    .file-index {
      font-size: 12px;
      color: white;
      font-weight: 600;
      min-width: 40px;
      text-align: center;
      letter-spacing: 0.5px;
    }
    
    :deep(.el-button) {
      border: none;
      background: rgba(255, 255, 255, 0.15);
      color: white;
      padding: 4px;
      
      &:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.3);
      }
      
      &:disabled {
        opacity: 0.3;
      }
      
      .el-icon {
        color: white;
      }
    }
  }
  
  .map-card {
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
      
      span {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }
    
      .map-container {
        height: calc(100vh - 280px);
        min-height: 500px;
        max-height: 720px;
        width: 100%;
        background: #f5f7fa;
        border-radius: 4px;
        position: relative;
        overflow: hidden;
      
      // OpenLayers 地图样式调整
      :deep(.ol-viewport) {
        border-radius: 4px;
      }
      
      :deep(.ol-control) {
        background: rgba(255, 255, 255, 0.8);
        border-radius: 4px;
      }
      
      :deep(.ol-zoom) {
        top: 10px;
        left: auto;
        right: 10px;
      }
      
      // 底图控制开关（右上角）
      .basemap-control {
        position: absolute;
        top: 15px;
        right: 15px;
        z-index: 1000;
        background: rgba(255, 255, 255, 0.95);
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        backdrop-filter: blur(10px);
        
        :deep(.el-switch) {
          .el-switch__label {
            font-size: 13px;
            font-weight: 500;
            color: #606266;
          }
          
          &.is-checked .el-switch__core {
            background-color: #67C23A;
          }
        }
      }
      
      // 图例样式（左下角）
      .map-legend {
        position: absolute;
        bottom: 15px;
        left: 15px;
        background: rgba(255, 255, 255, 0.95);
        border-radius: 8px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
        min-width: 200px;
        max-width: 280px;
        z-index: 1000;
        font-size: 13px;
        backdrop-filter: blur(10px);
        
        .legend-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 15px;
          border-bottom: 1px solid #e4e7ed;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 8px 8px 0 0;
          cursor: pointer;
          user-select: none;
          
          .legend-title {
            font-weight: 600;
            color: white;
            font-size: 14px;
            letter-spacing: 0.5px;
          }
          
          .legend-toggle {
            color: white;
            font-size: 16px;
            transition: transform 0.3s;
            cursor: pointer;
            
            &.collapsed {
              transform: rotate(-90deg);
            }
            
            &:hover {
              transform: scale(1.2);
            }
          }
        }
        
        .legend-content {
          padding: 10px 12px;
          max-height: 350px;
          overflow-y: auto;
          
          &::-webkit-scrollbar {
            width: 6px;
          }
          
          &::-webkit-scrollbar-thumb {
            background: #dcdfe6;
            border-radius: 3px;
          }
          
          .legend-layer {
            margin-bottom: 8px;
            
            &:last-child {
              margin-bottom: 0;
            }
            
            .layer-header {
              margin-bottom: 8px;
              
              :deep(.el-checkbox) {
                font-weight: 500;
                color: #303133;
                
                .el-checkbox__label {
                  font-size: 13px;
                  padding-left: 6px;
                }
              }
            }
            
            .layer-items {
              padding-left: 24px;
              
              .legend-empty {
                padding: 10px;
                text-align: center;
                color: #909399;
                font-size: 12px;
                font-style: italic;
              }
              
              .legend-files {
                margin-bottom: 12px;
                
                .legend-section-title {
                  font-size: 12px;
                  font-weight: 600;
                  color: #303133;
                  margin-bottom: 8px;
                  padding-bottom: 6px;
                  border-bottom: 1px solid #e4e7ed;
                }
                
                .legend-file-item {
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  padding: 6px 10px;
                  margin: 4px 0;
                  border-radius: 4px;
                  cursor: pointer;
                  transition: all 0.2s;
                  font-size: 12px;
                  border: 1px solid transparent;
                  
                  &:hover {
                    background: #f0f2f5;
                  }
                  
                  &.active {
                    background: #ecf5ff;
                    border-color: #409EFF;
                    color: #409EFF;
                    font-weight: 500;
                  }
                  
                  .el-icon {
                    font-size: 14px;
                  }
                  
                  span {
                    flex: 1;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                  }
                }
              }
              
              .legend-item {
                display: flex;
                align-items: center;
                padding: 5px 0;
                gap: 10px;
                
                .legend-color {
                  width: 24px;
                  height: 18px;
                  border-radius: 3px;
                  border: 1px solid rgba(0, 0, 0, 0.1);
                  flex-shrink: 0;
                  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }
                
                .legend-label {
                  color: #606266;
                  font-size: 12px;
                  line-height: 1.4;
                }
              }
              
              .legend-info {
                padding: 8px 0;
              }
              
              .legend-item-text {
                padding: 4px 0;
                font-size: 12px;
                color: #606266;
                line-height: 1.6;
                
                .legend-label-bold {
                  font-weight: 600;
                  color: #303133;
                  margin-right: 8px;
                }
              }
            }
          }
        }
      }
    }
  }
  
  .stats-card {
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    transition: all 0.3s;
    
    &:hover {
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
      transform: translateY(-2px);
    }
    
    :deep(.el-card__header) {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 20px;
      border-bottom: none;
      
      .el-icon {
        color: white;
      }
      
      .stats-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        
        .stats-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: white;
          font-size: 15px;
          font-weight: 600;
          
          .el-icon {
            color: white;
            font-size: 18px;
          }
        }
      }
    }
    
    .stats-empty {
      padding: 20px;
      text-align: center;
    }
    
    // 🆕 影像信息样式
    .image-info-content {
      .info-list {
        padding: 8px 0;
        
        .info-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          margin-bottom: 10px;
          background: linear-gradient(135deg, #ffffff 0%, #f8f9fc 100%);
          border-radius: 10px;
          border: 1px solid #e8ecf0;
          transition: all 0.3s ease;
          
          &:last-child {
            margin-bottom: 0;
          }
          
          &:hover {
            background: linear-gradient(135deg, #f8f9fc 0%, #e8edf5 100%);
            transform: translateX(4px);
            border-color: #409EFF;
            box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
          }
          
          .info-label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            font-weight: 500;
            color: #606266;
            min-width: 100px;
            
            .el-icon {
              font-size: 16px;
              color: #409EFF;
            }
          }
          
          .info-value {
            font-size: 13px;
            color: #303133;
            font-weight: 500;
            text-align: right;
            flex: 1;
            word-break: break-all;
            
            .el-tag {
              font-size: 12px;
            }
          }
        }
      }
    }
    
    .stats-content {
      .current-file-name {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 8px;
        margin-bottom: 16px;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
        
        span {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }
      
      .stat-item {
        display: flex;
        align-items: center;
        padding: 20px 18px;
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fc 100%);
        border-radius: 12px;
        margin-bottom: 14px;
        transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid #e8ecf0;
        position: relative;
        overflow: hidden;
        
        &::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #409EFF 0%, #67C23A 100%);
          transform: scaleX(0);
          transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        &:last-child {
          margin-bottom: 0;
        }
        
        &:hover {
          background: linear-gradient(135deg, #f8f9fc 0%, #e8edf5 100%);
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 8px 24px rgba(64, 158, 255, 0.2);
          border-color: #409EFF;
          
          &::before {
            transform: scaleX(1);
          }
          
          .stat-icon {
            transform: rotate(5deg) scale(1.1);
            box-shadow: 0 6px 16px rgba(64, 158, 255, 0.3);
          }
        }
        
        .stat-icon {
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #409EFF 0%, #66b3ff 100%);
          border-radius: 12px;
          margin-right: 16px;
          box-shadow: 0 4px 12px rgba(64, 158, 255, 0.25);
          transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          
          :deep(.el-icon) {
            color: white;
            filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
          }
        }
        
        &:nth-child(2) .stat-icon {
          background: linear-gradient(135deg, #67C23A 0%, #85ce61 100%);
          box-shadow: 0 4px 12px rgba(103, 194, 58, 0.25);
        }
        
        &:nth-child(2):hover .stat-icon {
          box-shadow: 0 6px 16px rgba(103, 194, 58, 0.3);
        }
        
        .stat-info {
          flex: 1;
          
          .stat-label {
            font-size: 13px;
            color: #909399;
            margin-bottom: 6px;
            font-weight: 500;
            letter-spacing: 0.3px;
          }
          
          .stat-value {
            font-size: 26px;
            font-weight: bold;
            color: #303133;
            background: linear-gradient(135deg, #409EFF 0%, #303133 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            line-height: 1.2;
            
            .stat-unit {
              font-size: 14px;
              font-weight: 500;
              color: #909399;
              margin-left: 4px;
              -webkit-text-fill-color: #909399;
            }
          }
        }
      }
    }
  }
  
  .file-switch-card {
    .file-list {
      max-height: 300px;
      overflow-y: auto;
      
      .file-item {
        display: flex;
        align-items: center;
        padding: 12px;
        background: #f5f7fa;
        border-radius: 8px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.3s;
        border: 2px solid transparent;
        
        &:last-child {
          margin-bottom: 0;
        }
        
        &:hover {
          background: #e8edf3;
          transform: translateX(4px);
        }
        
        &.active {
          background: #e8f5e9;
          border-color: #67C23A;
          box-shadow: 0 2px 8px rgba(103, 194, 58, 0.2);
        }
        
        .file-number {
          width: 28px;
          height: 28px;
          background: #409EFF;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          margin-right: 12px;
          flex-shrink: 0;
        }
        
        .file-info {
          flex: 1;
          min-width: 0;
          
          .file-name {
            font-size: 13px;
            font-weight: 500;
            color: #303133;
            margin-bottom: 6px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          .file-meta {
            display: flex;
            align-items: center;
            gap: 8px;
            
            .file-date {
              font-size: 12px;
              color: #909399;
            }
          }
        }
        
        .check-icon {
          font-size: 20px;
          margin-left: 8px;
          flex-shrink: 0;
        }
      }
    }
  }
}

.gradient-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.gradient-success {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.gradient-warning {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}

.gradient-info {
  background: linear-gradient(135deg, #30cfd0 0%, #330867 100%);
}
</style>

