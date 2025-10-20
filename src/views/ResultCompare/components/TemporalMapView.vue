<template>
  <div class="temporal-map-view">
    <el-row :gutter="20" style="height: 100%;">
      <!-- 地图区域 -->
      <el-col :span="18" style="height: 100%;">
        <el-card shadow="hover" style="height: 100%;">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>{{ data.title }} - 第 {{ currentTimeIndex + 1 }} / {{ data.timePoints.length }} 期</span>
              <div>
                <span style="margin-right: 12px; color: #606266;">
                  {{ currentTimePoint.taskName || `时间点${currentTimeIndex + 1}` }}
                </span>
                <el-tag type="info" size="small">{{ formatTime(currentTimePoint.time) }}</el-tag>
              </div>
            </div>
          </template>
          
          <!-- 地图 -->
          <div id="map-temporal" class="leaflet-map"></div>
          
          <!-- 作物颜色图例 -->
          <div class="crop-legend">
            <div class="legend-title">作物类型</div>
            <div 
              v-for="(color, crop) in cropColorMap" 
              :key="crop"
              class="legend-item"
            >
              <span class="legend-color" :style="{ backgroundColor: color }"></span>
              <span class="legend-text">{{ crop }}</span>
            </div>
          </div>
          
          <!-- 时间轴控制 -->
          <div class="timeline-controls">
            <el-button 
              size="small" 
              :disabled="currentTimeIndex === 0"
              @click="prevTime"
              :icon="ArrowLeft"
            >
              上一期
            </el-button>
            
            <div class="slider-wrapper">
              <el-slider 
                v-model="currentTimeIndex" 
                :min="0" 
                :max="data.timePoints.length - 1"
                :marks="timeMarks"
                :show-tooltip="false"
                @change="handleTimeChange"
              />
            </div>
            
            <el-button 
              size="small" 
              :disabled="currentTimeIndex === data.timePoints.length - 1"
              @click="nextTime"
              :icon="ArrowRight"
            >
              下一期
            </el-button>
          </div>
          
          <!-- 时间点标签 -->
          <div class="time-labels">
            <div 
              v-for="(point, index) in data.timePoints" 
              :key="index"
              class="time-label"
              :class="{ active: currentTimeIndex === index }"
              @click="jumpToTime(index)"
            >
              <div class="time-label-name">{{ point.taskName || `期${index + 1}` }}</div>
              <div class="time-label-time">{{ formatTime(point.time) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 统计侧边栏 -->
      <el-col :span="6" style="height: 100%; overflow-y: auto;">
        <el-card shadow="hover">
          <template #header>变化统计</template>
          <div class="stats-list">
            <div class="stat-item">
              <div>总地块数</div>
              <div class="stat-value">{{ data.stats.total }}</div>
            </div>
            <el-divider />
            <div class="stat-item">
              <div>有变化</div>
              <div class="stat-value warning">{{ data.stats.changed }}</div>
            </div>
            <el-divider />
            <div class="stat-item">
              <div>无变化</div>
              <div class="stat-value success">{{ data.stats.unchanged }}</div>
            </div>
            <el-divider />
            <div class="stat-item">
              <div>时间跨度</div>
              <div class="stat-value primary">{{ data.timePoints.length }} 期</div>
            </div>
          </div>
        </el-card>

        <!-- 变化地块列表 -->
        <el-card shadow="hover" style="margin-top: 16px;">
          <template #header>变化地块列表 ({{ changedFeatures.length }})</template>
          <el-scrollbar height="400px">
            <div 
              v-for="(feature, index) in changedFeatures" 
              :key="index"
              class="change-item"
              @click="highlightFeature(feature)"
            >
              <div style="font-weight: 600; margin-bottom: 6px;">
                {{ feature.properties.plotName || `地块${index + 1}` }}
              </div>
              <div style="font-size: 12px; color: #909399; margin: 4px 0;">
                变化次数: {{ feature.properties.changeCount }} 次
              </div>
              <div style="font-size: 12px;">
                <el-tag 
                  v-for="(point, idx) in feature.properties.timeline.slice(0, 2)" 
                  :key="idx"
                  size="small"
                  style="margin: 2px;"
                >
                  {{ point.crop }}
                </el-tag>
                <span v-if="feature.properties.timeline.length > 2" style="color: #909399;">...</span>
              </div>
            </div>
            <el-empty v-if="changedFeatures.length === 0" description="无变化地块" />
          </el-scrollbar>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

const props = defineProps({
  data: {
    type: Object,
    required: true
  }
})

// 当前时间索引
const currentTimeIndex = ref(0)

// Leaflet地图实例
let map = null
let currentLayer = null

// 作物颜色映射（根据gridcode或作物名称）
const cropColorMap = ref({})

// 预定义的颜色列表
const colorPalette = [
  '#FF6B6B', // 红色
  '#4ECDC4', // 青色
  '#45B7D1', // 蓝色
  '#FFA07A', // 浅橙色
  '#98D8C8', // 薄荷绿
  '#F7DC6F', // 黄色
  '#BB8FCE', // 紫色
  '#85C1E2', // 天蓝色
  '#F8B195', // 粉橙色
  '#C06C84', // 玫瑰色
  '#6C5B7B', // 深紫色
  '#355C7D', // 深蓝色
]

// 初始化作物颜色映射
const initCropColors = () => {
  const cropSet = new Set()
  
  // 收集所有出现的作物类型
  props.data.timePoints.forEach(timePoint => {
    if (timePoint.geojson && timePoint.geojson.features) {
      timePoint.geojson.features.forEach(feature => {
        const props = feature.properties
        const gridcode = props.gridcode || props.GRIDCODE
        if (gridcode !== undefined) {
          cropSet.add(`作物${gridcode}`)
        } else {
          const crop = props.label || props.crop || props.class || '未知'
          cropSet.add(crop)
        }
      })
    }
  })
  
  // 为每个作物分配颜色
  const crops = Array.from(cropSet).sort()
  crops.forEach((crop, index) => {
    cropColorMap.value[crop] = colorPalette[index % colorPalette.length]
  })
  
  console.log('作物颜色映射:', cropColorMap.value)
}

// 获取作物颜色
const getCropColor = (feature) => {
  const props = feature.properties
  const gridcode = props.gridcode || props.GRIDCODE
  const crop = gridcode !== undefined 
    ? `作物${gridcode}` 
    : (props.label || props.crop || props.class || '未知')
  
  const color = cropColorMap.value[crop] || '#999999'
  return color
}

// 当前时间点
const currentTimePoint = computed(() => {
  return props.data.timePoints[currentTimeIndex.value] || {}
})

// 有变化的要素
const changedFeatures = computed(() => {
  return props.data.features.filter(f => f.properties?.hasChange === true).slice(0, 20)
})

// 时间轴标记
const timeMarks = computed(() => {
  const marks = {}
  props.data.timePoints.forEach((point, index) => {
    marks[index] = ''
  })
  return marks
})

// 初始化地图
const initMap = () => {
  console.log('初始化时序分析地图...')
  
  if (typeof L === 'undefined') {
    console.error('Leaflet未加载')
    return
  }
  
  // 检查地图容器是否存在
  const mapContainer = document.getElementById('map-temporal')
  if (!mapContainer) {
    console.error('地图容器未找到，延迟初始化')
    setTimeout(initMap, 200)
    return
  }
  
  // 如果地图已存在，先销毁
  if (map) {
    map.remove()
    map = null
  }
  
  // 初始化作物颜色
  initCropColors()
  
  const geojson = props.data.timePoints[0].geojson
  const center = calculateCenter(geojson)
  const bounds = calculateBounds(geojson)
  
  map = L.map('map-temporal', {
    center: center,
    zoom: 10,
    zoomControl: true,
    preferCanvas: true
  })
  
  // 自动定位到数据区域
  if (bounds) {
    map.fitBounds(bounds, { padding: [50, 50] })
    console.log('地图已自动定位到数据区域')
  }
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map)
  
  // 加载第一个时间点的数据
  loadTimePoint(0)
  
  console.log('时序地图初始化完成')
}

// 加载指定时间点的数据
const loadTimePoint = (timeIndex) => {
  console.log('🔄 loadTimePoint 被调用, timeIndex:', timeIndex)
  
  if (!map) {
    console.warn('⚠️ 地图未初始化，无法加载时间点')
    return
  }
  
  // 移除旧图层
  if (currentLayer) {
    map.removeLayer(currentLayer)
    console.log('✅ 已移除旧图层')
  }
  
  const timePoint = props.data.timePoints[timeIndex]
  console.log('📊 当前时间点数据:', timePoint)
  
  if (!timePoint) {
    console.error('❌ 时间点数据不存在:', timeIndex)
    return
  }
  
  if (!timePoint.geojson) {
    console.error('❌ 时间点缺少geojson数据')
    return
  }
  
  console.log('📦 GeoJSON特征数量:', timePoint.geojson.features?.length || 0)
  
  // 添加新图层（按作物类型着色）
  currentLayer = L.geoJSON(timePoint.geojson, {
    coordsToLatLng: (coords) => {
      const [lng, lat] = mercatorToLatLng(coords[0], coords[1])
      return L.latLng(lat, lng)
    },
    style: (feature) => {
      // 根据作物类型获取颜色
      const color = getCropColor(feature)
      
      const style = {
        color: color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.6
      }
      
      return style
    },
    onEachFeature: (feature, layer) => {
      const featureProps = feature.properties
      const plotId = String(featureProps?.FID || featureProps?.id || featureProps?.plotId || '')
      const analysisFeature = props.data.features.find(f => f.properties.plotId === plotId)
      
      // 获取gridcode并显示
      const gridcode = featureProps.gridcode || featureProps.GRIDCODE
      const crop = gridcode !== undefined ? `作物${gridcode}` : (featureProps.label || featureProps.crop || '未知')
      
      let popupContent = `
        <div style="min-width: 200px;">
          <strong style="font-size: 14px;">${featureProps.plotName || featureProps.name || '未命名地块'}</strong><br>
          <hr style="margin: 8px 0;">
          <div style="margin: 4px 0;">
            <span style="color: #909399;">当前作物:</span>
            <strong>${crop}</strong>
          </div>
      `
      
      if (analysisFeature && analysisFeature.properties.timeline) {
        const timeline = analysisFeature.properties.timeline
        popupContent += `
          <hr style="margin: 8px 0;">
          <div style="font-size: 12px; color: #909399;">时序变化:</div>
        `
        timeline.forEach((t, idx) => {
          popupContent += `
            <div style="font-size: 12px; margin: 2px 0; ${idx === timeIndex ? 'color: #409EFF; font-weight: 600;' : ''}">
              ${formatTime(t.time)}: ${t.crop}
            </div>
          `
        })
      }
      
      popupContent += '</div>'
      layer.bindPopup(popupContent)
    }
  }).addTo(map)
  
  console.log('✅ 新图层已添加到地图, 时间点:', timeIndex)
  console.log('🎨 当前作物颜色映射:', cropColorMap.value)
}

// 坐标转换：从Web Mercator (EPSG:3857) 转为 WGS84 (EPSG:4326)
const mercatorToLatLng = (x, y) => {
  // 检查是否是投影坐标（值通常很大）
  if (Math.abs(x) > 180 || Math.abs(y) > 90) {
    // Web Mercator转换公式
    const lng = (x / 20037508.34) * 180
    let lat = (y / 20037508.34) * 180
    lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2)
    return [lng, lat]
  }
  // 已经是经纬度坐标
  return [x, y]
}

