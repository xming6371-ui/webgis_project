<template>
  <div id="crop-distribution-chart" class="crop-distribution-chart">
    <el-card shadow="hover">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>
            <el-icon><DataAnalysis /></el-icon>
            作物分布趋势
          </span>
          <el-select v-model="displayMode" size="small" style="width: 120px;">
            <el-option label="数量" value="count" />
            <el-option label="面积" value="area" />
            <el-option label="占比" value="percentage" />
          </el-select>
        </div>
      </template>

      <div v-if="!hasData" style="text-align: center; padding: 40px; color: #909399;">
        暂无作物分布数据
      </div>

      <div v-else>
        <!-- 时间点选择器 -->
        <div class="time-selector">
          <el-radio-group v-model="selectedTimeIndex" size="small">
            <el-radio-button
              v-for="(point, index) in distribution"
              :key="index"
              :label="index"
            >
              {{ formatTimeLabel(point.taskName || point.time) }}
            </el-radio-button>
          </el-radio-group>
        </div>

        <!-- 当前时间点的作物分布 -->
        <div class="current-distribution">
          <el-scrollbar max-height="400px">
            <div class="crop-list">
              <div
                v-for="(crop, index) in currentCrops"
                :key="index"
                class="crop-item"
              >
                <div class="crop-header">
                  <div class="crop-name">
                    <div
                      class="crop-color"
                      :style="{ background: getCropColor(index) }"
                    ></div>
                    <span>{{ crop.crop }}</span>
                  </div>
                  <div class="crop-value">{{ getCropValue(crop) }}</div>
                </div>
                <el-progress
                  :percentage="parseFloat(crop.percentage)"
                  :color="getCropColor(index)"
                  :show-text="false"
                />
              </div>
            </div>
          </el-scrollbar>
        </div>

        <!-- 对比视图 -->
        <el-divider />
        <div class="comparison-view">
          <div style="margin-bottom: 12px; font-weight: 600; color: #606266;">
            各时期对比
          </div>
          <el-table :data="comparisonData" border size="small" max-height="300">
            <el-table-column prop="crop" label="作物类型" fixed width="120" />
            <el-table-column
              v-for="(point, index) in distribution"
              :key="index"
              :label="formatTimeLabel(point.taskName || point.time)"
              align="center"
              width="100"
            >
              <template #default="scope">
                <span :style="{ color: getCellColor(scope.row, index) }">
                  {{ getCellValue(scope.row, index) }}
                </span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { DataAnalysis } from '@element-plus/icons-vue'

const props = defineProps({
  distribution: {
    type: Array,
    default: () => []
  }
})

const displayMode = ref('count') // count | area | percentage
const selectedTimeIndex = ref(0)

const hasData = computed(() => props.distribution && props.distribution.length > 0)

// 数据格式规范化：支持对象格式和数组格式（兼容新旧两种数据格式）
const normalizeCropsData = (crops) => {
  if (!crops) return []
  
  // 如果已经是数组格式 [{crop, count, percentage}, ...]（新格式）
  if (Array.isArray(crops)) {
    return crops
  }
  
  // 如果是对象格式 {'棉花': 10, '小麦': 20}（旧格式），转换为数组
  if (typeof crops === 'object') {
    const total = Object.values(crops).reduce((sum, count) => sum + count, 0)
    return Object.entries(crops).map(([crop, count]) => ({
      crop,
      count,
      percentage: total > 0 ? ((count / total) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.count - a.count) // 按数量降序排序
  }
  
  return []
}

const currentCrops = computed(() => {
  if (!hasData.value) return []
  const point = props.distribution[selectedTimeIndex.value]
  // 使用规范化函数，确保返回数组格式
  return normalizeCropsData(point?.crops)
})

// 构建对比数据表格
const comparisonData = computed(() => {
  if (!hasData.value) return []

  // 收集所有出现过的作物
  const allCrops = new Set()
  props.distribution.forEach(point => {
    // 兼容性处理：支持新旧两种格式
    const crops = normalizeCropsData(point.crops)
    crops.forEach(crop => allCrops.add(crop.crop))
  })

  // 为每个作物构建时间序列数据
  return Array.from(allCrops).map(cropName => {
    const row = { crop: cropName }
    props.distribution.forEach((point, index) => {
      const crops = normalizeCropsData(point.crops)
      const cropData = crops.find(c => c.crop === cropName)
      row[`time_${index}`] = cropData || { count: 0, area: 0, percentage: '0' }
    })
    return row
  })
})

const formatTimeLabel = (label) => {
  if (!label) return '未知'
  
  // 尝试从文件名中提取年份信息（如：2024_kle_vh_kndvi -> 2024）
  const yearMatch = label.match(/(\d{4})/)
  if (yearMatch) {
    return yearMatch[1] // 返回年份
  }
  
  // 如果是日期格式，提取月-日
  const dateMatch = label.match(/(\d{4}-)?(\d{1,2}-\d{1,2})/)
  if (dateMatch) {
    return dateMatch[2]
  }
  
  // 否则返回前8个字符
  return label.length > 8 ? label.substring(0, 8) : label
}

const getCropValue = (crop) => {
  switch (displayMode.value) {
    case 'count':
      return `${crop.count} 个地块`
    case 'area':
      return `${crop.area.toFixed(2)} 亩`
    case 'percentage':
      return `${crop.percentage}%`
    default:
      return `${crop.count} 个地块`
  }
}

const getCellValue = (row, timeIndex) => {
  const cropData = row[`time_${timeIndex}`]
  if (!cropData || cropData.count === 0) return '-'
  
  switch (displayMode.value) {
    case 'count':
      return `${cropData.count} 个地块`
    case 'area':
      return `${cropData.area.toFixed(1)} 亩`
    case 'percentage':
      return `${cropData.percentage}%`
    default:
      return `${cropData.count} 个地块`
  }
}

const getCellColor = (row, timeIndex) => {
  const cropData = row[`time_${timeIndex}`]
  if (!cropData || cropData.count === 0) return '#c0c4cc'
  
  const value = parseFloat(cropData.percentage)
  if (value > 20) return '#67c23a'
  if (value > 10) return '#409eff'
  if (value > 5) return '#e6a23c'
  return '#909399'
}

const cropColors = [
  '#67c23a', '#409eff', '#e6a23c', '#f56c6c', '#909399',
  '#6f7ad3', '#00d4ff', '#00ffaa', '#ff6b9d', '#c71585'
]

const getCropColor = (index) => {
  return cropColors[index % cropColors.length]
}
</script>

<style scoped lang="scss">
.crop-distribution-chart {
  .time-selector {
    margin-bottom: 20px;
    text-align: center;

    :deep(.el-radio-group) {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
    }
  }

  .current-distribution {
    .crop-list {
      .crop-item {
        margin-bottom: 20px;
        padding: 12px;
        background: #f5f7fa;
        border-radius: 8px;
        transition: all 0.3s;

        &:hover {
          background: #ecf5ff;
          transform: translateX(4px);
        }

        .crop-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;

          .crop-name {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            color: #303133;

            .crop-color {
              width: 16px;
              height: 16px;
              border-radius: 4px;
            }
          }

          .crop-value {
            font-size: 16px;
            font-weight: 600;
            color: #409eff;
          }
        }
      }
    }
  }

  .comparison-view {
    :deep(.el-table) {
      .el-table__cell {
        padding: 8px 0;
      }
    }
  }
}
</style>

