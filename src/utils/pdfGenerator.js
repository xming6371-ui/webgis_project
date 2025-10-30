/**
 * PDF报告生成工具
 * 使用jspdf、html2canvas、jspdf-autotable生成PDF报告
 * 
 * 注意：由于jsPDF对中文支持有限，我们使用HTML转Canvas的方式生成PDF
 * 这样可以完美支持中文，并且保留所有样式
 */

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { getCropCategory, CROP_CATEGORIES } from '@/config/cropCategories'

/**
 * 统一的配色方案（蓝紫色系）
 */
const THEME_COLORS = {
  // === 表格表头颜色 ===
  primary: '#4f46e5',      // 主表头背景色（靛蓝色）← 改这里！
  primaryDark: '#4338ca',  // 表头边框颜色
  secondary: '#8b5cf6',    // 次级表头背景色（紫色）
  
  // === 表格内容颜色 ===
  text: '#1f2937',         // 表格文字颜色（深灰）← 改这里！
  textLight: '#374151',    // 次要文字颜色（浅灰）
  
  // === 表格背景和边框 ===
  border: '#e5e7eb',       // 表格边框颜色
  grayBg: '#f9fafb',       // 表格交替行背景色
  grayBgDark: '#f3f4f6',   // 深一点的灰色背景
  gray: '#6b7280',         // 灰色文字
  
  // === 特殊数据颜色 ===
  success: '#10b981',      // 成功/增长数据（绿色）
  warning: '#f59e0b',      // 警告/变化数据（橙色）
  danger: '#ef4444',       // 危险/减少数据（红色）
  info: '#3b82f6',         // 信息提示（蓝色）
  
  // === 背景颜色 ===
  successBg: '#d1fae5',    // 成功背景色（浅绿）
  warningBg: '#fef3c7',    // 警告背景色（浅黄）
  dangerBg: '#fee2e2',     // 危险背景色（浅红）
  infoBg: '#eff6ff',       // 信息背景色（浅蓝）
  primaryBg: '#eef2ff'     // 主色背景（浅色版本）
}

/**
 * 默认字体大小配置
 */
const DEFAULT_FONT_SIZES = {
  coverTitle: '40px',   // 封面标题 - 增大
  coverSubtitle: '24px', // 封面副标题 - 增大
  coverDate: '16px',    // 封面日期 - 增大
  title: '28px',        // 主标题（H2）- 显著增大
  subtitle: '22px',     // 小标题（H3）- 显著增大
  tableHeader: '20px',  // 表格表头 - 显著增大
  tableCell: '15px',    // 表格内容 - 显著增大
  description: '14px',  // 说明文字 - 显著增大
  normal: '15px',       // 普通文字 - 显著增大
  cardLabel: '15px',    // 卡片标签 - 增大
  cardValue: '32px',    // 卡片数值 - 增大
  trendArrow: '20px',   // 趋势箭头 - 增大
  miniCoverTitle: '36px',   // 简化版封面标题 - 增大
  miniCoverSubtitle: '20px', // 简化版封面副标题 - 增大
  miniCardValue: '28px'     // 简化版卡片数值 - 增大
}

/**
 * 导出默认字体配置（供前端使用）
 */
export function getDefaultFontSizes() {
  return { ...DEFAULT_FONT_SIZES }
}

/**
 * 等待地图完全加载
 * @param {HTMLElement} mapElement - 地图DOM元素
 * @returns {Promise<boolean>} 是否成功加载
 */
async function waitForMapToLoad(mapElement) {
  console.log('⏳ 开始检测地图加载状态...')
  
  // 检测方法1：查找Canvas元素（OpenLayers会创建Canvas）
  const checkCanvasLoaded = () => {
    const canvases = mapElement.querySelectorAll('canvas')
    if (canvases.length === 0) {
      console.log('📋 未发现Canvas元素，地图可能未初始化')
      return false
    }
    
    // 检查Canvas是否有内容（不使用getImageData以避免跨域问题）
    let hasContent = false
    canvases.forEach((canvas, index) => {
      if (canvas.width > 0 && canvas.height > 0) {
        // 只检查canvas尺寸，不读取像素数据
        // 因为地图瓦片可能来自跨域资源，getImageData会报错
            hasContent = true
        console.log(`📋 Canvas ${index + 1}: ${canvas.width}x${canvas.height}, 已渲染`)
      }
    })
    
    return hasContent
  }
  
  // 检测方法2：查找地块元素（SVG或其他渲染元素）
  const checkFeaturesLoaded = () => {
    const features = mapElement.querySelectorAll('svg, .ol-layer, [class*="feature"]')
    console.log('🗺️ 发现地图要素元素:', features.length, '个')
    return features.length > 0
  }
  
  // 多次检测，最多等待5秒
  const maxAttempts = 10
  const interval = 500 // 每500ms检测一次
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`🔍 第 ${attempt}/${maxAttempts} 次检测...`)
    
    const canvasLoaded = checkCanvasLoaded()
    const featuresLoaded = checkFeaturesLoaded()
    
    if (canvasLoaded || featuresLoaded) {
      console.log('✅ 地图加载检测成功!')
      // 额外等待500ms确保渲染完成
      await new Promise(resolve => setTimeout(resolve, 500))
      return true
    }
    
    if (attempt < maxAttempts) {
      console.log(`⏳ 地图未完全加载，${interval}ms后重试...`)
      await new Promise(resolve => setTimeout(resolve, interval))
    }
  }
  
  console.warn('⚠️ 地图加载检测超时，可能未完全加载')
  return false
}

/**
 * 生成时序分析PDF报告（分段截图版本，避免内容跨页）
 * @param {Object} data - 分析数据
 * @param {string} activeTab - 当前活动标签页 ('timeline' | 'charts')
 * @param {Object} customConfig - 自定义配置（字体+配色）
 * @param {Function} onProgress - 进度回调函数 (current, total, message)
 * @returns {Promise<Blob>} PDF文件的Blob对象
 */