// 计算边界
const calculateBounds = (geojson) => {
  if (!geojson || !geojson.features || geojson.features.length === 0) {
    return null
  }
  
  let minLat = Infinity, maxLat = -Infinity
  let minLng = Infinity, maxLng = -Infinity
  
  geojson.features.forEach(feature => {
    const geom = feature.geometry
    if (!geom) return
    
    if (geom.type === 'Point') {
      const [x, y] = geom.coordinates
      const [lng, lat] = mercatorToLatLng(x, y)
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
      minLng = Math.min(minLng, lng)
      maxLng = Math.max(maxLng, lng)
    } else if (geom.type === 'Polygon') {
      geom.coordinates[0].forEach(([x, y]) => {
        const [lng, lat] = mercatorToLatLng(x, y)
        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
        minLng = Math.min(minLng, lng)
        maxLng = Math.max(maxLng, lng)
      })
    } else if (geom.type === 'MultiPolygon') {
      geom.coordinates.forEach(polygon => {
        polygon[0].forEach(([x, y]) => {
          const [lng, lat] = mercatorToLatLng(x, y)
          minLat = Math.min(minLat, lat)
          maxLat = Math.max(maxLat, lat)
          minLng = Math.min(minLng, lng)
          maxLng = Math.max(maxLng, lng)
        })
      })
    }
  })
  
  if (minLat === Infinity) return null
  
  return [[minLat, minLng], [maxLat, maxLng]]
}

