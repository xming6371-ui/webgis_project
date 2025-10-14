<template>
  <div class="report-container">
    <!-- 操作栏 -->
    <el-card class="action-card" shadow="never">
      <el-space wrap>
        <el-button type="primary" @click="showReportDialog = true">
          <template #icon><FilePlus :size="16" /></template>
          生成报告
        </el-button>
        <el-button @click="handleExportAll">
          <template #icon><Download :size="16" /></template>
          导出全部图表
        </el-button>
        <el-divider direction="vertical" />
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 280px"
        />
        <el-select v-model="selectedRegion" placeholder="选择行政区" style="width: 150px" clearable>
          <el-option label="全部" value="" />
          <el-option label="乌鲁木齐市" value="wlmq" />
          <el-option label="喀什地区" value="ks" />
          <el-option label="阿勒泰地区" value="alt" />
        </el-select>
        <el-button @click="handleRefresh">
          <template #icon><RefreshCw :size="16" /></template>
          刷新
        </el-button>
      </el-space>
    </el-card>

    <!-- 图表区域 -->
    <el-row :gutter="20">
      <!-- 作物分布饼图 -->
      <el-col :xs="24" :lg="12">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="card-header">
              <span><PieChart :size="16" style="margin-right: 8px" /> 作物类型分布统计</span>
              <el-button-group size="small">
                <el-button :icon="Download" @click="handleExportChart('crop-distribution')">
                  导出图片
                </el-button>
                <el-button :icon="FullScreen" @click="handleFullscreen('crop-distribution')">
                  全屏
                </el-button>
              </el-button-group>
            </div>
          </template>
          <div id="crop-distribution" class="chart-container"></div>
        </el-card>
      </el-col>

      <!-- 差异类型柱状图 -->
      <el-col :xs="24" :lg="12">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="card-header">
              <span><BarChart :size="16" style="margin-right: 8px" /> 差异类型统计</span>
              <el-button-group size="small">
                <el-button :icon="Download" @click="handleExportChart('diff-distribution')">
                  导出图片
                </el-button>
                <el-button :icon="FullScreen" @click="handleFullscreen('diff-distribution')">
                  全屏
                </el-button>
              </el-button-group>
            </div>
          </template>
          <div id="diff-distribution" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <!-- 时间序列趋势图 -->
      <el-col :span="24">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="card-header">
              <span><TrendingUp :size="16" style="margin-right: 8px" /> 监测趋势分析（近5年）</span>
              <el-space>
                <el-checkbox-group v-model="trendSeries" size="small">
                  <el-checkbox label="监测面积" />
                  <el-checkbox label="吻合率" />
                  <el-checkbox label="差异地块" />
                </el-checkbox-group>
                <el-button-group size="small">
                  <el-button :icon="Download" @click="handleExportChart('trend-analysis')">
                    导出图片
                  </el-button>
                  <el-button :icon="FullScreen" @click="handleFullscreen('trend-analysis')">
                    全屏
                  </el-button>
                </el-button-group>
              </el-space>
            </div>
          </template>
          <div id="trend-analysis" class="trend-chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <!-- 行政区对比 -->
      <el-col :xs="24" :lg="12">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="card-header">
              <span><LineChart :size="16" style="margin-right: 8px" /> 行政区监测对比</span>
              <el-button-group size="small">
                <el-button :icon="Download" @click="handleExportChart('region-compare')">
                  导出图片
                </el-button>
              </el-button-group>
            </div>
          </template>
          <div id="region-compare" class="chart-container"></div>
        </el-card>
      </el-col>

      <!-- 月度监测统计 -->
      <el-col :xs="24" :lg="12">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="card-header">
              <span><Calendar :size="16" style="margin-right: 8px" /> 月度监测统计</span>
              <el-button-group size="small">
                <el-button :icon="Download" @click="handleExportChart('monthly-stats')">
                  导出图片
                </el-button>
              </el-button-group>
            </div>
          </template>
          <div id="monthly-stats" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 数据表格 -->
    <el-card shadow="never" class="table-card" style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span><Ticket :size="16" style="margin-right: 8px" /> 详细数据表</span>
          <el-button :icon="Download" size="small" @click="handleExportTable">
            导出Excel
          </el-button>
        </div>
      </template>
      
      <el-table :data="tableData" style="width: 100%" border stripe>
        <el-table-column prop="region" label="行政区" width="150" />
        <el-table-column prop="totalArea" label="监测面积（亩）" width="150" align="right" />
        <el-table-column prop="plotCount" label="地块数量" width="120" align="right" />
        <el-table-column prop="matchRate" label="吻合率" width="120" align="right">
          <template #default="scope">
            <el-progress :percentage="scope.row.matchRate" :color="getProgressColor(scope.row.matchRate)" />
          </template>
        </el-table-column>
        <el-table-column prop="diffCount" label="差异地块" width="120" align="right" />
        <el-table-column prop="wheat" label="小麦（亩）" width="130" align="right" />
        <el-table-column prop="corn" label="玉米（亩）" width="130" align="right" />
        <el-table-column prop="cotton" label="棉花（亩）" width="130" align="right" />
        <el-table-column prop="rice" label="水稻（亩）" width="130" align="right" />
      </el-table>

      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
        />
      </div>
    </el-card>

    <!-- 生成报告对话框 -->
    <el-dialog
      v-model="showReportDialog"
      title="生成分析报告"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form :model="reportForm" label-width="100px">
        <el-form-item label="报告标题">
          <el-input v-model="reportForm.title" placeholder="请输入报告标题" />
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="reportForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="行政区域">
          <el-cascader
            v-model="reportForm.region"
            :options="regionOptions"
            placeholder="请选择行政区域"
            style="width: 100%"
            clearable
          />
        </el-form-item>
        <el-form-item label="包含图表">
          <el-checkbox-group v-model="reportForm.charts">
            <el-checkbox label="crop">作物类型分布</el-checkbox>
            <el-checkbox label="diff">差异类型统计</el-checkbox>
            <el-checkbox label="trend">监测趋势分析</el-checkbox>
            <el-checkbox label="region">行政区对比</el-checkbox>
            <el-checkbox label="monthly">月度统计</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="包含表格">
          <el-switch v-model="reportForm.includeTable" />
        </el-form-item>
        <el-form-item label="输出格式">
          <el-radio-group v-model="reportForm.format">
            <el-radio label="pdf">PDF</el-radio>
            <el-radio label="word">Word</el-radio>
            <el-radio label="excel">Excel</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showReportDialog = false">取消</el-button>
        <el-button type="primary" :loading="generating" @click="handleGenerateReport">
          {{ generating ? '生成中...' : '生成报告' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import {
  FilePlus, Download, RefreshCw, PieChart, BarChart, TrendingUp,
  LineChart, Calendar, Ticket, Maximize
} from 'lucide-vue-next'
import * as echarts from 'echarts'

const dateRange = ref([])
const selectedRegion = ref('')
const trendSeries = ref(['监测面积', '吻合率', '差异地块'])
const showReportDialog = ref(false)
const generating = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(100)

const reportForm = ref({
  title: '2024年农作物监测分析报告',
  dateRange: [],
  region: [],
  charts: ['crop', 'diff', 'trend'],
  includeTable: true,
  format: 'pdf'
})

const regionOptions = [
  {
    value: 'xj',
    label: '新疆维吾尔自治区',
    children: [
      { value: 'wlmq', label: '乌鲁木齐市' },
      { value: 'ks', label: '喀什地区' },
      { value: 'alt', label: '阿勒泰地区' }
    ]
  }
]

const tableData = ref([
  {
    region: '乌鲁木齐市',
    totalArea: '45,230',
    plotCount: 1256,
    matchRate: 94,
    diffCount: 75,
    wheat: '18,500',
    corn: '12,300',
    cotton: '8,900',
    rice: '5,530'
  },
  {
    region: '喀什地区',
    totalArea: '38,650',
    plotCount: 1089,
    matchRate: 91,
    diffCount: 98,
    wheat: '15,200',
    corn: '10,800',
    cotton: '8,100',
    rice: '4,550'
  },
  {
    region: '阿勒泰地区',
    totalArea: '32,480',
    plotCount: 945,
    matchRate: 93,
    diffCount: 66,
    wheat: '13,400',
    corn: '9,600',
    cotton: '6,200',
    rice: '3,280'
  }
])

let cropChart = null
let diffChart = null
let trendChart = null
let regionChart = null
let monthlyChart = null

const getProgressColor = (percentage) => {
  if (percentage >= 90) return '#67C23A'
  if (percentage >= 70) return '#E6A23C'
  return '#F56C6C'
}

const handleRefresh = () => {
  ElMessage.success('数据已刷新')
}

const handleExportChart = (chartId) => {
  ElMessage.success(`导出图表: ${chartId}`)
}

const handleFullscreen = (chartId) => {
  ElMessage.info(`全屏显示: ${chartId}`)
}

const handleExportAll = () => {
  ElMessage.success('导出全部图表中...')
}

const handleExportTable = () => {
  ElMessage.success('导出Excel表格中...')
}

const handleGenerateReport = () => {
  generating.value = true
  setTimeout(() => {
    generating.value = false
    showReportDialog.value = false
    ElMessage.success('报告生成成功！')
  }, 2000)
}

const initCropChart = () => {
  const chartDom = document.getElementById('crop-distribution')
  cropChart = echarts.init(chartDom)
  
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}亩 ({d}%)'
    },
    legend: {
      bottom: '5%',
      left: 'center'
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
          formatter: '{b}\n{d}%'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        data: [
          { value: 47100, name: '小麦', itemStyle: { color: '#FFD700' } },
          { value: 32700, name: '玉米', itemStyle: { color: '#32CD32' } },
          { value: 23200, name: '棉花', itemStyle: { color: '#F0E68C' } },
          { value: 13360, name: '水稻', itemStyle: { color: '#87CEEB' } }
        ]
      }
    ]
  }
  
  cropChart.setOption(option)
}

