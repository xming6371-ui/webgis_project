/**
 * PDF报告生成工具
 * 使用jspdf、html2canvas、jspdf-autotable生成PDF报告
 * 
 * 注意：由于jsPDF对中文支持有限，我们使用HTML转Canvas的方式生成PDF
 * 这样可以完美支持中文，并且保留所有样式
 */

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

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
    
    // 检查Canvas是否有内容（不是空白）
    let hasContent = false
    canvases.forEach((canvas, index) => {
      if (canvas.width > 0 && canvas.height > 0) {
        const ctx = canvas.getContext('2d')
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        
        // 检查是否有非透明像素
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 0) { // alpha > 0
            hasContent = true
            break
          }
        }
        console.log(`📋 Canvas ${index + 1}: ${canvas.width}x${canvas.height}, 有内容: ${hasContent}`)
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
 * 生成时序分析PDF报告
 * @param {Object} data - 分析数据
 * @param {string} activeTab - 当前活动标签页 ('timeline' | 'charts')
 * @returns {Promise<Blob>} PDF文件的Blob对象
 */
export async function generateTemporalPDF(data, activeTab = 'timeline') {
  // 创建一个临时的HTML容器用于生成PDF
  const reportContainer = document.createElement('div')
  reportContainer.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: 800px;
    background: white;
    padding: 40px;
    font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
  `
  
  // 生成HTML内容（等待地图截图）
  console.log('⏳ 开始生成报告内容，等待地图加载...')
  reportContainer.innerHTML = await generateReportHTML(data, activeTab)
  document.body.appendChild(reportContainer)
  
  // 等待一小段时间确保内容渲染
  await new Promise(resolve => setTimeout(resolve, 100))
  
  try {
    console.log('📸 开始截图整个报告...')
    // 使用html2canvas将整个报告转换为图片
    const canvas = await html2canvas(reportContainer, {
      scale: 2, // 提高清晰度
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      allowTaint: true,
      imageTimeout: 15000
    })
    
    console.log('✅ 报告截图完成，尺寸:', canvas.width, 'x', canvas.height)
    
    // 移除临时容器
    document.body.removeChild(reportContainer)
    
     // 创建PDF
     const pdf = new jsPDF('p', 'mm', 'a4')
     const pageWidth = pdf.internal.pageSize.getWidth()
     const pageHeight = pdf.internal.pageSize.getHeight()
     
     // 设置页边距（上下左右各10mm）
     const margin = 10
     const usableWidth = pageWidth - 2 * margin
     const usableHeight = pageHeight - 2 * margin
     
     const imgWidth = usableWidth
     const imgHeight = (canvas.height * usableWidth) / canvas.width
     
     console.log('📄 PDF页面尺寸:', pageWidth, 'mm x', pageHeight, 'mm')
     console.log('📐 可用区域:', usableWidth, 'mm x', usableHeight, 'mm (边距:', margin, 'mm)')
     console.log('📐 图片总高度:', imgHeight, 'mm')
     
     // 如果内容高度超过一页，分页处理
     if (imgHeight <= usableHeight) {
       // 单页
       console.log('📄 单页PDF')
       const imgData = canvas.toDataURL('image/png')
       pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight)
     } else {
       // 多页 - 改进的分页算法
       console.log('📚 多页PDF，开始智能分页...')
       const pageCanvas = document.createElement('canvas')
       const pageCtx = pageCanvas.getContext('2d')
       pageCanvas.width = canvas.width
       
       // 计算每页实际可用的画布高度
       const usableCanvasHeight = (canvas.width * usableHeight) / usableWidth
       pageCanvas.height = usableCanvasHeight
       
       let currentY = 0
       let pageIndex = 0
       
       while (currentY < canvas.height) {
         if (pageIndex > 0) {
           pdf.addPage()
         }
         
         // 计算当前页要截取的高度（避免超出原图）
         const remainingHeight = canvas.height - currentY
         const drawHeight = Math.min(usableCanvasHeight, remainingHeight)
         
         console.log(`  📄 生成第 ${pageIndex + 1} 页 (从 ${currentY.toFixed(0)}px 开始，高度 ${drawHeight.toFixed(0)}px)...`)
         
         // 清空画布并设置白色背景
         pageCtx.fillStyle = '#ffffff'
         pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
         
         // 绘制当前页的内容
         pageCtx.drawImage(
           canvas,
           0, currentY,              // 源图的起始位置
           canvas.width, drawHeight, // 源图的宽高
           0, 0,                     // 目标画布的起始位置
           pageCanvas.width, drawHeight  // 目标画布的宽高
         )
         
         // 转换为图片并添加到PDF（添加边距）
         const pageImgData = pageCanvas.toDataURL('image/png')
         const pageImgHeight = (drawHeight * usableWidth) / canvas.width
         pdf.addImage(pageImgData, 'PNG', margin, margin, imgWidth, pageImgHeight)
         
         // 移动到下一页的起始位置（添加小的重叠以避免内容截断）
         const overlap = Math.min(20, drawHeight * 0.05) // 5%重叠或最多20px
         currentY += usableCanvasHeight - overlap
         pageIndex++
         
         // 防止无限循环
         if (pageIndex > 20) {
           console.warn('⚠️ 页数超过20页，强制停止分页')
           break
         }
       }
       
       console.log(`✅ 共生成 ${pageIndex} 页`)
     }
    
    return pdf.output('blob')
  } catch (error) {
    console.error('❌ PDF生成失败:', error)
    // 确保清理临时容器
    if (reportContainer.parentNode) {
      document.body.removeChild(reportContainer)
    }
    throw error
  }
}

/**
 * 生成报告HTML内容
 */
async function generateReportHTML(data, activeTab) {
  const timestamp = new Date().toLocaleString('zh-CN')
  const changeRate = data.stats?.total ? ((data.stats.changed / data.stats.total) * 100).toFixed(1) : 0
  
   // 捕获地图截图
   let mapImageData = ''
   if (activeTab === 'timeline') {
     try {
       const mapElement = document.getElementById('temporal-map')
       if (mapElement) {
         console.log('🗺️ 发现地图元素，开始检测地图加载状态...')
         
         // 检测地图是否真正加载完成
         const isMapLoaded = await waitForMapToLoad(mapElement)
         if (!isMapLoaded) {
           console.warn('⚠️ 地图加载超时，尝试强制截图...')
         }
         
         console.log('📸 开始捕获地图截图...')
         const mapCanvas = await html2canvas(mapElement, {
           scale: 1.5,
           useCORS: true,
           logging: false,
           backgroundColor: '#f5f5f5',
           allowTaint: true,
           imageTimeout: 20000,
           foreignObjectRendering: true,
           onclone: (clonedDoc) => {
             // 确保克隆的文档中的Canvas也被正确处理
             const clonedMap = clonedDoc.getElementById('temporal-map')
             if (clonedMap) {
               console.log('📋 克隆地图元素成功')
             }
           }
         })
         
         mapImageData = mapCanvas.toDataURL('image/png')
         const sizeKB = (mapImageData.length / 1024).toFixed(2)
         console.log('✅ 地图截图完成，大小:', sizeKB, 'KB')
         
         // 检查截图是否为空白（小于20KB可能是空白或加载失败）
         if (mapImageData.length < 20480) {
           console.warn('⚠️ 地图截图可能为空白，尺寸过小:', sizeKB, 'KB')
           mapImageData = '' // 清空，使用警告提示
         }
       } else {
         console.warn('⚠️ 未找到地图元素 #temporal-map')
       }
     } catch (error) {
       console.error('❌ 地图截图失败:', error)
       mapImageData = '' // 确保失败时清空
     }
   }
  
  // 捕获图表截图
  let chartImages = {}
  if (activeTab === 'charts') {
    const chartIds = ['crop-transition-chart', 'crop-distribution-chart', 'rotation-pattern-chart', 'unchanged-crop-chart']
    for (const chartId of chartIds) {
      try {
        const chartElement = document.querySelector(`[id*="${chartId}"]`) || document.getElementById(chartId)
        if (chartElement) {
          const chartCanvas = await html2canvas(chartElement, {
            scale: 1.5,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
          })
          chartImages[chartId] = chartCanvas.toDataURL('image/png')
        }
      } catch (error) {
        console.warn(`图表${chartId}截图失败:`, error)
      }
    }
  }
  
  return `
    <div style="width: 100%; font-family: 'Microsoft YaHei', 'SimHei', sans-serif; color: #333;">
      <!-- 报告封面 -->
      <div style="text-align: center; padding: 60px 0; border-bottom: 3px solid #4f46e5;">
        <h1 style="font-size: 32px; color: #1f2937; margin: 0 0 20px 0; font-weight: bold;">
          时序分析报告
        </h1>
        <div style="font-size: 18px; color: #6b7280; margin: 10px 0;">
          ${activeTab === 'timeline' ? '地图与统计分析' : '图表分析'}
        </div>
        <div style="font-size: 14px; color: #9ca3af; margin: 30px 0 0 0;">
          生成时间：${timestamp}
        </div>
      </div>
      
      <!-- 摘要信息 -->
      <div style="margin: 30px 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; color: white;">
        <h2 style="font-size: 20px; margin: 0 0 20px 0; border-bottom: 2px solid rgba(255,255,255,0.3); padding-bottom: 10px;">
          📊 分析摘要
        </h2>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
          <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
            <div style="font-size: 12px; opacity: 0.9;">分析周期</div>
            <div style="font-size: 24px; font-weight: bold; margin-top: 5px;">${data.filesCount || 0} 期</div>
          </div>
          <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
            <div style="font-size: 12px; opacity: 0.9;">总地块数</div>
            <div style="font-size: 24px; font-weight: bold; margin-top: 5px;">${data.stats?.total || 0} 个</div>
          </div>
          <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
            <div style="font-size: 12px; opacity: 0.9;">变化地块</div>
            <div style="font-size: 24px; font-weight: bold; margin-top: 5px;">${data.stats?.changed || 0} 个</div>
          </div>
          <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
            <div style="font-size: 12px; opacity: 0.9;">变化率</div>
            <div style="font-size: 24px; font-weight: bold; margin-top: 5px;">${changeRate}%</div>
          </div>
        </div>
      </div>
      
      ${activeTab === 'timeline' ? generateTimelineHTML(data, mapImageData) : generateChartsHTML(data, chartImages)}
    </div>
  `
}

/**
 * 生成地图与统计HTML
 */
function generateTimelineHTML(data, mapImageData) {
  // 变化地块列表（取前20个）
  const changedFeatures = (data.features || [])
    .filter(f => (f.properties?.changeCount || 0) > 0)
    .slice(0, 20)
  
  // 作物分布统计（取前3个时间点）
  const distributionData = (data.cropDistribution || []).slice(0, 3)
  
  return `
     <!-- 变化统计详情 -->
     <div style="margin: 20px 0 30px 0; page-break-inside: avoid; page-break-after: auto;">
       <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 15px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
         📈 变化统计详情
       </h2>
       <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
         <thead>
           <tr style="background: #f9fafb;">
             <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb; font-size: 14px;">统计项</th>
             <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb; font-size: 14px;">数值</th>
             <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb; font-size: 14px;">占比</th>
           </tr>
         </thead>
         <tbody>
           <tr style="page-break-inside: avoid;">
             <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 13px;">总地块数</td>
             <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px; font-weight: bold;">${data.stats?.total || 0} 个</td>
             <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px;">100%</td>
           </tr>
           <tr style="background: #fef3c7; page-break-inside: avoid;">
             <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 13px;">变化地块</td>
             <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px; font-weight: bold; color: #f59e0b;">${data.stats?.changed || 0} 个</td>
             <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px;">${((data.stats?.changed / data.stats?.total) * 100).toFixed(1)}%</td>
           </tr>
           <tr style="background: #d1fae5; page-break-inside: avoid;">
             <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 13px;">未变化地块</td>
             <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px; font-weight: bold; color: #10b981;">${data.stats?.unchanged || 0} 个</td>
             <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px;">${((data.stats?.unchanged / data.stats?.total) * 100).toFixed(1)}%</td>
           </tr>
           <tr style="page-break-inside: avoid;">
             <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 13px;">总变化次数</td>
             <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px; font-weight: bold;">${data.stats?.totalChanges || 0} 次</td>
             <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px;">-</td>
           </tr>
         </tbody>
       </table>
     </div>
    
     ${mapImageData ? `
     <!-- 时序变化地图 -->
     <div style="margin: 40px 0 30px 0; page-break-before: always; page-break-inside: avoid; page-break-after: auto;">
       <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 20px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
         🗺️ 时序变化地图
       </h2>
       <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: #f9fafb; max-width: 100%; margin-bottom: 15px;">
         <img src="${mapImageData}" style="width: 100%; max-width: 100%; height: auto; display: block;" alt="时序变化地图" />
       </div>
       <div style="padding: 12px; background: #eff6ff; border-radius: 6px; font-size: 12px; color: #1e40af; line-height: 1.5;">
         <strong>说明：</strong>地图中不同颜色代表地块的变化程度，绿色表示无变化，橙色至深红色表示变化频率逐渐增加。点击地块可查看详细的作物变化历史。
       </div>
     </div>
     ` : `
     <!-- 地图未加载提示 -->
     <div style="margin: 40px 0 30px 0; padding: 30px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; text-align: center; page-break-inside: avoid;">
       <p style="color: #856404; font-size: 14px; margin: 0; line-height: 1.6;">
         ⚠️ 地图截图未成功，请确保地图已完全加载后再导出报告<br/>
         <small style="font-size: 12px; opacity: 0.8;">建议：等待地图显示所有地块（绿色/红色区域）后再点击"导出报告"</small>
       </p>
     </div>
     `}
    
     <!-- 作物分布统计 -->
     ${distributionData.length > 0 ? `
     <div style="margin: 40px 0 30px 0; page-break-inside: avoid; page-break-after: auto;">
       <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 20px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
         🌾 各时期作物分布（前${distributionData.length}期）
       </h2>
       ${distributionData.map((point, index) => {
         const topCrops = point.crops.slice(0, 5)
         return `
         <div style="margin-bottom: 25px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; page-break-inside: avoid; page-break-after: auto;">
           <div style="background: #f3f4f6; padding: 12px 15px; font-size: 14px; font-weight: bold; color: #374151; border-bottom: 1px solid #e5e7eb;">
             ${point.taskName || point.time || `时间点${point.timeIndex + 1}`}
           </div>
           <table style="width: 100%; border-collapse: collapse;">
             <thead>
               <tr style="background: #f9fafb;">
                 <th style="padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 12px; font-weight: bold;">作物类型</th>
                 <th style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb; font-size: 12px; font-weight: bold;">地块数</th>
                 <th style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb; font-size: 12px; font-weight: bold;">占比</th>
               </tr>
             </thead>
             <tbody>
               ${topCrops.map((crop, cropIndex) => `
                 <tr style="page-break-inside: avoid; ${cropIndex % 2 === 0 ? 'background: #ffffff;' : 'background: #f9fafb;'}">
                   <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-size: 12px;">${crop.crop}</td>
                   <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; text-align: right; font-size: 12px; font-weight: bold;">${crop.count} 个</td>
                   <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; text-align: right; font-size: 12px; font-weight: bold; color: #4f46e5;">${crop.percentage}%</td>
                 </tr>
               `).join('')}
             </tbody>
           </table>
         </div>
         `
       }).join('')}
     </div>
     ` : ''}
    
     <!-- 变化地块明细 -->
     ${changedFeatures.length > 0 ? `
     <div style="margin: 50px 0 30px 0; page-break-before: always; page-break-after: auto;">
       <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 20px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
         📋 变化地块明细（前${changedFeatures.length}个）
       </h2>
       <div style="page-break-inside: avoid;">
         <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; font-size: 11px;">
           <thead>
             <tr style="background: #4f46e5; color: white;">
               <th style="padding: 12px 8px; text-align: center; border: 1px solid #4338ca; font-weight: bold;">序号</th>
               <th style="padding: 12px 8px; text-align: left; border: 1px solid #4338ca; font-weight: bold;">地块ID</th>
               <th style="padding: 12px 8px; text-align: left; border: 1px solid #4338ca; font-weight: bold;">起始作物</th>
               <th style="padding: 12px 8px; text-align: left; border: 1px solid #4338ca; font-weight: bold;">结束作物</th>
               <th style="padding: 12px 8px; text-align: center; border: 1px solid #4338ca; font-weight: bold;">变化次数</th>
               <th style="padding: 12px 8px; text-align: left; border: 1px solid #4338ca; font-weight: bold;">变化序列</th>
             </tr>
           </thead>
           <tbody>
             ${changedFeatures.map((feature, index) => {
               const props = feature.properties
               return `
                 <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'}; page-break-inside: avoid;">
                   <td style="padding: 10px 8px; text-align: center; border: 1px solid #e5e7eb; font-weight: bold;">${index + 1}</td>
                   <td style="padding: 10px 8px; border: 1px solid #e5e7eb; font-family: monospace;">${props?.id || props?.Id || 'N/A'}</td>
                   <td style="padding: 10px 8px; border: 1px solid #e5e7eb; color: #059669; font-weight: bold;">${props?.startCrop || 'N/A'}</td>
                   <td style="padding: 10px 8px; border: 1px solid #e5e7eb; color: #dc2626; font-weight: bold;">${props?.endCrop || 'N/A'}</td>
                   <td style="padding: 10px 8px; text-align: center; border: 1px solid #e5e7eb; font-weight: bold; color: #f59e0b;">${props?.changeCount || 0}</td>
                   <td style="padding: 10px 8px; border: 1px solid #e5e7eb; font-size: 10px; line-height: 1.3; font-family: monospace;">${(props?.cropSequence || 'N/A').length > 50 ? (props?.cropSequence || 'N/A').substring(0, 50) + '...' : (props?.cropSequence || 'N/A')}</td>
                 </tr>
               `
             }).join('')}
           </tbody>
         </table>
       </div>
     </div>
     ` : ''}
  `
}

/**
 * 生成图表分析HTML
 */
function generateChartsHTML(data, chartImages) {
  // 作物转换统计（取前10个）
  const transitions = Object.entries(data.transitionMatrix || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
  
  return `
    <!-- 作物转换流向统计 -->
    ${transitions.length > 0 ? `
    <div style="margin: 30px 0; page-break-inside: avoid; page-break-after: auto;">
      <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 15px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
        🔄 作物转换流向统计（前10种）
      </h2>
      <div style="margin-bottom: 15px; padding: 12px; background: #eff6ff; border-left: 3px solid #3b82f6; font-size: 12px; color: #1e40af;">
        <strong>说明：</strong>共统计到 <strong>${Object.keys(data.transitionMatrix).length}</strong> 种不同的作物转换类型，
        总计发生 <strong>${data.stats?.totalChanges || 0}</strong> 次转换（已排除无变化情况）
      </div>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
        <thead>
          <tr style="background: #4f46e5; color: white;">
            <th style="padding: 12px; text-align: left; border: 1px solid #4338ca; font-size: 13px;">排名</th>
            <th style="padding: 12px; text-align: left; border: 1px solid #4338ca; font-size: 13px;">转换类型</th>
            <th style="padding: 12px; text-align: right; border: 1px solid #4338ca; font-size: 13px;">次数</th>
            <th style="padding: 12px; text-align: right; border: 1px solid #4338ca; font-size: 13px;">占比</th>
          </tr>
        </thead>
        <tbody>
          ${transitions.map(([key, count], index) => {
            const percentage = ((count / (data.stats?.totalChanges || 1)) * 100).toFixed(1)
            return `
              <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'}; page-break-inside: avoid;">
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 13px; font-weight: bold; color: ${index < 3 ? '#dc2626' : '#6b7280'};">
                  ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                </td>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 13px;">${key}</td>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px; font-weight: bold;">${count} 次</td>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px; color: #4f46e5; font-weight: bold;">${percentage}%</td>
              </tr>
            `
          }).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}
    
    <!-- 图表展示 -->
    <div style="margin: 30px 0; page-break-before: always;">
      <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 15px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
        📊 可视化图表
      </h2>
      ${Object.entries(chartImages).map(([chartId, imageData]) => {
        const titles = {
          'crop-transition-chart': '作物转换流向图',
          'crop-distribution-chart': '作物分布趋势图',
          'rotation-pattern-chart': '作物轮作模式分析',
          'unchanged-crop-chart': '无变化作物类型分析'
        }
        const title = titles[chartId] || '图表'
        return imageData ? `
          <div style="margin-bottom: 30px; page-break-inside: avoid; page-break-after: auto;">
            <h3 style="font-size: 16px; color: #374151; margin: 0 0 10px 0; padding: 8px 12px; background: #f3f4f6; border-radius: 6px;">
              ${title}
            </h3>
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: white; max-width: 100%;">
              <img src="${imageData}" style="width: 100%; max-width: 100%; height: auto; display: block;" alt="${title}" />
            </div>
          </div>
        ` : ''
      }).join('')}
    </div>
    
    <!-- 报告说明 -->
    <div style="margin: 40px 0 0 0; padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 12px; color: #6b7280;">
      <h3 style="font-size: 14px; color: #374151; margin: 0 0 10px 0;">📝 报告说明</h3>
      <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
        <li>本报告基于时序分析系统自动生成</li>
        <li>分析结果反映了选定时间范围内地块作物类型的变化情况</li>
        <li>变化率 = 变化地块数 / 总地块数 × 100%</li>
        <li>转换类型统计已排除作物类型不变的情况</li>
        <li>报告生成时间：${new Date().toLocaleString('zh-CN')}</li>
      </ul>
    </div>
  `
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

// 旧版函数 - 已废弃
async function addTimelineContent_deprecated(pdf, data, startY) {
  let yOffset = startY
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15

  // 1. 变化统计表格
  pdf.setFontSize(14)
  pdf.setTextColor(40, 40, 40)
  pdf.text('变化统计', margin, yOffset)
  yOffset += 8

  autoTable(pdf, {
    startY: yOffset,
    head: [['统计项', '数值', '占比']],
    body: [
      ['总地块数', String(data.stats?.total || 0), '100%'],
      ['变化地块', String(data.stats?.changed || 0), `${((data.stats?.changed / data.stats?.total) * 100).toFixed(1)}%`],
      ['未变化地块', String(data.stats?.unchanged || 0), `${((data.stats?.unchanged / data.stats?.total) * 100).toFixed(1)}%`],
      ['总变化次数', String(data.stats?.totalChanges || 0), '-']
    ],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    margin: { left: margin, right: margin }
  })
  yOffset = pdf.lastAutoTable.finalY + 12

  // 2. 尝试捕获地图截图（如果可能）
  try {
    const mapElement = document.getElementById('temporal-map')
    if (mapElement) {
      // 检查是否需要新页面
      if (yOffset + 100 > pageHeight - 20) {
        pdf.addPage()
        yOffset = 20
      }

      pdf.setFontSize(14)
      pdf.text('时序变化地图', margin, yOffset)
      yOffset += 8

      const canvas = await html2canvas(mapElement, {
        scale: 1,
        useCORS: true,
        logging: false,
        backgroundColor: '#f5f5f5'
      })
      const imgData = canvas.toDataURL('image/png')
      const imgWidth = pageWidth - 2 * margin
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      
      // 如果图片太高，缩小高度
      const maxHeight = 120
      const finalHeight = Math.min(imgHeight, maxHeight)
      const finalWidth = finalHeight === maxHeight ? (canvas.width * maxHeight) / canvas.height : imgWidth

      pdf.addImage(imgData, 'PNG', margin, yOffset, finalWidth, finalHeight)
      yOffset += finalHeight + 10
    }
  } catch (error) {
    console.warn('地图截图失败:', error)
  }

  // 3. 作物分布统计
  if (data.cropDistribution && data.cropDistribution.length > 0) {
    // 检查是否需要新页面
    if (yOffset + 60 > pageHeight - 20) {
      pdf.addPage()
      yOffset = 20
    }

    pdf.setFontSize(14)
    pdf.text('各时期作物分布', margin, yOffset)
    yOffset += 8

    // 取前3个时间点的数据
    const distributionData = data.cropDistribution.slice(0, 3).map(point => {
      const topCrops = point.crops.slice(0, 5) // 每个时间点取前5种作物
      return {
        time: point.taskName || point.time || `时间点${point.timeIndex + 1}`,
        crops: topCrops
      }
    })

    const tableData = []
    distributionData.forEach(point => {
      point.crops.forEach((crop, index) => {
        tableData.push([
          index === 0 ? point.time : '',
          crop.crop,
          `${crop.count} 个地块`,
          `${crop.percentage}%`
        ])
      })
    })

    autoTable(pdf, {
      startY: yOffset,
      head: [['时间', '作物类型', '地块数', '占比']],
      body: tableData,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255 },
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 40 },
        2: { cellWidth: 50 },
        3: { cellWidth: 30 }
      }
    })
    yOffset = pdf.lastAutoTable.finalY + 12
  }
}

