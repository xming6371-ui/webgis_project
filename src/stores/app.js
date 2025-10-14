import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const isCollapse = ref(false)
  const theme = ref('light')
  
  const toggleSidebar = () => {
    isCollapse.value = !isCollapse.value
  }
  
  const setTheme = (newTheme) => {
    theme.value = newTheme
  }
  
  return {
    isCollapse,
    theme,
    toggleSidebar,
    setTheme
  }
})