// 计算中心点
const calculateCenter = (geojson) => {
  const bounds = calculateBounds(geojson)
  if (!bounds) return [39.9, 116.4]
  
  const [[minLat, minLng], [maxLat, maxLng]] = bounds
  return [(minLat + maxLat) / 2, (minLng + maxLng) / 2]
}

// 格式化时间
const formatTime = (timeStr) => {
  if (!timeStr) return ''
  return timeStr.split(' ')[0] || timeStr
}

// 时间变化
const handleTimeChange = (value) => {
  console.log('时间轴变化:', value)
  currentTimeIndex.value = value
}

// 上一期
const prevTime = () => {
  if (currentTimeIndex.value > 0) {
    currentTimeIndex.value--
    console.log('切换到上一期:', currentTimeIndex.value)
  }
}

// 下一期
const nextTime = () => {
  if (currentTimeIndex.value < props.data.timePoints.length - 1) {
    currentTimeIndex.value++
    console.log('切换到下一期:', currentTimeIndex.value)
  }
}

// 跳转到指定时间
const jumpToTime = (index) => {
  console.log('跳转到时间点:', index)
  currentTimeIndex.value = index
}

// 高亮要素
const highlightFeature = (feature) => {
  if (map && currentLayer) {
    currentLayer.eachLayer(layer => {
      const layerPlotId = String(layer.feature.properties?.FID || layer.feature.properties?.id || layer.feature.properties?.plotId || '')
      if (layerPlotId === feature.properties.plotId) {
        layer.openPopup()
        map.fitBounds(layer.getBounds())
      }
    })
  }
}

