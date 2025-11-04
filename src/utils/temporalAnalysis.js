/**
 * 时序分析工具函数
 * 用于多时期影像对比分析
 */

// 作物类型映射（与Dashboard保持一致）
const CROP_TYPE_MAP = {
  1: '裸地',
  2: '棉花',
  3: '小麦',
  4: '玉米',
  5: '番茄',
  6: '甜菜',
  7: '打瓜',
  8: '辣椒',
  9: '籽用葫芦',
  10: '其它耕地'
}

/**
 * 获取作物类型名称
 */
export function getCropTypeName(typeValue) {
  if (typeValue === null || typeValue === undefined) return '未知'
  return CROP_TYPE_MAP[typeValue] || `未知类型(${typeValue})`
}

/**
 * 构建时序轨迹
 * @param {Array} timePointsData - 时间点数据数组 [{geojsonData, taskName, time}, ...]
 * @returns {Object} 包含轨迹、统计信息和质量报告的对象
 */
export function buildTemporalTrajectories(timePointsData) {
  console.log('🔄 开始构建时序轨迹，时间点数量:', timePointsData.length)
  
  if (!timePointsData || timePointsData.length < 2) {
    throw new Error('至少需要两个时间点进行时序分析')
  }

  // 🔥 关键修复：按时间排序，确保无论用户选择顺序如何，都按时间先后顺序进行分析
  console.log('📅 原始顺序:', timePointsData.map(tp => `${tp.taskName} (${tp.time || tp.createTime})`))
  
  // 按时间字段排序（优先使用 time，其次 createTime）
  const sortedTimePointsData = [...timePointsData].sort((a, b) => {
    const timeA = a.time || a.createTime
    const timeB = b.time || b.createTime
    
    if (!timeA || !timeB) {
      console.warn('⚠️ 部分时间点缺少时间信息:', { a: a.taskName, b: b.taskName })
      return 0
    }
    
    // 转换为时间戳进行比较
    const timestampA = new Date(timeA).getTime()
    const timestampB = new Date(timeB).getTime()
    
    return timestampA - timestampB // 升序排列（早→晚）
  })
  
  console.log('📅 排序后顺序:', sortedTimePointsData.map(tp => `${tp.taskName} (${tp.time || tp.createTime})`))
  console.log('✅ 时间排序完成，确保按时间先后进行分析')
  
  // 使用排序后的数据进行后续处理
  timePointsData = sortedTimePointsData

  // 数据质量分析
  const qualityReport = analyzeDataQuality(timePointsData)
  console.log('📊 数据质量报告:', qualityReport)

  // 提取所有地块ID（从第一个时间点）
  const firstTimePoint = timePointsData[0]
  const firstFeatures = firstTimePoint.geojsonData?.features || firstTimePoint.features || []
  
  if (firstFeatures.length === 0) {
    throw new Error('第一个时间点没有地块数据')
  }

  console.log(`📍 基准时间点包含 ${firstFeatures.length} 个地块`)

  // 构建地块ID -> 时序数据的映射
  const plotTrajectories = new Map()
  const allPlotIds = new Set()

  // 遍历每个时间点
  timePointsData.forEach((timePoint, timeIndex) => {
    const features = timePoint.geojsonData?.features || timePoint.features || []
    
    console.log(`⏰ 时间点 ${timeIndex + 1}: ${timePoint.taskName}, 地块数: ${features.length}`)
    
    features.forEach((feature, featureIndex) => {
      const plotId = feature.properties?.id || feature.properties?.Id || feature.id
      // 优先读取gridcode字段，其次是type/Type字段
      const cropType = feature.properties?.gridcode || feature.properties?.GRIDCODE || 
                       feature.properties?.type || feature.properties?.Type || 0
      const cropName = getCropTypeName(cropType)
      
      // 添加详细日志
      if (featureIndex === 0) {
        console.log(`📋 时间点 ${timeIndex + 1} 的第一个地块示例:`, {
          plotId,
          cropType,
          cropName,
          properties: feature.properties,
          fieldUsed: feature.properties?.gridcode ? 'gridcode' : 
                     feature.properties?.GRIDCODE ? 'GRIDCODE' :
                     feature.properties?.type ? 'type' : 
                     feature.properties?.Type ? 'Type' : 'none'
        })
      }
      
      if (!plotId) {
        console.warn('⚠️ 发现没有ID的地块:', feature.properties)
        return
      }

      allPlotIds.add(plotId)

      if (!plotTrajectories.has(plotId)) {
        plotTrajectories.set(plotId, {
          plotId,
          plotName: feature.properties?.plotName || feature.properties?.name || `地块${plotId}`,
          area: feature.properties?.area || feature.properties?.Area || 0,
          geometry: feature.geometry, // 保留第一次出现的geometry
          timeline: [],
          cropHistory: [],
          changeCount: 0
        })
      }

      const trajectory = plotTrajectories.get(plotId)
      trajectory.timeline.push({
        time: timePoint.time || timePoint.taskName,
        taskName: timePoint.taskName,
        crop: cropName,
        cropType: cropType,
        timeIndex: timeIndex
      })
      trajectory.cropHistory.push(cropName)
    })
  })

  console.log(`✅ 共识别 ${allPlotIds.size} 个唯一地块`)

  // 计算变化次数
  let changedCount = 0
  const trajectories = []
  let exampleLogged = false

  plotTrajectories.forEach((trajectory, plotId) => {
    // 确保所有时间点都有数据（缺失的填充为"未知"）
    if (trajectory.timeline.length < timePointsData.length) {
      console.warn(`⚠️ 地块 ${plotId} 在某些时间点缺失，补充为"未知"`)
      
      for (let i = 0; i < timePointsData.length; i++) {
        if (!trajectory.timeline.find(t => t.timeIndex === i)) {
          trajectory.timeline.splice(i, 0, {
            time: timePointsData[i].time || timePointsData[i].taskName,
            taskName: timePointsData[i].taskName,
            crop: '未知',
            cropType: null,
            timeIndex: i
          })
          trajectory.cropHistory.splice(i, 0, '未知')
        }
      }
    }

    // 计算变化次数（相邻时间点作物不同）
    let changes = 0
    for (let i = 1; i < trajectory.cropHistory.length; i++) {
      if (trajectory.cropHistory[i] !== trajectory.cropHistory[i - 1]) {
        changes++
      }
    }
    trajectory.changeCount = changes

    // 输出第一个地块的示例
    if (!exampleLogged) {
      console.log(`📝 第一个地块示例 (ID: ${plotId}):`, {
        cropHistory: trajectory.cropHistory,
        changeCount: changes,
        timeline: trajectory.timeline.map(t => `${t.taskName}: ${t.crop}`)
      })
      exampleLogged = true
    }

    if (changes > 0) {
      changedCount++
    }

    trajectories.push(trajectory)
  })

  console.log(`📈 变化统计: ${changedCount}/${allPlotIds.size} 个地块有变化`)
  if (changedCount === 0) {
    console.warn(`⚠️ 警告：所有地块都没有变化！请检查：
    1. 两个文件的作物类型字段是否正确 (type/Type)
    2. 作物类型值是否不同
    3. 地块ID是否匹配`)
  }

  // 构建转换矩阵
  const transitionResult = calculateTransitionMatrix(trajectories, timePointsData.length)
  console.log('🔄 转换矩阵:', transitionResult)

  // 计算作物分布
  const cropDistribution = calculateCropDistribution(trajectories, timePointsData.length, timePointsData)
  console.log('🌾 作物分布:', cropDistribution)

  // 构建GeoJSON features
  const features = trajectories.map(traj => ({
    type: 'Feature',
    id: traj.plotId,
    properties: {
      id: traj.plotId,
      plotName: traj.plotName,
      area: traj.area,
      changeCount: traj.changeCount,
      startCrop: traj.cropHistory[0],
      endCrop: traj.cropHistory[traj.cropHistory.length - 1],
      timeline: traj.timeline,
      cropSequence: traj.cropHistory.join(' → ')
    },
    geometry: traj.geometry
  }))

  // 构建时间点信息
  const timePoints = timePointsData.map((tp, idx) => ({
    index: idx,
    taskName: tp.taskName,
    time: tp.time || tp.taskName,
    plotCount: tp.geojsonData?.features?.length || tp.features?.length || 0
  }))

  const result = {
    trajectories,
    features,
    stats: {
      total: allPlotIds.size,
      changed: changedCount,
      unchanged: allPlotIds.size - changedCount,
      totalChanges: transitionResult.totalChanges || 0 // 添加总变化次数
    },
    timePoints,
    filesCount: timePointsData.length,
    transitionMatrix: transitionResult.matrix,
    cropDistribution,
    qualityReport
  }

  console.log('✅ 时序轨迹构建完成:', result.stats)
  return result
}