const initDiffChart = () => {
  const chartDom = document.getElementById('diff-distribution')
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
        data: [120, 52, 43, 24],
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#fa709a' },
            { offset: 1, color: '#fee140' }
          ]),
          borderRadius: [0, 8, 8, 0]
        },
        label: {
          show: true,
          position: 'right'
        }
      }
    ]
  }
  
  diffChart.setOption(option)
}

const initTrendChart = () => {
  const chartDom = document.getElementById('trend-analysis')
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
        data: [8.5, 9.2, 10.1, 11.3, 11.6],
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
        data: [88, 90, 91, 92.5, 92.8],
        itemStyle: {
          color: '#67C23A'
        }
      },
      {
        name: '差异地块',
        type: 'line',
        smooth: true,
        data: [0.32, 0.28, 0.26, 0.24, 0.239],
        itemStyle: {
          color: '#F56C6C'
        }
      }
    ]
  }
  
  trendChart.setOption(option)
}

const initRegionChart = () => {
  const chartDom = document.getElementById('region-compare')
  regionChart = echarts.init(chartDom)
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    legend: {
      data: ['监测面积', '差异地块']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: ['乌鲁木齐市', '喀什地区', '阿勒泰地区', '伊犁州', '昌吉州']
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        name: '监测面积',
        type: 'bar',
        data: [4.52, 3.87, 3.25, 2.98, 2.65],
        itemStyle: {
          color: '#409EFF'
        }
      },
      {
        name: '差异地块',
        type: 'bar',
        data: [0.075, 0.098, 0.066, 0.082, 0.055],
        itemStyle: {
          color: '#F56C6C'
        }
      }
    ]
  }
  
  regionChart.setOption(option)
}