/**
 * 添加图表分析内容
 */
async function addChartsContent(pdf, data, startY) {
  let yOffset = startY
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15

  // 1. 作物转换流向
  if (data.transitionMatrix && Object.keys(data.transitionMatrix).length > 0) {
    pdf.setFontSize(14)
    pdf.setTextColor(40, 40, 40)
    pdf.text('作物转换流向', margin, yOffset)
    yOffset += 8

    const transitions = Object.entries(data.transitionMatrix)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10) // 取前10个转换

    autoTable(pdf, {
      startY: yOffset,
      head: [['转换类型', '次数', '占比']],
      body: transitions.map(([key, count]) => {
        const percentage = ((count / (data.stats?.totalChanges || 1)) * 100).toFixed(1)
        return [key, String(count), `${percentage}%`]
      }),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255 },
      margin: { left: margin, right: margin }
    })
    yOffset = pdf.lastAutoTable.finalY + 12
  }

  // 2. 作物分布趋势
  if (data.cropDistribution && data.cropDistribution.length > 0) {
    // 检查是否需要新页面
    if (yOffset + 60 > pageHeight - 20) {
      pdf.addPage()
      yOffset = 20
    }

    pdf.setFontSize(14)
    pdf.text('作物分布趋势', margin, yOffset)
    yOffset += 8

    // 收集所有作物类型
    const allCrops = new Set()
    data.cropDistribution.forEach(point => {
      point.crops.forEach(crop => allCrops.add(crop.crop))
    })

    // 只取前5种最常见的作物
    const topCrops = Array.from(allCrops).slice(0, 5)

    const tableHead = ['时间', ...topCrops]
    const tableBody = data.cropDistribution.map(point => {
      const row = [point.taskName || point.time || `时间${point.timeIndex + 1}`]
      topCrops.forEach(cropName => {
        const cropData = point.crops.find(c => c.crop === cropName)
        row.push(cropData ? `${cropData.count}` : '-')
      })
      return row
    })

    autoTable(pdf, {
      startY: yOffset,
      head: [tableHead],
      body: tableBody,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255 },
      margin: { left: margin, right: margin }
    })
    yOffset = pdf.lastAutoTable.finalY + 12
  }

  // 3. 尝试捕获图表截图
  try {
    const chartElements = [
      { id: 'crop-transition-chart', title: '作物转换流向图' },
      { id: 'crop-distribution-chart', title: '作物分布趋势图' },
      { id: 'rotation-pattern-chart', title: '作物轮作模式分析' }
    ]

    for (const { id, title } of chartElements) {
      const chartElement = document.getElementById(id)
      if (!chartElement) continue

      // 检查是否需要新页面
      if (yOffset + 100 > pageHeight - 20) {
        pdf.addPage()
        yOffset = 20
      }

      pdf.setFontSize(12)
      pdf.text(title, margin, yOffset)
      yOffset += 6

      const canvas = await html2canvas(chartElement, {
        scale: 1,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })
      const imgData = canvas.toDataURL('image/png')
      const imgWidth = pageWidth - 2 * margin
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      
      const maxHeight = 80
      const finalHeight = Math.min(imgHeight, maxHeight)
      const finalWidth = finalHeight === maxHeight ? (canvas.width * maxHeight) / canvas.height : imgWidth

      pdf.addImage(imgData, 'PNG', margin, yOffset, finalWidth, finalHeight)
      yOffset += finalHeight + 10
    }
  } catch (error) {
    console.warn('图表截图失败:', error)
  }
}
