<template>
  <div class="dashboard-container">
    <!-- 顶部筛选栏 -->
    <el-card class="filter-card" shadow="never">
      <div class="filter-bar">
        <el-space :size="15" wrap>
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
              v-model="filterForm.imageName" 
              placeholder="选择影像" 
              style="width: 240px" 
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
          <div class="filter-item">
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
                v-for="crop in cropLegend" 
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
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
          <el-button type="success" @click="handleRefreshOptions" plain>
            <RefreshCw :size="16" style="margin-right: 6px" />
            刷新选项
          </el-button>
        </el-space>
      </div>
    </el-card>

    <!-- KPI统计卡片 -->
    <div class="kpi-container">
      <el-row :gutter="20">
        <el-col :xs="24" :sm="12" :md="6">
          <div class="kpi-card gradient-primary">
            <div class="kpi-icon">
              <el-icon :size="32"><Grid /></el-icon>
            </div>
            <div class="kpi-content">
              <div class="kpi-value">{{ kpiData.totalArea }}</div>
              <div class="kpi-label">总监测面积（亩）</div>
            </div>
          </div>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <div class="kpi-card gradient-success">
            <div class="kpi-icon">
              <el-icon :size="32"><SuccessFilled /></el-icon>
            </div>
            <div class="kpi-content">
              <div class="kpi-value">{{ kpiData.matchRate }}%</div>
              <div class="kpi-label">作物吻合率</div>
            </div>
          </div>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <div class="kpi-card gradient-warning">
            <div class="kpi-icon">
              <el-icon :size="32"><WarningFilled /></el-icon>
            </div>
            <div class="kpi-content">
              <div class="kpi-value">{{ kpiData.diffCount }}</div>
              <div class="kpi-label">差异地块数</div>
            </div>
          </div>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <div class="kpi-card gradient-info">
            <div class="kpi-icon">
              <el-icon :size="32"><DocumentChecked /></el-icon>
            </div>
            <div class="kpi-content">
              <div class="kpi-value">{{ kpiData.plotCount }}</div>
              <div class="kpi-label">地块总数</div>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

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
            
            <!-- 栅格图层图例（左下角） - 仅在选择影像后显示 -->
            <div class="map-legend" v-show="!legendCollapsed && currentImageData">
              <div class="legend-header" @click="legendCollapsed = !legendCollapsed">
                <span class="legend-title">作物分类图例</span>
                <el-icon 
                  class="legend-toggle" 
                  :class="{ collapsed: legendCollapsed }"
                >
                  <ArrowDown />
                </el-icon>
              </div>
              <div class="legend-content">
                <!-- 图层控制 -->
                <div class="legend-layer">
                  <div class="layer-header">
                    <el-checkbox v-model="tiffLayerVisible" @change="toggleTiffLayer">
                      作物分类 (2024)
                    </el-checkbox>
                  </div>
                  <div class="layer-items" v-show="tiffLayerVisible">
                    <div v-if="filteredCropLegend.length === 0" class="legend-empty">
                      请选择作物类型进行筛选
                    </div>
                    <div class="legend-item" v-for="item in filteredCropLegend" :key="item.value">
                      <div class="legend-color" :style="{ background: item.color }"></div>
                      <span class="legend-label">{{ item.label }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 右侧图表 -->
      <el-col :xs="24" :lg="6">
        <!-- 作物分布图 -->
        <el-card class="chart-card" shadow="never">
          <template #header>
            <span><el-icon><PieChart /></el-icon> 作物类型分布</span>
          </template>
          <div id="crop-chart" class="chart-container"></div>
        </el-card>

        <!-- 差异类型分布 -->
        <el-card class="chart-card" shadow="never" style="margin-top: 20px">
          <template #header>
            <span><el-icon><DataLine /></el-icon> 差异类型统计</span>
          </template>
          <div id="diff-chart" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 趋势分析图表 -->
    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="24">
        <el-card shadow="never">
          <template #header>
            <span><el-icon><TrendCharts /></el-icon> 近年监测趋势分析</span>
          </template>
          <div id="trend-chart" class="trend-chart-container"></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Search, Refresh, Grid, SuccessFilled, WarningFilled, DocumentChecked, Location, ZoomIn, ZoomOut, Position, PieChart, DataLine, TrendCharts, ArrowDown, Loading } from '@element-plus/icons-vue'
import { RefreshCw } from 'lucide-vue-next'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'

// OpenLayers 导入
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import { OSM, XYZ } from 'ol/source'
import { fromLonLat, transformExtent } from 'ol/proj'
import GeoTIFF from 'ol/source/GeoTIFF'
import WebGLTile from 'ol/layer/WebGLTile'
import { defaults as defaultControls } from 'ol/control'
import 'ol/ol.css'
import axios from 'axios'