/**
 * 数据质量分析
 */
function analyzeDataQuality(timePointsData) {
  const warnings = []
  const timePointCounts = []

  timePointsData.forEach((tp, idx) => {
    const features = tp.geojsonData?.features || tp.features || []
    const count = features.length
    
    timePointCounts.push({
      taskName: tp.taskName,
      time: tp.time || tp.taskName,
      count: count
    })

    if (count === 0) {
      warnings.push({
        type: 'empty_data',
        severity: 'error',
        message: `时间点 ${idx + 1} (${tp.taskName}) 没有地块数据`,
        timeIndex: idx
      })
    }
  })

  // 检查地块数量一致性
  const counts = timePointCounts.map(t => t.count)
  const maxCount = Math.max(...counts)
  const minCount = Math.min(...counts)

  if (maxCount !== minCount) {
    warnings.push({
      type: 'count_mismatch',
      severity: 'warning',
      message: `不同时间点的地块数量不一致（${minCount}-${maxCount}），可能影响对比结果`,
      details: timePointCounts
    })
  }

  // 计算匹配率（所有时间点都有数据的地块占比）
  const firstCount = counts[0] || 0
  const matchRate = firstCount > 0 ? ((minCount / maxCount) * 100).toFixed(1) : 0

  return {
    warnings,
    timePointCounts,
    matchRate: parseFloat(matchRate),
    isConsistent: maxCount === minCount
  }
}

