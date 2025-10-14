<template>
  <div class="layout-container">
    <!-- 顶部导航栏 -->
    <el-header class="layout-header">
      <div class="header-left">
        <el-icon class="logo-icon" :size="32" color="white">
          <Location />
        </el-icon>
        <h1 class="system-title">新疆WebGIS监测与分析系统</h1>
      </div>
      <div class="header-right">
        <el-space :size="20">
          <el-tooltip content="全屏" placement="bottom">
            <el-button :icon="FullScreen" circle @click="toggleFullscreen" />
          </el-tooltip>
          <el-tooltip content="刷新" placement="bottom">
            <el-button :icon="Refresh" circle @click="handleRefresh" />
          </el-tooltip>
          <el-dropdown>
            <div class="user-info">
              <el-avatar :size="32" :icon="User" />
              <span class="username">管理员</span>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item :icon="User">个人中心</el-dropdown-item>
                <el-dropdown-item :icon="Setting">系统设置</el-dropdown-item>
                <el-dropdown-item divided :icon="SwitchButton">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-space>
      </div>
    </el-header>

    <!-- 主体内容区 -->
    <el-container class="layout-main">
      <!-- 左侧菜单 -->
      <el-aside :width="isCollapse ? '64px' : '200px'" class="layout-aside">
        <el-menu
          :default-active="activeMenu"
          :collapse="isCollapse"
          :collapse-transition="false"
          class="layout-menu"
          @select="handleMenuSelect"
        >
          <el-menu-item index="/dashboard">
            <el-icon><Monitor /></el-icon>
            <template #title>监测主控台</template>
          </el-menu-item>
          <el-menu-item index="/image-management">
            <el-icon><Picture /></el-icon>
            <template #title>影像数据管理</template>
          </el-menu-item>
          <el-menu-item index="/task-management">
            <el-icon><Setting /></el-icon>
            <template #title>分类分析任务</template>
          </el-menu-item>
          <el-menu-item index="/result-compare">
            <el-icon><View /></el-icon>
            <template #title>结果查看与比对</template>
          </el-menu-item>
          <el-menu-item index="/report">
            <el-icon><DataAnalysis /></el-icon>
            <template #title>图表报表</template>
          </el-menu-item>
        </el-menu>
        <div class="collapse-btn" @click="isCollapse = !isCollapse">
          <el-icon>
            <ArrowRight v-if="isCollapse" />
            <ArrowLeft v-else />
          </el-icon>
        </div>
      </el-aside>

      <!-- 内容区 -->
      <el-main class="layout-content">
        <router-view v-slot="{ Component }">
          <transition name="fade-transform" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  Location,
  FullScreen,
  Refresh,
  User,
  Setting,
  SwitchButton,
  Monitor,
  Picture,
  View,
  DataAnalysis,
  ArrowRight,
  ArrowLeft
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()

const isCollapse = ref(false)

const activeMenu = computed(() => route.path)

const handleMenuSelect = (index) => {
  router.push(index)
}

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
    ElMessage.success('已进入全屏模式')
  } else {
    document.exitFullscreen()
    ElMessage.info('已退出全屏模式')
  }
}

const handleRefresh = () => {
  location.reload()
}
</script>

<style scoped lang="scss">
.layout-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f0f2f5;
}

.layout-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  color: white;

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;

    .logo-icon {
      background: rgba(255, 255, 255, 0.2);
      padding: 6px;
      border-radius: 8px;
    }

    .system-title {
      font-size: 20px;
      font-weight: 600;
      margin: 0;
      letter-spacing: 1px;
    }
  }

  .header-right {
    .user-info {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      padding: 5px 10px;
      border-radius: 20px;
      transition: all 0.3s;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .username {
        font-size: 14px;
        font-weight: 500;
      }
    }
  }
}

.layout-main {
  flex: 1;
  height: calc(100vh - 60px);
  overflow: hidden;
}

.layout-aside {
  background: white;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.05);
  position: relative;
  transition: width 0.3s;
  overflow: hidden;

  .layout-menu {
    border-right: none;
    height: calc(100vh - 120px);
  }

  .collapse-btn {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    background: #f0f2f5;
    border-radius: 50%;
    transition: all 0.3s;

    &:hover {
      background: #e0e3e8;
      transform: translateX(-50%) scale(1.1);
    }
  }
}

.layout-content {
  padding: 20px;
  overflow-y: auto;
  background: #f0f2f5;
}

/* 页面切换动画 */
.fade-transform-leave-active,
.fade-transform-enter-active {
  transition: all 0.3s;
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>

