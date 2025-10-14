<template>
  <el-card shadow="never" class="chart-card">
    <template #header>
      <div class="chart-header">
        <span class="chart-title">
          <el-icon v-if="icon"><component :is="icon" /></el-icon>
          {{ title }}
        </span>
        <slot name="actions">
          <el-button-group v-if="showActions" size="small">
            <el-button :icon="Download" @click="handleExport">导出</el-button>
            <el-button :icon="FullScreen" @click="handleFullscreen">全屏</el-button>
          </el-button-group>
        </slot>
      </div>
    </template>
    
    <div :id="chartId" class="chart-content" :style="{ height: height }"></div>
  </el-card>
</template>

<script setup>
import { Download, FullScreen } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  chartId: {
    type: String,
    required: true
  },
  icon: {
    type: Object,
    default: null
  },
  height: {
    type: String,
    default: '350px'
  },
  showActions: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['export', 'fullscreen'])

const handleExport = () => {
  emit('export')
  ElMessage.success('导出功能开发中')
}

const handleFullscreen = () => {
  emit('fullscreen')
  ElMessage.info('全屏功能开发中')
}
</script>

<style scoped lang="scss">
.chart-card {
  border-radius: 8px;
  
  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .chart-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 15px;
    }
  }
  
  .chart-content {
    width: 100%;
  }
}
</style>

