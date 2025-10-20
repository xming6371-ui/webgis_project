<template>
  <div class="difference-simple-view">
    <el-row :gutter="20">
      <el-col :span="24">
        <!-- 统计概览 -->
        <el-row :gutter="20" style="margin-bottom: 20px;">
          <el-col :span="6">
            <el-card shadow="hover" class="stat-card">
              <el-statistic title="总地块数" :value="data.stats.total">
                <template #prefix>
                  <el-icon><Grid /></el-icon>
                </template>
              </el-statistic>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card shadow="hover" class="stat-card stat-danger">
              <el-statistic title="有变化" :value="data.stats.changed">
                <template #prefix>
                  <el-icon color="#f56c6c"><Warning /></el-icon>
                </template>
              </el-statistic>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card shadow="hover" class="stat-card stat-success">
              <el-statistic title="无变化" :value="data.stats.unchanged">
                <template #prefix>
                  <el-icon color="#67c23a"><CircleCheck /></el-icon>
                </template>
              </el-statistic>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card shadow="hover" class="stat-card">
              <el-statistic 
                title="变化率" 
                :value="changeRate"
                suffix="%"
              >
                <template #prefix>
                  <el-icon><TrendCharts /></el-icon>
                </template>
              </el-statistic>
            </el-card>
          </el-col>
        </el-row>
        
        <!-- 对比说明 -->
        <el-alert
          title="对比分析说明"
          type="info"
          :closable="false"
          style="margin-bottom: 20px;"
        >
          <div>
            <strong>原始图：</strong>{{ data.baseFile.taskName }} &nbsp;&nbsp;
            <strong>对比图：</strong>{{ data.compareFile.taskName }}
          </div>
          <div style="margin-top: 8px;">
            <el-tag type="danger" size="small">红色</el-tag> 表示作物类型发生变化 &nbsp;
            <el-tag type="success" size="small">绿色</el-tag> 表示作物类型未变化
          </div>
        </el-alert>

        <!-- 变化地块详情表格 -->
        <el-card shadow="hover">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>变化地块详情 (共 {{ data.stats.changed }} 个)</span>
              <el-space>
                <el-input
                  v-model="searchKeyword"
                  placeholder="搜索地块"
                  style="width: 200px;"
                  clearable
                  size="small"
                >
                  <template #prefix><el-icon><Search /></el-icon></template>
                </el-input>
                <el-button size="small" type="success" @click="exportCSV">
                  <el-icon><Download /></el-icon>
                  导出CSV
                </el-button>
              </el-space>
            </div>
          </template>
          
          <el-table 
            :data="filteredChangedFeatures" 
            stripe 
            border
            max-height="600"
            :default-sort="{ prop: 'area', order: 'descending' }"
          >
            <el-table-column type="index" label="序号" width="60" />
            <el-table-column prop="properties.plotId" label="地块ID" width="100" />
            <el-table-column prop="properties.plotName" label="地块名称" width="150" />
            <el-table-column label="原始作物" width="120">
              <template #default="scope">
                <el-tag size="small">{{ scope.row.properties.originalCrop }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="→" width="50" align="center">
              <template #default>
                <el-icon color="#f56c6c" :size="20"><Right /></el-icon>
              </template>
            </el-table-column>
            <el-table-column label="当前作物" width="120">
              <template #default="scope">
                <el-tag type="danger" size="small">{{ scope.row.properties.currentCrop }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="properties.area" label="面积(亩)" width="120" sortable>
              <template #default="scope">
                {{ scope.row.properties.area || 0 }}
              </template>
            </el-table-column>
            <el-table-column label="变化类型" width="120">
              <template #default="scope">
                <el-tag 
                  :type="getDiffTypeTagType(scope.row.properties.diffType)" 
                  size="small"
                >
                  {{ getDiffTypeText(scope.row.properties.diffType) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>

          <div style="margin-top: 16px; text-align: center;">
            <el-pagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              :page-sizes="[10, 20, 50, 100]"
              layout="total, sizes, prev, pager, next, jumper"
              :total="changedFeatures.length"
            />
          </div>
        </el-card>

        <!-- 无变化地块概览 -->
        <el-card shadow="hover" style="margin-top: 20px;">
          <template #header>
            <span>无变化地块概览 (共 {{ data.stats.unchanged }} 个)</span>
          </template>
          <el-table 
            :data="unchangedFeatures.slice(0, 10)" 
            stripe
            size="small"
          >
            <el-table-column type="index" label="序号" width="60" />
            <el-table-column prop="properties.plotName" label="地块名称" width="150" />
            <el-table-column label="作物类型" width="120">
              <template #default="scope">
                <el-tag type="success" size="small">{{ scope.row.properties.originalCrop }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="properties.area" label="面积(亩)" width="120">
              <template #default="scope">
                {{ scope.row.properties.area || 0 }}
              </template>
            </el-table-column>
          </el-table>
          <div v-if="data.stats.unchanged > 10" style="margin-top: 12px; text-align: center; color: #909399;">
            还有 {{ data.stats.unchanged - 10 }} 个无变化地块未显示...
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Grid, Warning, CircleCheck, TrendCharts, Search, Download, Right } from '@element-plus/icons-vue'

const props = defineProps({
  data: {
    type: Object,
    required: true
  }
})

const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(20)

// 变化率
const changeRate = computed(() => {
  if (props.data.stats.total === 0) return 0
  return ((props.data.stats.changed / props.data.stats.total) * 100).toFixed(1)
})

// 有变化的地块
const changedFeatures = computed(() => {
  return props.data.features.filter(f => f.properties?.hasChange === true)
})

// 无变化的地块
const unchangedFeatures = computed(() => {
  return props.data.features.filter(f => f.properties?.hasChange !== true)
})

// 过滤后的变化地块（搜索）
const filteredChangedFeatures = computed(() => {
  let features = changedFeatures.value
  
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    features = features.filter(f => 
      f.properties.plotName?.toLowerCase().includes(keyword) ||
      f.properties.plotId?.toString().includes(keyword) ||
      f.properties.originalCrop?.toLowerCase().includes(keyword) ||
      f.properties.currentCrop?.toLowerCase().includes(keyword)
    )
  }
  
  // 分页
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return features.slice(start, end)
})

// 差异类型标签
const getDiffTypeTagType = (type) => {
  const map = {
    changed: 'danger',
    abandoned: 'warning',
    unchanged: 'success'
  }
  return map[type] || 'info'
}

const getDiffTypeText = (type) => {
  const map = {
    changed: '类型变化',
    abandoned: '未种植',
    unchanged: '无变化'
  }
  return map[type] || '未知'
}

// 导出CSV
const exportCSV = () => {
  try {
    let csvContent = '\uFEFF' // UTF-8 BOM
    csvContent += '序号,地块ID,地块名称,原始作物,当前作物,面积(亩),变化类型\n'
    
    changedFeatures.value.forEach((feature, index) => {
      const props = feature.properties
      csvContent += `${index + 1},${props.plotId || ''},${props.plotName || ''},${props.originalCrop || ''},${props.currentCrop || ''},${props.area || 0},${getDiffTypeText(props.diffType)}\n`
    })
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `差异检测_${props.data.title}_${new Date().getTime()}.csv`
    link.click()
    
    ElMessage.success('CSV文件已导出')
  } catch (error) {
    console.error('导出CSV失败:', error)
    ElMessage.error('导出失败: ' + error.message)
  }
}
</script>

<style scoped lang="scss">
.difference-simple-view {
  .stat-card {
    border-left: 4px solid #409EFF;
    
    &.stat-danger {
      border-left-color: #f56c6c;
    }
    
    &.stat-success {
      border-left-color: #67c23a;
    }
  }
}
</style>








