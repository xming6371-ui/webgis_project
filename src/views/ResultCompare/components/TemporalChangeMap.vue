<template>
  <div class="temporal-change-map">
    <!-- 数据质量警告 -->
    <div v-if="qualityReport && qualityReport.warnings.length > 0" style="margin-bottom: 16px;">
      <el-alert
        v-for="(warning, index) in qualityReport.warnings"
        :key="index"
        :title="warning.message"
        :type="warning.severity === 'error' ? 'error' : warning.severity === 'warning' ? 'warning' : 'info'"
        :closable="false"
        style="margin-bottom: 8px;"
      >
        <template v-if="warning.type === 'count_mismatch'">
          <div style="margin-top: 8px; font-size: 12px;">
            <div v-for="(detail, idx) in warning.details" :key="idx" style="margin: 4px 0;">
              • {{ detail.taskName || detail.time }}: <strong>{{ detail.count }}</strong> 个地块
            </div>
          </div>
        </template>
      </el-alert>
    </div>

    <el-row :gutter="20">
      <!-- 地图主区域 -->
      <el-col :span="18">
        <el-card shadow="hover">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>
                <el-icon><Location /></el-icon>
                时序变化地图
              </span>
              <el-space>
                <el-select v-model="currentBaseMap" size="small" style="width: 120px" @change="handleBaseMapChange">
                  <el-option label="高德路网" value="amap-vector" />
                  <el-option label="高德影像" value="amap-satellite" />
                  <el-option label="无底图" value="none" />
                </el-select>
                <el-button size="small" @click="handleZoomToExtent" :icon="Position">缩放至</el-button>
              </el-space>
            </div>
          </template>

          <!-- OpenLayers 地图容器 -->
          <div id="temporal-map" class="map-container" v-loading="mapLoading">
            <!-- 可拖拽的详情面板（显示在地图右侧） -->
            <div
              v-if="selectedFeature"
              ref="detailPanel"
              class="detail-panel"
              :style="detailPanelStyle"
              @mousedown="startDrag"
            >
              <div class="panel-header">
                <span class="panel-title">
                  <el-icon><InfoFilled /></el-icon>
                  地块详情
                </span>
                <el-button size="small" text @click="selectedFeature = null">
                  <el-icon><Close /></el-icon>
                </el-button>
              </div>
              
              <el-scrollbar max-height="500px">
                <div class="plot-detail">
                  <div class="detail-section">
                    <div class="section-title">基本信息</div>
                    <div class="detail-item">
                      <span class="label">地块名称：</span>
                      <span class="value">{{ selectedFeature.properties.plotName || '未命名' }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="label">地块ID：</span>
                      <span class="value">{{ selectedFeature.properties.id || selectedFeature.id }}</span>
                    </div>
                    <div class="detail-item" v-if="selectedFeature.properties.area">
                      <span class="label">面积：</span>
                      <span class="value">{{ selectedFeature.properties.area }} 亩</span>
                    </div>
                  </div>

                  <el-divider />

                  <div class="detail-section">
                    <div class="section-title">变化统计</div>
                    <div class="detail-item">
                      <span class="label">变化次数：</span>
                      <el-tag :type="getChangeTypeTag(selectedFeature.properties.changeCount)" size="small">
                        {{ selectedFeature.properties.changeCount }} 次
                      </el-tag>
                    </div>
                    <div class="detail-item">
                      <span class="label">起始作物：</span>
                      <el-tag type="success" size="small">{{ selectedFeature.properties.startCrop }}</el-tag>
                    </div>
                    <div class="detail-item">
                      <span class="label">结束作物：</span>
                      <el-tag type="warning" size="small">{{ selectedFeature.properties.endCrop }}</el-tag>
                    </div>
                  </div>

                  <el-divider />

                  <div class="detail-section">
                    <div class="section-title">时序变化轨迹</div>
                    <el-timeline>
                      <el-timeline-item
                        v-for="(point, index) in selectedFeature.properties.timeline"
                        :key="index"
                        :timestamp="formatTime(point.time)"
                        :type="index === currentTimeIndex ? 'primary' : 'info'"
                        :hollow="index !== currentTimeIndex"
                      >
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <el-tag size="small">{{ point.crop }}</el-tag>
                          <span v-if="index > 0 && point.crop !== selectedFeature.properties.timeline[index-1].crop" style="color: #e6a23c; font-size: 12px;">
                            变化 ⚡
                          </span>
                        </div>
                      </el-timeline-item>
                    </el-timeline>
                  </div>
                </div>
              </el-scrollbar>
            </div>
          </div>

          <!-- 图例 - 移到右上角 -->
          <div class="map-legend">
            <div class="legend-header">
              <span class="legend-title">变化程度</span>
            </div>
            <div class="legend-content">
              <div class="legend-item" v-for="item in changeLegend" :key="item.level">
                <div class="legend-color" :style="{ background: item.color }"></div>
                <span class="legend-label">{{ item.label }}</span>
                <span class="legend-count">({{ getCountForLevel(item.level) }})</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 右侧统计面板 -->
      <el-col :span="6">
        <!-- 统计卡片 -->
        <el-card shadow="hover" style="margin-bottom: 16px;">
          <template #header>统计信息</template>
          <div class="stats-list">
            <div class="stat-item">
              <div class="stat-label">地块总数</div>
              <div class="stat-value primary">{{ stats.total }}</div>
            </div>
            <el-divider />
            <div class="stat-item">
              <div class="stat-label">有变化</div>
              <div class="stat-value warning">{{ stats.changed }}</div>
            </div>
            <el-divider />
            <div class="stat-item">
              <div class="stat-label">无变化</div>
              <div class="stat-value success">{{ stats.unchanged }}</div>
            </div>
            <el-divider />
            <div class="stat-item">
              <div class="stat-label">
                匹配率
                <el-tooltip placement="top" effect="dark">
                  <template #content>
                    <div style="max-width: 250px;">
                      <p style="margin: 0 0 8px 0; font-weight: 600;">地块匹配率</p>
                      <p style="margin: 0;">能在所有时间点找到对应数据的地块百分比。</p>
                      <p style="margin: 8px 0 0 0;">
                        • 100%：所有地块在每个时期都有数据<br>
                        • <100%：部分地块在某些时期缺失数据
                      </p>
                    </div>
                  </template>
                  <el-icon style="cursor: help; margin-left: 4px; font-size: 12px; color: #909399;">
                    <QuestionFilled />
                  </el-icon>
                </el-tooltip>
              </div>
              <div class="stat-value" :class="matchRateClass">
                {{ qualityReport?.matchRate || 100 }}%
              </div>
            </div>
            <el-divider />
            <div class="stat-item">
              <div class="stat-label">时间跨度</div>
              <div class="stat-value info">{{ timePoints.length }} 期</div>
            </div>
          </div>
        </el-card>

        <!-- 变化地块列表 -->
        <el-card shadow="hover">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>变化地块列表</span>
              <el-tag type="warning">{{ changedFeatures.length }}</el-tag>
            </div>
          </template>
          
          <el-scrollbar max-height="500px">
            <div
              v-for="(feature, index) in changedFeatures.slice(0, 20)"
              :key="index"
              class="change-item"
              @click="handleSelectFeature(feature)"
            >
              <div class="change-item-header">
                <span class="plot-id">{{ feature.properties.plotName || `地块 ${feature.properties.id || index + 1}` }}</span>
                <el-tag size="small" :type="getChangeTypeTag(feature.properties.changeCount)">
                  {{ feature.properties.changeCount }} 次
                </el-tag>
              </div>
              <div class="change-item-body">
                <div class="crop-transition">
                  <el-tag size="small" type="success" effect="plain">{{ feature.properties.startCrop }}</el-tag>
                  <el-icon><Right /></el-icon>
                  <el-tag size="small" type="warning" effect="plain">{{ feature.properties.endCrop }}</el-tag>
                </div>
                <div class="crop-sequence" v-if="feature.properties.cropSequence">
                  <span class="sequence-label">变化序列：</span>
                  <span class="sequence-value">{{ feature.properties.cropSequence }}</span>
                </div>
              </div>
            </div>
            <el-empty v-if="changedFeatures.length === 0" description="无变化地块" :image-size="60" />
            <div v-if="changedFeatures.length > 20" style="text-align: center; padding: 12px; color: #909399; font-size: 13px;">
              仅显示前20个地块，共 {{ changedFeatures.length }} 个
            </div>
          </el-scrollbar>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Location, Position, ArrowLeft, ArrowRight, Close, InfoFilled, QuestionFilled, Right } from '@element-plus/icons-vue'

