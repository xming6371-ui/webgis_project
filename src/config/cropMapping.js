/**
 * 作物类型映射配置
 * gridcode -> 作物名称
 */
export const CROP_TYPE_MAP = {
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
 * 根据gridcode获取作物名称
 * @param {number|string} gridcode - 作物代码
 * @returns {string} 作物名称
 */
export function getCropName(gridcode) {
  const code = parseInt(gridcode)
  return CROP_TYPE_MAP[code] || `未知作物(${gridcode})`
}

/**
 * 获取所有作物类型列表
 * @returns {Array} 作物类型列表
 */
export function getAllCropTypes() {
  return Object.entries(CROP_TYPE_MAP).map(([code, name]) => ({
    code: parseInt(code),
    name
  }))
}

/**
 * 作物颜色映射
 */
export const CROP_COLOR_MAP = {
  '裸地': '#D2B48C',      // 棕褐色
  '棉花': '#FFFFFF',      // 白色
  '小麦': '#FFD700',      // 金黄色
  '玉米': '#FFA500',      // 橙色
  '番茄': '#FF6347',      // 番茄红
  '甜菜': '#DC143C',      // 深红色
  '打瓜': '#90EE90',      // 浅绿色
  '辣椒': '#FF4500',      // 橙红色
  '籽用葫芦': '#32CD32',  // 酸橙绿
  '其它耕地': '#808080'   // 灰色
}

/**
 * 根据作物名称获取颜色
 * @param {string} cropName - 作物名称
 * @returns {string} 颜色值
 */
export function getCropColor(cropName) {
  return CROP_COLOR_MAP[cropName] || '#999999'
}

