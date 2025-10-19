<template>
  <div class="temporal-view">
    <!-- 视图模式切换 -->
    <div style="margin-bottom: 20px; text-align: center;">
      <el-radio-group v-model="viewMode">
        <el-radio-button value="timeline">时间轴视图</el-radio-button>
        <el-radio-button value="statistics">统计报表</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 时间轴视图 -->
    <el-card v-show="viewMode === 'timeline'" shadow="hover">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>{{ data.title }} - 时序变化分析</span>
          <el-space>
            <el-button size="small" @click="handleExport">导出数据</el-button>
          </el-space>
        </div>
      </template>
      
      <el-row :gutter="20">
        <!-- 地图区域 -->
        <el-col :span="18">
          <div class="map-container">
            <div class="map-placeholder">
              <!-- 当前时间点信息 -->
              <div class="time-info">
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">
                  {{ currentTimePoint.taskName || `时间点 ${currentTimeIndex + 1}` }}
                </div>
                <div style="font-size: 14px; color: #606266;">
                  {{ currentTimePoint.time || currentTimePoint.createTime }}
                </div>
              </div>
              
              <!-- 地块网格 -->
              <div class="plot-grid">
                <div 
                  v-for="(feature, index) in displayFeatures" 
                  :key="index"
                  class="plot-item"
                  :class="getCropClass(feature, currentTimeIndex)"
                  @mouseenter="hoveredFeature = feature"
                  @mouseleave="hoveredFeature = null"
                >
                  <div class="plot-label">
                    {{ getCurrentCrop(feature, currentTimeIndex) }}
                  </div>
                </div>
              </div>

              <!-- 悬停提示 -->
              <div v-if="hoveredFeature" class="plot-tooltip">
                <div style="font-weight: 600; margin-bottom: 8px; font-size: 16px;">
                  {{ hoveredFeature.properties.plotName || '未命名地块' }}
                </div>
                <el-divider style="margin: 8px 0;" />
                <div style="margin: 6px 0; font-size: 14px;">
                  <span style="color: #909399;">当前作物:</span>
                  <el-tag size="small" style="margin-left: 8px;">
                    {{ getCurrentCrop(hoveredFeature, currentTimeIndex) }}
                  </el-tag>
                </div>
                <div style="margin: 6px 0; font-size: 14px;">
                  <span style="color: #909399;">面积:</span>
                  <span style="margin-left: 8px;">{{ hoveredFeature.properties.area || 0 }} 亩</span>
                </div>
                <div style="margin: 6px 0; font-size: 14px;">
                  <span style="color: #909399;">变化次数:</span>
                  <el-tag 
                    :type="hoveredFeature.properties.changeCount > 0 ? 'warning' : 'success'" 
                    size="small" 
                    style="margin-left: 8px;"
                  >
                    {{ hoveredFeature.properties.changeCount }} 次
                  </el-tag>
                </div>
                <!-- 时间轴详情 -->
                <el-divider style="margin: 8px 0;" />
                <div style="font-size: 13px; color: #909399; margin-bottom: 4px;">时序变化轨迹:</div>
                <div 
                  v-for="(point, idx) in hoveredFeature.properties.timeline" 
                  :key="idx"
                  style="font-size: 12px; margin: 4px 0; padding: 4px; border-radius: 4px;"
                  :style="{ background: idx === currentTimeIndex ? '#e6f7ff' : 'transparent' }"
                >
                  <span style="font-weight: 600;">{{ formatTime(point.time) }}:</span>
                  <el-tag size="small" style="margin-left: 4px;">{{ point.crop }}</el-tag>
                </div>
              </div>
            </div>
          </div>

          <!-- 时间轴滑块 -->
          <div class="timeline-slider">
            <div class="slider-header">
              <span style="font-weight: 600; color: #606266;">时间轴控制</span>
              <span style="color: #909399; font-size: 13px;">
                第 {{ currentTimeIndex + 1 }} / {{ data.timePoints.length }} 期
              </span>
            </div>
            
            <div class="slider-controls">
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
                  @input="handleTimeChange"
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
                @click="currentTimeIndex = index"
              >
                <div class="time-label-name">{{ point.taskName || `期${index + 1}` }}</div>
                <div class="time-label-time">{{ formatTime(point.time) }}</div>
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
                <div class="stat-value primary">{{ data.filesCount }} 期</div>
              </div>
            </div>
          </el-card>

          <!-- 变化地块列表 -->
          <el-card shadow="hover" style="margin-top: 16px;">
            <template #header>变化地块列表</template>
            <el-scrollbar height="400px">
              <div 
                v-for="(feature, index) in changedFeatures" 
                :key="index"
                class="change-item"
              >
                <div style="font-weight: 600; margin-bottom: 6px;">
                  {{ feature.properties.plotName || `地块${index + 1}` }}
                </div>
                <div style="font-size: 12px; color: #909399; margin: 4px 0;">
                  变化次数: {{ feature.properties.changeCount }} 次
                </div>
                <div style="font-size: 12px;">
                  <el-tag 
                    v-for="(point, idx) in feature.properties.timeline.slice(0, 3)" 
                    :key="idx"
                    size="small"
                    style="margin: 2px;"
                  >
                    {{ point.crop }}
                  </el-tag>
                  <span v-if="feature.properties.timeline.length > 3" style="color: #909399;">...</span>
                </div>
              </div>
              <el-empty v-if="changedFeatures.length === 0" description="无变化地块" />
            </el-scrollbar>
          </el-card>
        </el-col>
      </el-row>
    </el-card>

    <!-- 统计报表视图 -->
    <el-card v-show="viewMode === 'statistics'" shadow="hover">
      <template #header>时序变化统计报表</template>
      
      <el-alert
        title="时序变化统计"
        type="info"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        显示每个地块在多个时间点的变化轨迹和统计信息
      </el-alert>

      <el-table :data="data.features" border stripe max-height="600">
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column prop="properties.plotName" label="地块名称" width="150" />
        <el-table-column label="变化次数" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.properties.changeCount > 0 ? 'warning' : 'success'" size="small">
              {{ scope.row.properties.changeCount }} 次
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="时序轨迹" min-width="300">
          <template #default="scope">
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
              <el-tag 
                v-for="(point, index) in scope.row.properties.timeline" 
                :key="index"
                size="small"
              >
                {{ formatTime(point.time) }}: {{ point.crop }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="properties.area" label="面积（亩）" width="120" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

const props = defineProps({
  data: {
    type: Object,
    required: true
  }
})

// 视图模式
const viewMode = ref('timeline')

// 当前时间索引
const currentTimeIndex = ref(0)

// 悬停的要素
const hoveredFeature = ref(null)

// 当前时间点信息
const currentTimePoint = computed(() => {
  return props.data.timePoints[currentTimeIndex.value] || {}
})

// 显示的要素
const displayFeatures = computed(() => {
  return props.data.features.slice(0, 50) // 最多显示50个
})

// 有变化的地块
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

// 获取当前时间点的作物
const getCurrentCrop = (feature, timeIndex) => {
  const timeline = feature.properties?.timeline || []
  if (timeIndex < timeline.length) {
    return timeline[timeIndex].crop || '未知'
  }
  return '未知'
}

// 获取地块样式类
const getCropClass = (feature, timeIndex) => {
  const crop = getCurrentCrop(feature, timeIndex)
  if (crop === '未知' || crop === '未检测到') {
    return 'plot-unknown'
  }
  return 'plot-normal'
}

// 格式化时间
const formatTime = (timeStr) => {
  if (!timeStr) return ''
  // 提取日期部分 2024-03-15 10:30:00 -> 2024-03-15
  return timeStr.split(' ')[0] || timeStr
}

// 时间变化
const handleTimeChange = (value) => {
  currentTimeIndex.value = value
}

// 上一期
const prevTime = () => {
  if (currentTimeIndex.value > 0) {
    currentTimeIndex.value--
  }
}

// 下一期
const nextTime = () => {
  if (currentTimeIndex.value < props.data.timePoints.length - 1) {
    currentTimeIndex.value++
  }
}

// 导出
const handleExport = () => {
  ElMessage.success('导出功能开发中...')
}
</script>

<style scoped lang="scss">
.temporal-view {
  // 地图容器
  .map-container {
    width: 100%;
    height: 500px;
    position: relative;
    background: #f5f7fa;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 20px;
    
    .map-placeholder {
      width: 100%;
      height: 100%;
      position: relative;
      
      .time-info {
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
          
          &.plot-normal {
            background: #e1f3d8;
            border-color: #67c23a;
          }
          
          &.plot-unknown {
            background: #f0f0f0;
            border-color: #d0d0d0;
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
        min-width: 260px;
        max-width: 320px;
        max-height: 80vh;
        overflow-y: auto;
      }
    }
  }
  
  // 时间轴滑块
  .timeline-slider {
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    
    .slider-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    
    .slider-controls {
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
          border-color: #409EFF;
          background: #ecf5ff;
        }
        
        &.active {
          border-color: #409EFF;
          background: #409EFF;
          color: white;
          
          .time-label-name {
            color: white;
          }
          
          .time-label-time {
            color: rgba(255, 255, 255, 0.9);
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


