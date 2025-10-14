<template>
  <div class="dashboard-container">
    <!-- 顶部筛选栏 -->
    <el-card class="filter-card" shadow="never">
      <div class="filter-bar">
        <el-space :size="15" wrap>
          <div class="filter-item">
            <span class="filter-label">年份期次：</span>
            <el-select v-model="filterForm.year" placeholder="选择年份" style="width: 120px">
              <el-option label="2024年" value="2024" />
              <el-option label="2023年" value="2023" />
              <el-option label="2022年" value="2022" />
            </el-select>
            <el-select v-model="filterForm.period" placeholder="选择期次" style="width: 100px; margin-left: 10px">
              <el-option label="第一期" value="1" />
              <el-option label="第二期" value="2" />
            </el-select>
          </div>
          <div class="filter-item">
            <span class="filter-label">行政区：</span>
            <el-cascader
              v-model="filterForm.region"
              :options="regionOptions"
              placeholder="选择行政区"
              style="width: 200px"
              clearable
            />
          </div>
          <div class="filter-item">
            <span class="filter-label">作物类型：</span>
            <el-select v-model="filterForm.cropType" placeholder="选择作物" style="width: 140px" clearable>
              <el-option label="全部" value="" />
              <el-option label="小麦" value="wheat" />
              <el-option label="玉米" value="corn" />
              <el-option label="棉花" value="cotton" />
              <el-option label="水稻" value="rice" />
            </el-select>
          </div>
          <el-input
            v-model="filterForm.keyword"
            placeholder="地块ID / 户主姓名"
            style="width: 200px"
            clearable
            :prefix-icon="Search"
          />
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-space>
      </div>
    </el-card>

    <!-- KPI统计卡片 -->
    <div class="kpi-container">
      <el-row :gutter="20">
        <el-col :xs="24" :sm="12" :md="6">
          <div class="kpi-card gradient-primary">
            <div class="kpi-icon">
              <el-icon :size="40"><Grid /></el-icon>
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
              <el-icon :size="40"><SuccessFilled /></el-icon>
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
              <el-icon :size="40"><WarningFilled /></el-icon>
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
              <el-icon :size="40"><DocumentChecked /></el-icon>
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
    <el-row :gutter="20" style="margin-top: 20px">
      <!-- 地图区域 -->
      <el-col :xs="24" :lg="16">
        <el-card class="map-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span><el-icon><Location /></el-icon> 监测地图</span>
              <el-space>
                <el-button size="small" :icon="ZoomIn">放大</el-button>
                <el-button size="small" :icon="ZoomOut">缩小</el-button>
                <el-button size="small" :icon="Position">定位</el-button>
              </el-space>
            </div>
          </template>
          <div id="map-container" class="map-container"></div>
        </el-card>
      </el-col>

      <!-- 右侧图表 -->
      <el-col :xs="24" :lg="8">
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
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Search, Refresh, Grid, SuccessFilled, WarningFilled, DocumentChecked, Location, ZoomIn, ZoomOut, Position, PieChart, DataLine, TrendCharts } from '@element-plus/icons-vue'
import * as echarts from 'echarts'

const filterForm = ref({
  year: '2024',
  period: '1',
  region: [],
  cropType: '',
  keyword: ''
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

const handleSearch = () => {
  console.log('搜索条件：', filterForm.value)
}

const handleReset = () => {
  filterForm.value = {
    year: '2024',
    period: '1',
    region: [],
    cropType: '',
    keyword: ''
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
      bottom: '5%',
      left: 'center'
    },
    series: [
      {
        name: '作物类型',
        type: 'pie',
        radius: ['40%', '70%'],
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
  const mapContainer = document.getElementById('map-container')
  if (mapContainer) {
    mapContainer.innerHTML = '<div class="map-placeholder"><el-icon size="80"><Location /></el-icon><p>地图加载区域（需集成 OpenLayers）</p></div>'
  }
}

onMounted(() => {
  initMap()
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
})
</script>

<style scoped lang="scss">
.dashboard-container {
  .filter-card {
    margin-bottom: 20px;
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
    .kpi-card {
      padding: 24px;
      border-radius: 12px;
      color: white;
      display: flex;
      align-items: center;
      gap: 20px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
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
          font-size: 32px;
          font-weight: bold;
          line-height: 1.2;
          margin-bottom: 5px;
        }
        
        .kpi-label {
          font-size: 14px;
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
      height: 500px;
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
    
    .chart-container {
      height: 260px;
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

