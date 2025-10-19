<template>
  <div class="difference-view">
    <!-- 视图模式切换 -->
    <div style="margin-bottom: 20px; text-align: center;">
      <el-radio-group v-model="viewMode">
        <el-radio-button value="map">地图视图</el-radio-button>
        <el-radio-button value="statistics">统计报表</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 地图视图 -->
    <el-card v-show="viewMode === 'map'" shadow="hover">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>{{ data.title }}</span>
          <el-space>
            <el-radio-group v-model="mapMode" size="small">
              <el-radio-button value="single">单图模式</el-radio-button>
              <el-radio-button value="compare">双图对比</el-radio-button>
            </el-radio-group>
            <el-button size="small" @click="handleExport">导出数据</el-button>
          </el-space>
        </div>
      </template>
      
      <el-row :gutter="20">
        <!-- 地图区域 -->
        <el-col :span="18">
          <!-- 单图模式 -->
          <div v-if="mapMode === 'single'" class="map-container">
            <div class="map-placeholder">
              <div class="map-info">
                <div style="font-size: 16px; margin-bottom: 8px; font-weight: 600;">差异检测结果</div>
                <div style="font-size: 14px; color: #606266;">
                  <el-tag type="danger" size="small">红色</el-tag> 有变化 |
                  <el-tag type="success" size="small">绿色</el-tag> 无变化
                </div>
              </div>
              
              <!-- 地块网格（真实数据） -->
              <div class="plot-grid">
                <div 
                  v-for="(feature, index) in displayFeatures" 
                  :key="index"
                  class="plot-item"
                  :class="{ 
                    'plot-changed': feature.properties.hasChange,
                    'plot-unchanged': !feature.properties.hasChange
                  }"
                  @mouseenter="hoveredFeature = feature"
                  @mouseleave="hoveredFeature = null"
                >
                  <div class="plot-label">{{ feature.properties.plotName || `地块${index + 1}` }}</div>
                </div>
              </div>

              <!-- 悬停提示 -->
              <div v-if="hoveredFeature" class="plot-tooltip">
                <div style="font-weight: 600; margin-bottom: 8px; font-size: 16px;">
                  {{ hoveredFeature.properties.plotName || '未命名地块' }}
                </div>
                <el-divider style="margin: 8px 0;" />
                <div style="margin: 6px 0;">
                  <span style="color: #909399;">原始作物:</span>
                  <el-tag size="small" style="margin-left: 8px;">{{ hoveredFeature.properties.originalCrop }}</el-tag>
                </div>
                <div style="margin: 6px 0;">
                  <span style="color: #909399;">当前作物:</span>
                  <el-tag size="small" style="margin-left: 8px;">{{ hoveredFeature.properties.currentCrop }}</el-tag>
                </div>
                <div style="margin: 6px 0;">
                  <span style="color: #909399;">面积:</span>
                  <span style="margin-left: 8px;">{{ hoveredFeature.properties.area || 0 }} 亩</span>
                </div>
                <div style="margin: 6px 0;">
                  <span style="color: #909399;">状态:</span>
                  <el-tag 
                    :type="hoveredFeature.properties.hasChange ? 'danger' : 'success'" 
                    size="small" 
                    style="margin-left: 8px;"
                  >
                    {{ hoveredFeature.properties.hasChange ? '有变化' : '无变化' }}
                  </el-tag>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 双图对比模式（卷帘效果） -->
          <div v-else class="map-compare-container" ref="compareContainer">
            <div class="compare-wrapper">
              <!-- 左侧：原始图 -->
              <div class="compare-left" :style="{ width: sliderPosition + '%' }">
                <div class="map-placeholder">
                  <div class="map-label map-label-left">原始图: {{ data.baseFile }}</div>
                  <div class="plot-grid">
                    <div 
                      v-for="(feature, index) in displayFeatures" 
                      :key="'left-' + index"
                      class="plot-item plot-original"
                    >
                      <div class="plot-label">{{ feature.properties.originalCrop || '未知' }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 右侧：对比图 -->
              <div class="compare-right">
                <div class="map-placeholder">
                  <div class="map-label map-label-right">对比图: {{ data.compareFile }}</div>
                  <div class="plot-grid">
                    <div 
                      v-for="(feature, index) in displayFeatures" 
                      :key="'right-' + index"
                      class="plot-item"
                      :class="{ 
                        'plot-changed': feature.properties.hasChange,
                        'plot-unchanged': !feature.properties.hasChange
                      }"
                    >
                      <div class="plot-label">{{ feature.properties.currentCrop || '未知' }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 可拖动分隔线 -->
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
        </el-col>

        <!-- 统计侧边栏 -->
        <el-col :span="6">
          <el-card shadow="hover">
            <template #header>变化统计</template>
            <div class="stats-list">
              <div class="stat-item">
                <div>总地块数</div>
                <div class="stat-value">{{ data.stats.total }}</div>
              </div>
              <el-divider />
              <div class="stat-item">
                <div>变化地块</div>
                <div class="stat-value danger">{{ data.stats.changed }}</div>
              </div>
              <el-divider />
              <div class="stat-item">
                <div>无变化</div>
                <div class="stat-value success">{{ data.stats.unchanged }}</div>
              </div>
            </div>
          </el-card>

          <!-- 变化列表 -->
          <el-card shadow="hover" style="margin-top: 16px;">
            <template #header>变化地块列表</template>
            <el-scrollbar height="400px">
              <div 
                v-for="(feature, index) in data.changedFeatures" 
                :key="index"
                class="change-item"
              >
                <div style="font-weight: 600; margin-bottom: 4px;">
                  {{ feature.properties.plotName || `地块${index + 1}` }}
                </div>
                <div style="font-size: 12px; color: #909399;">
                  {{ feature.properties.originalCrop }} → {{ feature.properties.currentCrop }}
                </div>
                <div style="font-size: 12px; color: #909399;">
                  面积: {{ feature.properties.area || 0 }} 亩
                </div>
              </div>
              <el-empty v-if="data.changedFeatures.length === 0" description="无变化地块" />
            </el-scrollbar>
          </el-card>
        </el-col>
      </el-row>
    </el-card>

    <!-- 统计报表视图 -->
    <el-card v-show="viewMode === 'statistics'" shadow="hover">
      <template #header>统计报表</template>
      
      <el-alert
        title="统计报表"
        type="info"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        根据差异检测结果生成的详细统计报表，支持导出Excel格式
      </el-alert>

      <el-table :data="data.features" border stripe max-height="600">
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column prop="properties.plotName" label="地块名称" width="150" />
        <el-table-column prop="properties.originalCrop" label="原始作物" width="120" />
        <el-table-column prop="properties.currentCrop" label="当前作物" width="120" />
        <el-table-column prop="properties.area" label="面积（亩）" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.properties.hasChange ? 'danger' : 'success'" size="small">
              {{ scope.row.properties.hasChange ? '有变化' : '无变化' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  data: {
    type: Object,
    required: true
  }
})

// 视图模式
const viewMode = ref('map')
const mapMode = ref('single')

// 地图相关
const hoveredFeature = ref(null)
const sliderPosition = ref(50)
const isDragging = ref(false)
const compareContainer = ref(null)

// 显示的要素（限制数量以提高性能）
const displayFeatures = computed(() => {
  return props.data.features.slice(0, 50) // 最多显示50个
})

// 对比滑块拖动
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
  
  sliderPosition.value = Math.max(0, Math.min(100, percentage))
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// 导出
const handleExport = () => {
  ElMessage.success('导出功能开发中...')
}

// 组件卸载时清理事件监听
onUnmounted(() => {
  if (isDragging.value) {
    stopDrag()
  }
})
</script>

<style scoped lang="scss">
.difference-view {
  // 地图容器
  .map-container {
    width: 100%;
    height: 600px;
    position: relative;
    background: #f5f7fa;
    border-radius: 8px;
    overflow: hidden;
    
    .map-placeholder {
      width: 100%;
      height: 100%;
      position: relative;
      
      .map-info {
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        text-align: center;
        z-index: 10;
        background: rgba(255, 255, 255, 0.95);
        padding: 16px 30px;
        border-radius: 8px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
      }
      
      .plot-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        gap: 12px;
        padding: 100px 20px 20px;
        height: 100%;
        overflow-y: auto;
        
        .plot-item {
          background: #e8f4f8;
          border: 2px solid #b3d8e8;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 80px;
          padding: 8px;
          transition: all 0.3s;
          cursor: pointer;
          
          &.plot-changed {
            background: #fde2e2;
            border-color: #f56c6c;
            box-shadow: 0 0 12px rgba(245, 108, 108, 0.3);
          }
          
          &.plot-unchanged {
            background: #e1f3d8;
            border-color: #67c23a;
            box-shadow: 0 0 8px rgba(103, 194, 58, 0.2);
          }
          
          &.plot-original {
            background: #e8f4f8;
            border-color: #b3d8e8;
          }
          
          &:hover {
            transform: scale(1.05);
            z-index: 5;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
          }
          
          .plot-label {
            font-weight: 600;
            font-size: 13px;
            color: #606266;
            text-align: center;
            word-break: break-all;
          }
        }
      }
      
      .plot-tooltip {
        position: fixed;
        top: 50%;
        right: 30px;
        transform: translateY(-50%);
        background: white;
        border: 2px solid #409EFF;
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        min-width: 240px;
        max-width: 300px;
      }
    }
  }
  
  // 对比模式
  .map-compare-container {
    width: 100%;
    height: 600px;
    position: relative;
    background: #f5f7fa;
    border-radius: 8px;
    overflow: hidden;
    
    .compare-wrapper {
      width: 100%;
      height: 100%;
      position: relative;
      
      .compare-left {
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        overflow: hidden;
        background: #f5f7fa;
        z-index: 1;
        
        .map-placeholder {
          width: 100vw;
          height: 100%;
          position: relative;
          
          .map-label {
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(64, 158, 255, 0.9);
            color: white;
            padding: 10px 24px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 15px;
            z-index: 10;
            white-space: nowrap;
          }
          
          .plot-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 12px;
            padding: 70px 20px 20px;
            height: 100%;
            overflow-y: auto;
          }
        }
      }
      
      .compare-right {
        position: absolute;
        right: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background: #f5f7fa;
        z-index: 2;
        
        .map-placeholder {
          width: 100%;
          height: 100%;
          position: relative;
          
          .map-label {
            position: absolute;
            top: 20px;
            right: 50px;
            background: rgba(103, 194, 58, 0.9);
            color: white;
            padding: 10px 24px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 15px;
            z-index: 10;
            white-space: nowrap;
          }
          
          .plot-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 12px;
            padding: 70px 20px 20px;
            height: 100%;
            overflow-y: auto;
          }
        }
      }
      
      .compare-slider {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 4px;
        background: transparent;
        cursor: ew-resize;
        z-index: 100;
        transform: translateX(-50%);
        
        &:hover .slider-line {
          background: #409EFF;
          box-shadow: 0 0 16px rgba(64, 158, 255, 0.6);
        }
        
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
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
          transition: all 0.3s;
          font-size: 20px;
          color: #409EFF;
          
          &:hover {
            transform: translate(-50%, -50%) scale(1.1);
          }
        }
        
        .slider-line {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 50%;
          width: 3px;
          background: rgba(64, 158, 255, 0.6);
          transform: translateX(-50%);
          transition: all 0.3s;
        }
      }
    }
  }
  
  // 统计侧边栏
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
        
        &.danger {
          color: #F56C6C;
        }
        
        &.success {
          color: #67C23A;
        }
      }
    }
  }
  
  // 变化列表
  .change-item {
    padding: 12px;
    border-bottom: 1px solid #ebeef5;
    cursor: pointer;
    transition: background 0.3s;
    
    &:hover {
      background: #f5f7fa;
    }
    
    &:last-child {
      border-bottom: none;
    }
  }
}
</style>


