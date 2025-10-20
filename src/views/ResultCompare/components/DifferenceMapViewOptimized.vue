<template>
  <div class="difference-map-view">
    <!-- 加载提示 -->
    <el-alert
      v-if="isLargeDataset"
      title="数据量较大"
      type="info"
      :closable="false"
      style="margin-bottom: 16px;"
    >
      检测到地块数量较多（{{ data.features.length }} 个），地图加载可能需要几秒钟，请稍候...
      所有地块都会显示在地图上。
    </el-alert>

    <el-row :gutter="20" style="height: calc(100vh - 200px);">
      <!-- 左侧：地图对比 -->
      <el-col :span="16" style="height: 100%;">
        <el-card shadow="hover" style="height: 100%;">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>{{ data.title }}</span>
              <el-space>
                <el-switch
                  v-model="showCompareMode"
                  active-text="卷帘对比"
                  inactive-text="单图查看"
                />
                <el-tag v-if="showCompareMode" type="info" size="small">
                  拖动中间滑块对比
                </el-tag>
              </el-space>
            </div>
          </template>
          
          <!-- 卷帘对比模式 -->
          <div v-show="showCompareMode" class="map-compare-container" ref="compareContainer">
            <div class="compare-wrapper">
              <!-- 左侧：原始图 -->
              <div class="compare-left" :style="{ width: sliderPosition + '%' }">
                <div id="map-base" class="leaflet-map"></div>
                <div class="map-label map-label-base">
                  原始图: {{ data.baseFile.taskName }}
                </div>
              </div>
              
              <!-- 右侧：对比图（标红变化） -->
              <div class="compare-right">
                <div id="map-compare" class="leaflet-map"></div>
                <div class="map-label map-label-compare">
                  对比图: {{ data.compareFile.taskName }}
                  <el-tag type="danger" size="small" style="margin-left: 8px;">红色=变化</el-tag>
                </div>
              </div>
              
              <!-- 卷帘滑块 -->
              <div 
                class="compare-slider" 
                :style="{ left: sliderPosition + '%' }"
                @mousedown="startDrag"
              >
                <div class="slider-handle">⇆</div>
                <div class="slider-line"></div>
              </div>
            </div>
          </div>
          
          <!-- 单图模式 -->
          <div v-show="!showCompareMode" class="map-single-container">
            <div id="map-result" class="leaflet-map"></div>
            <div class="map-legend">
              <div class="legend-item">
                <span class="legend-color legend-changed"></span>
                <span>有变化 ({{ data.stats.changed }})</span>
              </div>
              <div class="legend-item">
                <span class="legend-color legend-unchanged"></span>
                <span>无变化 ({{ data.stats.unchanged }})</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 右侧：统计和列表 -->
      <el-col :span="8" style="height: 100%; overflow-y: auto;">
        <!-- 统计 -->
        <el-card shadow="hover" style="margin-bottom: 16px;">
          <template #header>变化统计</template>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-label">总地块数</div>
              <div class="stat-value">{{ data.stats.total }}</div>
            </div>
            <div class="stat-item stat-danger">
              <div class="stat-label">有变化</div>
              <div class="stat-value">{{ data.stats.changed }}</div>
            </div>
            <div class="stat-item stat-success">
              <div class="stat-label">无变化</div>
              <div class="stat-value">{{ data.stats.unchanged }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">变化率</div>
              <div class="stat-value">{{ changeRate }}%</div>
            </div>
          </div>
        </el-card>

        <!-- 变化列表 -->
        <el-card shadow="hover">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>变化地块 ({{ changedFeatures.length }})</span>
              <el-button size="small" type="success" @click="exportCSV">
                导出CSV
              </el-button>
            </div>
          </template>
          <el-scrollbar height="400px">
            <div 
              v-for="(feature, index) in changedFeatures.slice(0, 50)" 
              :key="index"
              class="change-item"
              @click="highlightFeature(feature)"
            >
              <div style="font-weight: 600; margin-bottom: 4px;">
                {{ feature.properties.plotName || `地块${index + 1}` }}
              </div>
              <div style="font-size: 12px; color: #606266; margin: 2px 0;">
                <el-tag type="info" size="small">{{ feature.properties.originalCrop }}</el-tag>
                <el-icon style="margin: 0 4px;"><Right /></el-icon>
                <el-tag type="danger" size="small">{{ feature.properties.currentCrop }}</el-tag>
              </div>
              <div style="font-size: 12px; color: #909399;">
                面积: {{ feature.properties.area || 0 }} 亩
              </div>
            </div>
            <div v-if="changedFeatures.length > 50" style="padding: 12px; text-align: center; color: #909399;">
              还有 {{ changedFeatures.length - 50 }} 个变化地块，请导出CSV查看完整列表
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
import { Right } from '@element-plus/icons-vue'

const props = defineProps({
  data: {
    type: Object,
    required: true
  }
})

// 最大渲染要素数（防止卡死）
const maxFeaturesToRender = 10000 // 大幅增加限制，基本不会触发

// 是否为大数据集（仅作为性能提示）
const isLargeDataset = computed(() => {
  return props.data.features.length > 2000 // 超过2000个才显示警告
})

// 地图模式
const showCompareMode = ref(true)

// 卷帘滑块
const sliderPosition = ref(50)
const isDragging = ref(false)
const compareContainer = ref(null)

// Leaflet地图实例
let mapBase = null
let mapCompare = null
let mapResult = null

// 变化地块
const changedFeatures = computed(() => {
  return props.data.features.filter(f => f.properties?.hasChange === true)
})

// 变化率
const changeRate = computed(() => {
  if (props.data.stats.total === 0) return 0
  return ((props.data.stats.changed / props.data.stats.total) * 100).toFixed(1)
})

// 初始化地图
const initMaps = async () => {
  await nextTick()
  
  console.log('🗺️ 开始初始化差异检测地图...')
  console.log('📊 数据验证:', {
    hasData: !!props.data,
    hasFeatures: !!props.data?.features,
    featuresCount: props.data?.features?.length,
    hasStats: !!props.data?.stats,
    hasBaseFile: !!props.data?.baseFile,
    hasCompareFile: !!props.data?.compareFile
  })
  
  // 数据验证
  if (!props.data || !props.data.features || props.data.features.length === 0) {
    ElMessage.error('无效的差异检测数据：缺少地块数据')
    console.error('❌ 数据无效:', props.data)
    return
  }
  
  if (typeof L === 'undefined') {
    ElMessage.error('地图库加载失败，请刷新页面')
    return
  }
  
  // 检查地图容器是否存在
  const mapBaseContainer = document.getElementById('map-base')
  const mapCompareContainer = document.getElementById('map-compare')
  const mapResultContainer = document.getElementById('map-result')
  
  if (!mapBaseContainer || !mapCompareContainer || !mapResultContainer) {
    console.error('地图容器未找到，延迟初始化')
    setTimeout(initMaps, 300)
    return
  }
  
  // 如果地图已存在，先销毁
  if (mapBase) {
    mapBase.remove()
    mapBase = null
  }
  if (mapCompare) {
    mapCompare.remove()
    mapCompare = null
  }
  if (mapResult) {
    mapResult.remove()
    mapResult = null
  }
  
  try {
    // 使用所有地块进行渲染（不再限制数量）
    const featuresToRender = props.data.features
    
    console.log(`✅ 将渲染所有 ${featuresToRender.length} 个地块`)
    
    // 大数据集警告和性能提示
    if (featuresToRender.length > 5000) {
      ElMessage.warning(`数据量很大（${featuresToRender.length}个地块），地图加载可能需要较长时间，请耐心等待...`)
    } else if (isLargeDataset.value) {
      console.warn(`⚠️ 数据量较大（${featuresToRender.length}个地块），渲染可能需要几秒钟`)
    }
    
    // 计算边界和中心点（基于所有地块）
    const bounds = calculateBounds(featuresToRender)
    const center = calculateCenter(featuresToRender)
    console.log('🗺️ 地图中心点:', center)
    console.log('📍 地图边界:', bounds)
    
    // 初始化原始图
    mapBase = L.map('map-base', {
      center: center,
      zoom: 12,
      zoomControl: true,
      preferCanvas: true, // 使用Canvas渲染，性能更好
      renderer: L.canvas({ tolerance: 5, padding: 0.5 }) // 优化Canvas渲染器
    })
    
    // 自动定位到数据区域
    if (bounds) {
      mapBase.fitBounds(bounds, { padding: [50, 50] })
    }
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(mapBase)
    
    // 添加原始图数据（显示所有地块，统一浅蓝色样式）
    L.geoJSON(featuresToRender, {
      coordsToLatLng: (coords) => {
        const [lng, lat] = mercatorToLatLng(coords[0], coords[1])
        return L.latLng(lat, lng)
      },
      style: {
        color: '#409EFF',
        weight: 2,
        fillColor: '#ADD8E6',  // 浅蓝色填充
        fillOpacity: 0.5
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties
        layer.bindPopup(`
          <div style="min-width: 180px;">
            <strong>${props.plotName || '地块'}</strong><br>
            <hr style="margin: 6px 0;">
            原始作物: ${props.originalCrop}<br>
            面积: ${props.area || 0} 亩
          </div>
        `)
      }
    }).addTo(mapBase)
    
    // 初始化对比图
    mapCompare = L.map('map-compare', {
      center: center,
      zoom: 12,
      zoomControl: true,
      preferCanvas: true,
      renderer: L.canvas({ tolerance: 5, padding: 0.5 })
    })
    
    // 自动定位到数据区域
    if (bounds) {
      mapCompare.fitBounds(bounds, { padding: [50, 50] })
    }
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(mapCompare)
    
    // 添加对比图数据（变化=红色，未变化=绿色）
    L.geoJSON(featuresToRender, {
      coordsToLatLng: (coords) => {
        const [lng, lat] = mercatorToLatLng(coords[0], coords[1])
        return L.latLng(lat, lng)
      },
      style: (feature) => {
        const hasChange = feature.properties?.hasChange
        return {
          color: hasChange ? '#f56c6c' : '#67c23a',
          weight: 1,
          fillColor: hasChange ? '#f56c6c' : '#67c23a',
          fillOpacity: hasChange ? 0.6 : 0.3
        }
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties
        layer.bindPopup(`
          <div style="min-width: 180px;">
            <strong>${props.plotName || '地块'}</strong><br>
            <hr style="margin: 6px 0;">
            原始: ${props.originalCrop}<br>
            当前: ${props.currentCrop}<br>
            状态: <span style="color: ${props.hasChange ? '#f56c6c' : '#67c23a'}">
              ${props.hasChange ? '有变化' : '无变化'}
            </span>
          </div>
        `)
      }
    }).addTo(mapCompare)
    
    // 同步地图视图
    mapBase.on('move', () => {
      mapCompare.setView(mapBase.getCenter(), mapBase.getZoom(), { animate: false })
    })
    mapCompare.on('move', () => {
      mapBase.setView(mapCompare.getCenter(), mapCompare.getZoom(), { animate: false })
    })
    
    // 初始化结果图
    mapResult = L.map('map-result', {
      center: center,
      zoom: 12,
      zoomControl: true,
      preferCanvas: true,
      renderer: L.canvas({ tolerance: 5, padding: 0.5 })
    })
    
    // 自动定位到数据区域
    if (bounds) {
      mapResult.fitBounds(bounds, { padding: [50, 50] })
    }
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(mapResult)
    
    L.geoJSON(featuresToRender, {
      coordsToLatLng: (coords) => {
        const [lng, lat] = mercatorToLatLng(coords[0], coords[1])
        return L.latLng(lat, lng)
      },
      style: (feature) => {
        const hasChange = feature.properties?.hasChange
        return {
          color: hasChange ? '#f56c6c' : '#67c23a',
          weight: 2,
          fillColor: hasChange ? '#f56c6c' : '#67c23a',
          fillOpacity: 0.5
        }
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties
        layer.bindPopup(`
          <div style="min-width: 200px;">
            <strong style="font-size: 14px;">${props.plotName || '地块'}</strong><br>
            <hr style="margin: 8px 0;">
            原始作物: <strong>${props.originalCrop}</strong><br>
            当前作物: <strong>${props.currentCrop}</strong><br>
            面积: ${props.area || 0} 亩<br>
            状态: <span style="color: ${props.hasChange ? '#f56c6c' : '#67c23a'}; font-weight: 600;">
              ${props.hasChange ? '有变化' : '无变化'}
            </span>
          </div>
        `)
      }
    }).addTo(mapResult)
    
    console.log('地图初始化完成')
    
    // 初始化完成后设置地图尺寸（多次调用确保生效）
    setTimeout(() => {
      updateMapSizes()
    }, 100)
    
    setTimeout(() => {
      updateMapSizes()
    }, 500)
  } catch (error) {
    console.error('地图初始化失败:', error)
    ElMessage.error('地图加载失败: ' + error.message)
  }
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

// 计算地块的边界（可指定要计算的features，默认使用所有features）
const calculateBounds = (featuresToCalc = null) => {
  const features = featuresToCalc || props.data.features
  if (!features || features.length === 0) {
    return null
  }
  
  let minLat = Infinity, maxLat = -Infinity
  let minLng = Infinity, maxLng = -Infinity
  
  features.forEach(feature => {
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
  
  console.log(`计算的边界 (${features.length}个地块):`, { minLat, maxLat, minLng, maxLng })
  return [[minLat, minLng], [maxLat, maxLng]]
}

// 计算中心点（可指定要计算的features）
const calculateCenter = (featuresToCalc = null) => {
  const bounds = calculateBounds(featuresToCalc)
  if (!bounds) return [39.9, 116.4]
  
  const [[minLat, minLng], [maxLat, maxLng]] = bounds
  return [(minLat + maxLat) / 2, (minLng + maxLng) / 2]
}

// 卷帘拖动
const startDrag = (e) => {
  isDragging.value = true
  e.preventDefault()
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'
}

const onDrag = (e) => {
  if (!isDragging.value || !compareContainer.value) return
  const rect = compareContainer.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const percentage = (x / rect.width) * 100
  sliderPosition.value = Math.max(10, Math.min(90, percentage))
  
  // 确保左侧地图容器保持全宽
  updateMapSizes()
}

// 更新地图尺寸，确保两侧地图都保持全宽
const updateMapSizes = () => {
  nextTick(() => {
    const leftMapDiv = document.getElementById('map-base')
    const rightMapDiv = document.getElementById('map-compare')
    const wrapperDiv = document.querySelector('.compare-wrapper')
    
    if (wrapperDiv) {
      const fullWidth = wrapperDiv.offsetWidth
      
      // 让两个地图div都保持wrapper的全宽
      if (leftMapDiv) {
        leftMapDiv.style.width = fullWidth + 'px'
      }
      if (rightMapDiv) {
        rightMapDiv.style.width = fullWidth + 'px'
      }
    }
    
    // 刷新地图尺寸
    if (mapBase) mapBase.invalidateSize()
    if (mapCompare) mapCompare.invalidateSize()
  })
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// 高亮地块
const highlightFeature = (feature) => {
  showCompareMode.value = false
  nextTick(() => {
    if (mapResult) {
      mapResult.eachLayer(layer => {
        if (layer.feature && layer.feature.properties.plotId === feature.properties.plotId) {
          layer.openPopup()
        }
      })
    }
  })
}

// 导出CSV
const exportCSV = () => {
  try {
    let csvContent = '\uFEFF'
    csvContent += '序号,地块ID,地块名称,原始作物,当前作物,面积(亩)\n'
    
    changedFeatures.value.forEach((feature, index) => {
      const props = feature.properties
      csvContent += `${index + 1},${props.plotId || ''},${props.plotName || ''},${props.originalCrop || ''},${props.currentCrop || ''},${props.area || 0}\n`
    })
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `差异检测_${props.data.title}_${Date.now()}.csv`
    link.click()
    
    ElMessage.success('CSV已导出')
  } catch (error) {
    ElMessage.error('导出失败: ' + error.message)
  }
}

// 监听模式切换
watch(showCompareMode, async () => {
  await nextTick()
  if (showCompareMode.value) {
    // 切换到卷帘对比模式时，更新地图尺寸
    updateMapSizes()
  } else {
    if (mapResult) mapResult.invalidateSize()
  }
})

// 组件挂载
onMounted(() => {
  setTimeout(() => {
    initMaps()
  }, 200)
})

// 组件卸载
onUnmounted(() => {
  if (isDragging.value) stopDrag()
  if (mapBase) mapBase.remove()
  if (mapCompare) mapCompare.remove()
  if (mapResult) mapResult.remove()
})
</script>

<style scoped lang="scss">
.difference-map-view {
  .leaflet-map {
    width: 100%;
    height: calc(100vh - 280px);
    border-radius: 4px;
  }
  
  .map-compare-container {
    width: 100%;
    height: calc(100vh - 280px);
    position: relative;
    overflow: hidden;
    border-radius: 4px;
    
    .compare-wrapper {
      width: 100%;
      height: 100%;
      position: relative;
      
      .compare-left {
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        overflow: hidden; // 裁剪超出的地图部分
        z-index: 2;
        
        #map-base {
          // 地图div会通过JS动态设置为wrapper的全宽
          // 这样即使容器宽度变化，地图也不会留白
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
        }
        
        .map-label-base {
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(64, 158, 255, 0.95);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: 600;
          z-index: 1000;
          white-space: nowrap;
          font-size: 13px;
        }
      }
      
      .compare-right {
        position: absolute;
        right: 0;
        top: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
        
        #map-compare {
          // 右侧地图也需要保持全宽
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
        }
        
        .map-label-compare {
          position: absolute;
          top: 10px;
          right: 20px;
          background: rgba(245, 108, 108, 0.95);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: 600;
          z-index: 1000;
          white-space: nowrap;
          font-size: 13px;
        }
      }
      
      .compare-slider {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 4px;
        cursor: ew-resize;
        z-index: 100;
        transform: translateX(-50%);
        
        .slider-handle {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 48px;
          height: 48px;
          background: white;
          border: 3px solid #409EFF;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: ew-resize;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
          font-size: 20px;
          color: #409EFF;
          z-index: 101;
          transition: transform 0.2s;
          
          &:hover {
            transform: translate(-50%, -50%) scale(1.15);
          }
        }
        
        .slider-line {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 50%;
          width: 3px;
          background: rgba(64, 158, 255, 0.8);
          transform: translateX(-50%);
          box-shadow: 0 0 10px rgba(64, 158, 255, 0.5);
        }
      }
    }
  }
  
  .map-single-container {
    position: relative;
    
    .map-legend {
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(255, 255, 255, 0.95);
      padding: 12px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      
      .legend-item {
        display: flex;
        align-items: center;
        margin: 6px 0;
        font-size: 13px;
        
        .legend-color {
          width: 20px;
          height: 12px;
          border-radius: 3px;
          margin-right: 8px;
          
          &.legend-changed {
            background: #f56c6c;
          }
          
          &.legend-unchanged {
            background: #67c23a;
          }
        }
      }
    }
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    
    .stat-item {
      text-align: center;
      padding: 12px;
      background: #f5f7fa;
      border-radius: 8px;
      border-left: 4px solid #409EFF;
      
      &.stat-danger {
        border-left-color: #f56c6c;
      }
      
      &.stat-success {
        border-left-color: #67c23a;
      }
      
      .stat-label {
        font-size: 13px;
        color: #909399;
        margin-bottom: 8px;
      }
      
      .stat-value {
        font-size: 24px;
        font-weight: 600;
        color: #303133;
      }
    }
  }
  
  .change-item {
    padding: 12px;
    border-bottom: 1px solid #ebeef5;
    cursor: pointer;
    transition: all 0.2s;
    
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