// OpenLayers imports
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { XYZ } from 'ol/source'
import GeoJSON from 'ol/format/GeoJSON'
import { Style, Fill, Stroke } from 'ol/style'
import { defaults as defaultControls } from 'ol/control'
import { fromLonLat, get as getProjection } from 'ol/proj'
import 'ol/ol.css'

const props = defineProps({
  data: {
    type: Object,
    required: true
  }
})

// 地图相关
let map = null
let vectorLayer = null
let baseMapLayers = {}
const mapLoading = ref(true)
const currentBaseMap = ref('amap-vector')

// 时间轴
const currentTimeIndex = ref(0)
const timePoints = computed(() => props.data.timePoints || [])

// 选中的地块
const selectedFeature = ref(null)
const selectedFeatureId = ref(null) // 存储选中地块的ID，用于精确匹配

// 详情面板拖拽相关
const detailPanel = ref(null)
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const panelPosition = ref({ x: 0, y: 80 }) // 初始位置，将在mounted时计算

const detailPanelStyle = computed(() => ({
  left: `${panelPosition.value.x}px`,
  top: `${panelPosition.value.y}px`
}))

// 开始拖拽
const startDrag = (e) => {
  // 只有点击header时才能拖拽
  if (!e.target.closest('.panel-header')) return
  
  isDragging.value = true
  dragOffset.value = {
    x: e.clientX - panelPosition.value.x,
    y: e.clientY - panelPosition.value.y
  }
  
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

// 拖拽中
const onDrag = (e) => {
  if (!isDragging.value) return
  
  panelPosition.value = {
    x: e.clientX - dragOffset.value.x,
    y: e.clientY - dragOffset.value.y
  }
}

// 停止拖拽
const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// 统计信息
const stats = computed(() => props.data.stats || { total: 0, changed: 0, unchanged: 0 })
const qualityReport = computed(() => props.data.qualityReport || { warnings: [], timePointCounts: [], matchRate: 100 })

// 匹配率样式类
const matchRateClass = computed(() => {
  const rate = parseFloat(qualityReport.value.matchRate || 100)
  if (rate >= 95) return 'success'
  if (rate >= 85) return 'warning'
  return 'danger'
})

// 有变化的地块
const changedFeatures = computed(() => {
  return (props.data.features || []).filter(f => (f.properties?.changeCount || 0) > 0)
})

// 变化程度图例
// 计算最大变化次数
const maxChangeCount = computed(() => {
  if (!props.data.features || props.data.features.length === 0) return 0
  return Math.max(...props.data.features.map(f => f.properties?.changeCount || 0))
})

// 根据最大变化次数动态生成图例
const changeLegend = computed(() => {
  const legend = [
    { level: 0, label: '无变化', color: '#67c23a' }
  ]
  
  const max = maxChangeCount.value
  
  // 根据最大变化次数动态添加图例项
  if (max >= 1) {
    legend.push({ level: 1, label: '轻微变化 (1次)', color: '#e6a23c' })
  }
  if (max >= 2) {
    legend.push({ level: 2, label: '中度变化 (2次)', color: '#f56c6c' })
  }
  if (max >= 3) {
    legend.push({ level: 3, label: '频繁变化 (3+次)', color: '#c71585' })
  }
  
  return legend
})

// 统计每个变化级别的数量
const getCountForLevel = (level) => {
  if (!props.data.features) return 0
  if (level === 0) {
    return props.data.features.filter(f => f.properties?.changeCount === 0).length
  } else if (level === 1) {
    return props.data.features.filter(f => f.properties?.changeCount === 1).length
  } else if (level === 2) {
    return props.data.features.filter(f => f.properties?.changeCount === 2).length
  } else {
    return props.data.features.filter(f => (f.properties?.changeCount || 0) >= 3).length
  }
}

// 根据变化次数获取颜色
const getColorForChangeCount = (changeCount) => {
  if (changeCount === 0) return '#67c23a'
  if (changeCount === 1) return '#e6a23c'
  if (changeCount === 2) return '#f56c6c'
  return '#c71585'
}

// 获取变化类型标签
const getChangeTypeTag = (changeCount) => {
  if (changeCount === 0) return 'success'
  if (changeCount === 1) return 'warning'
  return 'danger'
}

// 格式化时间
const formatTime = (timeStr) => {
  if (!timeStr) return ''
  return timeStr.split(' ')[0] || timeStr
}

// 初始化地图
const initMap = async () => {
  try {
    mapLoading.value = true

    // 创建底图图层
    baseMapLayers['amap-vector'] = new TileLayer({
      source: new XYZ({
        url: 'https://wprd0{1-4}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&x={x}&y={y}&z={z}',
        wrapX: false
      }),
      visible: currentBaseMap.value === 'amap-vector',
      zIndex: 0
    })

    baseMapLayers['amap-satellite'] = new TileLayer({
      source: new XYZ({
        url: 'https://webst0{1-4}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
        wrapX: false
      }),
      visible: currentBaseMap.value === 'amap-satellite',
      zIndex: 0
    })

    baseMapLayers['amap-annotation'] = new TileLayer({
      source: new XYZ({
        url: 'https://webst0{1-4}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}',
        wrapX: false
      }),
      visible: currentBaseMap.value === 'amap-satellite',
      zIndex: 1
    })

    // 创建矢量图层（使用空的source，后续分批添加features）
    const vectorSource = new VectorSource({
      wrapX: false
    })
    
    // 分批加载features，避免一次性加载太多导致卡顿
    const batchSize = 500 // 每批加载500个
    const totalFeatures = props.data.features.length
    console.log(`开始分批加载 ${totalFeatures} 个地块，每批 ${batchSize} 个`)
    
    // 使用异步分批加载
    const loadFeaturesBatch = (startIndex) => {
      const endIndex = Math.min(startIndex + batchSize, totalFeatures)
      const batch = props.data.features.slice(startIndex, endIndex)
      
      try {
        const olFeatures = new GeoJSON().readFeatures({
          type: 'FeatureCollection',
          features: batch
        }, {
          dataProjection: 'EPSG:3857',
          featureProjection: 'EPSG:3857'
        })
        
        vectorSource.addFeatures(olFeatures)
        
        console.log(`已加载 ${endIndex}/${totalFeatures} 个地块`)
        
        // 继续加载下一批
        if (endIndex < totalFeatures) {
          requestAnimationFrame(() => loadFeaturesBatch(endIndex))
        } else {
          console.log('✅ 所有地块加载完成')
          // 缩放到图层范围
          setTimeout(() => {
            if (vectorLayer && map) {
              try {
                const extent = vectorSource.getExtent()
                if (extent && extent.every(val => isFinite(val))) {
                  map.getView().fit(extent, {
                    padding: [50, 50, 50, 50],
                    duration: 500
                  })
                } else {
                  // 如果无法计算extent，使用默认位置（新疆中心）
                  map.getView().setCenter(fromLonLat([87.6, 43.8]))
                  map.getView().setZoom(6)
                }
              } catch (e) {
                console.error('缩放到范围失败:', e)
              }
            }
            mapLoading.value = false
            ElMessage.success(`地图加载完成，共 ${totalFeatures} 个地块`)
          }, 100)
        }
      } catch (error) {
        console.error('加载features失败:', error)
        ElMessage.error('地图加载失败: ' + error.message)
        mapLoading.value = false
      }
    }

    vectorLayer = new VectorLayer({
      source: vectorSource,
      style: (feature) => {
        const changeCount = feature.get('changeCount') || 0
        const color = getColorForChangeCount(changeCount)
        
        // 根据缩放级别动态调整边界宽度
        const zoom = map?.getView().getZoom() || 6
        let strokeWidth = 0.5 // 默认值
        
        if (zoom < 8) {
          strokeWidth = 0.3 // 小缩放级别，更细的边界
        } else if (zoom < 12) {
          strokeWidth = 0.8
        } else if (zoom < 15) {
          strokeWidth = 1.5
        } else {
          strokeWidth = 2
        }
        
        // 精确判断是否为选中的地块
        const featureId = feature.get('id') || feature.get('Id')
        const isSelected = selectedFeatureId.value !== null && featureId === selectedFeatureId.value
        
        if (isSelected) {
          strokeWidth = strokeWidth * 3
        }
        
        return new Style({
          fill: new Fill({
            color: color + 'CC' // 添加透明度 (80%)
          }),
          stroke: new Stroke({
            color: isSelected ? '#409eff' : color,
            width: strokeWidth
          })
        })
      },
      zIndex: 10
    })

    // 创建地图
    map = new Map({
      target: 'temporal-map',
      layers: [
        baseMapLayers['amap-vector'],
        baseMapLayers['amap-satellite'],
        baseMapLayers['amap-annotation'],
        vectorLayer
      ],
      view: new View({
        center: fromLonLat([87.6, 43.8]),
        zoom: 6,
        maxZoom: 18,
        minZoom: 3
      }),
      controls: defaultControls({
        zoom: false,
        attribution: true
      })
    })

    // 添加点击事件
    map.on('click', handleMapClick)

    // 添加缩放事件，动态调整边界样式
    map.getView().on('change:resolution', () => {
      if (vectorLayer) {
        vectorLayer.changed()
      }
    })

    console.log('✅ 地图容器初始化成功，开始加载地块数据...')
    
    // 开始分批加载features
    loadFeaturesBatch(0)
    
  } catch (error) {
    console.error('地图初始化失败:', error)
    ElMessage.error('地图初始化失败: ' + error.message)
    mapLoading.value = false
  }
}

// 处理地图点击
const handleMapClick = (event) => {
  const feature = map.forEachFeatureAtPixel(event.pixel, (feature) => feature)
  
  if (feature) {
    const properties = feature.getProperties()
    const featureId = properties.id || properties.Id
    
    console.log('点击地块，ID:', featureId)
    
    // 从props.data.features中找到完整的feature数据
    const fullFeature = props.data.features.find(f => {
      const fId = f.properties?.id || f.properties?.Id || f.id
      return fId === featureId
    })
    
    if (fullFeature) {
      selectedFeature.value = fullFeature
      selectedFeatureId.value = featureId // 设置选中ID
      console.log('选中地块:', fullFeature)
    } else {
      // 如果找不到，使用当前properties构建
      selectedFeature.value = {
        id: featureId,
        type: 'Feature',
        properties: properties,
        geometry: feature.getGeometry()
      }
      selectedFeatureId.value = featureId
    }
    
    // 更新样式以高亮选中的地块
    vectorLayer.changed()
  } else {
    // 点击空白处取消选中
    selectedFeature.value = null
    selectedFeatureId.value = null
    vectorLayer?.changed()
  }
}

// 选择地块
const handleSelectFeature = (feature) => {
  const featureId = feature.properties?.id || feature.properties?.Id || feature.id
  
  selectedFeature.value = feature
  selectedFeatureId.value = featureId
  
  // 缩放到该地块
  if (vectorLayer) {
    const olFeature = vectorLayer.getSource().getFeatures().find(f => {
      const fId = f.get('id') || f.get('Id')
      return fId === featureId
    })
    
    if (olFeature && map) {
      const extent = olFeature.getGeometry().getExtent()
      map.getView().fit(extent, {
        padding: [100, 100, 100, 100],
        duration: 500
      })
    }
  }
  
  vectorLayer?.changed()
}

// 切换底图
const handleBaseMapChange = () => {
  Object.keys(baseMapLayers).forEach(key => {
    if (baseMapLayers[key]) {
      baseMapLayers[key].setVisible(false)
    }
  })
  
  if (currentBaseMap.value === 'amap-satellite') {
    baseMapLayers['amap-satellite']?.setVisible(true)
    baseMapLayers['amap-annotation']?.setVisible(true)
  } else if (currentBaseMap.value === 'amap-vector') {
    baseMapLayers['amap-vector']?.setVisible(true)
  }
}

// 缩放到范围
const handleZoomToExtent = () => {
  if (vectorLayer && map) {
    const extent = vectorLayer.getSource().getExtent()
    map.getView().fit(extent, {
      padding: [50, 50, 50, 50],
      duration: 500
    })
  }
}

// 时间轴控制函数已删除

// 监听时间变化，更新选中地块的当前作物显示
watch(currentTimeIndex, () => {
  if (selectedFeature.value) {
    // 触发重新渲染
    selectedFeature.value = { ...selectedFeature.value }
  }
})

onMounted(async () => {
  console.log('TemporalChangeMap 挂载')
  console.log('数据结构:', {
    hasData: !!props.data,
    hasFeatures: !!props.data?.features,
    featuresCount: props.data?.features?.length,
    hasTimePoints: !!props.data?.timePoints,
    timePointsCount: props.data?.timePoints?.length,
    hasStats: !!props.data?.stats
  })
  
  // 数据验证
  if (!props.data || !props.data.features || props.data.features.length === 0) {
    ElMessage.error('无效的分析数据：缺少features数据')
    mapLoading.value = false
    return
  }
  
  // 数据量警告
  const featureCount = props.data.features.length
  if (featureCount > 5000) {
    ElMessage.warning(`数据量较大（${featureCount}个地块），地图加载可能需要较长时间，请耐心等待...`)
  }
  
  // 计算详情面板的初始位置（地图容器右侧附近）
  await nextTick()
  
  setTimeout(() => {
    const mapElement = document.getElementById('temporal-map')
    if (mapElement) {
      const rect = mapElement.getBoundingClientRect()
      // 将面板放在地图容器的右侧边缘内侧
      panelPosition.value = {
        x: rect.width - 380, // 距离右边缘20px
        y: 80 // 距离顶部80px
      }
    }
    
    // 延迟初始化地图，给UI响应时间
    requestAnimationFrame(() => {
      initMap()
    })
  }, 200)
})

onBeforeUnmount(() => {
  if (map) {
    map.setTarget(null)
    map = null
  }
})
</script>

<style scoped lang="scss">
.temporal-change-map {
  .map-container {
    width: 100%;
    height: 600px;
    background: #f5f7fa;
    border-radius: 8px;
    position: relative;
    overflow: hidden;
  }

  .detail-panel {
    position: absolute;
    width: 350px;
    max-height: 600px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    z-index: 2000;
    display: flex;
    flex-direction: column;
    border: 2px solid #409eff;

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 6px 6px 0 0;
      cursor: move;
      user-select: none;

      .panel-title {
        display: flex;
        align-items: center;
        gap: 6px;
        color: white;
        font-weight: 600;
        font-size: 14px;
      }

      .el-button {
        color: white;
        &:hover {
          color: #f5f7fa;
        }
      }
    }

    :deep(.el-scrollbar) {
      padding: 16px;
    }
  }

  .map-legend {
    position: absolute;
    top: 80px;
    left: 15px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
    padding: 10px 12px;
    min-width: 150px;
    max-width: 170px;
    backdrop-filter: blur(10px);
    z-index: 100;

    .legend-header {
      font-weight: 600;
      font-size: 14px;
      color: #303133;
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e4e7ed;
    }

    .legend-content {
      .legend-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
        font-size: 12px;

        .legend-color {
          width: 20px;
          height: 14px;
          border-radius: 3px;
          border: 1px solid rgba(0, 0, 0, 0.1);
        }

        .legend-label {
          flex: 1;
          color: #606266;
        }

        .legend-count {
          color: #909399;
          font-size: 11px;
        }
      }
    }
  }

  // 地块变化对话框样式
  :deep(.plot-change-dialog) {
    .el-message-box__message {
      max-height: 500px;
      overflow-y: auto;
    }
  }

  .timeline-controls {
    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .timeline-slider {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;

      .slider-wrapper {
        flex: 1;
      }
    }

    .time-labels {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;

      .time-label {
        flex: 1;
        min-width: 120px;
        padding: 12px;
        background: #f5f7fa;
        border: 2px solid #e4e7ed;
        border-radius: 8px;
        text-align: center;
        cursor: pointer;
        transition: all 0.3s;

        &:hover {
          border-color: #409eff;
          background: #ecf5ff;
        }

        &.active {
          border-color: #409eff;
          background: #409eff;
          color: white;

          .time-label-name,
          .time-label-time {
            color: white;
          }
        }

        .time-label-name {
          font-weight: 600;
          font-size: 14px;
          color: #303133;
          margin-bottom: 4px;
        }

        .time-label-time {
          font-size: 12px;
          color: #909399;
        }
      }
    }
  }

  .stats-list {
    .stat-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;

      .stat-label {
        font-size: 14px;
        color: #606266;
      }

      .stat-value {
        font-size: 24px;
        font-weight: 600;

        &.primary { color: #409eff; }
        &.success { color: #67c23a; }
        &.warning { color: #e6a23c; }
        &.danger { color: #f56c6c; }
        &.info { color: #909399; }
      }
    }
  }

  .plot-detail {
    .detail-section {
      margin-bottom: 16px;

      .section-title {
        font-weight: 600;
        font-size: 14px;
        color: #303133;
        margin-bottom: 12px;
      }

      .detail-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 8px 0;
        font-size: 13px;

        .label {
          color: #909399;
        }

        .value {
          color: #303133;
          font-weight: 500;
        }
      }
    }
  }

  .change-item {
    padding: 12px;
    border-bottom: 1px solid #ebeef5;
    cursor: pointer;
    transition: all 0.3s;
    border-radius: 4px;

    &:hover {
      background: #ecf5ff;
      border-left: 3px solid #409eff;
      padding-left: 9px;
    }

    &:last-child {
      border-bottom: none;
    }

    .change-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      .plot-id {
        font-weight: 600;
        font-size: 14px;
        color: #303133;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .change-item-body {
      .crop-transition {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
      }

      .crop-sequence {
        font-size: 12px;
        color: #606266;
        line-height: 1.5;
        margin-top: 4px;

        .sequence-label {
          color: #909399;
          font-weight: 500;
        }

        .sequence-value {
          color: #303133;
          word-break: break-all;
        }
      }
    }
  }
}
</style>

