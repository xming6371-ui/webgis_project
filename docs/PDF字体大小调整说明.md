# PDF字体大小调整说明

## 字体大小常量位置

在 `src/utils/pdfGenerator.js` 文件的**第44-51行**，定义了所有字体大小常量：

```javascript
const FONT_SIZES = {
  title: '20px',        // 主标题（H2）- 如"作物转换流向TOP20"
  subtitle: '16px',     // 小标题（H3）- 如"一、各时期占比趋势"
  tableHeader: '13px',  // 表格表头
  tableCell: '12px',    // 表格内容
  description: '11px',  // 说明文字（黄色/蓝色说明框）
  normal: '12px'        // 普通文字
}
```

## 如何统一调整字体大小

### 方法一：直接修改常量（推荐）

直接修改上面的数值，所有使用该常量的地方都会自动更新。

例如，想要所有表格内容字体更大：
```javascript
tableCell: '14px',    // 从12px改为14px
```

### 方法二：批量替换（如果有遗漏）

在 `pdfGenerator.js` 文件中搜索并替换：

1. **表格表头统一**
   - 搜索：`<th style="padding:`
   - 确保每个都包含：`font-size: ${FONT_SIZES.tableHeader}; font-weight: bold;`

2. **表格内容统一**
   - 搜索：`<td style="padding:`
   - 确保每个都包含：`font-size: ${FONT_SIZES.tableCell};`

3. **说明文字统一**
   - 搜索：`<div style="font-size:`
   - 确保说明框内的都是：`font-size: ${FONT_SIZES.description};`

## 需要加粗的列

以下列需要添加 `font-weight: bold;`：
- **作物类型**（各时期作物分布详情表、未变化地块表）
- **转换类型**（作物转换流向表）
- **排名**（作物转换流向表、轮作模式表）
- **轮作模式**（轮作模式表）
- **统计项**（变化统计详情表）
- **路径类型**（地块完整路径分类表）

## 表头颜色

所有表格表头应使用蓝色：
```javascript
background: ${THEME_COLORS.primary};  // #4f46e5
color: white;
border: 1px solid ${THEME_COLORS.primaryDark};  // #4338ca
```

## 当前可能存在的问题

1. 部分表格的字体大小可能仍然硬编码为 `12px`、`13px` 等，没有使用常量
2. 部分需要加粗的列可能没有 `font-weight: bold;`
3. 部分表头可能没有统一使用蓝色

## 快速定位问题

搜索以下内容找出没有统一的地方：
- `font-size: 12px` （应该改为 `${FONT_SIZES.tableCell}`）
- `font-size: 13px` （应该改为 `${FONT_SIZES.tableHeader}`）
- `font-size: 11px` （应该改为 `${FONT_SIZES.description}`）
- `background: #10b981` 或 `background: #059669` （绿色表头，应该改为蓝色）


