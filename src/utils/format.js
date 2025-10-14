/**
 * 格式化文件大小
 * @param {number} bytes 字节数
 * @returns {string} 格式化后的字符串
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

/**
 * 格式化数字，添加千分位
 * @param {number} num 数字
 * @returns {string} 格式化后的字符串
 */
export const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * 格式化日期时间
 * @param {Date|string} date 日期
 * @param {string} format 格式
 * @returns {string} 格式化后的字符串
 */
export const formatDate = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  if (!date) return ''
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
}

/**
 * 格式化百分比
 * @param {number} value 数值
 * @param {number} decimals 小数位数
 * @returns {string} 格式化后的字符串
 */
export const formatPercent = (value, decimals = 2) => {
  return (value * 100).toFixed(decimals) + '%'
}

