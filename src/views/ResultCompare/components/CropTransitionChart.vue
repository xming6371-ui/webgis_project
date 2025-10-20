<template>
  <div id="crop-transition-chart" class="crop-transition-chart">
    <el-card shadow="hover">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>
            <el-icon><TrendCharts /></el-icon>
            作物转换流向图
          </span>
          <el-tag type="info">共 {{ totalTransitions }} 次变化</el-tag>
        </div>
      </template>

      <div v-if="!hasData" style="text-align: center; padding: 40px; color: #909399;">
        暂无作物转换数据
      </div>

      <div v-else class="chart-content">
        <el-alert
          type="info"
          :closable="false"
          style="margin-bottom: 16px;"
        >
          <template #title>
            <span style="font-size: 13px;">
              共统计到 <strong>{{ normalizedTransitions.length }}</strong> 种不同的作物转换类型，
              总计发生 <strong>{{ totalTransitions }}</strong> 次转换（已排除无变化情况）
            </span>
          </template>
        </el-alert>
        
        <!-- 流向图可视化 -->
        <div class="flow-chart">
          <div
            v-for="(item, index) in displayTransitions"
            :key="index"
            class="flow-item"
            :style="{ '--flow-width': getFlowWidth(item.count) }"
          >
            <div class="flow-left">
              <el-tag type="success" size="small">{{ item.from }}</el-tag>
            </div>
            <div class="flow-bar">
              <div class="flow-bar-inner" :style="{ width: getFlowWidth(item.count) }">
                <span class="flow-count">{{ item.count }}</span>
              </div>
            </div>
            <div class="flow-right">
              <el-tag type="warning" size="small">{{ item.to }}</el-tag>
            </div>
          </div>
        </div>

        <!-- 查看更多 -->
        <div v-if="transitions.length > displayLimit" style="text-align: center; margin-top: 16px;">
          <el-button size="small" link @click="showAll = !showAll">
            {{ showAll ? '收起' : `查看全部 (${transitions.length})` }}
          </el-button>
        </div>

        <!-- 统计信息 -->
        <el-divider />
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-label">最常见转换</div>
            <div class="stat-value">
              <el-tag size="small">{{ mostCommon.from }}</el-tag>
              <el-icon><Right /></el-icon>
              <el-tag size="small">{{ mostCommon.to }}</el-tag>
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-label">转换类型数</div>
            <div class="stat-value">{{ normalizedTransitions.length }} 种</div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { TrendCharts, Right } from '@element-plus/icons-vue'

const props = defineProps({
  transitions: {
    type: [Array, Object], // 支持数组和对象两种格式
    default: () => []
  },
  totalChanges: {
    type: Number,
    default: 0 // 总变化次数（排除无变化的）
  }
})

const showAll = ref(false)
const displayLimit = 10

// 数据格式规范化：支持对象格式和数组格式
const normalizedTransitions = computed(() => {
  if (!props.transitions) return []
  
  // 如果已经是数组格式 [{from, to, count, transition}, ...]
  if (Array.isArray(props.transitions)) {
    return props.transitions
  }
  
  // 如果是对象格式 {'棉花 → 小麦': 10, '小麦 → 玉米': 20}，转换为数组
  if (typeof props.transitions === 'object') {
    return Object.entries(props.transitions)
      .map(([transition, count]) => {
        const [from, to] = transition.split(' → ')
        return {
          from: from || '未知',
          to: to || '未知',
          count,
          transition
        }
      })
      .sort((a, b) => b.count - a.count) // 按数量降序排序
  }
  
  return []
})

const hasData = computed(() => normalizedTransitions.value && normalizedTransitions.value.length > 0)

const totalTransitions = computed(() => {
  // 如果传入了totalChanges，使用传入值；否则计算
  if (props.totalChanges > 0) {
    console.log('🔢 使用传入的totalChanges:', props.totalChanges)
    return props.totalChanges
  }
  const calculated = normalizedTransitions.value.reduce((sum, item) => sum + item.count, 0)
  console.log('🔢 计算得到的totalTransitions:', calculated)
  return calculated
})

const displayTransitions = computed(() => {
  return showAll.value ? normalizedTransitions.value : normalizedTransitions.value.slice(0, displayLimit)
})

const mostCommon = computed(() => {
  if (!hasData.value) return { from: '-', to: '-', transition: '-' }
  return normalizedTransitions.value[0]
})

const maxCount = computed(() => {
  if (!hasData.value) return 1
  return Math.max(...normalizedTransitions.value.map(t => t.count))
})

const getFlowWidth = (count) => {
  const percentage = (count / maxCount.value) * 100
  return `${Math.max(percentage, 10)}%`
}
</script>

<style scoped lang="scss">
.crop-transition-chart {
  .chart-content {
    .flow-chart {
      .flow-item {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
        gap: 12px;

        .flow-left,
        .flow-right {
          width: 120px;
        }

        .flow-left {
          text-align: right;
        }

        .flow-right {
          text-align: left;
        }

        .flow-bar {
          flex: 1;
          height: 32px;
          background: #f5f7fa;
          border-radius: 4px;
          position: relative;
          overflow: hidden;

          .flow-bar-inner {
            height: 100%;
            background: linear-gradient(90deg, #67c23a, #409eff);
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding-right: 12px;
            transition: width 0.6s ease;
            position: relative;

            .flow-count {
              color: white;
              font-weight: 600;
              font-size: 13px;
              text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
            }
          }
        }
      }
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;

      .stat-item {
        text-align: center;

        .stat-label {
          font-size: 13px;
          color: #909399;
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 16px;
          font-weight: 600;
          color: #303133;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
      }
    }
  }
}
</style>