/**
 * 计算转换矩阵
 */
function calculateTransitionMatrix(trajectories, timePointsCount) {
  const matrix = {}
  const cropTypes = new Set()
  let totalChanges = 0 // 统计真实变化次数

  // 只统计有变化的地块
  const changedTrajectories = trajectories.filter(traj => traj.changeCount > 0)
  
  changedTrajectories.forEach(traj => {
    for (let i = 1; i < traj.cropHistory.length; i++) {
      const fromCrop = traj.cropHistory[i - 1]
      const toCrop = traj.cropHistory[i]

      // 🔥 排除类型不变的情况（即fromCrop === toCrop）
      if (fromCrop === toCrop) {
        continue
      }

      cropTypes.add(fromCrop)
      cropTypes.add(toCrop)

      const key = `${fromCrop} → ${toCrop}`
      matrix[key] = (matrix[key] || 0) + 1
      totalChanges++
    }
  })

  // 按频次排序
  const sortedMatrix = Object.entries(matrix)
    .sort((a, b) => b[1] - a[1])
    .reduce((obj, [key, value]) => {
      obj[key] = value
      return obj
    }, {})

  console.log(`🔄 作物转换统计: 共 ${totalChanges} 次真实变化（排除无变化）`)

  return {
    matrix: sortedMatrix,
    cropTypes: Array.from(cropTypes),
    totalChanges // 返回总变化次数
  }
}

/**
 * 计算作物分布
 */
function calculateCropDistribution(trajectories, timePointsCount, timePointsData) {
  const distribution = []
  const allCropTypes = new Set() // 收集所有出现过的作物类型

  for (let timeIndex = 0; timeIndex < timePointsCount; timeIndex++) {
    const cropCounts = {}
    
    trajectories.forEach(traj => {
      if (traj.timeline[timeIndex]) {
        const crop = traj.timeline[timeIndex].crop
        const cropType = traj.timeline[timeIndex].cropType
        cropCounts[crop] = (cropCounts[crop] || 0) + 1
        
        // 收集cropType用于检查映射
        if (cropType !== null && cropType !== undefined) {
          allCropTypes.add(cropType)
        }
      }
    })

    const total = Object.values(cropCounts).reduce((sum, count) => sum + count, 0)
    
    // 转换为数组格式，并计算百分比
    const cropsArray = Object.entries(cropCounts).map(([crop, count]) => ({
      crop,
      count,
      percentage: total > 0 ? ((count / total) * 100).toFixed(1) : '0'
    }))
    
    // 按数量降序排序
    cropsArray.sort((a, b) => b.count - a.count)

    // 添加日志
    if (timeIndex === 0) {
      console.log(`🌾 时间点 ${timeIndex + 1} 的作物分布:`, cropCounts)
    }

    // 从timePointsData获取时间点信息
    const timePoint = timePointsData[timeIndex] || {}

    distribution.push({
      timeIndex,
      taskName: timePoint.taskName || `时间点${timeIndex + 1}`,  // 添加taskName
      time: timePoint.time || timePoint.taskName,  // 添加time
      crops: cropsArray, // 现在是数组格式，包含 {crop, count, percentage}
      total
    })
  }

  // 检查哪些cropType没有对应的映射
  const unmappedTypes = Array.from(allCropTypes).filter(type => !CROP_TYPE_MAP[type])
  if (unmappedTypes.length > 0) {
    console.warn(`⚠️ 发现未映射的作物类型值:`, unmappedTypes)
    console.warn(`⚠️ 当前CROP_TYPE_MAP:`, CROP_TYPE_MAP)
    console.warn(`⚠️ 所有出现过的cropType值:`, Array.from(allCropTypes).sort((a, b) => a - b))
  }

  console.log(`✅ 作物分布计算完成，共 ${distribution.length} 个时间点`)
  return distribution
}