export async function generateTemporalPDF(data, activeTab = 'timeline', customConfig = null, onProgress = null) {
  console.log('📄 开始生成PDF报告（分段截图模式）...')
  
  // 提取配置
  let FONT_SIZES = DEFAULT_FONT_SIZES
  let COLORS = { ...THEME_COLORS } // 复制默认配色
  
  if (customConfig) {
    // 如果配置中包含 colors，说明是新的配置格式
    if (customConfig.colors) {
      const { colors, ...fontConfig } = customConfig
      FONT_SIZES = fontConfig
      // 应用自定义配色，使用预定义的浅色背景
      if (colors.primary) {
        COLORS.primary = colors.primary
        COLORS.primaryDark = colors.primary
      }
      if (colors.secondary) {
        COLORS.secondary = colors.secondary
      }
      if (colors.success) {
        COLORS.success = colors.success
      }
      if (colors.warning) {
        COLORS.warning = colors.warning
      }
      if (colors.danger) {
        COLORS.danger = colors.danger
      }
      
      // 根据配色方案设置对应的浅色背景
      // 由于我们使用的是预定义配色，直接使用固定的浅色背景即可
      // 这些颜色对所有配色方案都适用
      COLORS.primaryBg = '#eef2ff'   // 浅紫蓝色（适配所有主色）
      COLORS.successBg = '#d1fae5'   // 浅绿色
      COLORS.warningBg = '#fef3c7'   // 浅黄色
      COLORS.dangerBg = '#fee2e2'    // 浅红色
      
      console.log('🎨 应用自定义配色方案:', colors.name, COLORS)
    } else {
      // 兼容旧的纯字体配置格式
      FONT_SIZES = customConfig
    }
  }
  
  // 创建PDF
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15
  const usableWidth = pageWidth - 2 * margin
  const usableHeight = pageHeight - 2 * margin
  
  let currentY = margin // 当前页面的Y位置
  let pageIndex = 1
  
  console.log('📐 PDF页面尺寸:', pageWidth, 'mm x', pageHeight, 'mm')
  console.log('📐 可用区域:', usableWidth, 'mm x', usableHeight, 'mm')
  
  // 创建临时容器
  const createTempContainer = (html) => {
    const container = document.createElement('div')
    container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
      width: ${usableWidth * 3.78}px;
    background: white;
      padding: 20px;
    font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
  `
    container.innerHTML = html
    document.body.appendChild(container)
    return container
  }
  
  // 截图并添加到PDF的辅助函数
  const addSectionToPDF = async (container, options = {}) => {
    const {
      forceNewPage = false,
      maxHeight = usableHeight,
      scale = 2,
      isMap = false,  // 是否为地图（需要特殊处理）
      keepTogether = true  // 是否保持内容完整（不跨页）
    } = options
    
    try {
      // 等待渲染
  await new Promise(resolve => setTimeout(resolve, 100))
  
      // 截图配置（降低清晰度以减小文件大小）
      const html2canvasOptions = isMap ? {
        scale: 2.5,  // 提高地图清晰度
      useCORS: true,
        allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
        timeout: 10000
      } : {
        scale: 3,  // 提高普通内容清晰度
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        timeout: 8000
      }
      
      // 截图（带超时保护）
      const screenshotPromise = html2canvas(container, html2canvasOptions)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('html2canvas 超时')), isMap ? 12000 : 10000)
      )
      
      const canvas = await Promise.race([screenshotPromise, timeoutPromise])
      
      // 计算图片在PDF中的尺寸
     const imgWidth = usableWidth
     const imgHeight = (canvas.height * usableWidth) / canvas.width
     
      console.log(`  📸 截图完成: ${canvas.width}x${canvas.height}px → ${imgWidth.toFixed(1)}x${imgHeight.toFixed(1)}mm`)
      
      // 检查是否需要新页面
      let needNewPage = forceNewPage
      
      // 如果启用keepTogether，且内容不超过一页高度，则检查是否能完整放在当前页
      if (keepTogether && imgHeight <= usableHeight) {
        // 如果当前页剩余空间不足以容纳完整内容，就新建页面
        const remainingSpace = pageHeight - margin - currentY
        if (remainingSpace < imgHeight) {
          needNewPage = true
          console.log(`  📄 内容保持完整：剩余空间${remainingSpace.toFixed(1)}mm < 需要${imgHeight.toFixed(1)}mm，另起新页`)
        }
      } else if (!keepTogether) {
        // 如果不要求保持完整，按原来的逻辑
        needNewPage = needNewPage || (currentY + imgHeight > pageHeight - margin)
      }
      
      if (needNewPage) {
        // 如果不是第一页的第一个内容，就需要新建页面
        if (pageIndex > 1 || currentY > margin + 5) {  // 修复：当前页有内容时才新建
          console.log(`  📄 新建页面 (当前Y: ${currentY.toFixed(1)}mm, 需要高度: ${imgHeight.toFixed(1)}mm)`)
          pdf.addPage()
          currentY = margin
          pageIndex++
        }
      }
      
      // 如果图片太高，需要分页
      if (imgHeight > usableHeight) {
        console.log(`  ⚠️ 内容过高 (${imgHeight.toFixed(1)}mm > ${usableHeight.toFixed(1)}mm)，分页处理...`)
        
        // 分页处理
       const pageCanvas = document.createElement('canvas')
       const pageCtx = pageCanvas.getContext('2d')
       pageCanvas.width = canvas.width
       
       const usableCanvasHeight = (canvas.width * usableHeight) / usableWidth
       pageCanvas.height = usableCanvasHeight
       
        let srcY = 0
        let subPageIndex = 0
       
        while (srcY < canvas.height) {
          if (subPageIndex > 0) {
           pdf.addPage()
            currentY = margin
            pageIndex++
         }
         
          const remainingHeight = canvas.height - srcY
         const drawHeight = Math.min(usableCanvasHeight, remainingHeight)
         
          // 清空画布
         pageCtx.fillStyle = '#ffffff'
         pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
         
          // 绘制
         pageCtx.drawImage(
           canvas,
            0, srcY,
            canvas.width, drawHeight,
            0, 0,
            pageCanvas.width, drawHeight
          )
          
          // 添加到PDF（使用JPEG减小文件大小）
          try {
            const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.85)
         const pageImgHeight = (drawHeight * usableWidth) / canvas.width
            pdf.addImage(pageImgData, 'JPEG', margin, currentY, imgWidth, pageImgHeight)
            console.log(`  ✅ 分页 ${subPageIndex + 1} 已添加`)
          } catch (e) {
            console.error('  ⚠️ toDataURL 失败（可能是跨域），跳过此分页')
            throw new Error('Canvas 被污染，无法转换为图片')
          }
          
          srcY += usableCanvasHeight
          subPageIndex++
        }
        
        currentY = margin // 下一个内容从新页开始
      } else {
        // 正常添加（使用JPEG格式减小文件大小）
        try {
          const imgData = canvas.toDataURL('image/jpeg', 0.85)  // 使用JPEG，质量85%
          pdf.addImage(imgData, 'JPEG', margin, currentY, imgWidth, imgHeight)
          currentY += imgHeight + 5 // 添加间距
          console.log(`  ✅ 已添加到PDF，当前Y位置: ${currentY.toFixed(1)}mm`)
        } catch (e) {
          console.error('  ⚠️ toDataURL 失败（可能是跨域）')
          throw new Error('Canvas 被污染，无法转换为图片')
        }
      }
      
      return true
    } catch (error) {
      console.error('  ❌ 截图失败:', error)
      return false
    } finally {
      // 清理容器
      if (container.parentNode) {
        document.body.removeChild(container)
      }
    }
  }
  
  try {
    const timestamp = new Date().toLocaleString('zh-CN')
    const changeRate = data.stats?.total ? ((data.stats.changed / data.stats.total) * 100).toFixed(1) : 0
    
    console.log('📊 开始生成完整PDF报告（包含所有分析内容）...')
    
    // 1. 封面
    console.log('📄 [1/14] 生成封面...')
    try {
      const coverHTML = `
        <div style="text-align: center; padding: 80px 0;">
          <h1 style="font-size: ${FONT_SIZES.coverTitle}; color: #1f2937; margin: 0 0 20px 0; font-weight: bold;">
            时序分析完整报告
          </h1>
          <div style="font-size: ${FONT_SIZES.coverSubtitle}; color: #6b7280; margin: 20px 0;">
            地图、统计与图表分析
          </div>
          <div style="font-size: ${FONT_SIZES.coverDate}; color: #9ca3af; margin: 40px 0 0 0;">
            生成时间：${timestamp}
          </div>
        </div>
      `
      await addSectionToPDF(createTempContainer(coverHTML), { scale: 3 })
      console.log('  ✅ 封面已添加')
      if (onProgress) onProgress(1, 15, '封面')
    } catch (error) {
      console.error('  ❌ 封面生成失败:', error.message)
      if (onProgress) onProgress(1, 15, '封面（失败）')
    }
    
    // 2. 摘要信息
    console.log('📄 [2/14] 生成分析摘要...')
    try {
      const summaryHTML = `
        <div style="padding: 25px; background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.secondary} 100%); border-radius: 10px; color: white;">
          <h2 style="font-size: ${FONT_SIZES.title}; margin: 0 0 20px 0; border-bottom: 2px solid rgba(255,255,255,0.3); padding-bottom: 10px;">
            📊 分析摘要
          </h2>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
            <div style="background: rgba(255,255,255,0.15); padding: 18px; border-radius: 8px;">
              <div style="font-size: ${FONT_SIZES.cardLabel}; opacity: 0.9;">分析周期</div>
              <div style="font-size: ${FONT_SIZES.cardValue}; font-weight: bold; margin-top: 8px;">${data.filesCount || 0} 期</div>
            </div>
            <div style="background: rgba(255,255,255,0.15); padding: 18px; border-radius: 8px;">
              <div style="font-size: ${FONT_SIZES.cardLabel}; opacity: 0.9;">总地块数</div>
              <div style="font-size: ${FONT_SIZES.cardValue}; font-weight: bold; margin-top: 8px;">${data.stats?.total || 0} 个</div>
            </div>
            <div style="background: rgba(255,255,255,0.15); padding: 18px; border-radius: 8px;">
              <div style="font-size: ${FONT_SIZES.cardLabel}; opacity: 0.9;">变化地块</div>
              <div style="font-size: ${FONT_SIZES.cardValue}; font-weight: bold; margin-top: 8px;">${data.stats?.changed || 0} 个</div>
            </div>
            <div style="background: rgba(255,255,255,0.15); padding: 18px; border-radius: 8px;">
              <div style="font-size: ${FONT_SIZES.cardLabel}; opacity: 0.9;">变化率</div>
              <div style="font-size: ${FONT_SIZES.cardValue}; font-weight: bold; margin-top: 8px;">${changeRate}%</div>
            </div>
          </div>
        </div>
      `
      await addSectionToPDF(createTempContainer(summaryHTML), { scale: 3 })
      console.log('  ✅ 摘要已添加')
      if (onProgress) onProgress(2, 15, '分析摘要')
    } catch (error) {
      console.error('  ❌ 摘要生成失败:', error.message)
      if (onProgress) onProgress(2, 15, '分析摘要（失败）')
    }
    
    // 生成所有内容（不再区分 timeline 和 charts）
    await generateAllContentSections(pdf, data, { addSectionToPDF, createTempContainer, usableHeight, FONT_SIZES, COLORS, onProgress })
    
    console.log(`✅ PDF生成完成，共 ${pageIndex} 页`)
    return pdf.output('blob')
    
  } catch (error) {
    console.error('❌ PDF生成失败:', error)
    throw error
  }
}

/**
 * 生成所有内容（完整报告）
 */
async function generateAllContentSections(pdf, data, { addSectionToPDF, createTempContainer, usableHeight, FONT_SIZES, COLORS, onProgress }) {
  const totalSections = 15 // 总章节数
  let currentSection = 2 // 从3开始，因为封面和摘要已经是1和2了
  
  // 进度更新辅助函数
  const updateProgress = async (message) => {
    currentSection++
    if (onProgress) {
      await onProgress(currentSection, totalSections, message)
    }
  }
  
  // 3. 变化统计详情
  console.log('📄 [3/14] 生成变化统计详情...')
  try {
    const statsHTML = `
      <div>
        <h2 style="font-size: ${FONT_SIZES.title}; color: #1f2937; margin: 0 0 15px 0; border-left: 4px solid ${COLORS.primary}; padding-left: 10px;">
          📈 变化统计详情
        </h2>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid ${COLORS.border};">
          <thead>
            <tr style="background: ${COLORS.primary};">
              <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; font-size: ${FONT_SIZES.tableHeader}; color: white;">统计项</th>
              <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; font-size: ${FONT_SIZES.tableHeader}; color: white;">数值</th>
              <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; font-size: ${FONT_SIZES.tableHeader}; color: white;">占比</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background: white;">
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.tableCell};">总地块数</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.tableCell}; font-weight: bold;">${data.stats?.total || 0} 个</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.tableCell};">100%</td>
            </tr>
            <tr style="background: ${COLORS.warningBg};">
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.tableCell};">变化地块</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.tableCell}; font-weight: bold; color: ${COLORS.warning};">${data.stats?.changed || 0} 个</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.tableCell};">${((data.stats?.changed / data.stats?.total) * 100).toFixed(1)}%</td>
            </tr>
            <tr style="background: ${COLORS.successBg};">
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.tableCell};">未变化地块</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.tableCell}; font-weight: bold; color: ${COLORS.success};">${data.stats?.unchanged || 0} 个</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.tableCell};">${((data.stats?.unchanged / data.stats?.total) * 100).toFixed(1)}%</td>
            </tr>
            <tr style="background: ${COLORS.grayBg};">
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.tableCell};">总变化次数</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.tableCell}; font-weight: bold;">${data.stats?.totalChanges || 0} 次</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.tableCell};">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
    await addSectionToPDF(createTempContainer(statsHTML), { scale: 3 })
    console.log('  ✅ 统计表格已添加')
    await updateProgress('变化统计详情')
  } catch (error) {
    console.error('  ❌ 统计表格生成失败:', error.message)
    await updateProgress('变化统计详情（失败）')
  }
  
  // 4. 时序变化地图
  console.log('📄 [4/14] 捕获时序变化地图...')
  let mapImageData = ''
  
  const mapScreenshotPromise = (async () => {
    try {
      const mapElement = document.getElementById('temporal-map')
      if (!mapElement) {
        console.warn('  ⚠️ 未找到地图元素')
        return ''
      }
      
      console.log('  🗺️ 发现地图元素，开始截图...')
      console.log('  📸 尝试截图（跳过加载检测）...')
      
      try {
        const canvas = await html2canvas(mapElement, {
          scale: 2.5,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          timeout: 5000
        })
        
        const dataURL = canvas.toDataURL('image/jpeg', 0.85)
        const sizeKB = (dataURL.length * 0.75 / 1024).toFixed(2)
        console.log(`  ✅ 方法1成功，大小: ${sizeKB} KB`)
        return dataURL
      } catch (err) {
        console.error('  ❌ 截图失败:', err.message)
        return ''
      }
    } catch (error) {
      console.error('  ❌ 地图截图过程出错:', error.message)
      return ''
    }
  })()
  
  try {
    mapImageData = await Promise.race([
      mapScreenshotPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('地图截图超时')), 15000))
    ])
  } catch (timeoutError) {
    console.error('  ❌ 地图截图超时，跳过地图部分')
    mapImageData = ''
  }
  
  console.log('  📍 地图截图阶段完成，数据长度:', mapImageData.length)
  
  if (mapImageData && mapImageData.length > 20480) {
    console.log('  📍 尝试添加地图到PDF...')
    const mapHTML = `
      <div>
        <h2 style="font-size: ${FONT_SIZES.title}; color: #1f2937; margin: 0 0 20px 0; border-left: 4px solid ${COLORS.primary}; padding-left: 10px;">
          🗺️ 时序变化地图
        </h2>
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: #f9fafb;">
          <img src="${mapImageData}" style="width: 100%; height: auto; display: block;" alt="时序变化地图" />
        </div>
        <div style="padding: 12px; background: ${COLORS.primaryBg}; border-left: 4px solid ${COLORS.primary}; border-radius: 6px; font-size: ${FONT_SIZES.description}; margin-top: 10px;">
          <strong style="color: ${COLORS.primary};">📌 说明：</strong>
          <span style="color: ${COLORS.textLight};">地图中不同颜色代表地块的变化程度，绿色表示无变化，橙色至深红色表示变化频率逐渐增加。</span>
        </div>
      </div>
    `
    try {
      await addSectionToPDF(createTempContainer(mapHTML), { scale: 2.8, isMap: true })
      console.log('  ✅ 地图已添加到PDF')
      await updateProgress('时序变化地图')
    } catch (error) {
      console.error('  ❌ 地图添加失败，跳过此部分:', error.message)
      await updateProgress('时序变化地图（失败）')
    }
  } else {
    console.log('  ⚠️ 地图数据无效或过小，跳过地图部分')
  }
  
  // 5. 地块种植稳定性分析（替换原变化频率分布）
  if (data.features && data.features.length > 0) {
    console.log('📄 [5/14] 生成地块种植稳定性分析...')
    try {
      const changeFrequency = {}
      data.features.forEach(f => {
        const count = f.properties?.changeCount || 0
        changeFrequency[count] = (changeFrequency[count] || 0) + 1
      })
      
      // 计算稳定性指标
      const stableCount = (changeFrequency[0] || 0) + (changeFrequency[1] || 0)
      const stabilityIndex = ((stableCount / data.stats.total) * 100).toFixed(1)
      const avgChange = (data.stats.totalChanges / data.stats.total).toFixed(2)
      const highFreqCount = Object.entries(changeFrequency)
        .filter(([freq]) => parseInt(freq) >= 4)
        .reduce((sum, [, count]) => sum + count, 0)
      
      // 按稳定性等级分组
      const stabilityLevels = []
      Object.entries(changeFrequency).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).forEach(([freq, count]) => {
        const freqNum = parseInt(freq)
        const percentage = ((count / data.stats.total) * 100).toFixed(1)
        const barWidth = Math.min(100, percentage * 2)
        
        let level, emoji, bgColor, textColor, rating
        if (freqNum === 0) {
          level = '完全稳定'
          emoji = '🟢'
          bgColor = COLORS.successBg
          textColor = COLORS.success
          rating = '优秀'
        } else if (freqNum === 1) {
          level = '基本稳定'
          emoji = '🟡'
          bgColor = COLORS.warningBg
          textColor = COLORS.warning
          rating = '良好'
        } else if (freqNum <= 3) {
          level = '稳定性一般'
          emoji = '🟠'
          bgColor = '#fff4e6'
          textColor = '#ea580c'
          rating = '一般'
        } else {
          level = '稳定性较差'
          emoji = '🔴'
          bgColor = COLORS.dangerBg
          textColor = COLORS.danger
          rating = '较差'
        }
        
        stabilityLevels.push({ freq, count, percentage, barWidth, level, emoji, bgColor, textColor, rating })
      })
      
      const stabilityHTML = `
        <div>
          <h2 style="font-size: ${FONT_SIZES.title}; color: ${COLORS.text}; margin: 0 0 15px 0; font-weight: bold;">
            📊 地块种植稳定性分析
          </h2>
          
          <table style="width: 100%; border-collapse: collapse; border: 1px solid ${COLORS.border}; margin-bottom: 20px;">
            <thead>
              <tr style="background: ${COLORS.primary};">
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">稳定性等级</th>
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">变化次数</th>
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">地块数量</th>
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">占比</th>
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">分布图</th>
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">评价</th>
              </tr>
            </thead>
            <tbody>
              ${stabilityLevels.map((item, index) => `
                <tr style="background: ${item.bgColor};">
                  <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; font-size: ${FONT_SIZES.tableCell};">
                    <span style="font-size: ${FONT_SIZES.tableCell};">${item.emoji}</span>
                    <strong style="margin-left: 6px; color: ${item.textColor};">${item.level}</strong>
                    </td>
                  <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">${item.freq}次</td>
                  <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">${item.count}个</td>
                  <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">${item.percentage}%</td>
                  <td style="padding: 10px 12px; border: 1px solid ${COLORS.border};">
                    <div style="background: ${COLORS.primary}; height: 8px; width: ${item.barWidth}%; border-radius: 4px;"></div>
                  </td>
                  <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; color: ${item.textColor}; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">${item.rating}</td>
                  </tr>
              `).join('')}
              <tr style="background: ${COLORS.grayBgDark}; font-weight: bold;">
                <td colspan="2" style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.tableCell};">合计</td>
                <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-size: ${FONT_SIZES.tableCell};">${data.stats.total}个</td>
                <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-size: ${FONT_SIZES.tableCell};">100.0%</td>
                <td colspan="2" style="padding: 10px 12px; border: 1px solid ${COLORS.border};"></td>
              </tr>
            </tbody>
          </table>
          
          <div style="padding: 18px; background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.secondary} 100%); border-radius: 8px; color: white; margin-bottom: 15px;">
            <h3 style="font-size: ${FONT_SIZES.subtitle}; margin: 0 0 15px 0; border-bottom: 2px solid rgba(255,255,255,0.3); padding-bottom: 8px;">
              📈 稳定性综合指标
            </h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
              <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 6px;">
                <div style="font-size: ${FONT_SIZES.description}; opacity: 0.9; margin-bottom: 4px;">稳定性指数</div>
                <div style="font-size: ${FONT_SIZES.title}; font-weight: bold;">${stabilityIndex}%</div>
                <div style="font-size: ${FONT_SIZES.description}; opacity: 0.8; margin-top: 4px;">0-1次变化占比</div>
              </div>
              <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 6px;">
                <div style="font-size: ${FONT_SIZES.description}; opacity: 0.9; margin-bottom: 4px;">平均变化频率</div>
                <div style="font-size: ${FONT_SIZES.title}; font-weight: bold;">${avgChange}次/地块</div>
                <div style="font-size: ${FONT_SIZES.description}; opacity: 0.8; margin-top: 4px;">所有地块平均</div>
              </div>
              <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 6px;">
                <div style="font-size: ${FONT_SIZES.description}; opacity: 0.9; margin-bottom: 4px;">需关注地块</div>
                <div style="font-size: ${FONT_SIZES.title}; font-weight: bold;">${highFreqCount}个</div>
                <div style="font-size: ${FONT_SIZES.description}; opacity: 0.8; margin-top: 4px;">4次及以上变化</div>
              </div>
            </div>
          </div>
          
          <div style="padding: 15px; background: ${COLORS.primaryBg}; border-left: 4px solid ${COLORS.primary}; border-radius: 6px; margin-bottom: 15px;">
              <strong style="color: ${COLORS.primary}; font-size: ${FONT_SIZES.normal};">💡 农业意义：</strong>
            <ul style="margin: 8px 0 0 0; padding-left: 20px; line-height: 1.8; font-size: ${FONT_SIZES.description}; color: ${COLORS.textLight};">
              <li><strong>完全稳定地块（${((changeFrequency[0] || 0) / data.stats.total * 100).toFixed(1)}%）：</strong>整个分析期间保持同一作物，可能是专业化种植或主导作物</li>
              <li><strong>基本稳定地块（${((changeFrequency[1] || 0) / data.stats.total * 100).toFixed(1)}%）：</strong>仅调整一次，符合正常的作物轮作规律</li>
              <li><strong>频繁变化地块（${(highFreqCount / data.stats.total * 100).toFixed(1)}%）：</strong>建议实地调研，了解频繁变化的原因（市场、政策、土壤等因素）</li>
            </ul>
          </div>
          
          <div style="padding: 12px; background: ${COLORS.primaryBg}; border-left: 4px solid ${COLORS.primary}; border-radius: 6px; font-size: ${FONT_SIZES.description};">
            <strong style="color: ${COLORS.primary};">📋 等级划分标准：</strong>
            <span style="color: ${COLORS.textLight};">
              优秀（0次）- 整个分析期间保持同一作物 | 
              良好（1次）- 仅调整一次 | 
              一般（2-3次）- 有一定轮作但较频繁 | 
              较差（4次+）- 变化过于频繁
            </span>
          </div>
        </div>
      `
      await addSectionToPDF(createTempContainer(stabilityHTML), { scale: 3 })
      console.log('  ✅ 种植稳定性分析已添加')
      await updateProgress('地块种植稳定性分析')
    } catch (error) {
      console.error('  ❌ 种植稳定性分析生成失败:', error.message)
      await updateProgress('地块种植稳定性分析（失败）')
    }
  }
  
  // 6. 作物分布趋势对比
  const distributionData = (data.cropDistribution || [])
  if (distributionData.length > 0) {
    console.log('📄 [6/14] 生成作物分布趋势对比...')
    try {
      const allCrops = new Set()
      distributionData.forEach(point => {
        point.crops.forEach(crop => allCrops.add(crop.crop))
      })
      
      const distributionHTML = `
        <div>
          <h2 style="font-size: ${FONT_SIZES.title}; color: #1f2937; margin: 0 0 15px 0; border-left: 4px solid ${COLORS.primary}; padding-left: 10px;">
            🌾 作物分布趋势对比
          </h2>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid ${COLORS.border}; table-layout: fixed;">
            <thead>
              <tr style="background: ${COLORS.primary};">
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; width: 15%; vertical-align: middle;">作物类型</th>
                ${distributionData.map(point => `
                  <th style="padding: 12px 8px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; word-wrap: break-word; word-break: break-all; white-space: normal; line-height: 1.4; vertical-align: middle;">
                    ${point.taskName || point.time || `时间${point.timeIndex + 1}`}
                  </th>
                `).join('')}
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; width: 12%; vertical-align: middle;">变化趋势</th>
              </tr>
            </thead>
            <tbody>
              ${Array.from(allCrops).slice(0, 15).map((cropName, i) => {
                const values = distributionData.map(point => {
                  const crop = point.crops.find(c => c.crop === cropName)
                  return crop ? crop.count : 0
                })
                const trend = values[values.length - 1] - values[0]
                const trendSymbol = trend > 0 ? '↑' : trend < 0 ? '↓' : '→'
                const trendColor = trend > 0 ? COLORS.success : trend < 0 ? COLORS.danger : COLORS.gray
                
                return `
                  <tr style="background: ${i % 2 === 0 ? '#ffffff' : COLORS.grayBg};">
                    <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">${cropName}</td>
                    ${values.map(val => `
                      <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-size: ${FONT_SIZES.tableCell};">${val}</td>
                    `).join('')}
                    <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-weight: bold; color: ${trendColor}; font-size: ${FONT_SIZES.tableCell}; word-wrap: break-word;">
                      ${trendSymbol} ${Math.abs(trend)}
                    </td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
          <div style="padding: 12px; background: ${COLORS.primaryBg}; border-left: 4px solid ${COLORS.primary}; border-radius: 6px; font-size: ${FONT_SIZES.description}; margin-top: 10px;">
            <strong style="color: ${COLORS.primary};">📌 说明：</strong>
            <span style="color: ${COLORS.textLight};">↑ 表示地块数增加，↓ 表示减少，→ 表示无变化</span>
          </div>
        </div>
      `
      await addSectionToPDF(createTempContainer(distributionHTML), { scale: 3 })
      console.log('  ✅ 作物分布趋势已添加')
      await updateProgress('作物分布趋势对比')
    } catch (error) {
      console.error('  ❌ 作物分布趋势生成失败:', error.message)
      await updateProgress('作物分布趋势对比（失败）')
    }
  }
  
  // 7. 经济作物与粮食作物转换分析（新增）
  if (distributionData.length > 0 && data.trajectories && data.trajectories.length > 0) {
    console.log('📄 [7/15] 生成经济作物与粮食作物转换分析...')
    try {
      // 统计各时期的作物分类占比
      const categoryTrend = []
      distributionData.forEach((point, index) => {
        const stat = {
          period: index + 1,
          name: point.taskName || point.time || `时期${index + 1}`,
          grain: { count: 0, percentage: 0 },
          economic: { count: 0, percentage: 0 },
          other: { count: 0, percentage: 0 }
        }
        
        point.crops.forEach(crop => {
          const category = getCropCategory(crop.crop)
          if (category === '粮食作物') {
            stat.grain.count += crop.count
          } else if (category === '经济作物') {
            stat.economic.count += crop.count
          } else {
            stat.other.count += crop.count
          }
        })
        
        const total = stat.grain.count + stat.economic.count + stat.other.count
        stat.grain.percentage = ((stat.grain.count / total) * 100).toFixed(1)
        stat.economic.percentage = ((stat.economic.count / total) * 100).toFixed(1)
        stat.other.percentage = ((stat.other.count / total) * 100).toFixed(1)
        
        categoryTrend.push(stat)
      })
      
      // 计算变化趋势
      const firstPeriod = categoryTrend[0]
      const lastPeriod = categoryTrend[categoryTrend.length - 1]
      const grainChange = ((lastPeriod.grain.count - firstPeriod.grain.count) / firstPeriod.grain.count * 100).toFixed(1)
      const economicChange = ((lastPeriod.economic.count - firstPeriod.economic.count) / firstPeriod.economic.count * 100).toFixed(1)
      
      // 统计转换流向（所有相邻时期）
      const transitions = { '粮食→粮食': [], '粮食→经济': [], '经济→粮食': [], '经济→经济': [], '其他': [] }
      
      data.trajectories.forEach(traj => {
        const history = traj.cropHistory || []
        for (let i = 0; i < history.length - 1; i++) {
          const fromCategory = getCropCategory(history[i])
          const toCategory = getCropCategory(history[i + 1])
          const period = `${i + 1}→${i + 2}`
          
          let key = '其他'
          if (fromCategory === '粮食作物' && toCategory === '粮食作物') key = '粮食→粮食'
          else if (fromCategory === '粮食作物' && toCategory === '经济作物') key = '粮食→经济'
          else if (fromCategory === '经济作物' && toCategory === '粮食作物') key = '经济→粮食'
          else if (fromCategory === '经济作物' && toCategory === '经济作物') key = '经济→经济'
          
          if (!transitions[key].find(t => t.period === period)) {
            transitions[key].push({ period, count: 0 })
          }
          transitions[key].find(t => t.period === period).count++
        }
      })
      
      // 地块完整路径分类
      const pathTypes = {
        '始终粮食作物': 0,
        '始终经济作物': 0,
        '粮食→经济转型': 0,
        '经济→粮食转型': 0,
        '多次粮经互换': 0,
        '其他混合路径': 0
      }
      
      data.trajectories.forEach(traj => {
        const history = traj.cropHistory || []
        const categories = history.map(crop => getCropCategory(crop))
        const unique = [...new Set(categories)]
        
        if (unique.length === 1) {
          if (unique[0] === '粮食作物') pathTypes['始终粮食作物']++
          else if (unique[0] === '经济作物') pathTypes['始终经济作物']++
          else pathTypes['其他混合路径']++
        } else {
          const first = categories[0]
          const last = categories[categories.length - 1]
          
          if (first === '粮食作物' && last === '经济作物') {
            pathTypes['粮食→经济转型']++
          } else if (first === '经济作物' && last === '粮食作物') {
            pathTypes['经济→粮食转型']++
          } else {
            let changeCount = 0
            for (let i = 0; i < categories.length - 1; i++) {
              if (categories[i] !== categories[i + 1]) changeCount++
            }
            if (changeCount >= 2) pathTypes['多次粮经互换']++
            else pathTypes['其他混合路径']++
          }
        }
      })
      
      // 第一部分：标题 + 说明 + 一、各时期占比趋势
      const economicHTML1 = `
        <div>
          <h2 style="font-size: ${FONT_SIZES.title}; color: ${COLORS.text}; margin: 0 0 15px 0; font-weight: bold;">
            💰 经济作物与粮食作物转换分析
          </h2>
          
          <div style="padding: 12px; background: ${COLORS.primaryBg}; border-left: 4px solid ${COLORS.primary}; border-radius: 6px; margin-bottom: 20px;">
              <strong style="color: ${COLORS.primary}; font-size: ${FONT_SIZES.normal};">📌 作物分类配置：</strong>
            <div style="font-size: ${FONT_SIZES.description}; color: ${COLORS.textLight}; margin-top: 8px; line-height: 1.6;">
              <strong>粮食作物：</strong>${CROP_CATEGORIES.粮食作物.join('、')} | 
              <strong>经济作物：</strong>${CROP_CATEGORIES.经济作物.join('、')} | 
              <strong>其他：</strong>${CROP_CATEGORIES.其他.join('、')}
            </div>
          </div>
          
          <h3 style="font-size: ${FONT_SIZES.subtitle}; color: ${COLORS.textLight}; margin: 20px 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid ${COLORS.border};">
            📈 一、各时期占比趋势
          </h3>
          
          <table style="width: 100%; border-collapse: collapse; border: 1px solid ${COLORS.border}; margin-bottom: 20px; table-layout: fixed;">
            <thead>
              <tr style="background: ${COLORS.primary};">
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; width: 15%; vertical-align: middle;">作物类型</th>
                ${categoryTrend.map(period => `
                  <th style="padding: 12px 8px; text-align: center; border: 1px solid ${COLORS.primaryDark}; font-size: ${FONT_SIZES.tableHeader}; color: white; word-wrap: break-word; word-break: break-all; white-space: normal; line-height: 1.4; vertical-align: middle;">
                    ${period.name}
                  </th>
                `).join('')}
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; width: 12%; vertical-align: middle;">变化趋势</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background: ${COLORS.warningBg};">
                <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">
                  <span style="color: ${COLORS.warning};">🌾 粮食作物</span>
                </td>
                ${categoryTrend.map((period, i) => `
                  <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border};">
                    <div style="font-weight: bold; font-size: ${FONT_SIZES.tableCell};">${period.grain.count}个</div>
                    <div style="font-size: ${FONT_SIZES.description}; color: ${COLORS.gray};">${period.grain.percentage}%</div>
                  </td>
                `).join('')}
                <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-weight: bold; font-size: ${FONT_SIZES.tableCell}; word-wrap: break-word;">
                  <span style="color: ${parseFloat(grainChange) >= 0 ? COLORS.success : COLORS.danger}; font-size: ${FONT_SIZES.tableCell};">
                    ${parseFloat(grainChange) >= 0 ? '↑' : '↓'}${Math.abs(grainChange)}%
                  </span>
                </td>
              </tr>
              <tr style="background: ${COLORS.successBg};">
                <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">
                  <span style="color: ${COLORS.success};">💰 经济作物</span>
                </td>
                ${categoryTrend.map((period, i) => `
                  <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border};">
                    <div style="font-weight: bold; font-size: ${FONT_SIZES.tableCell};">${period.economic.count}个</div>
                    <div style="font-size: ${FONT_SIZES.description}; color: ${COLORS.gray};">${period.economic.percentage}%</div>
                  </td>
                `).join('')}
                <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-weight: bold; font-size: ${FONT_SIZES.tableCell}; word-wrap: break-word;">
                  <span style="color: ${parseFloat(economicChange) >= 0 ? COLORS.success : COLORS.danger}; font-size: ${FONT_SIZES.tableCell};">
                    ${parseFloat(economicChange) >= 0 ? '↑' : '↓'}${Math.abs(economicChange)}%
                  </span>
                </td>
              </tr>
              <tr style="background: ${COLORS.grayBg};">
                <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">
                  <span style="color: ${COLORS.gray};">⚪ 其他</span>
                </td>
                ${categoryTrend.map((period, i) => `
                  <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border};">
                    <div style="font-weight: bold; font-size: ${FONT_SIZES.tableCell};">${period.other.count}个</div>
                    <div style="font-size: ${FONT_SIZES.description}; color: ${COLORS.gray};">${period.other.percentage}%</div>
                  </td>
                `).join('')}
                <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-size: ${FONT_SIZES.tableCell};"></td>
              </tr>
            </tbody>
          </table>
        </div>
      `
      await addSectionToPDF(createTempContainer(economicHTML1), { scale: 3 })
      
      // 第二部分：二、转换流向统计（单独一页）
      if (data.filesCount >= 2) {
        const economicHTML2 = `
          <div>
            <h3 style="font-size: ${FONT_SIZES.subtitle}; color: ${COLORS.textLight}; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid ${COLORS.border};">
              🔄 二、转换流向统计
            </h3>
            
            <table style="width: 100%; border-collapse: collapse; border: 1px solid ${COLORS.border}; margin-bottom: 20px;">
              <thead>
                <tr style="background: ${COLORS.primary};">
                  <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">转换方向</th>
                  ${transitions['粮食→粮食'].map((t, i) => `
                    <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; font-size: ${FONT_SIZES.tableHeader}; color: white; vertical-align: middle;">${t.period}期</th>
                  `).join('')}
                  <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">合计</th>
                  <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">占比</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(transitions).filter(([key]) => key !== '其他').map(([key, periods], index) => {
                  const total = periods.reduce((sum, p) => sum + p.count, 0)
                  const allTransitions = Object.values(transitions).flat().reduce((sum, p) => sum + p.count, 0)
                  const percentage = ((total / allTransitions) * 100).toFixed(1)
                  const bgColor = index % 2 === 0 ? '#ffffff' : COLORS.grayBg
                  
                  return `
                    <tr style="background: ${bgColor};">
                      <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">${key}</td>
                      ${periods.map(p => `
                        <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-size: ${FONT_SIZES.tableCell};">${p.count}次</td>
                      `).join('')}
                      <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-weight: bold; color: ${COLORS.primary}; font-size: ${FONT_SIZES.tableCell};">${total}次</td>
                      <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">${percentage}%</td>
                    </tr>
                  `
                }).join('')}
              </tbody>
            </table>
          </div>
        `
        await addSectionToPDF(createTempContainer(economicHTML2), { scale: 3 })
      }
      
      // 第三部分：三、地块完整路径分类 + 综合评估
      const economicHTML3 = `
        <div>
          <h3 style="font-size: ${FONT_SIZES.subtitle}; color: ${COLORS.textLight}; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid ${COLORS.border};">
            🗺️ 三、地块完整路径分类
          </h3>
          
          <table style="width: 100%; border-collapse: collapse; border: 1px solid ${COLORS.border}; margin-bottom: 20px;">
            <thead>
              <tr style="background: ${COLORS.primary};">
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">路径类型</th>
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">示例</th>
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">地块数</th>
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">占比</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(pathTypes).map(([type, count], index) => {
                const percentage = ((count / data.stats.total) * 100).toFixed(1)
                const examples = {
                  '始终粮食作物': '粮-粮-粮-粮',
                  '始终经济作物': '经-经-经-经',
                  '粮食→经济转型': '粮-粮-经-经',
                  '经济→粮食转型': '经-经-粮-粮',
                  '多次粮经互换': '粮-经-粮-经',
                  '其他混合路径': '粮-经-粮-其他'
                }
                
                const colors = {
                  '始终粮食作物': { bg: COLORS.warningBg, emoji: '🟡' },
                  '始终经济作物': { bg: COLORS.successBg, emoji: '🟢' },
                  '粮食→经济转型': { bg: '#dbeafe', emoji: '🔵' },
                  '经济→粮食转型': { bg: '#dbeafe', emoji: '🔵' },
                  '多次粮经互换': { bg: '#fed7aa', emoji: '🟠' },
                  '其他混合路径': { bg: COLORS.grayBg, emoji: '🟣' }
                }
                
                return `
                  <tr style="background: ${colors[type].bg};">
                    <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">
                      <span style="font-size: ${FONT_SIZES.tableCell};">${colors[type].emoji}</span> ${type}
                    </td>
                    <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-family: monospace; font-size: ${FONT_SIZES.description};">
                      ${examples[type]}
                    </td>
                    <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">${count}个</td>
                    <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">${percentage}%</td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
          
          <div style="padding: 18px; background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.secondary} 100%); border-radius: 8px; color: white; margin-bottom: 15px;">
            <h3 style="font-size: ${FONT_SIZES.subtitle}; margin: 0 0 12px 0; border-bottom: 2px solid rgba(255,255,255,0.3); padding-bottom: 8px;">
              📊 综合评估
            </h3>
            <ul style="margin: 0; padding-left: 20px; line-height: 2; font-size: ${FONT_SIZES.tableCell};">
              <li><strong>整体趋势：</strong>${parseFloat(economicChange) > 0 ? '经济作物化加速' : '种植结构稳定'}
                （粮食作物 ${firstPeriod.grain.percentage}% → ${lastPeriod.grain.percentage}%，
                经济作物 ${firstPeriod.economic.percentage}% → ${lastPeriod.economic.percentage}%）</li>
              <li><strong>专一地块：</strong>${pathTypes['始终粮食作物'] + pathTypes['始终经济作物']}个（${(((pathTypes['始终粮食作物'] + pathTypes['始终经济作物']) / data.stats.total) * 100).toFixed(1)}%），种植方向明确</li>
              <li><strong>转型地块：</strong>${pathTypes['粮食→经济转型'] + pathTypes['经济→粮食转型']}个（${(((pathTypes['粮食→经济转型'] + pathTypes['经济→粮食转型']) / data.stats.total) * 100).toFixed(1)}%），明确的结构调整</li>
            </ul>
          </div>
          
          <div style="padding: 15px; background: ${COLORS.primaryBg}; border-left: 4px solid ${COLORS.primary}; border-radius: 6px;">
              <strong style="color: ${COLORS.primary}; font-size: ${FONT_SIZES.normal};">💡 政策建议：</strong>
            <ul style="margin: 8px 0 0 0; padding-left: 20px; line-height: 1.8; font-size: ${FONT_SIZES.description}; color: ${COLORS.textLight};">
              <li>关注粮食作物种植面积变化，确保区域粮食安全</li>
              <li>经济作物增长应与市场需求和风险承受能力相匹配</li>
              <li>建议保持合理的粮经比例，避免过度单一化</li>
            </ul>
          </div>
        </div>
      `
      await addSectionToPDF(createTempContainer(economicHTML3), { scale: 3 })
      console.log('  ✅ 经济作物与粮食作物转换分析已添加')
      await updateProgress('经济作物与粮食作物转换分析')
    } catch (error) {
      console.error('  ❌ 经济作物与粮食作物转换分析生成失败:', error.message)
      await updateProgress('经济作物与粮食作物转换分析（失败）')
    }
  }
  
  // 8. 作物转换流向TOP20
  const transitions = Object.entries(data.transitionMatrix || {}).sort((a, b) => b[1] - a[1]).slice(0, 20)
  if (transitions.length > 0) {
    console.log(`📄 [8/15] 生成作物转换流向TOP20... 实际数量: ${transitions.length}条`)
    try {
      const filesCount = data.filesCount || 2
      const transitionHTML = `
        <div>
          <h2 style="font-size: ${FONT_SIZES.title}; color: ${COLORS.text}; margin: 0 0 15px 0; font-weight: bold;">
            🔄 作物转换流向TOP20
          </h2>
          
          <div style="padding: 12px; background: ${COLORS.primaryBg}; border-left: 4px solid ${COLORS.primary}; border-radius: 6px; margin-bottom: 15px;">
              <strong style="color: ${COLORS.primary}; font-size: ${FONT_SIZES.normal};">📌 说明：</strong>
            <div style="font-size: ${FONT_SIZES.description}; color: ${COLORS.textLight}; margin-top: 6px; line-height: 1.6;">
              ${filesCount <= 2 ? `
                当前为 <strong>${filesCount}期</strong> 分析。转换流向统计的是<strong>相邻时期间的作物变化方向</strong>。
                ${filesCount === 2 ? '两期分析时，此表与下方轮作模式表内容相同（建议使用3期及以上数据以体现轮作规律）。' : ''}
              ` : `
                统计 <strong>${filesCount}期</strong> 数据中，所有相邻时期间的作物转换次数。
                例如："小麦 → 玉米"出现150次，表示有150个地块在某个时期从小麦转为玉米。
              `}
            </div>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; border: 1px solid ${COLORS.border};">
            <thead>
              <tr style="background: ${COLORS.primary};">
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">排名</th>
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">转换类型</th>
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">次数</th>
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">占比</th>
              </tr>
            </thead>
            <tbody>
              ${transitions.map(([key, count], i) => {
                const percentage = ((count / (data.stats?.totalChanges || 1)) * 100).toFixed(1)
                return `
                  <tr style="background: ${i % 2 === 0 ? '#ffffff' : COLORS.grayBg};">
                    <td style="padding: 8px 10px; text-align: center; border: 1px solid ${COLORS.border}; font-weight: bold; color: ${i < 3 ? COLORS.primary : COLORS.gray}; font-size: ${FONT_SIZES.tableCell};">
                      ${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td style="padding: 8px 10px; text-align: center; border: 1px solid ${COLORS.border}; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">${key}</td>
                    <td style="padding: 8px 10px; text-align: center; border: 1px solid ${COLORS.border}; font-size: ${FONT_SIZES.tableCell}; color: ${COLORS.text};">${count} 次</td>
                    <td style="padding: 8px 10px; text-align: center; border: 1px solid ${COLORS.border}; font-size: ${FONT_SIZES.tableCell}; color: ${COLORS.text};">${percentage}%</td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
        </div>
      `
      await addSectionToPDF(createTempContainer(transitionHTML), { scale: 3 })
      console.log('  ✅ 作物转换流向已添加')
      await updateProgress('作物转换流向TOP20')
    } catch (error) {
      console.error('  ❌ 作物转换流向生成失败:', error.message)
      await updateProgress('作物转换流向TOP20（失败）')
    }
  }
  
  // 9. 作物轮作模式分析（仅分析有变化的地块）
  console.log('📄 [9/15] 生成作物轮作模式分析...')
  try {
    const filesCount = data.filesCount || 2
    
    // 从 trajectories 中提取轮作模式（只统计有变化的地块）
    const rotationPatterns = {}
    let changedCount = 0
    
    if (data.trajectories && data.trajectories.length > 0) {
      // 优先使用 trajectories（正确的数据源）
      const changedTrajectories = data.trajectories.filter(traj => (traj.changeCount || 0) > 0)
      changedCount = changedTrajectories.length
      
      changedTrajectories.forEach(traj => {
        // 使用 cropHistory 而不是 timeline
        const cropHistory = traj.cropHistory || []
        if (cropHistory.length >= 2) {
          const pattern = cropHistory.join(' → ')
          rotationPatterns[pattern] = (rotationPatterns[pattern] || 0) + 1
        }
      })
    } else if (data.features && data.features.length > 0) {
      // 降级方案：从 features 提取（如果有 cropSequence 属性）
      const changedFeatures = data.features.filter(f => (f.properties?.changeCount || 0) > 0)
      changedCount = changedFeatures.length
      
      changedFeatures.forEach(f => {
        const cropSequence = f.properties?.cropSequence
        if (cropSequence && cropSequence.includes(' → ')) {
          rotationPatterns[cropSequence] = (rotationPatterns[cropSequence] || 0) + 1
        }
      })
    }
    
    const topPatterns = Object.entries(rotationPatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
    
    console.log(`  📊 分析结果: ${changedCount} 个变化地块，${topPatterns.length} 种轮作模式`)
    
    if (topPatterns.length > 0) {
      const rotationHTML = `
        <div>
          <h2 style="font-size: ${FONT_SIZES.title}; color: ${COLORS.text}; margin: 0 0 15px 0; font-weight: bold;">
            🔁 作物轮作模式分析 TOP15
          </h2>
          
          <div style="padding: 12px; background: ${COLORS.primaryBg}; border-left: 4px solid ${COLORS.primary}; border-radius: 6px; margin-bottom: 15px;">
              <strong style="color: ${COLORS.primary}; font-size: ${FONT_SIZES.normal};">📌 说明：</strong>
            <div style="font-size: ${FONT_SIZES.description}; color: ${COLORS.textLight}; margin-top: 6px; line-height: 1.6;">
              ${filesCount <= 2 ? `
                当前为 <strong>${filesCount}期</strong> 分析。轮作模式显示的是<strong>地块完整的种植路径</strong>。
                ${filesCount === 2 ? `
                两期分析时，轮作模式即为"起始作物 → 结束作物"。<br>
                <strong>💡 建议：</strong>使用3期及以上数据，可分析出"小麦 → 玉米 → 水稻"等多年轮作策略。
                ` : ''}
              ` : `
                统计 <strong>${filesCount}期</strong> 数据中，地块的<strong>完整种植序列</strong>。
                例如："小麦 → 玉米 → 水稻"出现45次，表示有45个地块按此顺序完整轮作了${filesCount}期。
                <br><strong>区别于转换流向：</strong>轮作模式关注整体策略，转换流向关注单步变化。
              `}
            </div>
          </div>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid ${COLORS.border};">
            <thead>
              <tr style="background: ${COLORS.primary};">
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">排名</th>
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">轮作模式</th>
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">地块数</th>
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">周期</th>
              </tr>
            </thead>
            <tbody>
              ${topPatterns.map(([pattern, count], i) => {
                const cycle = pattern.split(' → ').length
                return `
                  <tr style="background: ${i % 2 === 0 ? '#ffffff' : COLORS.grayBg};">
                    <td style="padding: 8px 10px; text-align: center; border: 1px solid ${COLORS.border}; font-weight: bold; color: ${i < 3 ? COLORS.primary : COLORS.gray}; font-size: ${FONT_SIZES.tableCell};">
                      ${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td style="padding: 8px 10px; text-align: center; border: 1px solid ${COLORS.border}; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">${pattern}</td>
                    <td style="padding: 8px 10px; text-align: center; border: 1px solid ${COLORS.border}; font-size: ${FONT_SIZES.tableCell}; color: ${COLORS.text};">${count} 个</td>
                    <td style="padding: 8px 10px; text-align: center; border: 1px solid ${COLORS.border}; font-size: ${FONT_SIZES.tableCell}; color: ${COLORS.text};">${cycle}期</td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
          <div style="padding: 12px; background: ${COLORS.primaryBg}; border-left: 4px solid ${COLORS.primary}; border-radius: 6px; font-size: ${FONT_SIZES.description}; margin-top: 10px;">
            <strong style="color: ${COLORS.primary};">📋 等级划分标准：</strong>
            <span style="color: ${COLORS.textLight};">轮作模式表示地块在各时期种植的作物序列，箭头表示时间顺序</span>
          </div>
        </div>
      `
      await addSectionToPDF(createTempContainer(rotationHTML), { scale: 3 })
      console.log('  ✅ 轮作模式分析已添加')
      await updateProgress('作物轮作模式分析')
    } else {
      console.log('  ⚠️ 无轮作模式数据，跳过此部分')
      await updateProgress('作物轮作模式分析（无数据）')
    }
  } catch (error) {
    console.error('  ❌ 轮作模式分析生成失败:', error.message)
    await updateProgress('作物轮作模式分析（失败）')
  }
  
  // 10. 未变化地块作物类型分析
  let unchangedTrajectories = []
  
  if (data.trajectories && data.trajectories.length > 0) {
    // 优先使用 trajectories（正确的数据源）
    unchangedTrajectories = data.trajectories.filter(traj => (traj.changeCount || 0) === 0)
  } else if (data.features && data.features.length > 0) {
    // 降级方案：从 features 提取
    unchangedTrajectories = data.features.filter(f => (f.properties?.changeCount || 0) === 0)
  }
  
  if (unchangedTrajectories.length > 0) {
    console.log('📄 [10/15] 生成未变化地块作物类型分析...')
    console.log(`  📊 未变化地块数量: ${unchangedTrajectories.length}`)
    
    try {
      const unchangedCrops = {}
      unchangedTrajectories.forEach(traj => {
        // 使用 cropHistory 的第一个元素（无变化地块所有时间点作物都相同）
        const crop = traj.cropHistory?.[0] || traj.properties?.startCrop || traj.properties?.cropHistory?.[0] || '未知'
        unchangedCrops[crop] = (unchangedCrops[crop] || 0) + 1
      })
      
      console.log(`  📊 统计结果: ${Object.keys(unchangedCrops).length} 种作物类型`)
      
      const unchangedHTML = `
        <div>
          <h2 style="font-size: ${FONT_SIZES.title}; color: #1f2937; margin: 0 0 15px 0; border-left: 4px solid ${COLORS.primary}; padding-left: 10px;">
            🟢 未变化地块作物类型分析
          </h2>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid ${COLORS.border};">
            <thead>
              <tr style="background: ${COLORS.primary};">
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">作物类型</th>
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">地块数量</th>
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">占未变化地块比例</th>
                <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">占总地块比例</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(unchangedCrops).sort((a, b) => b[1] - a[1]).map(([crop, count], i) => {
                const percentageUnchanged = ((count / unchangedTrajectories.length) * 100).toFixed(1)
                const percentageTotal = ((count / (data.stats?.total || 1)) * 100).toFixed(1)
                return `
                  <tr style="background: ${i % 2 === 0 ? '#ffffff' : COLORS.grayBg};">
                    <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">${crop}</td>
                    <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-size: ${FONT_SIZES.tableCell};">${count} 个</td>
                    <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; color: ${COLORS.text}; font-size: ${FONT_SIZES.tableCell};">${percentageUnchanged}%</td>
                    <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; color: ${COLORS.gray}; font-size: ${FONT_SIZES.tableCell};">${percentageTotal}%</td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
          <div style="padding: 10px; background: ${COLORS.infoBg}; border-radius: 6px; font-size: ${FONT_SIZES.description}; color: ${COLORS.primary}; margin-top: 10px;">
            <strong>说明：</strong>这些地块在整个分析期间保持同一作物种植，表现出较强的种植稳定性
          </div>
        </div>
      `
      await addSectionToPDF(createTempContainer(unchangedHTML), { scale: 3 })
      console.log('  ✅ 未变化地块分析已添加')
      await updateProgress('未变化地块作物类型分析')
    } catch (error) {
      console.error('  ❌ 未变化地块分析生成失败:', error.message)
      await updateProgress('未变化地块作物类型分析（失败）')
    }
  }
  
  // 11-13. 各时期作物分布详情
  if (distributionData.length > 0) {
    console.log(`📄 [11-13/15] 生成各时期作物分布详情（共${distributionData.length}期）...`)
    try {
      for (const [index, point] of distributionData.entries()) {
        const topCrops = point.crops.slice(0, 10)
        const cropHTML = `
          <div>
            ${index === 0 ? `
            <h2 style="font-size: ${FONT_SIZES.title}; color: #1f2937; margin: 0 0 20px 0; border-left: 4px solid ${COLORS.primary}; padding-left: 10px;">
              📅 各时期作物分布详情
            </h2>
            ` : ''}
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 15px;">
              <div style="background: #f3f4f6; padding: 12px 15px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">
                ${point.taskName || point.time || `时间点${point.timeIndex + 1}`}（共${point.crops.length}种作物）
              </div>
              <table style="width: 100%; border-collapse: collapse; border: 1px solid ${COLORS.border};">
                <thead>
                  <tr style="background: ${COLORS.primary};">
                    <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; font-size: ${FONT_SIZES.tableHeader}; color: white; vertical-align: middle;">作物类型</th>
                    <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; font-size: ${FONT_SIZES.tableHeader}; color: white; vertical-align: middle;">地块数</th>
                    <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; font-size: ${FONT_SIZES.tableHeader}; color: white; vertical-align: middle;">占比</th>
                  </tr>
                </thead>
                <tbody>
                  ${topCrops.map((crop, i) => `
                    <tr style="${i % 2 === 0 ? 'background: #ffffff;' : 'background: #f9fafb;'}">
                      <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-size: ${FONT_SIZES.tableCell};">${crop.crop}</td>
                      <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-size: ${FONT_SIZES.tableCell}; font-weight: bold;">${crop.count} 个</td>
                      <td style="padding: 10px 12px; text-align: center; border: 1px solid ${COLORS.border}; font-size: ${FONT_SIZES.tableCell}; color: ${COLORS.text};">${crop.percentage}%</td>
                    </tr>
                  `).join('')}
                  ${point.crops.length > 10 ? `
                    <tr style="background: #f9fafb;">
                      <td colspan="3" style="padding: 8px 12px; text-align: center; font-size: ${FONT_SIZES.description}; color: ${COLORS.gray}; border-top: 1px solid ${COLORS.border};">
                        ... 其他${point.crops.length - 10}种作物
                      </td>
                    </tr>
                  ` : ''}
                </tbody>
              </table>
            </div>
          </div>
        `
        await addSectionToPDF(createTempContainer(cropHTML), { scale: 3 })
        console.log(`  ✅ 时期 ${index + 1}/${distributionData.length} 作物分布已添加`)
      }
      await updateProgress('各时期作物分布详情')
    } catch (error) {
      console.error('  ❌ 各时期作物分布生成失败:', error.message)
      await updateProgress('各时期作物分布详情（失败）')
    }
  }
  
  // 14. 数据统计汇总
  console.log('📄 [14/15] 生成数据统计汇总...')
  try {
    const summaryStatsHTML = `
      <div>
        <h2 style="font-size: ${FONT_SIZES.title}; color: #1f2937; margin: 0 0 15px 0; border-left: 4px solid ${COLORS.primary}; padding-left: 10px;">
          📊 数据统计汇总
        </h2>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid ${COLORS.border};">
          <thead>
            <tr style="background: ${COLORS.primary};">
              <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; width: 40%; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">统计项</th>
              <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; width: 30%; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">数值</th>
              <th style="padding: 12px; text-align: center; border: 1px solid ${COLORS.primaryDark}; width: 30%; color: white; font-size: ${FONT_SIZES.tableHeader}; vertical-align: middle;">说明</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background: ${COLORS.grayBg};">
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">分析时期数</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.tableCell};">${data.filesCount || distributionData.length} 期</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.description};">分析覆盖的时间周期数</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">总地块数</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.tableCell};">${data.stats?.total || 0} 个</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.description};">所有分析的地块数量</td>
            </tr>
            <tr style="background: ${COLORS.grayBg};">
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">变化地块数</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; color: ${COLORS.warning}; font-size: ${FONT_SIZES.tableCell};">${data.stats?.changed || 0} 个</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.description};">至少发生一次作物变化的地块</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">未变化地块数</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; color: ${COLORS.success}; font-size: ${FONT_SIZES.tableCell};">${data.stats?.unchanged || 0} 个</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.description};">始终保持同一作物的地块</td>
            </tr>
            <tr style="background: ${COLORS.grayBg};">
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">总变化次数</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.tableCell};">${data.stats?.totalChanges || 0} 次</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.description};">所有地块的变化次数总和</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">平均变化次数</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.tableCell};">${((data.stats?.totalChanges || 0) / (data.stats?.total || 1)).toFixed(2)} 次/地块</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.description};">每个地块平均变化次数</td>
            </tr>
            <tr style="background: ${COLORS.grayBg};">
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">作物转换模式数</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.tableCell};">${Object.keys(data.transitionMatrix || {}).length} 种</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.description};">不同的作物转换类型数</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-weight: bold; font-size: ${FONT_SIZES.tableCell};">作物类型数</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.tableCell};">${new Set((distributionData[0]?.crops || []).map(c => c.crop)).size} 种</td>
              <td style="padding: 10px 12px; border: 1px solid ${COLORS.border}; text-align: center; font-size: ${FONT_SIZES.description};">分析区域种植的作物种类</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
    await addSectionToPDF(createTempContainer(summaryStatsHTML), { scale: 3 })
    console.log('  ✅ 数据统计汇总已添加')
    await updateProgress('数据统计汇总')
  } catch (error) {
    console.error('  ❌ 数据统计汇总生成失败:', error.message)
    await updateProgress('数据统计汇总（失败）')
  }
  
  // 15. 报告说明
  console.log('📄 [15/15] 生成报告说明...')
  try {
    const notesHTML = `
      <div>
        <h2 style="font-size: ${FONT_SIZES.title}; color: #1f2937; margin: 0 0 15px 0; border-left: 4px solid ${COLORS.primary}; padding-left: 10px;">
          📝 报告说明
        </h2>
        <div style="padding: 20px; background: ${COLORS.primaryBg}; border-radius: 8px; border-left: 4px solid ${COLORS.primary};">
          <h3 style="font-size: ${FONT_SIZES.subtitle}; color: ${COLORS.primary}; margin: 0 0 12px 0;">本报告包含以下分析内容：</h3>
          <ul style="margin: 0; padding-left: 20px; line-height: 2; color: ${COLORS.textLight}; font-size: ${FONT_SIZES.description};">
            <li><strong>变化统计详情：</strong>地块变化的基本统计数据</li>
            <li><strong>时序变化地图：</strong>地块变化的空间分布可视化</li>
            <li><strong>地块种植稳定性分析：</strong>不同稳定性等级的地块数量统计与评价</li>
            <li><strong>作物分布趋势对比：</strong>各时期作物种植面积的横向对比</li>
            <li><strong>经济作物与粮食作物转换分析：</strong>粮经作物占比趋势与转换流向</li>
            <li><strong>作物转换流向：</strong>最常见的TOP20作物转换模式</li>
            <li><strong>作物轮作模式：</strong>完整的多期作物轮作序列分析（TOP15）</li>
            <li><strong>未变化地块分析：</strong>种植稳定性及作物类型分布</li>
            <li><strong>各时期作物分布：</strong>每个时期的详细作物分布</li>
            <li><strong>数据统计汇总：</strong>全面的数据统计指标</li>
          </ul>
          
          <h3 style="font-size: ${FONT_SIZES.subtitle}; color: ${COLORS.primary}; margin: 20px 0 12px 0;">关键术语说明：</h3>
          <ul style="margin: 0; padding-left: 20px; line-height: 2; color: ${COLORS.textLight}; font-size: ${FONT_SIZES.description};">
            <li><strong>变化地块：</strong>在分析期间至少发生一次作物转换的地块</li>
            <li><strong>未变化地块：</strong>始终保持同一作物种植的地块</li>
            <li><strong>变化次数：</strong>地块在相邻时期间发生作物转换的次数</li>
            <li><strong>轮作模式：</strong>地块在多个时期的完整作物种植序列</li>
            <li><strong>转换流向：</strong>从某一作物转换到另一作物的模式</li>
          </ul>
          
          <div style="margin-top: 20px; padding: 12px; background: ${COLORS.primaryBg}; border-left: 4px solid ${COLORS.primary}; border-radius: 6px; font-size: ${FONT_SIZES.description};">
            <strong style="color: ${COLORS.primary};">💡 提示：</strong>
            <span style="color: ${COLORS.textLight};">本报告基于时序分析自动生成，所有统计数据和图表均基于实际分析结果。建议结合实地调研进行综合分析。</span>
          </div>
        </div>
      </div>
    `
    await addSectionToPDF(createTempContainer(notesHTML), { scale: 3 })
    console.log('  ✅ 报告说明已添加')
    await updateProgress('报告说明')
  } catch (error) {
    console.error('  ❌ 报告说明生成失败:', error.message)
    await updateProgress('报告说明（失败）')
  }
  
  console.log('  📍 所有内容生成完成')
}

/**
 * 将Blob保存为文件
 * @param {Blob} blob - PDF Blob对象
 * @param {string} filename - 文件名
 */
export function downloadPDFBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}