// 监听时间索引变化
watch(currentTimeIndex, (newIndex, oldIndex) => {
  console.log('⏰ 时间索引变化:', oldIndex, '=>', newIndex)
  if (map) {
    loadTimePoint(newIndex)
  } else {
    console.warn('⚠️ watch触发但地图未初始化')
  }
})

// 组件挂载
onMounted(async () => {
  await nextTick()
  setTimeout(() => {
    initMap()
  }, 100)
})

// 组件卸载
onUnmounted(() => {
  if (map) map.remove()
})
</script>

<style scoped lang="scss">
.temporal-map-view {
  height: 100%;
  
  .leaflet-map {
    width: 100%;
    height: calc(100vh - 400px);
    border-radius: 4px;
    position: relative;
  }
  
  .crop-legend {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(255, 255, 255, 0.95);
    padding: 12px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    max-height: 300px;
    overflow-y: auto;
    
    .legend-title {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 8px;
      color: #303133;
      border-bottom: 2px solid #409EFF;
      padding-bottom: 4px;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      margin: 6px 0;
      font-size: 12px;
      
      .legend-color {
        width: 20px;
        height: 12px;
        border-radius: 3px;
        margin-right: 8px;
        border: 1px solid rgba(0, 0, 0, 0.1);
      }
      
      .legend-text {
        color: #606266;
      }
    }
  }
  
  .timeline-controls {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 20px;
    padding: 16px;
    background: #f5f7fa;
    border-radius: 4px;
    
    .slider-wrapper {
      flex: 1;
    }
  }
  
  .time-labels {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 16px;
    flex-wrap: wrap;
    
    .time-label {
      flex: 1;
      min-width: 100px;
      padding: 12px;
      background: white;
      border: 2px solid #e4e7ed;
      border-radius: 8px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s;
      
      &:hover {
        border-color: #409EFF;
        background: #ecf5ff;
      }
      
      &.active {
        border-color: #409EFF;
        background: #409EFF;
        color: white;
        
        .time-label-name,
        .time-label-time {
          color: white;
        }
      }
      
      .time-label-name {
        font-weight: 600;
        font-size: 13px;
        margin-bottom: 4px;
      }
      
      .time-label-time {
        font-size: 11px;
        color: #909399;
      }
    }
  }
  
  .stats-list {
    .stat-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      
      .stat-value {
        font-size: 24px;
        font-weight: 600;
        color: #409EFF;
        
        &.warning {
          color: #E6A23C;
        }
        
        &.success {
          color: #67C23A;
        }
        
        &.primary {
          color: #409EFF;
        }
      }
    }
  }
  
  .change-item {
    padding: 12px;
    border-bottom: 1px solid #ebeef5;
    cursor: pointer;
    transition: all 0.3s;
    
    &:hover {
      background: #f5f7fa;
      transform: translateX(4px);
    }
    
    &:last-child {
      border-bottom: none;
    }
  }
}
</style>

