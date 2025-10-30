# PDF报告功能完整指南

## 📅 最后更新
2025年10月30日

---

## 📖 目录

1. [功能概述](#功能概述)
2. [最新功能更新](#最新功能更新)
3. [PDF报告内容](#pdf报告内容)
4. [使用指南](#使用指南)
5. [字体与配色调整](#字体与配色调整)
6. [预览功能](#预览功能)
7. [技术实现](#技术实现)
8. [问题修复历史](#问题修复历史)
9. [故障排查](#故障排查)
10. [常见问题FAQ](#常见问题faq)

---

## 功能概述

时序分析PDF报告导出功能，可以将地图与统计、图表分析的所有内容导出为完整的PDF报告。

### 主要特性

✨ **完整的15个分析部分**
- 封面信息
- 分析摘要
- 变化统计详情
- 时序变化地图
- 地块种植稳定性分析
- 作物分布趋势对比
- 经济作物与粮食作物转换分析
- 作物转换流向TOP20
- 作物轮作模式分析TOP15
- 未变化地块作物类型分析
- 各时期作物分布详情（多期）
- 数据统计汇总
- 报告说明

🎨 **前端样式配置**
- 实时调整字体大小（8种字体类型）
- 多套预设配色方案（7种主题）
- 实时预览效果
- 一键重置为默认值

📄 **PDF预览功能**
- 预览与导出内容100%一致
- 生成进度实时显示
- 支持中途取消生成
- 样式配置实时应用

🎯 **智能分页**
- 自动计算页面高度
- 避免内容截断和分割
- 合理的页边距和间距

🗺️ **地图截图**
- 跨域资源处理（CORS）
- 多种底图支持
- 失败容错机制

📊 **图表展示**
- 作物分布统计
- 转换关系分析
- 轮作模式分析
- 变化趋势可视化

💾 **文件优化**
- JPEG压缩（85%质量）
- 合理的图片分辨率
- 优化的文件大小
- PDF缓存机制

---

## 最新功能更新

### ✅ 1. PDF预览功能（2025-10-30）

**核心特性**：
- 点击"预览PDF"可查看完整报告内容
- 预览内容与最终导出PDF完全一致
- 支持在预览中调整字体和配色
- 从预览直接导出无需重新生成

**使用方法**：
1. 点击"预览PDF"按钮
2. 查看完整的15个章节
3. 在左侧面板调整样式（可选）
4. 点击"导出PDF（使用当前预览）"直接下载

### ✅ 2. 前端字体调整（2025-10-30）

**可调整字体类型**：
- 封面标题（默认40px）
- 主标题（默认28px）
- 小标题（默认22px）
- 表格表头（默认20px）
- 表格内容（默认15px）
- 说明文字（默认14px）
- 普通文字（默认15px）
- 卡片数值（默认32px）

**调整方法**：
1. 在预览对话框左侧选择"字体配置"标签
2. 调整滑块或输入数值
3. 点击"应用"按钮
4. 查看预览效果
5. 满意后导出PDF

### ✅ 3. 配色方案选择（2025-10-30）

**预设7种配色方案**：
1. **经典蓝紫**（默认）- 蓝紫色系，专业稳重
2. **梦幻紫** - 紫色系，典雅大气
3. **商务深蓝** - 深蓝色系，商务正式
4. **海洋蓝** - 青蓝色系，清爽现代
5. **清新绿色** - 绿色系，自然环保
6. **日落橙** - 橙色系，温暖活力
7. **典雅灰色** - 灰色系，简约低调

**配色说明**：
- ① **主色**：表格表头、标题左侧竖线、提示框边框等主要元素
- ② **次色**：渐变色卡片、图表装饰等次要元素
- ③ **成功色**：增长趋势、正向数据、未变化地块等积极信息
- ④ **警告色**：变化地块、需要关注的中等数据等提示信息
- ⑤ **危险色**：减少趋势、负向数据、高频变化地块等警示信息

**使用方法**：
1. 在预览对话框左侧选择"配色方案"标签
2. 选择喜欢的配色方案
3. 点击"应用"按钮
4. 查看预览效果

### ✅ 4. 生成进度显示（2025-10-30）

**实时进度反馈**：
- 显示当前生成的章节（X/15）
- 进度条实时更新
- 显示正在处理的内容名称
- 生成过程可随时取消

**取消生成功能**：
- 生成过程中可随时关闭预览
- 后台立即停止PDF生成
- 不显示任何错误提示
- 完全静默处理

### ✅ 5. PDF缓存优化（2025-10-30）

**性能优化**：
- 预览生成的PDF自动缓存
- 导出时直接使用缓存，无需重新生成
- 调整样式时清除缓存，重新生成
- 关闭预览时自动清理缓存

**效果**：
- 首次预览：5-15秒
- 从预览导出：即时下载
- 样式调整后：5-15秒重新生成

---

## PDF报告内容

### 1. 📋 封面
- 报告标题：时序分析完整报告
- 分析类型：地图与统计 / 图表分析
- 生成时间

### 2. 📊 分析摘要
- 地块总数
- 变化地块数量
- 未变化地块数量
- 变化率
- 时间跨度
- 主要变化趋势

### 3. 📈 变化统计详情
- 各变化等级的地块数量
- 不同变化次数的统计
- 百分比分布
- 可视化图表

### 4. 🗺️ 时序变化地图
- 地块变化的空间分布
- 颜色标注变化程度
- 支持多种底图
- 图例说明

### 5. 🎯 地块种植稳定性分析
- 稳定性等级划分
- 各等级地块数量统计
- 评价标准说明
- 农业意义解读

### 6. 📊 作物分布趋势对比
- 各时期主要作物对比
- 面积统计图表
- 变化趋势可视化
- TOP作物排名

### 7. 🔄 经济作物与粮食作物转换分析
- 各时期占比趋势
- 转换流向统计
- 地块完整路径分类
- 作物分类配置说明

### 8. 🔝 作物转换流向TOP20
- 最常见的作物转换类型
- 转换地块数量
- 转换比例
- 占总变化的比重

### 9. 🔁 作物轮作模式分析TOP15
- 完整的作物轮作序列
- 轮作模式统计
- 地块数量
- 轮作周期分析

### 10. 🌾 未变化地块作物类型分析
- 保持不变的作物类型
- 各作物未变化地块数量
- 占比统计
- 稳定性评估

### 11-13. 📅 各时期作物分布详情
- 每个时期的作物分布
- 面积统计
- 地块数量
- 完整性指标

### 14. 📋 数据统计汇总
- 所有关键数据的汇总表
- 完整性指标
- 质量评估
- 数据来源

### 15. 📝 报告说明
- 各部分内容说明
- 关键术语解释
- 数据来源说明
- 使用建议

---

## 使用指南

### 基本使用流程

#### 方式1：直接导出（快速）
1. 在"结果查看与比对"页面
2. 点击右上角"导出报告"按钮
3. 等待生成完成（5-15秒）
4. 自动下载PDF文件

#### 方式2：预览后导出（推荐）
1. 点击"预览PDF"按钮
2. 等待预览生成（5-15秒）
3. 查看完整内容
4. （可选）调整字体和配色
5. 点击"导出PDF（使用当前预览）"
6. 即时下载（使用缓存）

### 样式配置流程

#### 字体大小调整
1. 打开PDF预览对话框
2. 左侧选择"字体配置"标签
3. 调整各项字体大小：
   - 封面标题：20-60px
   - 主标题：16-40px
   - 小标题：14-32px
   - 表格表头：12-28px
   - 表格内容：10-24px
   - 说明文字：10-20px
   - 普通文字：10-20px
   - 卡片数值：20-48px
4. 点击"应用"按钮
5. 查看预览效果
6. 不满意可继续调整或点击"重置"

#### 配色方案选择
1. 在预览对话框左侧
2. 切换到"配色方案"标签
3. 选择喜欢的配色：
   - 经典蓝紫（默认）
   - 梦幻紫
   - 商务深蓝
   - 海洋蓝
   - 清新绿色
   - 日落橙
   - 典雅灰色
4. 查看色块预览（5个色块）
5. 点击"应用"按钮
6. 查看整体效果

### 快速操作指南

| 操作 | 快捷方式 |
|------|----------|
| 预览PDF | 点击"预览PDF"按钮 |
| 调整字体 | 预览 → 字体配置 → 应用 |
| 更换配色 | 预览 → 配色方案 → 应用 |
| 重置样式 | 点击"重置"按钮 |
| 导出PDF | 预览 → 导出PDF |
| 取消生成 | 关闭预览对话框 |

---

## 字体与配色调整

### 字体调整详解

#### 可调整的字体类型

| 字体项 | 说明 | 默认值 | 调整范围 | 应用场景 |
|--------|------|--------|----------|----------|
| `coverTitle` | 封面标题 | 40px | 20-60px | 报告封面的主标题 |
| `title` | 主标题 | 28px | 16-40px | 各章节标题 |
| `subtitle` | 小标题 | 22px | 14-32px | 小节标题 |
| `tableHeader` | 表格表头 | 20px | 12-28px | 所有表格的表头 |
| `tableCell` | 表格内容 | 15px | 10-24px | 表格单元格内容 |
| `description` | 说明文字 | 14px | 10-20px | 图表说明、注释 |
| `normal` | 普通文字 | 15px | 10-20px | 正文段落 |
| `cardValue` | 卡片数值 | 32px | 20-48px | 统计卡片中的数值 |

#### 常见调整建议

**情况1：表格文字太小，看不清**
```
建议调整：
- tableHeader: 20px → 24px (+4px)
- tableCell: 15px → 18px (+3px)
```

**情况2：整体字体都想大一些**
```
建议调整：
- title: 28px → 32px (+4px)
- subtitle: 22px → 26px (+4px)
- tableHeader: 20px → 24px (+4px)
- tableCell: 15px → 18px (+3px)
- description: 14px → 16px (+2px)
```

**情况3：只想突出标题**
```
建议调整：
- coverTitle: 40px → 48px (+8px)
- title: 28px → 36px (+8px)
- subtitle: 22px → 28px (+6px)
```

**情况4：适合打印的设置**
```
建议调整：
- 所有字体 +2px
- 保持比例关系
- 确保表格清晰可读
```

### 配色方案详解

#### 7种预设配色

**1. 经典蓝紫（默认）**
- 主色：#4f46e5（靛蓝）
- 次色：#8b5cf6（紫色）
- 成功：#10b981（绿色）
- 警告：#f59e0b（琥珀）
- 危险：#ef4444（红色）
- 适用场景：通用、专业、稳重

**2. 梦幻紫**
- 主色：#9333ea（紫色）
- 次色：#a855f7（亮紫）
- 成功：#10b981（绿色）
- 警告：#f59e0b（琥珀）
- 危险：#f43f5e（玫红）
- 适用场景：典雅、大气、女性化

**3. 商务深蓝**
- 主色：#1e40af（深蓝）
- 次色：#3b82f6（蓝色）
- 成功：#059669（深绿）
- 警告：#d97706（橙色）
- 危险：#dc2626（深红）
- 适用场景：商务、正式、专业

**4. 海洋蓝**
- 主色：#0891b2（青色）
- 次色：#06b6d4（天蓝）
- 成功：#14b8a6（青绿）
- 警告：#f59e0b（琥珀）
- 危险：#f43f5e（玫红）
- 适用场景：清爽、现代、科技

**5. 清新绿色**
- 主色：#059669（绿色）
- 次色：#10b981（亮绿）
- 成功：#22c55e（翠绿）
- 警告：#eab308（黄色）
- 危险：#f43f5e（玫红）
- 适用场景：环保、自然、农业

**6. 日落橙**
- 主色：#ea580c（橙色）
- 次色：#f97316（亮橙）
- 成功：#10b981（绿色）
- 警告：#fbbf24（金黄）
- 危险：#dc2626（红色）
- 适用场景：温暖、活力、积极

**7. 典雅灰色**
- 主色：#374151（深灰）
- 次色：#6b7280（中灰）
- 成功：#10b981（绿色）
- 警告：#f59e0b（琥珀）
- 危险：#ef4444（红色）
- 适用场景：简约、低调、正式

#### 配色应用范围

**主色应用**：
- 表格表头背景
- 章节标题左侧竖线
- 提示框边框
- 统计卡片背景（渐变起点）
- 按钮主色调

**次色应用**：
- 渐变色卡片（渐变终点）
- 图表装饰元素
- 二级标题
- 辅助说明背景

**成功色应用**：
- 增长趋势箭头（↑）
- 正向数据标注
- 未变化地块统计
- 成功状态提示

**警告色应用**：
- 变化地块统计
- 中等变化次数
- 需要关注的数据
- 警示信息框

**危险色应用**：
- 减少趋势箭头（↓）
- 高频变化地块
- 负向数据标注
- 重要警告信息

---

## 预览功能

### 预览功能特性

#### 1. 内容一致性
- ✅ 预览内容与PDF导出100%一致
- ✅ 所有15个章节完整显示
- ✅ 表格、图表、数据完全相同
- ✅ 样式配置实时应用

#### 2. 实时反馈
- ✅ 生成进度实时显示
- ✅ 当前处理章节提示
- ✅ 进度百分比动态更新
- ✅ 预计剩余时间提示

#### 3. 样式调整
- ✅ 字体大小实时调整
- ✅ 配色方案即时切换
- ✅ 应用后立即查看效果
- ✅ 不满意可重置

#### 4. 性能优化
- ✅ PDF生成结果自动缓存
- ✅ 导出时直接使用缓存
- ✅ 避免重复生成
- ✅ 关闭预览自动清理

#### 5. 取消机制
- ✅ 生成过程可随时取消
- ✅ 关闭对话框即可取消
- ✅ 后台立即停止生成
- ✅ 无任何错误提示

### 预览使用流程

#### 完整流程
```
1. 点击"预览PDF"按钮
   ↓
2. 显示进度提示（生成中...）
   - 封面 (1/15)
   - 摘要 (2/15)
   - ...
   - 报告说明 (15/15)
   ↓
3. 预览显示（iframe展示PDF）
   ↓
4. （可选）调整样式
   - 切换到"字体配置"或"配色方案"
   - 修改设置
   - 点击"应用"
   - 等待重新生成
   ↓
5. 满意后导出
   - 点击"导出PDF（使用当前预览）"
   - 即时下载（使用缓存）
   ↓
6. 关闭预览
   - 自动清理缓存
   - 重置所有样式配置
```

#### 样式调整流程
```
预览生成完成后：

方式1：调整字体
1. 切换到"字体配置"标签
2. 滑动调整各项字体
3. 点击"应用"按钮
4. 等待重新生成（5-15秒）
5. 查看新效果

方式2：更换配色
1. 切换到"配色方案"标签
2. 选择喜欢的配色
3. 点击"应用"按钮
4. 等待重新生成（5-15秒）
5. 查看新效果

方式3：同时调整
1. 先调整字体
2. 再选择配色
3. 点击"应用"按钮一次
4. 两项配置同时生效
```

#### 取消生成流程
```
如果生成过程中不想继续：

1. 直接点击对话框右上角的"×"
   或
   点击"关闭预览"按钮
   ↓
2. 后台立即停止PDF生成
   ↓
3. 进度提示框消失
   ↓
4. 对话框关闭
   ↓
5. 完成（无任何错误提示）

注意：
- 取消是静默的，不会有任何提示
- 控制台不会输出错误信息
- 可以随时重新点击"预览PDF"
```

### 预览注意事项

⚠️ **重要提示**：

1. **首次生成时间**
   - 预览首次生成需要5-15秒
   - 取决于数据量和电脑性能
   - 请耐心等待进度条

2. **样式调整后**
   - 点击"应用"后会重新生成PDF
   - 再次需要5-15秒
   - 缓存会被清除

3. **导出效率**
   - 从预览导出是即时的
   - 直接使用已生成的PDF
   - 无需重新生成

4. **关闭预览**
   - 会清除缓存
   - 会重置样式配置
   - 下次打开是默认设置

5. **取消生成**
   - 可随时取消
   - 完全静默处理
   - 不影响后续使用

---

## 技术实现

### 核心技术栈

- **jsPDF**：PDF生成库
- **html2canvas**：HTML转Canvas截图
- **OpenLayers**：地图渲染
- **Vue 3**：前端框架
- **Element Plus**：UI组件库

### 关键配置

#### 1. OpenLayers 跨域配置
```javascript
// src/views/ResultCompare/components/TemporalChangeMap.vue
const baseMapLayers = {
  'amap-vector': new TileLayer({
    source: new XYZ({
      url: 'https://...',
      crossOrigin: 'anonymous'  // 允许跨域
    })
  })
}
```

#### 2. html2canvas 配置
```javascript
// src/utils/pdfGenerator.js
const canvas = await html2canvas(element, {
  useCORS: true,           // 使用CORS
  allowTaint: false,       // 不允许污染
  scale: 1.5,              // 缩放比例（平衡质量与文件大小）
  timeout: 10000,          // 超时设置
  logging: false,          // 关闭日志
  backgroundColor: '#fff'  // 背景色
})
```

#### 3. jsPDF 配置
```javascript
import { jsPDF } from 'jspdf'

const pdf = new jsPDF({
  orientation: 'portrait',  // 纵向
  unit: 'mm',               // 单位：毫米
  format: 'a4'              // A4纸张
})

// A4尺寸
const pageWidth = 210mm   // 宽度
const pageHeight = 297mm  // 高度
const margin = 15mm       // 页边距
const usableWidth = 180mm // 可用宽度
const usableHeight = 267mm // 可用高度
```

#### 4. 字体配置系统
```javascript
// src/utils/pdfGenerator.js
const DEFAULT_FONT_SIZES = {
  coverTitle: '40px',
  title: '28px',
  subtitle: '22px',
  tableHeader: '20px',
  tableCell: '15px',
  description: '14px',
  normal: '15px',
  cardValue: '32px'
}

// 支持自定义覆盖
function generateTemporalPDF(data, activeTab, customConfig, onProgress) {
  let FONT_SIZES = DEFAULT_FONT_SIZES
  let COLORS = { ...THEME_COLORS }
  
  if (customConfig) {
    if (customConfig.colors) {
      const { colors, ...fontConfig } = customConfig
      FONT_SIZES = fontConfig
      COLORS = applyCustomColors(colors)
    }
  }
  // ...
}
```

#### 5. 配色系统
```javascript
// src/utils/pdfGenerator.js
const THEME_COLORS = {
  primary: '#4f46e5',      // 主色
  secondary: '#8b5cf6',    // 次色
  success: '#10b981',      // 成功色
  warning: '#f59e0b',      // 警告色
  danger: '#ef4444',       // 危险色
  // ... 衍生颜色
}

// 动态应用配色
function applyCustomColors(colors) {
  return {
    primary: colors.primary,
    primaryDark: colors.primary,
    primaryBg: colors.primary + '15',  // 15%透明度
    // ...
  }
}
```

#### 6. 进度回调系统
```javascript
// src/utils/pdfGenerator.js
async function generateTemporalPDF(data, activeTab, customConfig, onProgress) {
  // 每完成一个章节，调用回调
  const updateProgress = async (sectionName) => {
    currentSection++
    if (onProgress) {
      await onProgress(currentSection, totalSections, sectionName)
    }
  }
  
  // 生成各章节
  await generateSection1()
  await updateProgress('封面')
  
  await generateSection2()
  await updateProgress('分析摘要')
  // ...
}
```

#### 7. PDF缓存机制
```javascript
// src/views/ResultCompare/components/TemporalMapViewEnhanced.vue
const cachedPdfBlob = ref(null)

// 预览时缓存
const handlePreview = async () => {
  const pdfBlob = await generateTemporalPDF(...)
  cachedPdfBlob.value = pdfBlob  // 缓存
  previewPdfUrl.value = URL.createObjectURL(pdfBlob)
}

// 导出时使用缓存
const handleExportFromPreview = async () => {
  if (cachedPdfBlob.value) {
    // 直接使用缓存，无需重新生成
    downloadPdfBlob(cachedPdfBlob.value)
  }
}

// 关闭时清理
const handleClosePreview = () => {
  if (previewPdfUrl.value) {
    URL.revokeObjectURL(previewPdfUrl.value)
  }
  cachedPdfBlob.value = null  // 清除缓存
}
```

#### 8. 取消机制
```javascript
// src/views/ResultCompare/components/TemporalMapViewEnhanced.vue
const cancelGeneration = ref(false)

// 进度回调中检查取消标志
const onProgress = async (current, total, message) => {
  if (cancelGeneration.value) {
    const error = new Error('用户取消了PDF生成')
    error.isCancellation = true
    throw error
  }
  // 更新进度...
}

// 关闭预览时设置取消标志
const handleClosePreview = () => {
  if (generatingProgress.value.visible) {
    cancelGeneration.value = true
  }
  // ...
}

// 捕获取消错误（静默处理）
try {
  await generateTemporalPDF(...)
} catch (error) {
  if (error.isCancellation) {
    // 静默处理，不显示任何信息
    return
  }
  // 其他错误正常处理
}
```

#### 9. 图片压缩
```javascript
// PNG → JPEG (85%质量)
const imgData = canvas.toDataURL('image/jpeg', 0.85)

// 添加到PDF
pdf.addImage(imgData, 'JPEG', x, y, width, height)
```

### 生成流程

```mermaid
开始生成PDF
    ↓
创建临时容器
    ↓
[1/15] 生成封面
    ↓ → 更新进度 → 检查取消标志
[2/15] 生成摘要
    ↓ → 更新进度 → 检查取消标志
[3/15] 生成统计详情
    ↓ → 更新进度 → 检查取消标志
[4/15] 截取地图（特殊处理）
    ↓ → 更新进度 → 检查取消标志
[5/15] 生成种植稳定性分析
    ↓ → 更新进度 → 检查取消标志
[6/15] 生成作物分布趋势
    ↓ → 更新进度 → 检查取消标志
[7/15] 生成经济粮食作物转换
    ↓ → 更新进度 → 检查取消标志
[8/15] 生成转换流向TOP20
    ↓ → 更新进度 → 检查取消标志
[9/15] 生成轮作模式TOP15
    ↓ → 更新进度 → 检查取消标志
[10/15] 生成未变化作物分析
    ↓ → 更新进度 → 检查取消标志
[11-13/15] 生成各期分布详情
    ↓ → 更新进度 → 检查取消标志
[14/15] 生成数据汇总
    ↓ → 更新进度 → 检查取消标志
[15/15] 生成报告说明
    ↓ → 更新进度 → 检查取消标志
保存PDF Blob
    ↓
返回PDF Blob
    ↓
预览或下载
    ↓
完成！
```

### 容错机制

1. **部分失败不影响整体**：
   ```javascript
   try {
     await generateSection()
     console.log('✅ 章节已添加')
   } catch (error) {
     console.error('❌ 章节生成失败，跳过')
     // 不中断流程，继续下一部分
   }
   ```

2. **地图截图降级策略**：
   ```javascript
   // 策略1：CORS（推荐）
   try {
     const canvas = await html2canvas(map, { 
       useCORS: true,
       allowTaint: false 
     })
   } catch (error) {
     // 策略2：allowTaint（降级）
     try {
       const canvas = await html2canvas(map, { 
         useCORS: false,
         allowTaint: true 
       })
     } catch (error2) {
       console.error('地图截图失败，跳过地图部分')
     }
   }
   ```

3. **超时保护**：
   ```javascript
   await html2canvas(element, {
     timeout: 10000  // 10秒超时
   })
   ```

4. **取消保护**：
   ```javascript
   // 每个章节生成前检查取消标志
   if (cancelGeneration.value) {
     throw new Error('用户取消')
   }
   ```

5. **资源清理**：
   ```javascript
   // 关闭预览时清理所有资源
   const handleClosePreview = () => {
     // 清理PDF URL
     if (previewPdfUrl.value) {
       URL.revokeObjectURL(previewPdfUrl.value)
     }
     // 清除缓存
     cachedPdfBlob.value = null
     // 重置样式
     resetStyles()
   }
   ```

---

## 问题修复历史

### 1. 地图截图跨域问题（已修复）

**问题描述**：
```
SecurityError: Failed to execute 'getImageData' on 'CanvasRenderingContext2D': 
The canvas has been tainted by cross-origin data.
```

**原因**：
- OpenLayers加载的高德地图瓦片来自不同域
- 默认情况下，Canvas无法读取跨域图像的像素数据

**解决方案**：
1. 为XYZ图层源添加 `crossOrigin: 'anonymous'`
2. 实现双策略截图：
   - 策略1：使用 `useCORS: true`（推荐）
   - 策略2：使用 `allowTaint: true`（降级方案）
3. 移除 `waitForMapToLoad` 中的 `getImageData()` 调用

**修复时间**：2025-10-20

---

### 2. 内容截断问题（已修复）

**问题描述**：
- PDF内容在页面边界被切断
- 地图和表格被分割到两页

**原因**：
- 使用单张大截图然后分页切割
- 无法智能判断内容边界

**解决方案**：
- 改为"分段截图"模式
- 每个部分独立截图和添加
- 智能判断是否需要新页面

**核心代码**：
```javascript
const addSectionToPDF = async (element, options = {}) => {
  const canvas = await html2canvas(element, {
    scale: options.scale || 1.5,
    useCORS: true,
    timeout: 10000
  })
  
  const imgData = canvas.toDataURL('image/jpeg', 0.85)
  const imgHeight = (canvas.height * usableWidth) / canvas.width
  
  // 智能分页
  if (currentY + imgHeight > pageHeight - margin) {
    pdf.addPage()
    currentY = margin
  }
  
  pdf.addImage(imgData, 'JPEG', margin, currentY, usableWidth, imgHeight)
  currentY += imgHeight + 10
}
```

**修复时间**：2025-10-20

---

### 3. 内容不完整问题（已修复）

**问题描述**：
- PDF只显示第一页（封面和摘要）
- 后续内容丢失，无错误提示

**原因**：
- 某个部分生成失败导致整个流程中断
- 没有错误捕获机制

**解决方案**：
- 每个部分添加独立的 `try-catch`
- 失败部分跳过，继续生成后续内容
- 详细的控制台日志

**代码示例**：
```javascript
// 封面
try {
  console.log('📄 [1/15] 生成封面...')
  await addSectionToPDF(coverElement)
  console.log('  ✅ 封面已添加')
} catch (error) {
  console.error('  ❌ 封面生成失败:', error)
}

// 摘要
try {
  console.log('📄 [2/15] 生成摘要...')
  await addSectionToPDF(summaryElement)
  console.log('  ✅ 摘要已添加')
} catch (error) {
  console.error('  ❌ 摘要生成失败:', error)
}
```

**修复时间**：2025-10-20

---

### 4. 文件过大问题（已修复）

**问题描述**：
- PDF文件大小达到30MB+
- 生成速度慢
- 可能导致浏览器卡顿

**原因**：
- 图片分辨率过高（scale: 2）
- 使用PNG格式（无压缩）

**解决方案**：
1. **降低分辨率**：
   - 地图：scale 2 → 1.2
   - 其他：scale 2 → 1.5

2. **JPEG压缩**：
   ```javascript
   canvas.toDataURL('image/jpeg', 0.85)  // 85%质量
   ```

3. **添加超时**：
   ```javascript
   await html2canvas(element, {
     timeout: 10000,  // 10秒超时
     scale: 1.5
   })
   ```

**效果**：
- 文件大小：30MB → 0.3-2MB
- 生成速度：显著提升
- 视觉质量：几乎无损

**修复时间**：2025-10-20

---

### 5. 数据提取错误（已修复）

**问题描述**：
- "作物轮作模式分析"显示 "undefined → undefined"
- "未变化地块作物类型分析"显示 "Unknown"

**原因**：
- 使用了错误的数据源字段
- 轮作模式：使用了 `timeline` 而非 `cropHistory`
- 未变化作物：百分比计算基数错误

**解决方案**：

**轮作模式分析**：
```javascript
// ❌ 错误
const pattern = traj.timeline.map(t => t.crop).join(' → ')

// ✅ 正确
const changedTrajectories = data.trajectories.filter(
  traj => (traj.changeCount || 0) > 0
)
changedTrajectories.forEach(traj => {
  const cropHistory = traj.cropHistory || []
  if (cropHistory.length >= 2) {
    const pattern = cropHistory.join(' → ')
    rotationPatterns[pattern] = (rotationPatterns[pattern] || 0) + 1
  }
})
```

**未变化作物分析**：
```javascript
// ✅ 正确的筛选和数据提取
const unchangedTrajectories = data.trajectories.filter(
  traj => (traj.changeCount || 0) === 0
)

unchangedTrajectories.forEach(traj => {
  const crop = traj.cropHistory?.[0] || 
               traj.properties?.startCrop || 
               '未知'
  unchangedCrops[crop] = (unchangedCrops[crop] || 0) + 1
})

// 正确的百分比计算
const percentageUnchanged = (
  (count / unchangedTrajectories.length) * 100
).toFixed(1)
```

**修复时间**：2025-10-21

---

### 6. 预览与导出不一致（已修复）

**问题描述**：
- 预览显示的内容与导出PDF不一致
- 某些章节在预览中缺失
- 表格样式不同

**原因**：
- 预览使用 `generatePreviewHTML` 函数
- 导出使用 `generateTemporalPDF` 函数
- 两个函数的内容生成逻辑不同步

**解决方案**：
- 删除 `generatePreviewHTML` 函数
- 预览直接使用 `generateTemporalPDF` 生成真实PDF
- 在 iframe 中显示PDF Blob

**实现**：
```javascript
// 预览和导出使用同一个函数
const pdfBlob = await generateTemporalPDF(data, 'all', config)

// 预览：显示PDF
previewPdfUrl.value = URL.createObjectURL(pdfBlob)

// 导出：下载PDF
downloadPdfBlob(pdfBlob, filename)
```

**修复时间**：2025-10-30

---

### 7. 字体和配色应用不完整（已修复）

**问题描述**：
- 部分表格没有应用自定义配色
- 某些文字颜色仍是硬编码
- 说明框背景色未跟随主题

**原因**：
- 代码中存在硬编码的颜色值
- 未全面替换为动态 `COLORS` 变量

**解决方案**：
- 全局搜索替换所有硬编码颜色
- 确保所有颜色都使用 `COLORS` 变量
- 特殊处理数值列（使用 `COLORS.text`）

**修复时间**：2025-10-30

---

### 8. 进度条不平滑（已修复）

**问题描述**：
- 进度条更新不及时
- 前端显示滞后于控制台日志
- 跳跃式更新

**原因**：
- 前两个章节没有调用 `onProgress`
- `currentSection` 初始值设置错误
- 缺少 `await nextTick()` 强制UI更新

**解决方案**：
1. 为所有15个章节都添加进度回调
2. 正确初始化 `currentSection = 0`
3. 在回调中添加 `await nextTick()`
4. 确保进度更新是异步的

**修复时间**：2025-10-30

---

### 9. 样式配置不重置（已修复）

**问题描述**：
- 关闭预览后重新打开
- 字体配置保持上次设置
- 配色方案不是默认值
- 标签页停留在上次位置

**原因**：
- 关闭预览时只清除了PDF缓存
- 没有重置样式配置和标签页

**解决方案**：
在 `handleClosePreview` 中添加：
```javascript
// 重置配色方案
selectedColorScheme.value = 'classic'

// 重置字体大小
const defaultSizes = getDefaultFontSizes()
Object.keys(defaultSizes).forEach(key => {
  fontSizes.value[key] = parseInt(defaultSizes[key])
})

// 重置标签页
activeConfigTab.value = 'font'
```

**修复时间**：2025-10-30

---

### 10. 取消生成有错误提示（已修复）

**问题描述**：
- 生成过程中取消
- 控制台输出错误堆栈
- 用户体验不好

**原因**：
- 抛出的错误被正常捕获
- `catch` 块输出到控制台

**解决方案**：
1. 给取消错误添加 `isCancellation` 标记
2. 在 `catch` 块中判断标记
3. 取消时静默处理，不输出任何信息

```javascript
// 标记取消错误
const error = new Error('用户取消了PDF生成')
error.isCancellation = true
throw error

// 静默处理
if (error.isCancellation) {
  return  // 不输出任何信息
}
```

**修复时间**：2025-10-30

---

## 故障排查

### 问题1：PDF生成失败

**症状**：
- 点击导出后无响应
- 控制台报错
- 进度条卡住

**排查步骤**：

1. **检查控制台错误**：
   - 打开F12控制台
   - 查看红色错误信息
   - 定位失败的步骤

2. **检查数据完整性**：
   ```javascript
   console.log('地块数量:', data.features.length)
   console.log('时间点数量:', data.timePoints.length)
   console.log('变化统计:', data.changeStats)
   console.log('轨迹数据:', data.trajectories.length)
   ```

3. **切换底图模式**：
   - 尝试"无底图"模式
   - 避免跨域问题

4. **清除缓存重试**：
   - Ctrl + F5 刷新页面
   - 清除浏览器缓存
   - 重新加载数据

5. **查看生成日志**：
   ```
   📄 开始生成PDF报告...
   📄 [1/15] 生成封面...
     ✅ 封面已添加
   📄 [2/15] 生成摘要...
     ❌ 摘要生成失败: Error...
   ```

---

### 问题2：地图截图失败

**症状**：
- PDF中地图为空白
- 或显示"地图截图失败"
- 控制台有CORS错误

**解决方案**：

1. **切换到无底图模式**（推荐）：
   - 地图右上角选择"无底图"
   - 重新导出

2. **检查跨域配置**：
   ```javascript
   // 确认XYZ source有crossOrigin配置
   crossOrigin: 'anonymous'
   ```

3. **查看降级策略日志**：
   ```
   🗺️ 尝试策略1 (CORS)...
   ❌ 策略1失败，尝试策略2...
   ✅ 策略2成功
   ```

4. **手动触发地图渲染**：
   - 缩放地图
   - 等待加载完成
   - 再次导出

---

### 问题3：PDF文件过大

**症状**：
- 文件大小超过10MB
- 生成速度很慢
- 浏览器卡顿
- 下载时间长

**解决方案**：

1. **检查图片质量设置**：
   ```javascript
   // 应该是JPEG，不是PNG
   canvas.toDataURL('image/jpeg', 0.85)
   ```

2. **检查scale值**：
   ```javascript
   // 地图：1.2
   // 其他：1.5
   scale: 1.5
   ```

3. **优化内容**：
   - 只导出必要的部分
   - 减少图表数量
   - 简化表格内容

4. **使用无底图模式**：
   - 底图瓦片占用较大空间
   - 无底图可减小文件

---

### 问题4：内容显示不全

**症状**：
- 某些章节缺失
- 内容被截断
- 表格不完整
- 页数太少

**排查**：

1. **查看控制台日志**：
   ```
   📄 [X/15] 生成XXX...
     ❌ 生成失败: Error...
   ```

2. **检查数据可用性**：
   ```javascript
   console.log('作物分布数据:', data.cropDistribution)
   console.log('转换数据:', data.transitions)
   console.log('轮作模式:', data.rotationPatterns)
   console.log('未变化地块:', data.unchangedPlots)
   ```

3. **单独测试失败部分**：
   - 在界面上检查该部分是否正常显示
   - 如果界面也有问题，说明是数据问题
   - 如果界面正常，说明是PDF生成问题

4. **检查容错机制**：
   - 确认每个章节有独立的 try-catch
   - 失败不应中断整体流程

---

### 问题5：数据显示为"未知"或"undefined"

**症状**：
- 作物名称显示为"未知"
- 转换关系显示"undefined → undefined"
- 百分比显示NaN%

**原因**：
- 数据字段不匹配
- 使用了错误的数据源
- 数据为空或缺失

**解决**：

1. **检查数据结构**：
   ```javascript
   console.log('轨迹数据示例:', data.trajectories[0])
   console.log('cropHistory:', data.trajectories[0].cropHistory)
   console.log('properties:', data.trajectories[0].properties)
   ```

2. **确认字段映射**：
   - `cropHistory` 用于轮作模式
   - `startCrop` / `endCrop` 用于转换分析
   - `changeCount` 用于变化统计

3. **查看修复版本**：
   - 确保使用最新版本的 `pdfGenerator.js`
   - 数据提取已修复

4. **添加默认值**：
   ```javascript
   const crop = traj.cropHistory?.[0] || 
                traj.properties?.startCrop || 
                '未知'
   ```

---

### 问题6：预览加载慢

**症状**：
- 预览生成时间超过30秒
- 进度条长时间不动
- 浏览器无响应

**排查**：

1. **检查数据量**：
   ```javascript
   console.log('地块数量:', data.features.length)
   console.log('时期数量:', data.timePoints.length)
   ```
   - 如果地块数超过10000，考虑优化

2. **检查网络**：
   - 地图瓦片加载是否正常
   - 查看Network面板

3. **查看CPU使用率**：
   - html2canvas 是CPU密集型操作
   - 可能需要等待

4. **优化建议**：
   - 使用无底图模式
   - 降低截图分辨率
   - 分批处理大数据量

---

### 问题7：样式不生效

**症状**：
- 调整字体后没变化
- 配色方案未应用
- 预览和设置不符

**排查**：

1. **确认点击了"应用"**：
   - 修改后必须点击"应用"按钮
   - 否则只是修改了变量，未重新生成

2. **检查配置传递**：
   ```javascript
   console.log('字体配置:', fontSizes.value)
   console.log('配色方案:', selectedColorScheme.value)
   ```

3. **查看重新生成日志**：
   ```
   🔄 应用新配置并重新生成PDF预览...
   📝 字体配置: {...}
   🎨 配色方案: classic
   ```

4. **清除缓存重试**：
   - 关闭预览
   - 重新打开
   - 再次调整

---

### 问题8：取消不生效

**症状**：
- 点击关闭后仍在生成
- 控制台继续输出日志
- 无法停止

**排查**：

1. **检查取消标志**：
   ```javascript
   console.log('取消标志:', cancelGeneration.value)
   ```

2. **确认取消逻辑**：
   - 每个章节生成前应检查标志
   - 发现取消应立即中断

3. **查看错误处理**：
   - 取消错误应被静默处理
   - 不应有错误输出

---

## 常见问题FAQ

### Q1: PDF生成需要多长时间？
**A**: 
- **首次预览**：5-15秒（取决于数据量）
- **调整样式后**：5-15秒（重新生成）
- **从预览导出**：即时（使用缓存）
- **直接导出**：5-15秒

影响因素：
- 数据量大小（地块数量）
- 电脑性能（CPU速度）
- 底图模式（无底图最快）
- 浏览器性能

---

### Q2: 生成的PDF在哪里？
**A**: 两个位置：
1. **浏览器下载**：
   - 自动下载到默认下载文件夹
   - 文件名：`时序分析完整报告_YYYY-MM-DD_HH-mm-ss.pdf`

2. **服务器备份**：
   - 路径：`/data/data_analysis_results/reports/`
   - 文件名相同

---

### Q3: 可以导出特定部分吗？
**A**: 
当前版本导出完整的15个部分。如需定制，可以：
1. 修改 `pdfGenerator.js` 中的 `generateAllContentSections` 函数
2. 注释掉不需要的章节
3. 保存后重新生成

示例：
```javascript
// 注释掉不需要的章节
// await generateSection8()  // 跳过转换流向TOP20
// await generateSection9()  // 跳过轮作模式TOP15
```

---

### Q4: 为什么建议使用"无底图"模式？
**A**: 
- ✅ 避免跨域问题（最常见的失败原因）
- ✅ 生成速度更快（无需加载瓦片）
- ✅ 文件大小更小（不含底图图片）
- ✅ 成功率更高（100%成功）
- ✅ 内容更清晰（无底图干扰）

---

### Q5: 地图截图失败怎么办？
**A**: 
按优先级尝试：
1. **切换到无底图模式**（推荐）
2. 等待地图完全加载后再导出
3. 缩放地图触发重新渲染
4. 刷新页面重新加载数据
5. 如果仍失败，PDF会跳过地图部分，继续生成其他内容

---

### Q6: 如何查看PDF是否包含所有内容？
**A**: 
**方法1：查看控制台日志**
```
✅ PDF生成完成，共 X 页
```
通常完整的报告有8-15页，取决于数据量。

**方法2：查看进度**
- 15个章节都应该有 "✅ 已添加"
- 如果有 "❌ 失败"，说明对应章节缺失

**方法3：打开PDF检查**
- 查看目录是否完整
- 翻阅所有页面
- 确认数据准确性

---

### Q7: 可以保存自定义的字体配置吗？
**A**: 
当前版本不支持持久化保存。临时方案：
1. 记录你的字体配置（截图或笔记）
2. 每次使用时手动输入
3. 或者修改 `pdfGenerator.js` 中的 `DEFAULT_FONT_SIZES`

未来版本考虑添加：
- 配置预设保存
- 本地存储
- 导入/导出配置文件

---

### Q8: 为什么调整字体后要等那么久？
**A**: 
因为需要重新生成PDF：
1. 使用新字体大小重新渲染所有章节
2. 重新截图转换为图片
3. 重新计算分页
4. 重新组装PDF

优化建议：
- 一次调整多个字体项
- 调整完再点"应用"
- 避免频繁调整

---

### Q9: 配色方案有什么区别？
**A**: 
主要区别在于5种颜色的搭配：

| 配色方案 | 主色调 | 适用场景 |
|---------|--------|----------|
| 经典蓝紫 | 蓝紫色 | 通用、专业 |
| 梦幻紫 | 紫色 | 典雅、女性化 |
| 商务深蓝 | 深蓝色 | 商务、正式 |
| 海洋蓝 | 青蓝色 | 清爽、现代 |
| 清新绿色 | 绿色 | 环保、农业 |
| 日落橙 | 橙色 | 温暖、活力 |
| 典雅灰色 | 灰色 | 简约、低调 |

建议根据报告用途选择合适的配色。

---

### Q10: 取消PDF生成会有什么影响吗？
**A**: 
完全没有影响：
- ✅ 立即停止后台生成
- ✅ 不会有错误提示
- ✅ 不会影响下次生成
- ✅ 不会留下临时文件
- ✅ 可以随时重新生成

取消是完全安全的操作。

---

### Q11: PDF文件太大，如何优化？
**A**: 
优化方法：
1. **使用无底图模式**（最有效）
   - 减少50%以上文件大小
   
2. **减少内容**
   - 只导出必要的章节
   - 删除不需要的表格

3. **检查配置**
   - 确认使用JPEG压缩（85%质量）
   - 确认scale值合理（1.2-1.5）

4. **后期压缩**
   - 使用PDF压缩工具
   - 在线压缩服务

---

### Q12: 可以导出Word或Excel格式吗？
**A**: 
当前版本仅支持PDF格式。原因：
- PDF格式更通用
- 保持样式一致性
- 跨平台兼容性好

临时方案：
- 使用PDF转Word工具
- 或手动复制内容到Word

---

## 最佳实践

### 导出前准备

**数据检查**：
- ✅ 确保所有数据已加载完成
- ✅ 检查时序分析结果正确
- ✅ 验证统计数据准确
- ✅ 确认图表显示正常

**环境设置**：
- ✅ 切换到"无底图"模式
- ✅ 等待地图渲染完成
- ✅ 关闭其他大型应用
- ✅ 确保网络连接稳定

**浏览器准备**：
- ✅ 打开控制台（F12）
- ✅ 准备查看生成进度
- ✅ 清除浏览器缓存（可选）

---

### 导出中

**必须遵守**：
- ⏳ 不要切换页面或标签页
- ⏳ 不要最小化浏览器
- ⏳ 不要关闭浏览器
- ⏳ 等待生成完成

**可以做的**：
- 👀 查看控制台进度
- 👀 监控进度条更新
- 👀 准备下载文件夹

**紧急情况**：
- 🚫 如需取消，直接关闭预览对话框
- 🚫 完全安全，无副作用

---

### 导出后

**质量检查**：
- ✅ 检查PDF页数是否合理（8-15页）
- ✅ 打开PDF查看内容完整性
- ✅ 检查地图是否正常显示
- ✅ 验证所有表格数据准确
- ✅ 确认图表清晰可读

**文件管理**：
- ✅ 重命名为有意义的文件名
- ✅ 移动到合适的文件夹
- ✅ 备份重要报告
- ✅ 删除测试版本

**问题处理**：
- ❌ 如有问题，查看[故障排查](#故障排查)
- ❌ 记录错误信息
- ❌ 尝试重新生成

---

### 样式配置建议

**字体调整原则**：
1. **保持比例**：
   - 标题应大于正文
   - 表头应大于表格内容
   - 数值应醒目

2. **小幅调整**：
   - 每次调整±2-4px
   - 避免过大或过小
   - 保持可读性

3. **统一风格**：
   - 同类元素使用相同字体
   - 保持整体协调
   - 避免混乱

**配色选择原则**：
1. **根据用途**：
   - 正式场合：商务深蓝、经典蓝紫
   - 环保主题：清新绿色
   - 活力展示：日落橙
   - 简约风格：典雅灰色

2. **考虑受众**：
   - 专业人士：深色系
   - 年轻群体：亮色系
   - 通用场合：经典蓝紫

3. **保持一致**：
   - 同系列报告使用相同配色
   - 建立品牌识别

---

### 性能优化

**生成速度优化**：
1. 使用无底图模式
2. 减少不必要的章节
3. 关闭其他占用资源的程序
4. 使用性能较好的浏览器（Chrome推荐）

**文件大小优化**：
1. 无底图模式
2. JPEG压缩（85%质量）
3. 合理的截图分辨率
4. 精简表格内容

**用户体验优化**：
1. 使用预览功能
2. 调整好样式再导出
3. 利用PDF缓存机制
4. 避免频繁重新生成

---

## 更新日志

### v3.0.0 (2025-10-30)
- ✅ 新增PDF预览功能
- ✅ 预览与导出内容100%一致
- ✅ 新增前端字体调整功能（8种字体）
- ✅ 新增配色方案选择（7种主题）
- ✅ 新增生成进度实时显示
- ✅ 新增PDF缓存优化
- ✅ 新增取消生成功能
- ✅ 样式配置自动重置
- ✅ 修复进度条不平滑问题
- ✅ 修复样式应用不完整问题

### v2.1.0 (2025-10-21)
- ✅ 修复作物轮作模式数据提取错误
- ✅ 修复未变化作物类型数据提取错误
- ✅ 调整总部分数为15个
- ✅ 优化数据统计逻辑

### v2.0.0 (2025-10-20)
- ✅ 实现完整的15部分PDF报告
- ✅ 新增作物轮作模式分析
- ✅ 新增数据统计汇总
- ✅ 新增报告说明
- ✅ 优化文件大小（JPEG压缩）
- ✅ 修复内容截断问题
- ✅ 修复地图跨域问题
- ✅ 实现容错机制

### v1.0.0 (2025-10-15)
- ✅ 基础PDF导出功能
- ✅ 封面和摘要
- ✅ 主要统计章节
- ✅ 地图截图
- ✅ 基础表格展示

---

## 技术支持

### 获取帮助

如遇到问题，请提供以下信息：

**1. 基本信息**：
- 操作系统版本
- 浏览器版本
- 项目版本

**2. 错误信息**：
- 控制台完整日志（F12 → Console）
- 错误截图
- 错误发生的步骤

**3. 数据信息**：
- 地块数量
- 时期数量
- 数据文件大小

**4. 文件信息**：
- PDF文件大小（如果生成了）
- 生成耗时
- 包含的页数

**5. 复现步骤**：
- 详细的操作步骤
- 使用的功能
- 设置的参数

### 调试方法

**开启调试模式**：
```javascript
// 在控制台执行
localStorage.setItem('pdfDebug', 'true')

// 刷新页面，会看到更详细的日志
```

**查看生成日志**：
```javascript
// 完整的生成日志
📄 开始生成PDF报告（分段截图模式）...
📐 PDF页面尺寸: 210mm x 297mm
📄 [1/15] 生成封面...
  📸 截图完成: 1021x528px
  ✅ 已添加到PDF (当前Y: 89.58mm)
📄 [2/15] 生成摘要...
  ✅ 已添加到PDF (当前Y: 154.23mm)
...
✅ PDF生成完成，共 X 页
```

**检查数据结构**：
```javascript
// 在控制台执行
console.log('完整数据:', props.data)
console.log('轨迹数量:', props.data.trajectories.length)
console.log('示例轨迹:', props.data.trajectories[0])
```

### 常见调试命令

```javascript
// 查看字体配置
console.log('字体配置:', fontSizes.value)

// 查看配色方案
console.log('配色方案:', selectedColorScheme.value)
console.log('当前配色:', getCurrentColorScheme())

// 查看缓存状态
console.log('是否有缓存:', !!cachedPdfBlob.value)
console.log('预览URL:', previewPdfUrl.value)

// 查看取消状态
console.log('取消标志:', cancelGeneration.value)
console.log('生成进度:', generatingProgress.value)
```

---

## 附录

### A. 完整的章节列表

1. 封面（Cover）
2. 分析摘要（Summary）
3. 变化统计详情（Change Statistics）
4. 时序变化地图（Temporal Change Map）
5. 地块种植稳定性分析（Plot Stability Analysis）
6. 作物分布趋势对比（Crop Distribution Trend）
7. 经济作物与粮食作物转换分析（Economic/Food Crop Conversion）
8. 作物转换流向TOP20（Top 20 Crop Transitions）
9. 作物轮作模式分析TOP15（Top 15 Rotation Patterns）
10. 未变化地块作物类型分析（Unchanged Plot Crop Analysis）
11. 各时期作物分布详情-第1期（Period 1 Distribution）
12. 各时期作物分布详情-第2期（Period 2 Distribution）
13. 各时期作物分布详情-第3期（Period 3 Distribution）
14. 数据统计汇总（Data Statistics Summary）
15. 报告说明（Report Notes）

### B. 颜色变量对照表

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `COLORS.primary` | 主色 | #4f46e5 |
| `COLORS.primaryDark` | 主色深色 | #4f46e5 |
| `COLORS.primaryBg` | 主色背景（15%透明） | #4f46e515 |
| `COLORS.secondary` | 次色 | #8b5cf6 |
| `COLORS.success` | 成功色 | #10b981 |
| `COLORS.successBg` | 成功色背景 | #d1fae5 |
| `COLORS.warning` | 警告色 | #f59e0b |
| `COLORS.warningBg` | 警告色背景 | #fef3c7 |
| `COLORS.danger` | 危险色 | #ef4444 |
| `COLORS.dangerBg` | 危险色背景 | #fee2e2 |
| `COLORS.gray` | 灰色 | #6b7280 |
| `COLORS.grayBg` | 灰色背景 | #f9fafb |
| `COLORS.border` | 边框色 | #e5e7eb |
| `COLORS.text` | 文本色 | #1f2937 |
| `COLORS.textLight` | 浅文本色 | #6b7280 |

### C. 文件路径参考

| 文件 | 路径 | 说明 |
|------|------|------|
| PDF生成器 | `src/utils/pdfGenerator.js` | 核心PDF生成逻辑 |
| 预览组件 | `src/views/ResultCompare/components/TemporalMapViewEnhanced.vue` | PDF预览界面 |
| 地图组件 | `src/views/ResultCompare/components/TemporalChangeMap.vue` | 地图截图源 |
| 导出的PDF | `public/data/data_analysis_results/reports/` | 服务器保存位置 |

---

**文档维护**：本文档整合了PDF预览、字体调整、配色方案等所有PDF相关功能的完整说明，是PDF功能的唯一参考指南。

**版本**：v3.0.0  
**最后更新**：2025年10月30日  
**维护者**：开发团队
