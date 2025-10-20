<template>
  <div id="unchanged-crop-chart" class="unchanged-crop-chart">
    <el-card shadow="hover">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>
            <el-icon><Check /></el-icon>
            无变化作物类型分析
          </span>
          <el-tag type="success">{{ unchangedCount }} 个地块</el-tag>
        </div>
      </template>

      <div v-if="!hasData" style="text-align: center; padding: 40px; color: #909399;">
        暂无无变化地块数据
      </div>

      <div v-else>
        <el-alert
          title="分析说明"
          type="success"
          :closable="false"
          style="margin-bottom: 20px;"
        >
          显示在整个时间段内作物类型保持不变的地块统计
        </el-alert>

        <!-- 作物类型柱状图 -->
        <div class="chart-container">
          <el-scrollbar max-height="400px">
            <div class="crop-bars">
              <div
                v-for="(item, index) in sortedUnchangedCrops"
                :key="index"
                class="crop-bar-item"
              >
                <div class="crop-info">
                  <div class="crop-name">
                    <div
                      class="crop-color"
                      :style="{ background: getCropColor(index) }"
                    ></div>
                    <span>{{ item.crop }}</span>
                  </div>
                  <div class="crop-stats">
                    <el-tag size="small" type="info">{{ item.count }} 个地块</el-tag>
                    <el-tag size="small">{{ item.percentage }}%</el-tag>
                  </div>
                </div>
                <div class="bar-container">
                  <div
                    class="bar-inner"
                    :style="{
                      width: getBarWidth(item.count),
                      background: getCropColor(index)
                    }"
                  >
                    <span class="bar-label">{{ item.count }}</span>
                  </div>
                </div>
              </div>
            </div>
          </el-scrollbar>
        </div>

        <!-- 统计摘要 -->
        <el-divider />
        <div class="summary">
          <el-descriptions :column="3" border size="small">
            <el-descriptions-item label="无变化地块总数">
              {{ unchangedCount }} 个
            </el-descriptions-item>
            <el-descriptions-item label="作物类型数">
              {{ sortedUnchangedCrops.length }} 种
            </el-descriptions-item>
            <el-descriptions-item label="最常见类型">
              {{ mostCommonCrop.crop }} ({{ mostCommonCrop.count }} 个)
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Check } from '@element-plus/icons-vue'

const props = defineProps({
  trajectories: {
    type: Array,
    default: () => []
  }
})

// 筛选出无变化的地块
const unchangedTrajectories = computed(() => {
  return props.trajectories.filter(traj => traj.changeCount === 0)
})

const hasData = computed(() => unchangedTrajectories.value.length > 0)

const unchangedCount = computed(() => unchangedTrajectories.value.length)

// 统计每种作物类型的无变化地块数量
const unchangedCrops = computed(() => {
  const cropCounts = {}
  
  unchangedTrajectories.value.forEach(traj => {
    const crop = traj.cropHistory[0] // 无变化的地块，所有时间点作物类型都相同
    cropCounts[crop] = (cropCounts[crop] || 0) + 1
  })
  
  const total = unchangedCount.value
  
  return Object.entries(cropCounts).map(([crop, count]) => ({
    crop,
    count,
    percentage: total > 0 ? ((count / total) * 100).toFixed(1) : '0'
  }))
})

// 按数量降序排序
const sortedUnchangedCrops = computed(() => {
  return [...unchangedCrops.value].sort((a, b) => b.count - a.count)
})

const mostCommonCrop = computed(() => {
  if (sortedUnchangedCrops.value.length === 0) {
    return { crop: '-', count: 0 }
  }
  return sortedUnchangedCrops.value[0]
})

const maxCount = computed(() => {
  if (sortedUnchangedCrops.value.length === 0) return 1
  return Math.max(...sortedUnchangedCrops.value.map(c => c.count))
})

const getBarWidth = (count) => {
  const percentage = (count / maxCount.value) * 100
  return `${Math.max(percentage, 5)}%`
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
.unchanged-crop-chart {
  .chart-container {
    .crop-bars {
      .crop-bar-item {
        margin-bottom: 16px;
        padding: 12px;
        background: #f5f7fa;
        border-radius: 8px;
        transition: all 0.3s;

        &:hover {
          background: #ecf5ff;
          transform: translateX(4px);
        }

        .crop-info {
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
              width: 12px;
              height: 12px;
              border-radius: 50%;
            }
          }

          .crop-stats {
            display: flex;
            gap: 8px;
          }
        }

        .bar-container {
          width: 100%;
          height: 32px;
          background: #e4e7ed;
          border-radius: 4px;
          overflow: hidden;
          position: relative;

          .bar-inner {
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding-right: 12px;
            transition: width 0.6s ease;
            position: relative;

            .bar-label {
              color: white;
              font-weight: 600;
              font-size: 13px;
              text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
            }
          }
        }
      }
    }
  }

  .summary {
    margin-top: 16px;
  }
}
</style>


