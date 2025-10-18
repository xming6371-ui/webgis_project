<template>
  <div class="result-compare-container">
    <el-card shadow="never">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 18px; font-weight: 600;">结果查看与比对</span>
          <el-button @click="handleRefresh">刷新数据</el-button>
        </div>
      </template>

      <!-- 文件选择区域 -->
      <div style="margin-bottom: 20px;">
        <el-select 
          v-model="selectedFileId" 
          placeholder="请选择分析结果文件" 
          style="width: 400px;"
          filterable
          @change="handleFileChange"
        >
          <el-option 
            v-for="file in analysisFiles" 
            :key="file.id"
            :label="file.name" 
            :value="file.id"
          />
        </el-select>
        <el-button 
          type="primary" 
          style="margin-left: 12px;"
          :disabled="!selectedFileId"
          @click="handleLoadFile"
        >
          加载并查看
        </el-button>
      </div>

      <!-- 空状态 -->
      <el-empty 
        v-if="!loadedData" 
        description="请从分析结果队列中选择文件并加载"
        style="margin: 60px 0;"
      />

      <!-- 数据展示区 -->
      <div v-else>
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
              <span>{{ loadedData.title }}</span>
              <el-space>
                <el-radio-group v-model="mapMode" size="small">
                  <el-radio-button value="single">单图</el-radio-button>
                  <el-radio-button value="compare">对比</el-radio-button>
                </el-radio-group>
                <el-button size="small" @click="handleExport">导出</el-button>
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
                    <div style="font-size: 16px; margin-bottom: 8px;">地图展示区域</div>
                    <div style="font-size: 14px; color: #909399;">变化区域：红色 | 无变化：灰色</div>
                  </div>
                  
                  <!-- 地块网格 -->
                  <div class="plot-grid">
                    <div 
                      v-for="plot in currentPlots" 
                      :key="plot.id"
                      class="plot-item"
                      :class="{ 
                        'plot-changed': plot.hasChange,
                        'plot-unchanged': !plot.hasChange
                      }"
                      @mouseenter="hoveredPlot = plot"
                      @mouseleave="hoveredPlot = null"
                    >
                      <div class="plot-label">{{ plot.name }}</div>
                    </div>
                </div>

                  <!-- 悬停提示 -->
                  <div v-if="hoveredPlot" class="plot-tooltip">
                    <div style="font-weight: 600; margin-bottom: 8px;">{{ hoveredPlot.name }}</div>
                    <div style="margin: 4px 0;">原始: {{ hoveredPlot.from }}</div>
                    <div style="margin: 4px 0;">变为: {{ hoveredPlot.to }}</div>
                    <div style="margin: 4px 0;">面积: {{ hoveredPlot.area }} 亩</div>
                    </div>
                  </div>
                </div>
                
              <!-- 对比模式 -->
              <div v-else class="map-compare-container" ref="compareContainer">
                <div class="compare-wrapper">
                  <!-- 左侧：原始图 -->
                  <div class="compare-left" :style="{ width: sliderPosition + '%' }">
                    <div class="map-placeholder">
                      <div class="map-label">原始图</div>
                      <div class="plot-grid">
                        <div 
                          v-for="plot in currentPlots" 
                          :key="'left-' + plot.id"
                          class="plot-item plot-original"
                        >
                          <div class="plot-label">{{ plot.name }}</div>
                    </div>
                  </div>
                </div>
              </div>

                  <!-- 右侧：分析结果图 -->
                  <div class="compare-right">
                    <div class="map-placeholder">
                      <div class="map-label">分析结果</div>
                      <div class="plot-grid">
                        <div 
                          v-for="plot in currentPlots" 
                          :key="'right-' + plot.id"
                          class="plot-item"
                          :class="{ 
                            'plot-changed': plot.hasChange,
                            'plot-unchanged': !plot.hasChange
                          }"
                        >
                          <div class="plot-label">{{ plot.name }}</div>
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
                    <div class="stat-value">{{ loadedData.stats.total }}</div>
                  </div>
                  <el-divider />
                  <div class="stat-item">
                    <div>变化地块</div>
                    <div class="stat-value danger">{{ loadedData.stats.changed }}</div>
                  </div>
                  <el-divider />
                  <div class="stat-item">
                    <div>无变化</div>
                    <div class="stat-value success">{{ loadedData.stats.unchanged }}</div>
            </div>
          </div>
        </el-card>

              <!-- 变化列表 -->
              <el-card shadow="hover" style="margin-top: 16px;">
                <template #header>变化列表</template>
                <el-scrollbar height="400px">
                  <div 
                    v-for="plot in changedPlots" 
                    :key="plot.id"
                    class="change-item"
                  >
                    <div style="font-weight: 600; margin-bottom: 4px;">{{ plot.name }}</div>
                    <div style="font-size: 12px; color: #909399;">
                      {{ plot.from }} → {{ plot.to }}
                    </div>
                    <div style="font-size: 12px; color: #909399;">
                      面积: {{ plot.area }} 亩
                    </div>
                  </div>
                </el-scrollbar>
              </el-card>
            </el-col>
          </el-row>
        </el-card>

        <!-- 统计报表视图 -->
        <el-card v-show="viewMode === 'statistics'" shadow="hover">
          <template #header>统计报表</template>
          
          <el-alert
            title="统计报表功能"
            type="info"
            :closable="false"
            style="margin-bottom: 20px;"
          >
            根据分析类型自动生成多维度统计报表，支持导出Excel/PDF格式
          </el-alert>

          <el-table :data="currentPlots" border stripe>
            <el-table-column prop="name" label="地块名称" width="150" />
            <el-table-column prop="from" label="原始类型" width="120" />
            <el-table-column prop="to" label="变化类型" width="120" />
            <el-table-column prop="area" label="面积（亩）" width="120" />
            <el-table-column label="状态" width="100">
              <template #default="scope">
                <el-tag :type="scope.row.hasChange ? 'danger' : 'success'" size="small">
                  {{ scope.row.hasChange ? '有变化' : '无变化' }}
                </el-tag>
      </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'

