/**
 * 导出工具函数
 * 用于将数据导出为Excel/CSV/TXT等格式
 */

/**
 * 导出差异检测结果为Excel文件
 * @param {Object} analysisResult - 分析结果对象
 * @param {String} baseFileName - 基准文件名
 * @param {String} compareFileName - 对比文件名
 */
export const exportDifferenceToExcel = (analysisResult, baseFileName, compareFileName) => {
  const { features, stats, metadata } = analysisResult
  
  // 创建HTML表格内容
  let htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:x="urn:schemas-microsoft-com:office:excel" 
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #409EFF; color: white; font-weight: bold; }
        .header { background-color: #f5f7fa; padding: 15px; margin-bottom: 10px; }
        .stats { margin: 10px 0; padding: 10px; background-color: #ecf5ff; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>种植差异检测分析报告</h2>
        <p><strong>原始图：</strong>${baseFileName}</p>
        <p><strong>对比图：</strong>${compareFileName}</p>
        <p><strong>生成时间：</strong>${new Date().toLocaleString('zh-CN')}</p>
      </div>
      
      <div class="stats">
        <h3>统计汇总</h3>
        <p><strong>总地块数：</strong>${stats.total} 个</p>
        <p><strong>有变化：</strong>${stats.changed} 个</p>
        <p><strong>无变化：</strong>${stats.unchanged} 个</p>
        <p><strong>变化率：</strong>${((stats.changed / stats.total) * 100).toFixed(2)}%</p>
      </div>
      
      <h3>详细变化列表</h3>
      <table>
        <thead>
          <tr>
            <th>序号</th>
            <th>地块ID</th>
            <th>地块名称</th>
            <th>原始作物</th>
            <th>对比作物</th>
            <th>变化类型</th>
            <th>变化描述</th>
            <th>面积(公顷)</th>
          </tr>
        </thead>
        <tbody>
  `
  
  // 只导出有变化的地块
  const changedFeatures = features.filter(f => f.properties.hasChange)
  
  changedFeatures.forEach((feature, index) => {
    const props = feature.properties
    const area = props.area ? props.area.toFixed(2) : (props.SHAPE_Area ? (props.SHAPE_Area / 10000).toFixed(2) : 'N/A')
    
    htmlContent += `
      <tr>
        <td>${index + 1}</td>
        <td>${props.plotId || props.FID || 'N/A'}</td>
        <td>${props.plotName || props.name || '未命名'}</td>
        <td>${props.baseCrop || 'N/A'}</td>
        <td>${props.compareCrop || 'N/A'}</td>
        <td>${props.changeType || '类型变化'}</td>
        <td>${props.changeDescription || `从${props.baseCrop}变为${props.compareCrop}`}</td>
        <td>${area}</td>
      </tr>
    `
  })
  
  htmlContent += `
        </tbody>
      </table>
    </body>
    </html>
  `
  
  // 创建Blob并下载
  const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const fileName = `差异检测报告_${new Date().getTime()}.xls`
  downloadBlob(blob, fileName)
  
  return fileName
}

/**
 * 导出时序变化分析结果为Excel文件
 * @param {Object} analysisResult - 分析结果对象
 */
export const exportTemporalToExcel = (analysisResult) => {
  const { features, stats, timePoints } = analysisResult
  
  // 创建HTML表格内容
  let htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:x="urn:schemas-microsoft-com:office:excel" 
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #409EFF; color: white; font-weight: bold; }
        .header { background-color: #f5f7fa; padding: 15px; margin-bottom: 10px; }
        .stats { margin: 10px 0; padding: 10px; background-color: #ecf5ff; }
        .timeline-cell { font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>时序变化分析报告</h2>
        <p><strong>分析时间段：</strong>${timePoints.length} 期</p>
        <p><strong>时间跨度：</strong>${timePoints[0].time} 至 ${timePoints[timePoints.length - 1].time}</p>
        <p><strong>生成时间：</strong>${new Date().toLocaleString('zh-CN')}</p>
      </div>
      
      <div class="stats">
        <h3>统计汇总</h3>
        <p><strong>总地块数：</strong>${stats.total} 个</p>
        <p><strong>有变化：</strong>${stats.changed} 个</p>
        <p><strong>无变化：</strong>${stats.unchanged} 个</p>
        <p><strong>变化率：</strong>${((stats.changed / stats.total) * 100).toFixed(2)}%</p>
        <p><strong>分析期数：</strong>${timePoints.length} 期</p>
      </div>
      
      <h3>详细变化列表</h3>
      <table>
        <thead>
          <tr>
            <th>序号</th>
            <th>地块ID</th>
            <th>地块名称</th>
            <th>变化次数</th>
            <th>时序变化轨迹</th>
            <th>面积(公顷)</th>
          </tr>
        </thead>
        <tbody>
  `
  
  // 只导出有变化的地块
  const changedFeatures = features.filter(f => f.properties.hasChange)
  
  changedFeatures.forEach((feature, index) => {
    const props = feature.properties
    const area = props.area ? props.area.toFixed(2) : (props.SHAPE_Area ? (props.SHAPE_Area / 10000).toFixed(2) : 'N/A')
    
    // 构建时序变化轨迹文本
    const timelineText = props.timeline
      ? props.timeline.map(t => `${t.time.split(' ')[0]}: ${t.crop}`).join(' → ')
      : 'N/A'
    
    htmlContent += `
      <tr>
        <td>${index + 1}</td>
        <td>${props.plotId || 'N/A'}</td>
        <td>${props.plotName || '未命名'}</td>
        <td>${props.changeCount || 0} 次</td>
        <td class="timeline-cell">${timelineText}</td>
        <td>${area}</td>
      </tr>
    `
  })
  
  htmlContent += `
        </tbody>
      </table>
      
      <h3>时序统计图表数据</h3>
      <table>
        <thead>
          <tr>
            <th>时间点</th>
            <th>期数</th>
            <th>文件名</th>
          </tr>
        </thead>
        <tbody>
  `
  
  timePoints.forEach((tp, idx) => {
    htmlContent += `
      <tr>
        <td>${tp.time}</td>
        <td>第 ${idx + 1} 期</td>
        <td>${tp.taskName || 'N/A'}</td>
      </tr>
    `
  })
  
  htmlContent += `
        </tbody>
      </table>
    </body>
    </html>
  `
  
  // 创建Blob并下载
  const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const fileName = `时序变化分析报告_${new Date().getTime()}.xls`
  downloadBlob(blob, fileName)
  
  return fileName
}

/**
 * 导出统计汇总结果为Excel文件
 * @param {Array} statisticsData - 统计数据数组
 * @param {Object} config - 配置信息
 */
export const exportStatisticsToExcel = (statisticsData, config) => {
  // 创建HTML表格内容
  let htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:x="urn:schemas-microsoft-com:office:excel" 
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #409EFF; color: white; font-weight: bold; }
        .header { background-color: #f5f7fa; padding: 15px; margin-bottom: 10px; }
        .number { text-align: right; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>统计汇总报告</h2>
        <p><strong>数据来源：</strong>${config.source || 'N/A'}</p>
        <p><strong>统计维度：</strong>${config.dimensions ? config.dimensions.join(', ') : 'N/A'}</p>
        <p><strong>生成时间：</strong>${new Date().toLocaleString('zh-CN')}</p>
      </div>
      
      <h3>统计数据</h3>
      <table>
        <thead>
          <tr>
            <th>序号</th>
            <th>类别</th>
            <th>数量</th>
            <th>占比</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
  `
  
  const total = statisticsData.reduce((sum, item) => sum + (item.count || 0), 0)
  
  statisticsData.forEach((item, index) => {
    const percentage = total > 0 ? ((item.count / total) * 100).toFixed(2) : '0.00'
    
    htmlContent += `
      <tr>
        <td>${index + 1}</td>
        <td>${item.category || item.name || 'N/A'}</td>
        <td class="number">${item.count || 0}</td>
        <td class="number">${percentage}%</td>
        <td>${item.description || '-'}</td>
      </tr>
    `
  })
  
  htmlContent += `
        </tbody>
        <tfoot>
          <tr style="font-weight: bold; background-color: #f0f0f0;">
            <td colspan="2">总计</td>
            <td class="number">${total}</td>
            <td class="number">100.00%</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </body>
    </html>
  `
  
  // 创建Blob并下载
  const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const fileName = `统计汇总报告_${new Date().getTime()}.xls`
  downloadBlob(blob, fileName)
  
  return fileName
}

/**
 * 导出为CSV文件
 * @param {Array} data - 数据数组
 * @param {Array} headers - 表头数组
 * @param {String} fileName - 文件名
 */
export const exportToCSV = (data, headers, fileName = 'export.csv') => {
  // 构建CSV内容
  let csvContent = '\uFEFF' // UTF-8 BOM for Excel
  
  // 添加表头
  csvContent += headers.join(',') + '\n'
  
  // 添加数据行
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header] || ''
      // 处理包含逗号或引号的值
      if (String(value).includes(',') || String(value).includes('"')) {
        return `"${String(value).replace(/"/g, '""')}"`
      }
      return value
    })
    csvContent += values.join(',') + '\n'
  })
  
  // 创建Blob并下载
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, fileName)
}