// 影像数据相关
const imageData = ref([])
const availableYears = ref([])
const availablePeriods = ref([])
const availableImages = ref([]) // 可用的影像列表
const currentImageData = ref(null)

const filterForm = ref({
  year: '2024',
  period: '1',
  imageName: '', // 影像名称
  region: [],
  keyword: ''
})

// 选中的作物类型（多选）
// 默认显示所有类型（包括裸地）
const selectedCropTypes = ref([])

// 过滤后的图例（根据选中的作物类型）
const filteredCropLegend = computed(() => {
  if (selectedCropTypes.value.length === 0) {
    // 如果没有选择，显示全部
    return cropLegend
  }
  // 只显示选中的作物类型
  return cropLegend.filter(crop => selectedCropTypes.value.includes(crop.value))
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
  totalArea: '128,456',
  matchRate: '92.8',
  diffCount: '245',
  plotCount: '3,421'
})

let cropChart = null
let diffChart = null
let trendChart = null
let map = null // OpenLayers 地图实例
let tiffLayer = null // TIF 图层实例
let tiffSource = null // TIF 数据源

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
  { value: 2, label: '棉花', color: '#FFFFFF' },      // 原1
  { value: 3, label: '小麦', color: '#FFD700' },      // 原2
  { value: 4, label: '玉米', color: '#FFA500' },      // 原3
  { value: 5, label: '番茄', color: '#FF6347' },      // 原4
  { value: 6, label: '甜菜', color: '#FF1493' },      // 原5
  { value: 7, label: '打瓜', color: '#00FF7F' },      // 原6
  { value: 8, label: '辣椒', color: '#DC143C' },      // 原7
  { value: 9, label: '籽用葫芦', color: '#9370DB' },  // 原8
  { value: 10, label: '其它耕地', color: '#808080' }  // 原9
]

