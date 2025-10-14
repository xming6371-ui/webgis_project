<template>
  <div class="map-container-wrapper">
    <div :id="mapId" class="map-content" :style="{ height: height }"></div>
    <div v-if="!mapInitialized" class="map-placeholder">
      <el-icon :size="60"><Location /></el-icon>
      <p>地图加载中...</p>
      <p class="tip">需要集成 OpenLayers 库</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Location } from '@element-plus/icons-vue'

const props = defineProps({
  mapId: {
    type: String,
    default: 'map-container'
  },
  height: {
    type: String,
    default: '500px'
  }
})

const mapInitialized = ref(false)

onMounted(() => {
  // 这里将来可以初始化 OpenLayers 地图
  console.log(`地图容器 ${props.mapId} 已挂载`)
})
</script>

<style scoped lang="scss">
.map-container-wrapper {
  position: relative;
  width: 100%;
  
  .map-content {
    width: 100%;
    background: #f5f7fa;
    border-radius: 4px;
  }
  
  .map-placeholder {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: #909399;
    
    p {
      margin-top: 15px;
      font-size: 16px;
      
      &.tip {
        font-size: 13px;
        color: #c0c4cc;
        margin-top: 8px;
      }
    }
  }
}
</style>