/**
 * 导出为TXT文件（适用于简单的文本报告）
 * @param {String} content - 文本内容
 * @param {String} fileName - 文件名
 */
export const exportToTXT = (content, fileName = 'report.txt') => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  downloadBlob(blob, fileName)
}

/**
 * 通用下载函数
 * @param {Blob} blob - Blob对象
 * @param {String} fileName - 文件名
 */
const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 生成可下载的文件URL（保存到public/data目录）
 * 注意：这个函数返回的是一个虚拟路径，实际文件并未保存
 * @param {String} fileName - 文件名
 * @returns {String} 文件路径
 */
export const generateDownloadPath = (fileName) => {
  return `/data/exports/${fileName}`
}

/**
 * 保存文件元数据到localStorage（用于数据管理界面显示）
 * @param {Object} fileInfo - 文件信息
 */
export const saveFileMetadata = (fileInfo) => {
  const QUEUE_KEY = 'analysis_result_queue'
  let queue = []
  
  try {
    const stored = localStorage.getItem(QUEUE_KEY)
    if (stored) {
      queue = JSON.parse(stored)
    }
  } catch (error) {
    console.error('读取队列失败:', error)
    queue = []
  }
  
  // 添加新文件
  queue.push(fileInfo)
  
  // 保存到localStorage
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
    console.log('✅ 文件元数据已保存到队列:', fileInfo.name)
  } catch (error) {
    console.error('❌ 保存文件元数据失败:', error)
  }
}