// 获取影像数据列表
const fetchImageData = async () => {
  try {
    const response = await axios.get('/data/imageData.json')
    imageData.value = response.data.images || []
    
    // 提取所有年份
    const years = [...new Set(imageData.value.map(img => img.year))]
    availableYears.value = years.sort((a, b) => b - a)
    
    // 设置默认年份
    if (availableYears.value.length > 0 && !filterForm.value.year) {
      filterForm.value.year = availableYears.value[0]
    }
    
    // 更新可用期次
    updateAvailablePeriods()
    
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
  if (filterForm.value.imageName && 
      !availableImages.value.some(img => img.name === filterForm.value.imageName)) {
    filterForm.value.imageName = ''
  }
  
  console.log('可用影像列表已更新:', availableImages.value.length, '个影像')
}

// 年份变化处理
const handleYearChange = () => {
  filterForm.value.imageName = '' // 清空影像名称选择
  updateAvailablePeriods()
  // 不再自动加载，等待用户点击查询
}

// 期次变化处理
const handlePeriodChange = () => {
  filterForm.value.imageName = '' // 清空影像名称选择
  updateAvailableImages()
  // 不再自动加载，等待用户点击查询
}

// 影像名称变化处理
const handleImageNameChange = () => {
  // 不再自动加载，等待用户点击查询
}

// 作物类型变化处理
const handleCropTypeChange = () => {
  // 如果图层已经加载且可见，重新应用样式
  if (tiffLayer && tiffLayerVisible.value) {
    console.log('作物类型已更改，重新应用样式')
    
    // 更新图层样式
    tiffLayer.setStyle({
      color: generateColorStyle()
    })
    
    // 更新统计图表
    if (currentImageData.value) {
      updateStatistics(currentImageData.value)
    }
    
    ElMessage.success('已更新作物类型筛选')
  }
}

// 加载 TIF 数据到地图
const loadTiffData = async () => {
  let matchedImage = null
  
  // 如果指定了影像名称，优先使用影像名称查找
  if (filterForm.value.imageName) {
    matchedImage = imageData.value.find(img => 
      img.year === filterForm.value.year &&
      img.period === filterForm.value.period &&
      img.name === filterForm.value.imageName
    )
  } else {
    // 否则根据年份、期次、作物类型查找
    // 如果有多个符合条件的影像，取第一个
    const matches = imageData.value.filter(img => 
      img.year === filterForm.value.year &&
      img.period === filterForm.value.period &&
      (filterForm.value.cropType === 'all' || img.cropType === filterForm.value.cropType)
    )
    
    if (matches.length > 1) {
      ElMessage.warning(`找到 ${matches.length} 个符合条件的影像，请通过"影像名称"选择具体影像`)
      // 自动选择第一个
      matchedImage = matches[0]
    } else if (matches.length === 1) {
      matchedImage = matches[0]
    }
  }
  
  if (!matchedImage) {
    console.log('未找到符合条件的影像数据')
    // 移除当前图层
    if (tiffLayer && map) {
      tiffLayer.setVisible(false)
    }
    currentImageData.value = null
    return
  }
  
  currentImageData.value = matchedImage
  console.log('找到匹配的影像:', matchedImage)
  
  // 如果 TIF 图层开关是打开的，重新加载图层
  if (tiffLayerVisible.value) {
    // 优先使用优化后的路径，如果没有则使用原始路径
    const pathToLoad = matchedImage.optimizedPath || matchedImage.filePath || matchedImage.originalPath
    
    if (!matchedImage.isOptimized && matchedImage.optimizedPath === null) {
      ElMessage.warning('该影像未经过优化，可能加载较慢')
    }
    
    await reloadTiffLayer(pathToLoad)
  }
  
  // 更新统计数据
  updateStatistics(matchedImage)
  
  const imageName = matchedImage.name.length > 30 ? matchedImage.name.substring(0, 30) + '...' : matchedImage.name
  ElMessage.success(`已选择: ${imageName}`)
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

// 重新加载 TIF 图层
const reloadTiffLayer = async (filePath) => {
  try {
    ElMessage.info('正在加载影像数据...')
    
    // 移除旧图层
    if (tiffLayer && map) {
      map.removeLayer(tiffLayer)
      tiffLayer = null
      tiffSource = null
    }
    
    // 创建新的 GeoTIFF 数据源
    tiffSource = new GeoTIFF({
      sources: [{
        url: filePath
      }],
      normalize: false,
      interpolate: false,
      transition: 0,
      wrapX: false
    })
    
    // 创建新的 WebGL Tile 图层，使用动态颜色样式
    tiffLayer = new WebGLTile({
      source: tiffSource,
      visible: true,
      style: {
        color: generateColorStyle()
      },
      opacity: 0.85
    })
    
    // 添加到地图
    map.addLayer(tiffLayer)
    
    console.log('TIF 图层重新加载成功，已应用作物类型筛选')
    ElMessage.success('影像加载成功')
  } catch (error) {
    console.error('TIF 图层加载失败:', error)
    ElMessage.error('影像加载失败：' + error.message)
  }
}

// 更新统计数据
const updateStatistics = (imageData) => {
  if (!imageData || !imageData.statistics) {
    console.log('没有统计数据可用')
    return
  }
  
  const stats = imageData.statistics
  
  // 更新 KPI 卡片数据
  kpiData.value = {
    totalArea: formatNumber(stats.totalArea),
    matchRate: stats.matchRate,
    diffCount: stats.diffCount,
    plotCount: formatNumber(stats.plotCount)
  }
  
  // 更新作物分布饼图（根据选中的作物类型过滤）
  if (cropChart && stats.cropDistribution) {
    let cropData = Object.entries(stats.cropDistribution).map(([name, value]) => ({
      value,
      name
    }))
    
    // 如果选择了特定的作物类型，只显示选中的
    if (selectedCropTypes.value.length > 0) {
      const selectedLabels = cropLegend
        .filter(crop => selectedCropTypes.value.includes(crop.value))
        .map(crop => crop.label)
      
      cropData = cropData.filter(item => selectedLabels.includes(item.name))
      
      console.log('已筛选作物统计数据:', cropData)
    }
    
    // 如果没有数据，显示提示
    if (cropData.length === 0) {
      cropData = [{ value: 1, name: '无数据' }]
    }
    
    cropChart.setOption({
      series: [{
        data: cropData
      }]
    })
  }
  
  console.log('统计数据已更新')
}

// 格式化数字（添加千位分隔符）
const formatNumber = (num) => {
  if (!num) return '0'
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const handleSearch = () => {
  loadTiffData()
}

const handleReset = () => {
  filterForm.value = {
    year: availableYears.value[0] || '2024',
    period: '1',
    imageName: '',
    region: [],
    keyword: ''
  }
  selectedCropTypes.value = [] // 清空作物类型选择
  updateAvailablePeriods()
  
  // 如果图层已打开，关闭它
  if (tiffLayerVisible.value) {
    tiffLayerVisible.value = false
    if (tiffLayer && map) {
      map.removeLayer(tiffLayer)
      tiffLayer = null
      tiffSource = null
    }
  }
  
  ElMessage.info('筛选条件已重置')
}

// 刷新选项（重新从后端加载数据）
const handleRefreshOptions = async () => {
  try {
    await fetchImageData()
    ElMessage.success('选项已刷新')
  } catch (error) {
    ElMessage.error('刷新失败')
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

const handleZoomToExtent = () => {
  if (map) {
    const view = map.getView()
    
    // 如果 TIF 图层打开，尝试缩放到 TIF 范围
    if (tiffLayerVisible.value && tiffSource) {
      tiffSource.getView().then((viewConfig) => {
        if (viewConfig && viewConfig.extent) {
          view.fit(viewConfig.extent, {
            padding: [50, 50, 50, 50],
            duration: 500
          })
          ElMessage.success('已缩放至图层范围')
        }
      }).catch(() => {
        // 如果获取失败，使用默认范围
        view.animate({
          center: fromLonLat([87.6, 43.8]),
          zoom: 6,
          duration: 500
        })
        ElMessage.info('已缩放至默认视图')
      })
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
    if (!currentImageData.value) {
      ElMessage.warning('请先选择年份期次')
      tiffLayerVisible.value = false
      return
    }
    
    if (!tiffLayer) {
      // 第一次打开，需要加载 TIF 数据
      await reloadTiffLayer(currentImageData.value.filePath)
    } else {
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
              // 2 - 棉花（原1）
              ['==', ['band', 1], 2], [255, 255, 255, 1],
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
    ElMessage.success('已切换到高德影像图')
  } else if (value === 'amap-vector') {
    baseMapLayers['amap-vector'].setVisible(true)
    ElMessage.success('已切换到高德路网图')
  } else if (value === 'amap-pure') {
    baseMapLayers['amap-pure'].setVisible(true)
    ElMessage.success('已切换到高德纯净图')
  }
}

const initCropChart = () => {
  const chartDom = document.getElementById('crop-chart')
  cropChart = echarts.init(chartDom)
  
  const option = {
    tooltip: {
      trigger: 'item'
    },
    legend: {
      bottom: '0%',
      left: 'center',
      type: 'scroll',
      pageIconSize: 12,
      pageTextStyle: {
        fontSize: 12
      }
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
            fontSize: 20,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: [
          { value: 1048, name: '小麦' },
          { value: 735, name: '玉米' },
          { value: 580, name: '棉花' },
          { value: 484, name: '水稻' },
          { value: 300, name: '其他' }
        ]
      }
    ]
  }
  
  cropChart.setOption(option)
}

const initDiffChart = () => {
  const chartDom = document.getElementById('diff-chart')
  diffChart = echarts.init(chartDom)
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'value'
    },
    yAxis: {
      type: 'category',
      data: ['类型不符', '撂荒未种', '非规划种植', '超范围种植']
    },
    series: [
      {
        name: '地块数',
        type: 'bar',
        data: [120, 52, 43, 30],
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#fa709a' },
            { offset: 1, color: '#fee140' }
          ])
        }
      }
    ]
  }
  
  diffChart.setOption(option)
}

const initTrendChart = () => {
  const chartDom = document.getElementById('trend-chart')
  trendChart = echarts.init(chartDom)
  
  const option = {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['监测面积', '吻合率', '差异地块']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['2020', '2021', '2022', '2023', '2024']
    },
    yAxis: [
      {
        type: 'value',
        name: '面积(万亩)',
        position: 'left'
      },
      {
        type: 'value',
        name: '吻合率(%)',
        position: 'right',
        max: 100
      }
    ],
    series: [
      {
        name: '监测面积',
        type: 'line',
        smooth: true,
        data: [8.5, 9.2, 10.1, 11.3, 12.8],
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(102, 126, 234, 0.5)' },
            { offset: 1, color: 'rgba(102, 126, 234, 0.1)' }
          ])
        }
      },
      {
        name: '吻合率',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        data: [88, 90, 91, 92, 92.8]
      },
      {
        name: '差异地块',
        type: 'line',
        smooth: true,
        data: [0.32, 0.28, 0.26, 0.25, 0.245]
      }
    ]
  }
  
  trendChart.setOption(option)
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
    initDiffChart()
    initTrendChart()
  }, 100)
  
  window.addEventListener('resize', () => {
    cropChart?.resize()
    diffChart?.resize()
    trendChart?.resize()
  })
})

onBeforeUnmount(() => {
  cropChart?.dispose()
  diffChart?.dispose()
  trendChart?.dispose()
  
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
  
  .map-card, .chart-card {
    border-radius: 8px;
    
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
      height: 560px;
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
            }
          }
        }
      }
    }
    
    .chart-container {
      height: 340px;
    }
  }
  
  .trend-chart-container {
    height: 350px;
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

