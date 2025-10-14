<template>
  <div class="result-compare-container">
    <!-- 工具栏 -->
    <el-card class="toolbar-card" shadow="never">
      <el-space wrap>
        <el-select v-model="selectedTask" placeholder="选择分析结果" style="width: 250px">
          <el-option label="2024年春季小麦识别" value="task001" />
          <el-option label="棉花种植区域提取" value="task002" />
          <el-option label="玉米地块分类识别" value="task003" />
        </el-select>
        <el-divider direction="vertical" />
        <span class="toolbar-label">对比模式：</span>
        <el-radio-group v-model="compareMode" size="default">
          <el-radio-button label="split">并排对比</el-radio-button>
          <el-radio-button label="swipe">滑动对比</el-radio-button>
          <el-radio-button label="opacity">叠加对比</el-radio-button>
        </el-radio-group>
        <el-divider direction="vertical" />
        <el-checkbox v-model="showDiffOnly" label="仅显示差异" />
        <el-button type="primary" @click="handleExport">
          <template #icon><Download :size="16" /></template>
          导出结果
        </el-button>
      </el-space>
    </el-card>

    <!-- 主体布局 -->
    <el-container class="main-container">
      <!-- 左侧地图区域 -->
      <el-main class="map-section">
        <el-card shadow="never" class="map-card">
          <template #header>
            <div class="card-header">
              <span><Map :size="16" style="margin-right: 8px" /> 分类结果地图</span>
              <el-space>
                <el-button size="small">
                  <template #icon><ZoomIn :size="14" /></template>
                  放大
                </el-button>
                <el-button size="small">
                  <template #icon><ZoomOut :size="14" /></template>
                  缩小
                </el-button>
                <el-button size="small">
                  <template #icon><MapPin :size="14" /></template>
                  定位
                </el-button>
                <el-button size="small" @click="showLayerPanel = !showLayerPanel">
                  <template #icon><Settings :size="14" /></template>
                  图层控制
                </el-button>
              </el-space>
            </div>
          </template>
          
          <!-- 地图容器 -->
          <div class="map-wrapper">
            <div id="result-map" class="result-map"></div>
            
            <!-- 图层控制面板 -->
            <transition name="slide-fade">
              <div v-show="showLayerPanel" class="layer-panel">
                <div class="panel-header">
                  <span>图层控制</span>
                  <X :size="18" class="close-icon" @click="showLayerPanel = false" />
                </div>
                <div class="panel-content">
                  <div v-for="layer in layers" :key="layer.id" class="layer-item">
                    <el-checkbox v-model="layer.visible">{{ layer.name }}</el-checkbox>
                    <div class="layer-controls">
                      <span class="control-label">透明度</span>
                      <el-slider v-model="layer.opacity" :max="100" style="width: 100px" />
                    </div>
                  </div>
                </div>
                
                <el-divider />
                
                <div class="legend-section">
                  <div class="legend-title">图例</div>
                  <div class="legend-items">
                    <div v-for="item in legendItems" :key="item.label" class="legend-item">
                      <span class="legend-color" :style="{ background: item.color }"></span>
                      <span>{{ item.label }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </transition>
          </div>
        </el-card>
      </el-main>

      <!-- 右侧详情面板 -->
      <el-aside width="380px" class="detail-section">
        <!-- 统计概览 -->
        <el-card shadow="never" class="stats-card">
          <template #header>
            <span><BarChart :size="16" style="margin-right: 8px" /> 分类统计</span>
          </template>
          <div id="stats-chart" class="stats-chart"></div>
        </el-card>

        <!-- 差异列表 -->
        <el-card shadow="never" class="diff-card">
          <template #header>
            <div class="card-header">
              <span><AlertTriangle :size="16" style="margin-right: 8px" /> 差异地块 ({{ diffList.length }})</span>
              <el-button size="small" text @click="handleExportDiff">导出</el-button>
            </div>
          </template>
          
          <div class="diff-list">
            <div
              v-for="item in diffList"
              :key="item.id"
              class="diff-item"
              :class="{ active: selectedDiff === item.id }"
              @click="handleSelectDiff(item)"
            >
              <div class="diff-header">
                <span class="diff-id">{{ item.plotId }}</span>
                <el-tag :type="getDiffTypeColor(item.diffType)" size="small">
                  {{ item.diffType }}
                </el-tag>
              </div>
              <div class="diff-content">
                <div class="diff-row">
                  <span class="label">规划作物：</span>
                  <span>{{ item.planned }}</span>
                </div>
                <div class="diff-row">
                  <span class="label">识别作物：</span>
                  <span>{{ item.detected }}</span>
                </div>
                <div class="diff-row">
                  <span class="label">地块面积：</span>
                  <span>{{ item.area }} 亩</span>
                </div>
              </div>
              <div class="diff-actions">
                <el-button size="small" :icon="View" @click.stop="handleViewDetail(item)">
                  查看详情
                </el-button>
                <el-button size="small" :icon="Edit" @click.stop="handleMarkReview(item)">
                  标注复核
                </el-button>
              </div>
            </div>
          </div>
        </el-card>
      </el-aside>
    </el-container>

    <!-- 地块详情对话框 -->
    <el-dialog v-model="showDetailDialog" title="地块详情" width="700px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="地块ID">{{ currentDetail.plotId }}</el-descriptions-item>
        <el-descriptions-item label="户主">{{ currentDetail.owner }}</el-descriptions-item>
        <el-descriptions-item label="行政区">{{ currentDetail.region }}</el-descriptions-item>
        <el-descriptions-item label="地块面积">{{ currentDetail.area }} 亩</el-descriptions-item>
        <el-descriptions-item label="规划作物">{{ currentDetail.planned }}</el-descriptions-item>
        <el-descriptions-item label="识别作物">{{ currentDetail.detected }}</el-descriptions-item>
        <el-descriptions-item label="差异类型">
          <el-tag :type="getDiffTypeColor(currentDetail.diffType)">
            {{ currentDetail.diffType }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="置信度">{{ currentDetail.confidence }}%</el-descriptions-item>
      </el-descriptions>
      
      <el-divider content-position="left">历年记录</el-divider>
      
      <el-timeline>
        <el-timeline-item
          v-for="record in currentDetail.history"
          :key="record.year"
          :timestamp="record.year"
        >
          {{ record.crop }} ({{ record.match ? '吻合' : '不吻合' }})
        </el-timeline-item>
      </el-timeline>
      
      <template #footer>
        <el-button @click="showDetailDialog = false">关闭</el-button>
        <el-button type="primary" :icon="Edit">提交复核</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Download, Map, ZoomIn, ZoomOut, MapPin, Settings, X,
  BarChart, AlertTriangle, Eye, Edit
} from 'lucide-vue-next'
import * as echarts from 'echarts'

const selectedTask = ref('task001')
const compareMode = ref('split')
const showDiffOnly = ref(false)
const showLayerPanel = ref(true)
const showDetailDialog = ref(false)
const selectedDiff = ref(null)

const layers = ref([
  { id: 'classification', name: '分类结果', visible: true, opacity: 80 },
  { id: 'plots', name: '地块边界', visible: true, opacity: 100 },
  { id: 'difference', name: '差异高亮', visible: true, opacity: 90 },
  { id: 'satellite', name: '卫星影像', visible: false, opacity: 100 }
])

const legendItems = [
  { label: '小麦', color: '#FFD700' },
  { label: '玉米', color: '#32CD32' },
  { label: '棉花', color: '#F0E68C' },
  { label: '水稻', color: '#87CEEB' },
  { label: '差异地块', color: '#FF6B6B' },
  { label: '未种植', color: '#D3D3D3' }
]

const diffList = ref([
  {
    id: 1,
    plotId: 'PLOT001',
    diffType: '类型不符',
    planned: '小麦',
    detected: '玉米',
    area: 12.5,
    owner: '张三',
    region: '乌鲁木齐市',
    confidence: 92,
    history: [
      { year: '2023年', crop: '小麦', match: true },
      { year: '2022年', crop: '小麦', match: true }
    ]
  },
  {
    id: 2,
    plotId: 'PLOT002',
    diffType: '撂荒未种',
    planned: '棉花',
    detected: '未种植',
    area: 8.3,
    owner: '李四',
    region: '喀什地区',
    confidence: 88,
    history: [
      { year: '2023年', crop: '棉花', match: true },
      { year: '2022年', crop: '棉花', match: true }
    ]
  },
  {
    id: 3,
    plotId: 'PLOT003',
    diffType: '非规划种植',
    planned: '水稻',
    detected: '玉米',
    area: 15.6,
    owner: '王五',
    region: '阿勒泰地区',
    confidence: 95,
    history: [
      { year: '2023年', crop: '水稻', match: true },
      { year: '2022年', crop: '玉米', match: false }
    ]
  }
])

const currentDetail = ref({
  plotId: '',
  owner: '',
  region: '',
  area: 0,
  planned: '',
  detected: '',
  diffType: '',
  confidence: 0,
  history: []
})

let statsChart = null

const getDiffTypeColor = (type) => {
  const map = {
    '类型不符': 'warning',
    '撂荒未种': 'danger',
    '非规划种植': 'info',
    '超范围种植': 'warning'
  }
  return map[type] || ''
}

const handleSelectDiff = (item) => {
  selectedDiff.value = item.id
  ElMessage.info(`已定位到地块 ${item.plotId}`)
}

const handleViewDetail = (item) => {
  currentDetail.value = item
  showDetailDialog.value = true
}

const handleMarkReview = (item) => {
  ElMessage.success(`地块 ${item.plotId} 已标记为待复核`)
}

const handleExport = () => {
  ElMessage.success('导出功能开发中')
}

const handleExportDiff = () => {
  ElMessage.success('差异地块数据导出中...')
}

const initStatsChart = () => {
  const chartDom = document.getElementById('stats-chart')
  statsChart = echarts.init(chartDom)
  
  const option = {
    tooltip: {
      trigger: 'item'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: '10%'
    },
    series: [
      {
        name: '作物分布',
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
          formatter: '{b}: {d}%'
        },
        data: [
          { value: 1048, name: '小麦', itemStyle: { color: '#FFD700' } },
          { value: 735, name: '玉米', itemStyle: { color: '#32CD32' } },
          { value: 580, name: '棉花', itemStyle: { color: '#F0E68C' } },
          { value: 484, name: '水稻', itemStyle: { color: '#87CEEB' } },
          { value: 120, name: '差异', itemStyle: { color: '#FF6B6B' } }
        ]
      }
    ]
  }
  
  statsChart.setOption(option)
}