// 文件选择相关
const selectedFileId = ref('')
const analysisFiles = ref([])
const currentFile = ref(null)

// 加载的数据
const loadedData = ref(null)

// 视图模式
const viewMode = ref('map')
const mapMode = ref('single')

// 地图相关
const hoveredPlot = ref(null)
const sliderPosition = ref(50)
const isDragging = ref(false)
const compareContainer = ref(null)

// 当前显示的地块数据
const currentPlots = computed(() => {
  if (!loadedData.value) return []
  return loadedData.value.plots || []
})

// 变化的地块列表
const changedPlots = computed(() => {
  return currentPlots.value.filter(p => p.hasChange)
})

// 从localStorage加载分析结果文件列表
const loadAnalysisFiles = () => {
  try {
    const QUEUE_KEY = 'analysis_result_queue'
    const stored = localStorage.getItem(QUEUE_KEY)
    if (stored) {
      const allResults = JSON.parse(stored)
      // 只加载非recognition类型的分析结果
      analysisFiles.value = allResults.filter(r => r.analysisType !== 'recognition')
      console.log('已加载分析结果文件:', analysisFiles.value.length, '个')
    } else {
      analysisFiles.value = []
    }
  } catch (error) {
    console.error('加载分析结果文件失败:', error)
    analysisFiles.value = []
  }
}

// 文件选择变化
const handleFileChange = () => {
  currentFile.value = analysisFiles.value.find(f => f.id === selectedFileId.value)
}

// 加载并查看文件
const handleLoadFile = () => {
  if (!currentFile.value) {
    ElMessage.warning('请先选择文件')
    return
  }

  ElMessage.info('正在加载分析结果...')
  
  // 模拟加载数据
  setTimeout(() => {
    // 生成模拟数据
    const mockPlots = generateMockPlots()
    
    loadedData.value = {
      type: getAnalysisTypeLabel(currentFile.value.analysisType),
      title: currentFile.value.taskName,
      analysisType: currentFile.value.analysisType,
      plots: mockPlots,
      stats: {
        total: mockPlots.length,
        changed: mockPlots.filter(p => p.hasChange).length,
        unchanged: mockPlots.filter(p => !p.hasChange).length
      }
    }
    
    ElNotification({
      title: '加载成功',
      message: `已加载${currentFile.value.name}的分析结果`,
      type: 'success',
      duration: 3000
    })
  }, 800)
}

// 生成模拟地块数据
const generateMockPlots = () => {
  return [
    {
      id: 'P001',
      name: '地块A',
      from: '小麦',
      to: '水稻',
      area: 125.5,
      hasChange: true
    },
    {
      id: 'P002',
      name: '地块B',
      from: '玉米',
      to: '裸地',
      area: 86.3,
      hasChange: true
    },
    {
      id: 'P003',
      name: '地块C',
      from: '水稻',
      to: '棉花',
      area: 156.8,
      hasChange: true
    },
    {
      id: 'P004',
      name: '地块D',
      from: '小麦',
      to: '小麦',
      area: 98.2,
      hasChange: false
    },
    {
      id: 'P005',
      name: '地块E',
      from: '棉花',
      to: '玉米',
      area: 142.6,
      hasChange: true
    },
    {
      id: 'P006',
      name: '地块F',
      from: '水稻',
      to: '水稻',
      area: 76.4,
      hasChange: false
    }
  ]
}

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

// 刷新
const handleRefresh = () => {
  loadAnalysisFiles()
  ElMessage.success('文件列表已刷新')
}

// 导出
const handleExport = () => {
  ElMessage.success('导出功能开发中...')
}

// 辅助方法
const getAnalysisTypeLabel = (type) => {
  const map = {
    difference: '差异检测',
    temporal: '时序分析',
    statistics: '统计汇总'
  }
  return map[type] || '未知类型'
}

// 组件挂载
onMounted(() => {
  loadAnalysisFiles()
})

// 组件卸载时清理事件监听
onUnmounted(() => {
  if (isDragging.value) {
    stopDrag()
  }
})
</script>

<style scoped lang="scss">
.result-compare-container {
  padding: 20px;
  
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
        padding: 20px 30px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
      
      .plot-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        padding: 120px 20px 20px;
        height: 100%;
        
        .plot-item {
          background: #e8f4f8;
          border: 2px solid #b3d8e8;
          border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
          transition: all 0.3s;
          cursor: pointer;
          
          &.plot-changed {
            background: #fde2e2;
            border-color: #f56c6c;
            box-shadow: 0 0 12px rgba(245, 108, 108, 0.3);
          }
          
          &.plot-unchanged {
            background: #e4e7ed;
            border-color: #909399;
            box-shadow: 0 0 8px rgba(144, 147, 153, 0.2);
          }
          
          &.plot-original {
            background: #e8f4f8;
            border-color: #b3d8e8;
          }
          
          &:hover {
            transform: scale(1.05);
            z-index: 5;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
          }
          
          .plot-label {
              font-weight: 600;
            font-size: 14px;
            color: #606266;
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
        min-width: 200px;
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
            padding: 8px 20px;
            border-radius: 20px;
                font-weight: 600;
            z-index: 10;
          }
          
          .plot-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            padding: 60px 20px 20px;
            height: 100%;
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
            padding: 8px 20px;
            border-radius: 20px;
                font-weight: 600;
            z-index: 10;
          }
          
          .plot-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            padding: 60px 20px 20px;
            height: 100%;
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