const initMonthlyChart = () => {
  const chartDom = document.getElementById('monthly-stats')
  monthlyChart = echarts.init(chartDom)
  
  const option = {
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        name: '监测次数',
        type: 'bar',
        data: [5, 8, 12, 18, 25, 28, 32, 30, 26, 20, 15, 10],
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#667eea' },
            { offset: 1, color: '#764ba2' }
          ])
        }
      }
    ]
  }
  
  monthlyChart.setOption(option)
}

onMounted(() => {
  setTimeout(() => {
    initCropChart()
    initDiffChart()
    initTrendChart()
    initRegionChart()
    initMonthlyChart()
  }, 100)
  
  window.addEventListener('resize', () => {
    cropChart?.resize()
    diffChart?.resize()
    trendChart?.resize()
    regionChart?.resize()
    monthlyChart?.resize()
  })
})

onBeforeUnmount(() => {
  cropChart?.dispose()
  diffChart?.dispose()
  trendChart?.dispose()
  regionChart?.dispose()
  monthlyChart?.dispose()
})
</script>

<style scoped lang="scss">
.report-container {
  .action-card {
    margin-bottom: 20px;
    border-radius: 8px;
  }
  
  .chart-card, .table-card {
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
    
    .chart-container {
      height: 350px;
    }
    
    .trend-chart-container {
      height: 400px;
    }
  }
  
  .pagination-container {
    display: flex;
    justify-content: center;
    margin-top: 20px;
  }
}
</style>