/**
 * 导出为CSV格式
 * @param {Object} analysisResult - 分析结果
 * @param {String} type - 导出类型: 'timeline' 或 'chart'
 * @returns {String} CSV内容
 */
export function exportToCSV(analysisResult, type = 'timeline') {
  if (type === 'timeline') {
    return exportTimelineToCSV(analysisResult)
  } else if (type === 'chart') {
    return exportChartToCSV(analysisResult)
  }
  throw new Error('不支持的导出类型')
}

/**
 * 导出时间轴统计表
 */
function exportTimelineToCSV(analysisResult) {
  const { trajectories, timePoints } = analysisResult
  
  // CSV头部
  let csv = '\uFEFF' // UTF-8 BOM
  csv += '地块ID,地块名称,面积(亩),变化次数,起始作物,结束作物'
  
  // 添加每个时间点的列
  timePoints.forEach(tp => {
    csv += `,${tp.taskName}`
  })
  csv += '\n'

  // 数据行
  trajectories.forEach(traj => {
    csv += `${traj.plotId},${traj.plotName},${traj.area},${traj.changeCount},${traj.cropHistory[0]},${traj.cropHistory[traj.cropHistory.length - 1]}`
    
    traj.timeline.forEach(point => {
      csv += `,${point.crop}`
    })
    csv += '\n'
  })

  return csv
}

/**
 * 导出图表分析数据
 */
function exportChartToCSV(analysisResult) {
  const { cropDistribution, transitionMatrix, timePoints } = analysisResult
  
  let csv = '\uFEFF' // UTF-8 BOM
  
  // 1. 作物分布统计
  csv += '=== 作物分布统计 ===\n'
  csv += '时间点,作物类型,地块数量,占比(%)\n'
  
  cropDistribution.forEach((dist, idx) => {
    const timePoint = timePoints[idx]
    dist.crops.forEach(cropData => {
      csv += `${timePoint.taskName},${cropData.crop},${cropData.count},${cropData.percentage}\n`
    })
  })
  
  csv += '\n'
  
  // 2. 作物转换矩阵
  csv += '=== 作物转换统计 ===\n'
  csv += '转换类型,发生次数\n'
  
  Object.entries(transitionMatrix).forEach(([transition, count]) => {
    csv += `${transition},${count}\n`
  })
  
  return csv
}

/**
 * 分析轮作模式（扩展功能）
 */
export function analyzeRotationPatterns(trajectories) {
  const patterns = {}
  
  // 🔥 只分析有变化的地块（changeCount > 0）
  const changedTrajectories = trajectories.filter(traj => traj.changeCount > 0)
  
  console.log(`🔄 轮作模式分析: 共 ${trajectories.length} 个地块，其中 ${changedTrajectories.length} 个有变化`)
  
  changedTrajectories.forEach(traj => {
    const pattern = traj.cropHistory.join(' → ')
    patterns[pattern] = (patterns[pattern] || 0) + 1
  })
  
  // 排序并转换为对象数组格式
  const sortedPatterns = Object.entries(patterns)
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10) // 只取前10个最常见的模式
  
  console.log('✅ 轮作模式分析结果（仅变化地块）:', sortedPatterns)
  
  return sortedPatterns
}

export default {
  getCropTypeName,
  buildTemporalTrajectories,
  exportToCSV,
  analyzeRotationPatterns
}
