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
 * @returns {Promise<Blob>} PDF文件的Blob对象
 */
export async function generateTemporalPDF(data, activeTab = 'timeline') {
  console.log('📄 开始生成PDF报告（分段截图模式）...')
  
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
      isMap = false  // 是否为地图（需要特殊处理）
    } = options
    
    try {
      // 等待渲染
  await new Promise(resolve => setTimeout(resolve, 100))
  
      // 截图配置（降低清晰度以减小文件大小）
      const html2canvasOptions = isMap ? {
        scale: 1.2,  // 降低地图清晰度（原来是 scale）
      useCORS: true,
        allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
        timeout: 10000
      } : {
        scale: 1.5,  // 降低普通内容清晰度（原来是 2）
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
      const needNewPage = forceNewPage || (currentY + imgHeight > pageHeight - margin)
      
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
          <h1 style="font-size: 36px; color: #1f2937; margin: 0 0 20px 0; font-weight: bold;">
            时序分析完整报告
          </h1>
          <div style="font-size: 20px; color: #6b7280; margin: 20px 0;">
            地图、统计与图表分析
          </div>
          <div style="font-size: 14px; color: #9ca3af; margin: 40px 0 0 0;">
            生成时间：${timestamp}
          </div>
        </div>
      `
      await addSectionToPDF(createTempContainer(coverHTML), { scale: 2 })
      console.log('  ✅ 封面已添加')
    } catch (error) {
      console.error('  ❌ 封面生成失败:', error.message)
    }
    
    // 2. 摘要信息
    console.log('📄 [2/14] 生成分析摘要...')
    try {
      const summaryHTML = `
        <div style="padding: 25px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; color: white;">
          <h2 style="font-size: 22px; margin: 0 0 20px 0; border-bottom: 2px solid rgba(255,255,255,0.3); padding-bottom: 10px;">
            📊 分析摘要
          </h2>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
            <div style="background: rgba(255,255,255,0.15); padding: 18px; border-radius: 8px;">
              <div style="font-size: 13px; opacity: 0.9;">分析周期</div>
              <div style="font-size: 28px; font-weight: bold; margin-top: 8px;">${data.filesCount || 0} 期</div>
            </div>
            <div style="background: rgba(255,255,255,0.15); padding: 18px; border-radius: 8px;">
              <div style="font-size: 13px; opacity: 0.9;">总地块数</div>
              <div style="font-size: 28px; font-weight: bold; margin-top: 8px;">${data.stats?.total || 0} 个</div>
            </div>
            <div style="background: rgba(255,255,255,0.15); padding: 18px; border-radius: 8px;">
              <div style="font-size: 13px; opacity: 0.9;">变化地块</div>
              <div style="font-size: 28px; font-weight: bold; margin-top: 8px;">${data.stats?.changed || 0} 个</div>
            </div>
            <div style="background: rgba(255,255,255,0.15); padding: 18px; border-radius: 8px;">
              <div style="font-size: 13px; opacity: 0.9;">变化率</div>
              <div style="font-size: 28px; font-weight: bold; margin-top: 8px;">${changeRate}%</div>
            </div>
          </div>
        </div>
      `
      await addSectionToPDF(createTempContainer(summaryHTML), { scale: 2 })
      console.log('  ✅ 摘要已添加')
    } catch (error) {
      console.error('  ❌ 摘要生成失败:', error.message)
    }
    
    // 生成所有内容（不再区分 timeline 和 charts）
    await generateAllContentSections(pdf, data, { addSectionToPDF, createTempContainer, usableHeight })
    
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
async function generateAllContentSections(pdf, data, { addSectionToPDF, createTempContainer, usableHeight }) {
  // 3. 变化统计详情
  console.log('📄 [3/14] 生成变化统计详情...')
  try {
    const statsHTML = `
      <div>
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
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 13px;">总地块数</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px; font-weight: bold;">${data.stats?.total || 0} 个</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px;">100%</td>
            </tr>
            <tr style="background: #fef3c7;">
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 13px;">变化地块</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px; font-weight: bold; color: #f59e0b;">${data.stats?.changed || 0} 个</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px;">${((data.stats?.changed / data.stats?.total) * 100).toFixed(1)}%</td>
            </tr>
            <tr style="background: #d1fae5;">
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 13px;">未变化地块</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px; font-weight: bold; color: #10b981;">${data.stats?.unchanged || 0} 个</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px;">${((data.stats?.unchanged / data.stats?.total) * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 13px;">总变化次数</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px; font-weight: bold;">${data.stats?.totalChanges || 0} 次</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px;">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
    await addSectionToPDF(createTempContainer(statsHTML), { scale: 2 })
    console.log('  ✅ 统计表格已添加')
  } catch (error) {
    console.error('  ❌ 统计表格生成失败:', error.message)
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
          scale: 1.2,
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
        <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 20px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
          🗺️ 时序变化地图
        </h2>
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: #f9fafb;">
          <img src="${mapImageData}" style="width: 100%; height: auto; display: block;" alt="时序变化地图" />
        </div>
        <div style="padding: 12px; background: #eff6ff; border-radius: 6px; font-size: 12px; color: #1e40af; margin-top: 10px;">
          <strong>说明：</strong>地图中不同颜色代表地块的变化程度，绿色表示无变化，橙色至深红色表示变化频率逐渐增加。
        </div>
      </div>
    `
    try {
      await addSectionToPDF(createTempContainer(mapHTML), { scale: 1.8, isMap: true })
      console.log('  ✅ 地图已添加到PDF')
    } catch (error) {
      console.error('  ❌ 地图添加失败，跳过此部分:', error.message)
    }
  } else {
    console.log('  ⚠️ 地图数据无效或过小，跳过地图部分')
  }
  
  // 5. 地块变化频率分布
  if (data.features && data.features.length > 0) {
    console.log('📄 [5/14] 生成地块变化频率分布...')
    try {
      const changeFrequency = {}
      data.features.forEach(f => {
        const count = f.properties?.changeCount || 0
        changeFrequency[count] = (changeFrequency[count] || 0) + 1
      })
      
      const frequencyHTML = `
        <div>
          <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 15px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
            📊 地块变化频率分布
          </h2>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
            <thead>
              <tr style="background: #f9fafb;">
                <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">变化次数</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">地块数量</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">占比</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">分布图</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(changeFrequency).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([freq, count]) => {
                const percentage = ((count / data.stats.total) * 100).toFixed(1)
                const barWidth = Math.min(100, percentage * 2)
                const bgColor = freq === '0' ? '#d1fae5' : freq === '1' ? '#fef3c7' : '#fee2e2'
                
                return `
                  <tr style="background: ${bgColor};">
                    <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold;">${freq} 次</td>
                    <td style="padding: 10px 12px; text-align: right; border: 1px solid #e5e7eb; font-weight: bold;">${count} 个</td>
                    <td style="padding: 10px 12px; text-align: right; border: 1px solid #e5e7eb;">${percentage}%</td>
                    <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">
                      <div style="background: #4f46e5; height: 8px; width: ${barWidth}%; border-radius: 4px;"></div>
                    </td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
        </div>
      `
      await addSectionToPDF(createTempContainer(frequencyHTML), { scale: 2 })
      console.log('  ✅ 变化频率分布已添加')
    } catch (error) {
      console.error('  ❌ 变化频率分布生成失败:', error.message)
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
          <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 15px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
            🌾 作物分布趋势对比
          </h2>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; font-size: 12px;">
            <thead>
              <tr style="background: #4f46e5; color: white;">
                <th style="padding: 10px; text-align: left; border: 1px solid #4338ca;">作物类型</th>
                ${distributionData.map(point => `
                  <th style="padding: 10px; text-align: center; border: 1px solid #4338ca;">
                    ${point.taskName || point.time || `时间${point.timeIndex + 1}`}
                  </th>
                `).join('')}
                <th style="padding: 10px; text-align: center; border: 1px solid #4338ca;">变化趋势</th>
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
                const trendColor = trend > 0 ? '#10b981' : trend < 0 ? '#ef4444' : '#6b7280'
                
                return `
                  <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                    <td style="padding: 8px 10px; border: 1px solid #e5e7eb; font-weight: bold;">${cropName}</td>
                    ${values.map(val => `
                      <td style="padding: 8px 10px; text-align: center; border: 1px solid #e5e7eb;">${val}</td>
                    `).join('')}
                    <td style="padding: 8px 10px; text-align: center; border: 1px solid #e5e7eb; font-weight: bold; color: ${trendColor};">
                      ${trendSymbol} ${Math.abs(trend)}
                    </td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
          <div style="padding: 10px; background: #f9fafb; border-radius: 6px; font-size: 11px; color: #6b7280; margin-top: 10px;">
            <strong>说明：</strong>↑ 表示地块数增加，↓ 表示减少，→ 表示无变化
          </div>
        </div>
      `
      await addSectionToPDF(createTempContainer(distributionHTML), { scale: 2 })
      console.log('  ✅ 作物分布趋势已添加')
    } catch (error) {
      console.error('  ❌ 作物分布趋势生成失败:', error.message)
    }
  }
  
  // 7. 作物转换流向TOP20
  const transitions = Object.entries(data.transitionMatrix || {}).sort((a, b) => b[1] - a[1]).slice(0, 20)
  if (transitions.length > 0) {
    console.log('📄 [7/14] 生成作物转换流向TOP20...')
    try {
      const transitionHTML = `
        <div>
          <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 15px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
            🔄 作物转换流向TOP20
          </h2>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
            <thead>
              <tr style="background: #4f46e5; color: white;">
                <th style="padding: 12px; text-align: left; border: 1px solid #4338ca;">排名</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #4338ca;">转换类型</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #4338ca;">次数</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #4338ca;">占比</th>
              </tr>
            </thead>
            <tbody>
              ${transitions.map(([key, count], i) => {
                const percentage = ((count / (data.stats?.totalChanges || 1)) * 100).toFixed(1)
                return `
                  <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                    <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold; color: ${i < 3 ? '#dc2626' : '#6b7280'};">
                      ${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${key}</td>
                    <td style="padding: 10px 12px; text-align: right; border: 1px solid #e5e7eb; font-weight: bold;">${count} 次</td>
                    <td style="padding: 10px 12px; text-align: right; border: 1px solid #e5e7eb; color: #4f46e5; font-weight: bold;">${percentage}%</td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
        </div>
      `
      await addSectionToPDF(createTempContainer(transitionHTML), { scale: 2 })
      console.log('  ✅ 作物转换流向已添加')
    } catch (error) {
      console.error('  ❌ 作物转换流向生成失败:', error.message)
    }
  }
  
  // 8. 作物轮作模式分析（仅分析有变化的地块）
  console.log('📄 [8/14] 生成作物轮作模式分析...')
  try {
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
          <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 15px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
            🔁 作物轮作模式分析 TOP15
          </h2>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; font-size: 12px;">
            <thead>
              <tr style="background: #10b981; color: white;">
                <th style="padding: 10px; text-align: left; border: 1px solid #059669;">排名</th>
                <th style="padding: 10px; text-align: left; border: 1px solid #059669;">轮作模式</th>
                <th style="padding: 10px; text-align: right; border: 1px solid #059669;">地块数</th>
                <th style="padding: 10px; text-align: right; border: 1px solid #059669;">周期</th>
              </tr>
            </thead>
            <tbody>
              ${topPatterns.map(([pattern, count], i) => {
                const cycle = pattern.split(' → ').length
                return `
                  <tr style="background: ${i % 2 === 0 ? '#ecfdf5' : '#d1fae5'};">
                    <td style="padding: 8px 10px; border: 1px solid #e5e7eb; font-weight: bold; color: ${i < 3 ? '#dc2626' : '#6b7280'};">
                      ${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td style="padding: 8px 10px; border: 1px solid #e5e7eb; font-weight: bold;">${pattern}</td>
                    <td style="padding: 8px 10px; text-align: right; border: 1px solid #e5e7eb;">${count} 个</td>
                    <td style="padding: 8px 10px; text-align: center; border: 1px solid #e5e7eb; color: #10b981; font-weight: bold;">${cycle}期</td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
          <div style="padding: 10px; background: #ecfdf5; border-radius: 6px; font-size: 11px; color: #059669; margin-top: 10px;">
            <strong>说明：</strong>轮作模式表示地块在各时期种植的作物序列，箭头表示时间顺序
          </div>
        </div>
      `
      await addSectionToPDF(createTempContainer(rotationHTML), { scale: 2 })
      console.log('  ✅ 轮作模式分析已添加')
    } else {
      console.log('  ⚠️ 无轮作模式数据，跳过此部分')
    }
  } catch (error) {
    console.error('  ❌ 轮作模式分析生成失败:', error.message)
  }
  
  // 9. 未变化地块作物类型分析
  let unchangedTrajectories = []
  
  if (data.trajectories && data.trajectories.length > 0) {
    // 优先使用 trajectories（正确的数据源）
    unchangedTrajectories = data.trajectories.filter(traj => (traj.changeCount || 0) === 0)
  } else if (data.features && data.features.length > 0) {
    // 降级方案：从 features 提取
    unchangedTrajectories = data.features.filter(f => (f.properties?.changeCount || 0) === 0)
  }
  
  if (unchangedTrajectories.length > 0) {
    console.log('📄 [9/14] 生成未变化地块作物类型分析...')
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
          <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 15px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
            🟢 未变化地块作物类型分析
          </h2>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
            <thead>
              <tr style="background: #10b981; color: white;">
                <th style="padding: 12px; text-align: left; border: 1px solid #059669;">作物类型</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #059669;">地块数量</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #059669;">占未变化地块比例</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #059669;">占总地块比例</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(unchangedCrops).sort((a, b) => b[1] - a[1]).map(([crop, count], i) => {
                const percentageUnchanged = ((count / unchangedTrajectories.length) * 100).toFixed(1)
                const percentageTotal = ((count / (data.stats?.total || 1)) * 100).toFixed(1)
                return `
                  <tr style="background: ${i % 2 === 0 ? '#d1fae5' : '#ecfdf5'};">
                    <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold;">${crop}</td>
                    <td style="padding: 10px 12px; text-align: right; border: 1px solid #e5e7eb;">${count} 个</td>
                    <td style="padding: 10px 12px; text-align: right; border: 1px solid #e5e7eb; color: #10b981; font-weight: bold;">${percentageUnchanged}%</td>
                    <td style="padding: 10px 12px; text-align: right; border: 1px solid #e5e7eb; color: #6b7280;">${percentageTotal}%</td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
          <div style="padding: 10px; background: #ecfdf5; border-radius: 6px; font-size: 11px; color: #059669; margin-top: 10px;">
            <strong>说明：</strong>这些地块在整个分析期间保持同一作物种植，表现出较强的种植稳定性
          </div>
        </div>
      `
      await addSectionToPDF(createTempContainer(unchangedHTML), { scale: 2 })
      console.log('  ✅ 未变化地块分析已添加')
    } catch (error) {
      console.error('  ❌ 未变化地块分析生成失败:', error.message)
    }
  }
  
  // 10-12. 各时期作物分布详情
  if (distributionData.length > 0) {
    console.log(`📄 [10-12/14] 生成各时期作物分布详情（共${distributionData.length}期）...`)
    try {
      for (const [index, point] of distributionData.entries()) {
        const topCrops = point.crops.slice(0, 10)
        const cropHTML = `
          <div>
            ${index === 0 ? `
            <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 20px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
              📅 各时期作物分布详情
            </h2>
            ` : ''}
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 15px;">
              <div style="background: #f3f4f6; padding: 12px 15px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">
                ${point.taskName || point.time || `时间点${point.timeIndex + 1}`}（共${point.crops.length}种作物）
              </div>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f9fafb;">
                    <th style="padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 12px;">作物类型</th>
                    <th style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb; font-size: 12px;">地块数</th>
                    <th style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb; font-size: 12px;">占比</th>
                  </tr>
                </thead>
                <tbody>
                  ${topCrops.map((crop, i) => `
                    <tr style="${i % 2 === 0 ? 'background: #ffffff;' : 'background: #f9fafb;'}">
                      <td style="padding: 10px 12px; font-size: 12px;">${crop.crop}</td>
                      <td style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: bold;">${crop.count} 个</td>
                      <td style="padding: 10px 12px; text-align: right; font-size: 12px; color: #4f46e5; font-weight: bold;">${crop.percentage}%</td>
                    </tr>
                  `).join('')}
                  ${point.crops.length > 10 ? `
                    <tr style="background: #f9fafb;">
                      <td colspan="3" style="padding: 8px 12px; text-align: center; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb;">
                        ... 其他${point.crops.length - 10}种作物
                      </td>
                    </tr>
                  ` : ''}
                </tbody>
              </table>
            </div>
          </div>
        `
        await addSectionToPDF(createTempContainer(cropHTML), { scale: 2 })
        console.log(`  ✅ 时期 ${index + 1}/${distributionData.length} 作物分布已添加`)
      }
    } catch (error) {
      console.error('  ❌ 各时期作物分布生成失败:', error.message)
    }
  }
  
  // 13. 数据统计汇总
  console.log('📄 [13/14] 生成数据统计汇总...')
  try {
    const summaryStatsHTML = `
      <div>
        <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 15px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
          📊 数据统计汇总
        </h2>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
          <thead>
            <tr style="background: #4f46e5; color: white;">
              <th style="padding: 12px; text-align: left; border: 1px solid #4338ca; width: 40%;">统计项</th>
              <th style="padding: 12px; text-align: right; border: 1px solid #4338ca; width: 30%;">数值</th>
              <th style="padding: 12px; text-align: left; border: 1px solid #4338ca; width: 30%;">说明</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background: #f9fafb;">
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold;">分析时期数</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right;">${data.filesCount || distributionData.length} 期</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 11px;">分析覆盖的时间周期数</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold;">总地块数</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right;">${data.stats?.total || 0} 个</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 11px;">所有分析的地块数量</td>
            </tr>
            <tr style="background: #f9fafb;">
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold;">变化地块数</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; color: #f59e0b;">${data.stats?.changed || 0} 个</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 11px;">至少发生一次作物变化的地块</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold;">未变化地块数</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; color: #10b981;">${data.stats?.unchanged || 0} 个</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 11px;">始终保持同一作物的地块</td>
            </tr>
            <tr style="background: #f9fafb;">
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold;">总变化次数</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right;">${data.stats?.totalChanges || 0} 次</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 11px;">所有地块的变化次数总和</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold;">平均变化次数</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right;">${((data.stats?.totalChanges || 0) / (data.stats?.total || 1)).toFixed(2)} 次/地块</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 11px;">每个地块平均变化次数</td>
            </tr>
            <tr style="background: #f9fafb;">
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold;">作物转换模式数</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right;">${Object.keys(data.transitionMatrix || {}).length} 种</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 11px;">不同的作物转换类型数</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold;">作物类型数</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right;">${new Set((distributionData[0]?.crops || []).map(c => c.crop)).size} 种</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 11px;">分析区域种植的作物种类</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
    await addSectionToPDF(createTempContainer(summaryStatsHTML), { scale: 2 })
    console.log('  ✅ 数据统计汇总已添加')
  } catch (error) {
    console.error('  ❌ 数据统计汇总生成失败:', error.message)
  }
  
  // 14. 报告说明
  console.log('📄 [14/14] 生成报告说明...')
  try {
    const notesHTML = `
      <div>
        <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 15px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
          📝 报告说明
        </h2>
        <div style="padding: 20px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #6b7280;">
          <h3 style="font-size: 16px; color: #374151; margin: 0 0 12px 0;">本报告包含以下分析内容：</h3>
          <ul style="margin: 0; padding-left: 20px; line-height: 2; color: #4b5563;">
            <li><strong>变化统计详情：</strong>地块变化的基本统计数据</li>
            <li><strong>时序变化地图：</strong>地块变化的空间分布可视化</li>
            <li><strong>地块变化频率分布：</strong>不同变化频次的地块数量统计</li>
            <li><strong>作物分布趋势对比：</strong>各时期作物种植面积的横向对比</li>
            <li><strong>作物转换流向：</strong>最常见的TOP20作物转换模式</li>
            <li><strong>作物轮作模式：</strong>完整的多期作物轮作序列分析（TOP15）</li>
            <li><strong>未变化地块分析：</strong>种植稳定性及作物类型分布</li>
            <li><strong>各时期作物分布：</strong>每个时期的详细作物分布</li>
            <li><strong>数据统计汇总：</strong>全面的数据统计指标</li>
          </ul>
          
          <h3 style="font-size: 16px; color: #374151; margin: 20px 0 12px 0;">关键术语说明：</h3>
          <ul style="margin: 0; padding-left: 20px; line-height: 2; color: #4b5563; font-size: 13px;">
            <li><strong>变化地块：</strong>在分析期间至少发生一次作物转换的地块</li>
            <li><strong>未变化地块：</strong>始终保持同一作物种植的地块</li>
            <li><strong>变化次数：</strong>地块在相邻时期间发生作物转换的次数</li>
            <li><strong>轮作模式：</strong>地块在多个时期的完整作物种植序列</li>
            <li><strong>转换流向：</strong>从某一作物转换到另一作物的模式</li>
          </ul>
          
          <div style="margin-top: 20px; padding: 12px; background: #eff6ff; border-radius: 6px; font-size: 12px; color: #1e40af;">
            <strong>💡 提示：</strong>本报告基于时序分析自动生成，所有统计数据和图表均基于实际分析结果。建议结合实地调研进行综合分析。
          </div>
        </div>
      </div>
    `
    await addSectionToPDF(createTempContainer(notesHTML), { scale: 2 })
    console.log('  ✅ 报告说明已添加')
  } catch (error) {
    console.error('  ❌ 报告说明生成失败:', error.message)
  }
  
  console.log('  📍 所有内容生成完成')
}

/**
 * 生成时间轴内容（分段）- 保留用于兼容
 */
async function generateTimelineContentSections(pdf, data, { addSectionToPDF, createTempContainer, usableHeight }) {
  // 3. 变化统计详情
  console.log('📄 [3/6] 生成变化统计...')
  try {
    const statsHTML = `
      <div>
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
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 13px;">总地块数</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px; font-weight: bold;">${data.stats?.total || 0} 个</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px;">100%</td>
            </tr>
            <tr style="background: #fef3c7;">
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 13px;">变化地块</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px; font-weight: bold; color: #f59e0b;">${data.stats?.changed || 0} 个</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px;">${((data.stats?.changed / data.stats?.total) * 100).toFixed(1)}%</td>
            </tr>
            <tr style="background: #d1fae5;">
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 13px;">未变化地块</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px; font-weight: bold; color: #10b981;">${data.stats?.unchanged || 0} 个</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px;">${((data.stats?.unchanged / data.stats?.total) * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 13px;">总变化次数</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px; font-weight: bold;">${data.stats?.totalChanges || 0} 次</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px;">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
    await addSectionToPDF(createTempContainer(statsHTML), { scale: 2 })
    console.log('  ✅ 统计表格已添加')
  } catch (error) {
    console.error('  ❌ 统计表格生成失败:', error.message)
  }
  
  // 4. 地图截图
  console.log('📄 [4/6] 捕获地图截图...')
  let mapImageData = ''
  
  // 设置超时保护，避免挂起
  const mapScreenshotPromise = (async () => {
    try {
      const mapElement = document.getElementById('temporal-map')
      if (!mapElement) {
        console.warn('  ⚠️ 未找到地图元素')
        return ''
      }
      
      console.log('  🗺️ 发现地图元素，开始截图...')
      
      // 跳过地图加载检测，直接截图
      console.log('  📸 尝试截图（跳过加载检测）...')
      
      try {
        const mapCanvas = await html2canvas(mapElement, {
          scale: 1.5,
          useCORS: true,
          allowTaint: false,
          logging: false,
          backgroundColor: '#f5f5f5',
          timeout: 10000,  // 添加超时
          foreignObjectRendering: false,
          ignoreElements: (element) => {
            return element.classList.contains('detail-panel') || 
                   element.classList.contains('map-legend')
          }
        })
        
        const data = mapCanvas.toDataURL('image/png')
        console.log('  ✅ 方法1成功，大小:', (data.length / 1024).toFixed(2), 'KB')
        return data
      } catch (corsError) {
        console.warn('  ⚠️ 方法1失败:', corsError.message)
        
        // 尝试方法2
        try {
          const mapCanvas = await html2canvas(mapElement, {
            scale: 1.5,
            useCORS: false,
            allowTaint: true,
            logging: false,
            backgroundColor: '#f5f5f5',
            timeout: 10000,
            foreignObjectRendering: false,
            ignoreElements: (element) => {
              return element.classList.contains('detail-panel') || 
                     element.classList.contains('map-legend')
            }
          })
          
          try {
            const data = mapCanvas.toDataURL('image/png')
            console.log('  ✅ 方法2成功')
            return data
          } catch (taintError) {
            console.warn('  ⚠️ Canvas被污染')
            return ''
          }
        } catch (e) {
          console.error('  ❌ 方法2失败:', e.message)
          return ''
        }
      }
    } catch (error) {
      console.error('  ❌ 地图截图异常:', error.message)
      return ''
    }
  })()
  
  // 使用 Promise.race 添加总超时（最多等待15秒）
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
  
  // 添加地图或跳过
  if (mapImageData && mapImageData.length > 20480) {
    console.log('  📍 尝试添加地图到PDF...')
    const mapHTML = `
      <div>
        <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 20px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
          🗺️ 时序变化地图
        </h2>
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: #f9fafb;">
          <img src="${mapImageData}" style="width: 100%; height: auto; display: block;" alt="时序变化地图" />
        </div>
        <div style="padding: 12px; background: #eff6ff; border-radius: 6px; font-size: 12px; color: #1e40af; margin-top: 10px;">
          <strong>说明：</strong>地图中不同颜色代表地块的变化程度，绿色表示无变化，橙色至深红色表示变化频率逐渐增加。
        </div>
      </div>
    `
    try {
      await addSectionToPDF(createTempContainer(mapHTML), { scale: 1.8, isMap: true })  // 移除forceNewPage，自动判断
      console.log('  ✅ 地图已添加到PDF')
    } catch (error) {
      console.error('  ❌ 地图添加失败，跳过此部分:', error.message)
    }
  } else {
    console.log('  ⚠️ 地图数据无效或过小，跳过地图部分（不影响后续内容）')
  }
  
  console.log('  📍 地图部分处理完成，继续后续内容...')
  
  console.log('  📍 准备生成作物分布统计...')
  
  // 5. 作物分布统计（取前3个时间点）
  const distributionData = (data.cropDistribution || []).slice(0, 3)
  console.log('  📍 作物分布数据长度:', distributionData.length)
  
  if (distributionData.length > 0) {
    console.log('📄 [5/6] 生成作物分布统计...')
    try {
      for (const [index, point] of distributionData.entries()) {
        console.log(`  📍 处理时间点 ${index + 1}/${distributionData.length}...`)
        const topCrops = point.crops.slice(0, 5)
        const cropHTML = `
          <div>
            ${index === 0 ? `
            <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 20px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
              🌾 各时期作物分布
            </h2>
            ` : ''}
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 15px;">
              <div style="background: #f3f4f6; padding: 12px 15px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">
                ${point.taskName || point.time || `时间点${point.timeIndex + 1}`}
              </div>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f9fafb;">
                    <th style="padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 12px;">作物类型</th>
                    <th style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb; font-size: 12px;">地块数</th>
                    <th style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb; font-size: 12px;">占比</th>
                  </tr>
                </thead>
                <tbody>
                  ${topCrops.map((crop, i) => `
                    <tr style="${i % 2 === 0 ? 'background: #ffffff;' : 'background: #f9fafb;'}">
                      <td style="padding: 10px 12px; font-size: 12px;">${crop.crop}</td>
                      <td style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: bold;">${crop.count} 个</td>
                      <td style="padding: 10px 12px; text-align: right; font-size: 12px; color: #4f46e5; font-weight: bold;">${crop.percentage}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `
        await addSectionToPDF(createTempContainer(cropHTML), { scale: 2 })  // 移除forceNewPage，自动判断
        console.log(`  ✅ 时间点 ${index + 1} 已添加`)
      }
    } catch (error) {
      console.error('  ❌ 作物分布统计生成失败，跳过:', error.message)
    }
  } else {
    console.log('  📍 没有作物分布数据，跳过')
  }
  
  console.log('  📍 准备生成变化地块明细...')
  
  // 6. 变化地块明细（前20个）
  const changedFeatures = (data.features || []).filter(f => (f.properties?.changeCount || 0) > 0).slice(0, 20)
  console.log('  📍 变化地块数量:', changedFeatures.length)
  
  if (changedFeatures.length > 0) {
    console.log('📄 [6/6] 生成变化地块明细...')
    try {
      const detailHTML = `
        <div>
          <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 20px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
            📋 变化地块明细（前${changedFeatures.length}个）
          </h2>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; font-size: 11px;">
            <thead>
              <tr style="background: #4f46e5; color: white;">
                <th style="padding: 10px 6px; border: 1px solid #4338ca;">序号</th>
                <th style="padding: 10px 6px; text-align: left; border: 1px solid #4338ca;">地块ID</th>
                <th style="padding: 10px 6px; text-align: left; border: 1px solid #4338ca;">起始→结束</th>
                <th style="padding: 10px 6px; border: 1px solid #4338ca;">变化次数</th>
              </tr>
            </thead>
            <tbody>
              ${changedFeatures.map((feature, i) => {
                const props = feature.properties
                return `
                  <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                    <td style="padding: 8px 6px; text-align: center; border: 1px solid #e5e7eb; font-weight: bold;">${i + 1}</td>
                    <td style="padding: 8px 6px; border: 1px solid #e5e7eb; font-family: monospace;">${props?.id || props?.Id || 'N/A'}</td>
                    <td style="padding: 8px 6px; border: 1px solid #e5e7eb; font-size: 10px;">${props?.startCrop || 'N/A'} → ${props?.endCrop || 'N/A'}</td>
                    <td style="padding: 8px 6px; text-align: center; border: 1px solid #e5e7eb; font-weight: bold; color: #f59e0b;">${props?.changeCount || 0}</td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
        </div>
      `
      await addSectionToPDF(createTempContainer(detailHTML), { scale: 2 })  // 移除forceNewPage，自动判断
      console.log('  ✅ 地块明细已添加')
    } catch (error) {
      console.error('  ❌ 地块明细生成失败，跳过:', error.message)
    }
  } else {
    console.log('  📍 没有变化地块，跳过')
  }
  
  console.log('  📍 generateTimelineContentSections 执行完成')
}

/**
 * 生成图表分析内容（分段）
 */
async function generateChartsContentSections(pdf, data, { addSectionToPDF, createTempContainer, usableHeight }) {
  console.log('📄 [3/9] 生成变化统计表格...')
  
  // 3. 变化统计表格
  try {
    const statsHTML = `
      <div>
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
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 13px;">总地块数</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px; font-weight: bold;">${data.stats?.total || 0} 个</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px;">100%</td>
            </tr>
            <tr style="background: #fef3c7;">
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 13px;">变化地块</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px; font-weight: bold; color: #f59e0b;">${data.stats?.changed || 0} 个</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px;">${((data.stats?.changed / data.stats?.total) * 100).toFixed(1)}%</td>
            </tr>
            <tr style="background: #d1fae5;">
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 13px;">未变化地块</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px; font-weight: bold; color: #10b981;">${data.stats?.unchanged || 0} 个</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px;">${((data.stats?.unchanged / data.stats?.total) * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 13px;">总变化次数</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px; font-weight: bold;">${data.stats?.totalChanges || 0} 次</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 13px;">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
    await addSectionToPDF(createTempContainer(statsHTML), { scale: 2 })
    console.log('  ✅ 变化统计已添加')
  } catch (error) {
    console.error('  ❌ 变化统计生成失败:', error.message)
  }
  
  // 4. 作物分布趋势（各时期对比）
  const distributionData = (data.cropDistribution || []).slice(0, 3)
  if (distributionData.length > 0) {
    console.log('📄 [4/9] 生成作物分布趋势...')
    try {
      // 汇总所有作物
      const allCrops = new Set()
      distributionData.forEach(point => {
        point.crops.forEach(crop => allCrops.add(crop.crop))
      })
      
      const distributionHTML = `
        <div>
          <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 15px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
            🌾 作物分布趋势对比
          </h2>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; font-size: 12px;">
            <thead>
              <tr style="background: #4f46e5; color: white;">
                <th style="padding: 10px; text-align: left; border: 1px solid #4338ca;">作物类型</th>
                ${distributionData.map(point => `
                  <th style="padding: 10px; text-align: center; border: 1px solid #4338ca;">
                    ${point.taskName || point.time || `时间${point.timeIndex + 1}`}
                  </th>
                `).join('')}
                <th style="padding: 10px; text-align: center; border: 1px solid #4338ca;">变化趋势</th>
              </tr>
            </thead>
            <tbody>
              ${Array.from(allCrops).slice(0, 10).map((cropName, i) => {
                const values = distributionData.map(point => {
                  const crop = point.crops.find(c => c.crop === cropName)
                  return crop ? crop.count : 0
                })
                const trend = values[values.length - 1] - values[0]
                const trendSymbol = trend > 0 ? '↑' : trend < 0 ? '↓' : '→'
                const trendColor = trend > 0 ? '#10b981' : trend < 0 ? '#ef4444' : '#6b7280'
                
                return `
                  <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                    <td style="padding: 8px 10px; border: 1px solid #e5e7eb; font-weight: bold;">${cropName}</td>
                    ${values.map(val => `
                      <td style="padding: 8px 10px; text-align: center; border: 1px solid #e5e7eb;">${val}</td>
                    `).join('')}
                    <td style="padding: 8px 10px; text-align: center; border: 1px solid #e5e7eb; font-weight: bold; color: ${trendColor};">
                      ${trendSymbol} ${Math.abs(trend)}
                    </td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
          <div style="padding: 10px; background: #f9fafb; border-radius: 6px; font-size: 11px; color: #6b7280; margin-top: 10px;">
            <strong>说明：</strong>↑ 表示地块数增加，↓ 表示减少，→ 表示无变化
          </div>
        </div>
      `
      await addSectionToPDF(createTempContainer(distributionHTML), { scale: 2 })
      console.log('  ✅ 作物分布趋势已添加')
    } catch (error) {
      console.error('  ❌ 作物分布趋势生成失败:', error.message)
    }
  }
  
  // 5. 作物转换流向统计
  const transitions = Object.entries(data.transitionMatrix || {}).sort((a, b) => b[1] - a[1]).slice(0, 15)
  if (transitions.length > 0) {
    console.log('📄 [5/9] 生成作物转换流向...')
    try {
      const transitionHTML = `
        <div>
          <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 15px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
            🔄 作物转换流向TOP15
          </h2>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
            <thead>
              <tr style="background: #4f46e5; color: white;">
                <th style="padding: 12px; text-align: left; border: 1px solid #4338ca;">排名</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #4338ca;">转换类型</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #4338ca;">次数</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #4338ca;">占比</th>
              </tr>
            </thead>
            <tbody>
              ${transitions.map(([key, count], i) => {
                const percentage = ((count / (data.stats?.totalChanges || 1)) * 100).toFixed(1)
                return `
                  <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                    <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold; color: ${i < 3 ? '#dc2626' : '#6b7280'};">
                      ${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${key}</td>
                    <td style="padding: 10px 12px; text-align: right; border: 1px solid #e5e7eb; font-weight: bold;">${count} 次</td>
                    <td style="padding: 10px 12px; text-align: right; border: 1px solid #e5e7eb; color: #4f46e5; font-weight: bold;">${percentage}%</td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
        </div>
      `
      await addSectionToPDF(createTempContainer(transitionHTML), { scale: 2 })
      console.log('  ✅ 作物转换流向已添加')
    } catch (error) {
      console.error('  ❌ 作物转换流向生成失败:', error.message)
    }
  }
  
  // 6. 变化频率分析
  if (data.features && data.features.length > 0) {
    console.log('📄 [6/9] 生成变化频率分析...')
    try {
      // 统计变化频率
      const changeFrequency = {}
      data.features.forEach(f => {
        const count = f.properties?.changeCount || 0
        changeFrequency[count] = (changeFrequency[count] || 0) + 1
      })
      
      const frequencyHTML = `
        <div>
          <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 15px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
            📊 地块变化频率分布
          </h2>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
            <thead>
              <tr style="background: #f9fafb;">
                <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">变化次数</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">地块数量</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">占比</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">分布图</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(changeFrequency).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([freq, count], i) => {
                const percentage = ((count / data.stats.total) * 100).toFixed(1)
                const barWidth = Math.min(100, percentage * 2)
                const bgColor = freq === '0' ? '#d1fae5' : freq === '1' ? '#fef3c7' : '#fee2e2'
                
                return `
                  <tr style="background: ${bgColor};">
                    <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold;">${freq} 次</td>
                    <td style="padding: 10px 12px; text-align: right; border: 1px solid #e5e7eb; font-weight: bold;">${count} 个</td>
                    <td style="padding: 10px 12px; text-align: right; border: 1px solid #e5e7eb;">${percentage}%</td>
                    <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">
                      <div style="background: #4f46e5; height: 8px; width: ${barWidth}%; border-radius: 4px;"></div>
                    </td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
        </div>
      `
      await addSectionToPDF(createTempContainer(frequencyHTML), { scale: 2 })
      console.log('  ✅ 变化频率分析已添加')
    } catch (error) {
      console.error('  ❌ 变化频率分析生成失败:', error.message)
    }
  }
  
  // 7. 未变化地块分析
  const unchangedFeatures = (data.trajectories || data.features || []).filter(f => {
    const changeCount = f.properties?.changeCount || f.changeCount || 0
    return changeCount === 0
  }).slice(0, 10)
  
  if (unchangedFeatures.length > 0) {
    console.log('📄 [7/9] 生成未变化地块分析...')
    try {
      // 统计未变化地块的作物类型
      const unchangedCrops = {}
      unchangedFeatures.forEach(f => {
        const crop = f.properties?.timeline?.[0] || f.timeline?.[0] || 'Unknown'
        unchangedCrops[crop] = (unchangedCrops[crop] || 0) + 1
      })
      
      const unchangedHTML = `
        <div>
          <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 15px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
            🟢 未变化地块作物类型分布
          </h2>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
            <thead>
              <tr style="background: #10b981; color: white;">
                <th style="padding: 12px; text-align: left; border: 1px solid #059669;">作物类型</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #059669;">地块数量</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #059669;">占未变化地块比例</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(unchangedCrops).sort((a, b) => b[1] - a[1]).map(([crop, count], i) => {
                const percentage = ((count / data.stats.unchanged) * 100).toFixed(1)
                return `
                  <tr style="background: ${i % 2 === 0 ? '#d1fae5' : '#ecfdf5'};">
                    <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold;">${crop}</td>
                    <td style="padding: 10px 12px; text-align: right; border: 1px solid #e5e7eb;">${count} 个</td>
                    <td style="padding: 10px 12px; text-align: right; border: 1px solid #e5e7eb; color: #10b981; font-weight: bold;">${percentage}%</td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
          <div style="padding: 10px; background: #ecfdf5; border-radius: 6px; font-size: 11px; color: #059669; margin-top: 10px;">
            <strong>说明：</strong>这些地块在整个分析期间保持同一作物种植，未发生变化
          </div>
        </div>
      `
      await addSectionToPDF(createTempContainer(unchangedHTML), { scale: 2 })
      console.log('  ✅ 未变化地块分析已添加')
    } catch (error) {
      console.error('  ❌ 未变化地块分析生成失败:', error.message)
    }
  }
  
  // 8. 各时期作物分布详情
  if (distributionData.length > 0) {
    console.log('📄 [8/9] 生成各时期作物分布详情...')
    try {
      for (const [index, point] of distributionData.entries()) {
        const topCrops = point.crops.slice(0, 8)
        const cropHTML = `
          <div>
            ${index === 0 ? `
            <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 20px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
              📅 各时期作物分布详情
            </h2>
            ` : ''}
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 15px;">
              <div style="background: #f3f4f6; padding: 12px 15px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">
                ${point.taskName || point.time || `时间点${point.timeIndex + 1}`}
              </div>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f9fafb;">
                    <th style="padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 12px;">作物类型</th>
                    <th style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb; font-size: 12px;">地块数</th>
                    <th style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb; font-size: 12px;">占比</th>
                  </tr>
                </thead>
                <tbody>
                  ${topCrops.map((crop, i) => `
                    <tr style="${i % 2 === 0 ? 'background: #ffffff;' : 'background: #f9fafb;'}">
                      <td style="padding: 10px 12px; font-size: 12px;">${crop.crop}</td>
                      <td style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: bold;">${crop.count} 个</td>
                      <td style="padding: 10px 12px; text-align: right; font-size: 12px; color: #4f46e5; font-weight: bold;">${crop.percentage}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `
        await addSectionToPDF(createTempContainer(cropHTML), { scale: 2 })
        console.log(`  ✅ 时期 ${index + 1} 作物分布已添加`)
      }
    } catch (error) {
      console.error('  ❌ 各时期作物分布生成失败:', error.message)
    }
  }
  
  // 9. 变化地块明细
  const changedFeatures = (data.features || []).filter(f => (f.properties?.changeCount || 0) > 0).slice(0, 20)
  if (changedFeatures.length > 0) {
    console.log('📄 [9/9] 生成变化地块明细...')
    try {
      const detailHTML = `
        <div>
          <h2 style="font-size: 20px; color: #1f2937; margin: 0 0 20px 0; border-left: 4px solid #4f46e5; padding-left: 10px;">
            📋 变化地块明细（前${changedFeatures.length}个）
          </h2>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; font-size: 11px;">
            <thead>
              <tr style="background: #4f46e5; color: white;">
                <th style="padding: 10px 6px; border: 1px solid #4338ca;">序号</th>
                <th style="padding: 10px 6px; text-align: left; border: 1px solid #4338ca;">地块ID</th>
                <th style="padding: 10px 6px; text-align: left; border: 1px solid #4338ca;">起始→结束</th>
                <th style="padding: 10px 6px; border: 1px solid #4338ca;">变化次数</th>
              </tr>
            </thead>
            <tbody>
              ${changedFeatures.map((feature, i) => {
                const props = feature.properties
                return `
                  <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                    <td style="padding: 8px 6px; text-align: center; border: 1px solid #e5e7eb; font-weight: bold;">${i + 1}</td>
                    <td style="padding: 8px 6px; border: 1px solid #e5e7eb; font-family: monospace;">${props?.id || props?.Id || 'N/A'}</td>
                    <td style="padding: 8px 6px; border: 1px solid #e5e7eb; font-size: 10px;">${props?.startCrop || 'N/A'} → ${props?.endCrop || 'N/A'}</td>
                    <td style="padding: 8px 6px; text-align: center; border: 1px solid #e5e7eb; font-weight: bold; color: #f59e0b;">${props?.changeCount || 0}</td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
        </div>
      `
      await addSectionToPDF(createTempContainer(detailHTML), { scale: 2 })
      console.log('  ✅ 变化地块明细已添加')
    } catch (error) {
      console.error('  ❌ 变化地块明细生成失败:', error.message)
    }
  }
  
  console.log('  📍 generateChartsContentSections 执行完成')
}

/**
 * 生成报告HTML内容（已废弃，保留以兼容旧代码）
 */
async function generateReportHTML(data, activeTab) {
  const timestamp = new Date().toLocaleString('zh-CN')
  const changeRate = data.stats?.total ? ((data.stats.changed / data.stats.total) * 100).toFixed(1) : 0
  
   // 捕获地图截图（带自动降级处理）
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
         
         // 尝试截图（方法1：使用 CORS）
         console.log('📸 方法1：尝试使用 CORS 截图地图...')
         try {
         const mapCanvas = await html2canvas(mapElement, {
           scale: 1.5,
           useCORS: true,
             allowTaint: false, // CORS 模式必须为 false
           logging: false,
           backgroundColor: '#f5f5f5',
           imageTimeout: 20000,
             foreignObjectRendering: false,
             ignoreElements: (element) => {
               return element.classList.contains('detail-panel') || 
                      element.classList.contains('map-legend')
             },
           onclone: (clonedDoc) => {
             const clonedMap = clonedDoc.getElementById('temporal-map')
             if (clonedMap) {
                 const detailPanel = clonedMap.querySelector('.detail-panel')
                 if (detailPanel) detailPanel.remove()
             }
           }
         })
         
         mapImageData = mapCanvas.toDataURL('image/png')
         const sizeKB = (mapImageData.length / 1024).toFixed(2)
           console.log('✅ 方法1成功：地图截图完成，大小:', sizeKB, 'KB')
         
           // 检查截图是否为空白
         if (mapImageData.length < 20480) {
             console.warn('⚠️ 截图尺寸过小 (< 20KB)，可能为空白，尝试备用方法...')
             throw new Error('Screenshot too small, possibly blank')
           }
         } catch (corsError) {
           // CORS 方法失败，尝试方法2：允许污染模式
           console.warn('⚠️ 方法1失败 (可能是跨域问题):', corsError.message)
           console.log('📸 方法2：尝试使用 allowTaint 模式截图...')
           
           try {
             const mapCanvas = await html2canvas(mapElement, {
               scale: 1.5,
               useCORS: false,
               allowTaint: true, // 允许污染模式
               logging: false,
               backgroundColor: '#f5f5f5',
               imageTimeout: 20000,
               foreignObjectRendering: false,
               ignoreElements: (element) => {
                 return element.classList.contains('detail-panel') || 
                        element.classList.contains('map-legend')
               }
             })
             
             // 注意：allowTaint 模式下 Canvas 被污染，toDataURL 可能失败
             try {
               mapImageData = mapCanvas.toDataURL('image/png')
               const sizeKB = (mapImageData.length / 1024).toFixed(2)
               console.log('✅ 方法2成功：地图截图完成，大小:', sizeKB, 'KB')
             } catch (taintError) {
               console.warn('⚠️ Canvas 被污染，无法导出:', taintError.message)
               console.log('💡 建议：请在导出前切换到"无底图"模式以避免跨域问题')
           mapImageData = '' // 清空，使用警告提示
             }
           } catch (taintModeError) {
             console.error('❌ 方法2也失败:', taintModeError.message)
             mapImageData = ''
           }
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
     <div style="margin: 40px 0 30px 0; padding: 30px; background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; page-break-inside: avoid;">
       <div style="text-align: center; margin-bottom: 15px;">
         <span style="font-size: 48px;">⚠️</span>
       </div>
       <h3 style="color: #856404; font-size: 16px; margin: 0 0 12px 0; text-align: center; font-weight: 600;">
         地图截图失败
       </h3>
       <p style="color: #856404; font-size: 13px; margin: 0 0 12px 0; line-height: 1.6;">
         由于浏览器安全限制，无法捕获包含外部地图瓦片的截图（跨域问题）。
       </p>
       <div style="background: #fff; padding: 15px; border-radius: 6px; margin-top: 12px;">
         <p style="color: #333; font-size: 13px; margin: 0 0 8px 0; font-weight: 600;">💡 解决方法：</p>
         <ol style="color: #666; font-size: 12px; margin: 8px 0 0 20px; padding: 0; line-height: 1.8;">
           <li>在导出前，将底图切换为"<strong>无底图</strong>"</li>
           <li>等待地图重新渲染（显示彩色地块）</li>
           <li>再次点击"<strong>导出报告</strong>"按钮</li>
         </ol>
       </div>
       <p style="color: #999; font-size: 11px; margin: 15px 0 0 0; text-align: center; font-style: italic;">
         无底图模式下仍可正常显示所有地块和变化信息
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
