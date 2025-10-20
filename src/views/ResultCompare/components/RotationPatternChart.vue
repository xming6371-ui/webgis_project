<template>
  <div id="rotation-pattern-chart" class="rotation-pattern-chart">
    <el-card shadow="hover">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>
            <el-icon><Refresh /></el-icon>
            作物轮作模式分析
          </span>
          <el-tag type="info">{{ patterns.length }} 种模式</el-tag>
        </div>
      </template>

      <div v-if="!hasData" style="text-align: center; padding: 40px; color: #909399;">
        暂无轮作模式数据
      </div>

      <div v-else>
        <el-alert
          title="轮作模式说明"
          type="info"
          :closable="false"
          style="margin-bottom: 20px;"
        >
          显示地块在多个时期的作物种植序列，帮助识别常见的轮作模式
        </el-alert>

        <el-scrollbar max-height="500px">
          <div class="pattern-list">
            <div
              v-for="(pattern, index) in patterns"
              :key="index"
              class="pattern-item"
              :class="{ 'top-pattern': index < 3 }"
            >
              <div class="pattern-rank">
                <el-tag v-if="index === 0" type="danger" effect="dark">TOP 1</el-tag>
                <el-tag v-else-if="index === 1" type="warning" effect="dark">TOP 2</el-tag>
                <el-tag v-else-if="index === 2" type="success" effect="dark">TOP 3</el-tag>
                <span v-else style="color: #909399;">{{ index + 1 }}</span>
              </div>

              <div class="pattern-content">
                <div class="pattern-sequence">
                  {{ pattern.pattern }}
                </div>
                <div class="pattern-info">
                  <el-tag size="small" type="info">{{ pattern.count }} 个地块</el-tag>
                  <el-tag size="small">占比 {{ getPercentage(pattern.count) }}%</el-tag>
                </div>
              </div>

              <div class="pattern-bar">
                <div
                  class="pattern-bar-inner"
                  :style="{ width: getBarWidth(pattern.count) }"
                ></div>
              </div>
            </div>
          </div>
        </el-scrollbar>

        <!-- 统计摘要 -->
        <el-divider />
        <div class="summary">
          <el-descriptions :column="3" border size="small">
            <el-descriptions-item label="总模式数">
              {{ patterns.length }} 种
            </el-descriptions-item>
            <el-descriptions-item label="最常见模式">
              {{ mostCommonPattern?.count || 0 }} 个地块
            </el-descriptions-item>
            <el-descriptions-item label="模式覆盖率">
              {{ getCoverage() }}%
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Refresh } from '@element-plus/icons-vue'

const props = defineProps({
  patterns: {
    type: Array,
    default: () => []
  },
  totalPlots: {
    type: Number,
    default: 0
  }
})

const hasData = computed(() => props.patterns && props.patterns.length > 0)

const mostCommonPattern = computed(() => {
  if (!hasData.value) return null
  return props.patterns[0]
})

const maxCount = computed(() => {
  if (!hasData.value) return 1
  return Math.max(...props.patterns.map(p => p.count))
})

const getPercentage = (count) => {
  if (props.totalPlots === 0) return 0
  return ((count / props.totalPlots) * 100).toFixed(1)
}

const getBarWidth = (count) => {
  const percentage = (count / maxCount.value) * 100
  return `${Math.max(percentage, 5)}%`
}

const getCoverage = () => {
  if (!hasData.value || props.totalPlots === 0) return 0
  const coveredPlots = props.patterns.reduce((sum, p) => sum + p.count, 0)
  return ((coveredPlots / props.totalPlots) * 100).toFixed(1)
}
</script>

<style scoped lang="scss">
.rotation-pattern-chart {
  .pattern-list {
    .pattern-item {
      display: grid;
      grid-template-columns: 80px 1fr 60px;
      align-items: center;
      gap: 16px;
      padding: 16px;
      margin-bottom: 12px;
      background: #f5f7fa;
      border-radius: 8px;
      border: 2px solid transparent;
      transition: all 0.3s;

      &:hover {
        background: #ecf5ff;
        border-color: #409eff;
        transform: translateX(4px);
      }

      &.top-pattern {
        background: linear-gradient(135deg, #fff9e6 0%, #fff 100%);
        border-color: #e6a23c;
        box-shadow: 0 2px 8px rgba(230, 162, 60, 0.2);
      }

      .pattern-rank {
        text-align: center;
        font-weight: 600;
        font-size: 16px;
      }

      .pattern-content {
        .pattern-sequence {
          font-size: 15px;
          font-weight: 600;
          color: #303133;
          margin-bottom: 8px;
          word-break: break-all;
        }

        .pattern-info {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
      }

      .pattern-bar {
        width: 100%;
        height: 100%;
        min-height: 60px;
        background: #e4e7ed;
        border-radius: 4px;
        overflow: hidden;
        position: relative;

        .pattern-bar-inner {
          height: 100%;
          background: linear-gradient(135deg, #409eff, #67c23a);
          transition: width 0.6s ease;
        }
      }
    }
  }

  .summary {
    margin-top: 16px;
  }
}
</style>