const initMap = () => {
  const mapContainer = document.getElementById('result-map')
  if (mapContainer) {
    mapContainer.innerHTML = '<div class="map-placeholder"><el-icon size="80"><Location /></el-icon><p>结果地图加载区域（需集成 OpenLayers）</p></div>'
  }
}

onMounted(() => {
  initMap()
  setTimeout(() => {
    initStatsChart()
  }, 100)
  
  window.addEventListener('resize', () => {
    statsChart?.resize()
  })
})

onBeforeUnmount(() => {
  statsChart?.dispose()
})
</script>

<style scoped lang="scss">
.result-compare-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  
  .toolbar-card {
    margin-bottom: 20px;
    border-radius: 8px;
    
    .toolbar-label {
      font-size: 14px;
      color: #606266;
    }
  }
  
  .main-container {
    flex: 1;
    overflow: hidden;
    
    .map-section {
      padding: 0;
      margin-right: 20px;
      
      .map-card {
        height: 100%;
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
        
        .map-wrapper {
          position: relative;
          height: calc(100vh - 240px);
          
          .result-map {
            width: 100%;
            height: 100%;
            background: #f5f7fa;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            
            .map-placeholder {
              text-align: center;
              color: #909399;
              
              p {
                margin-top: 20px;
                font-size: 16px;
              }
            }
          }
          
          .layer-panel {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 300px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
            z-index: 100;
            
            .panel-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 15px;
              border-bottom: 1px solid #ebeef5;
              font-weight: 600;
              
              .close-icon {
                cursor: pointer;
                &:hover {
                  color: #409EFF;
                }
              }
            }
            
            .panel-content {
              padding: 15px;
              max-height: 300px;
              overflow-y: auto;
              
              .layer-item {
                margin-bottom: 15px;
                
                .layer-controls {
                  display: flex;
                  align-items: center;
                  gap: 10px;
                  margin-top: 8px;
                  margin-left: 24px;
                  
                  .control-label {
                    font-size: 12px;
                    color: #909399;
                    white-space: nowrap;
                  }
                }
              }
            }
            
            .legend-section {
              padding: 15px;
              
              .legend-title {
                font-weight: 600;
                margin-bottom: 10px;
              }
              
              .legend-items {
                .legend-item {
                  display: flex;
                  align-items: center;
                  gap: 10px;
                  margin-bottom: 8px;
                  font-size: 13px;
                  
                  .legend-color {
                    width: 20px;
                    height: 14px;
                    border-radius: 2px;
                  }
                }
              }
            }
          }
        }
      }
    }
    
    .detail-section {
      .stats-card {
        margin-bottom: 20px;
        border-radius: 8px;
        
        .stats-chart {
          height: 300px;
        }
      }
      
      .diff-card {
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
        
        .diff-list {
          max-height: calc(100vh - 600px);
          overflow-y: auto;
          
          .diff-item {
            padding: 12px;
            border: 1px solid #ebeef5;
            border-radius: 6px;
            margin-bottom: 10px;
            cursor: pointer;
            transition: all 0.3s;
            
            &:hover {
              border-color: #409EFF;
              box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
            }
            
            &.active {
              border-color: #409EFF;
              background: #ecf5ff;
            }
            
            .diff-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 8px;
              
              .diff-id {
                font-weight: 600;
                font-size: 14px;
              }
            }
            
            .diff-content {
              font-size: 13px;
              color: #606266;
              margin-bottom: 8px;
              
              .diff-row {
                display: flex;
                margin-bottom: 4px;
                
                .label {
                  color: #909399;
                  min-width: 70px;
                }
              }
            }
            
            .diff-actions {
              display: flex;
              gap: 8px;
            }
          }
        }
      }
    }
  }
}

.slide-fade-enter-active {
  transition: all 0.3s ease;
}

.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(20px);
  opacity: 0;
}
</style>

