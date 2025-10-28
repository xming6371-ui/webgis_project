/**
 * 区域名称映射配置
 * 将英文缩写映射为中文名称
 */

export const REGION_NAME_MAP = {
  'BTH': '包头湖',
  'JJMC': '经济牧场',
  'KEC': '库尔楚',
  'PHMC': '普惠牧场',
  'PHNC': '普惠农场',
  'YZC': '原种场'
}

/**
 * 从文件名或路径中提取区域代码
 * @param {string} fileName - 文件名或路径
 * @returns {string|null} - 区域代码（如 'BTH'）或 null
 */
export function extractRegionCode(fileName) {
  if (!fileName) return null
  
  // 遍历所有区域代码，查找匹配
  for (const code of Object.keys(REGION_NAME_MAP)) {
    // 检查文件名或路径中是否包含区域代码
    if (fileName.toUpperCase().includes(code)) {
      return code
    }
  }
  
  return null
}

/**
 * 获取区域中文名称
 * @param {string} regionCode - 区域代码
 * @returns {string} - 区域中文名称
 */
export function getRegionName(regionCode) {
  if (!regionCode) return '未知区域'
  return REGION_NAME_MAP[regionCode.toUpperCase()] || '未知区域'
}

/**
 * 从文件名或路径中提取区域中文名称
 * @param {string} fileName - 文件名或路径
 * @returns {string} - 区域中文名称
 */
export function extractRegionName(fileName) {
  const code = extractRegionCode(fileName)
  return getRegionName(code)
}

/**
 * 获取识别任务类型的中文名称
 * @param {string} recognitionType - 识别任务类型
 * @returns {string} - 识别任务中文名称
 */
export function getRecognitionTypeName(recognitionType) {
  const typeMap = {
    'crop_recognition': '作物识别',
    'planting_situation': '种植情况识别',
    // 兼容旧版
    'crop_info': '作物识别',
    'planting_status': '种植情况识别'
  }
  return typeMap[recognitionType] || '未知任务'
}

/**
 * 从文件名中提取年份
 * @param {string} fileName - 文件名
 * @returns {number|null} - 年份（如 2024）或 null
 */
export function extractYear(fileName) {
  if (!fileName) return null
  
  // 匹配4位数年份（2020-2099）
  const yearPattern = /(20\d{2})/g
  const matches = fileName.match(yearPattern)
  
  if (matches && matches.length > 0) {
    // 如果有多个年份，取第一个
    return parseInt(matches[0], 10)
  }
  
  return null
}

/**
 * 从文件名中提取期次
 * @param {string} fileName - 文件名
 * @returns {number|null} - 期次（如 1, 2, 3）或 null
 */
export function extractPeriod(fileName) {
  if (!fileName) return null
  
  // 匹配期次模式：如 _1, _2, _第1期, _第2期, period1, p1 等
  const patterns = [
    /_(\d)(?:期)?(?:_|\.)/,  // _1_, _1.shp, _1期_
    /第(\d)期/,               // 第1期
    /period[_-]?(\d)/i,       // period1, period_1
    /p[_-]?(\d)/i             // p1, p_1
  ]
  
  for (const pattern of patterns) {
    const match = fileName.match(pattern)
    if (match && match[1]) {
      const period = parseInt(match[1], 10)
      if (period >= 1 && period <= 10) {
        return period
      }
    }
  }
  
  return null
}

/**
 * 从文件名或路径中自动识别元数据（区域、年份、期次）
 * @param {string} fileNameOrPath - 文件名或路径
 * @returns {Object} - { regionCode, regionName, year, period }
 */
export function autoDetectMetadata(fileNameOrPath) {
  const regionCode = extractRegionCode(fileNameOrPath)
  const regionName = getRegionName(regionCode)
  const year = extractYear(fileNameOrPath)
  const period = extractPeriod(fileNameOrPath)
  
  return {
    regionCode: regionCode || '',
    regionName,
    year,
    period
  }
}

