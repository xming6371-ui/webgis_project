/**
 * 作物分类配置
 * 用于经济作物与粮食作物分析
 */

/**
 * 作物分类映射
 */
export const CROP_CATEGORIES = {
  粮食作物: ['小麦', '玉米'],
  经济作物: ['棉花', '番茄', '甜菜', '打瓜', '辣椒', '籽用葫芦'],
  其他: ['裸地', '其它耕地', '未知', '休耕', '空']
}

/**
 * 根据作物名称获取作物分类
 * @param {string} cropName - 作物名称
 * @returns {string} 作物分类（粮食作物/经济作物/其他）
 */
export function getCropCategory(cropName) {
  for (const [category, crops] of Object.entries(CROP_CATEGORIES)) {
    if (crops.includes(cropName)) {
      return category
    }
  }
  return '其他'
}

/**
 * 获取所有作物分类
 * @returns {Object} 作物分类对象
 */
export function getAllCategories() {
  return CROP_CATEGORIES
}

/**
 * 判断是否为粮食作物
 * @param {string} cropName - 作物名称
 * @returns {boolean}
 */
export function isGrainCrop(cropName) {
  return CROP_CATEGORIES.粮食作物.includes(cropName)
}

/**
 * 判断是否为经济作物
 * @param {string} cropName - 作物名称
 * @returns {boolean}
 */
export function isEconomicCrop(cropName) {
  return CROP_CATEGORIES.经济作物.includes(cropName)
}




