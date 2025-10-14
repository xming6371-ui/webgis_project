/**
 * 验证邮箱
 * @param {string} email 邮箱地址
 * @returns {boolean}
 */
export const validateEmail = (email) => {
  const reg = /^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/
  return reg.test(email)
}

/**
 * 验证手机号
 * @param {string} phone 手机号
 * @returns {boolean}
 */
export const validatePhone = (phone) => {
  const reg = /^1[3-9]\d{9}$/
  return reg.test(phone)
}

/**
 * 验证是否为空
 * @param {any} value 值
 * @returns {boolean}
 */
export const isEmpty = (value) => {
  if (value === null || value === undefined) return true
  if (typeof value === 'string' && value.trim() === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  if (typeof value === 'object' && Object.keys(value).length === 0) return true
  return false
}

/**
 * 验证URL
 * @param {string} url URL地址
 * @returns {boolean}
 */
export const validateUrl = (url) => {
  const reg = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/
  return reg.test(url)
}

