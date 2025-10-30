# 影像优化 EPERM 错误修复说明

## 🔍 问题描述

在影像管理界面执行 TIF 文件优化时，出现以下错误：

```
❌ 处理文件 YZC20250601RGB_optimized.tif 时出错: 
EPERM: operation not permitted, stat 'E:\webgis\webgis_project\public\data\data_tif\YZC20250601RGB_optimized.tif'
```

## 📊 根本原因

当优化文件刚生成/重命名后，Windows 文件系统尚未完全释放文件句柄，导致后续的文件访问操作（如 `fs.statSync()`、`gdalinfo`、`fromFile()`）失败。

**错误代码说明：**
- **Windows**: `EPERM` (operation not permitted)
- **Linux**: `EACCES` (permission denied)、`EBUSY` (device or resource busy)、`EAGAIN` (resource temporarily unavailable)

## ✅ 修复方案

### 1. **文件状态读取重试机制** (`syncMetadata` 函数)

在扫描 TIF 文件时，添加重试逻辑处理文件访问失败：

```javascript
// ✅ 添加重试逻辑，解决文件刚创建时的占用问题（跨平台兼容）
let stats
let retryCount = 0
const maxRetries = 3

while (retryCount < maxRetries) {
  try {
    stats = fs.statSync(filePath)
    break // 成功，跳出循环
  } catch (err) {
    // Windows: EPERM, Linux: EACCES/EBUSY
    const isFileAccessError = ['EPERM', 'EACCES', 'EBUSY', 'EAGAIN'].includes(err.code)
    
    if (isFileAccessError && retryCount < maxRetries - 1) {
      // 文件被占用，等待后重试
      console.warn(`⚠️ 文件访问失败 [${err.code}] (尝试 ${retryCount + 1}/${maxRetries}): ${filename}`)
      await new Promise(resolve => setTimeout(resolve, 500)) // 等待500ms
      retryCount++
    } else {
      throw err // 其他错误或重试次数用完，抛出异常
    }
  }
}
```

**要点：**
- 最多重试 3 次
- 每次重试间隔 500ms
- 兼容 Windows 和 Linux 错误代码
- 非文件访问错误立即抛出

---

### 2. **优化完成后延迟** (`optimizeTifFile` 函数)

在优化文件保存后，等待文件系统完全释放句柄：

```javascript
fs.renameSync(tempOutput, optimizedPath)
console.log(`✅ 优化文件已保存: ${path.basename(optimizedPath)}`)

// ✅ 等待文件系统完全释放文件句柄
await new Promise(resolve => setTimeout(resolve, 500))

// 8. 更新元数据
const currentMetadata = readMetadata()
const currentImage = currentMetadata.images.find(img => img.id === id)
```

**要点：**
- 在 `fs.renameSync()` 后等待 500ms
- 确保后续 `fs.statSync()` 操作成功

---

### 3. **文件状态获取重试** (`optimizeTifFile` 函数)

获取优化文件状态时，添加重试机制：

```javascript
// ✅ 使用重试逻辑获取文件状态（跨平台兼容）
let optimizedStats
let statRetryCount = 0
while (statRetryCount < 3) {
  try {
    optimizedStats = fs.statSync(optimizedPath)
    break
  } catch (err) {
    // Windows: EPERM, Linux: EACCES/EBUSY
    const isFileAccessError = ['EPERM', 'EACCES', 'EBUSY', 'EAGAIN'].includes(err.code)
    
    if (isFileAccessError && statRetryCount < 2) {
      console.warn(`⚠️ 获取优化文件状态失败 [${err.code}]，重试中... (${statRetryCount + 1}/3)`)
      await new Promise(resolve => setTimeout(resolve, 500))
      statRetryCount++
    } else {
      throw err
    }
  }
}
```

---

### 4. **TIF 文件分析重试** (`analyzeTifFile` 函数)

使用 `geotiff` 库读取 TIF 文件时，添加重试机制：

```javascript
// ✅ 读取TIF文件（带重试，处理文件占用问题，跨平台兼容）
let tiff
let retryCount = 0
while (retryCount < 3) {
  try {
    tiff = await fromFile(filePath)
    break
  } catch (err) {
    // Windows: EPERM, Linux: EACCES/EBUSY
    const isFileAccessError = err.code && ['EPERM', 'EACCES', 'EBUSY', 'EAGAIN'].includes(err.code)
    const hasAccessErrorMsg = err.message && /EPERM|EACCES|EBUSY|EAGAIN/i.test(err.message)
    
    if (retryCount < 2 && (isFileAccessError || hasAccessErrorMsg)) {
      console.warn(`⚠️ TIF文件读取失败 [${err.code || 'unknown'}]，重试中... (${retryCount + 1}/3)`)
      await new Promise(resolve => setTimeout(resolve, 500))
      retryCount++
    } else {
      throw err
    }
  }
}
```

**要点：**
- 兼容不同库返回的错误格式
- 同时检查 `err.code` 和 `err.message`

---

### 5. **GDAL 命令超时控制** (`detectOptimizationStatus` 函数)

防止 GDAL 进程长时间占用文件：

```javascript
// ✅ 添加超时控制，避免GDAL进程长时间占用文件
const timeoutMs = 10000 // 10秒超时
const cmd = buildGDALCommand(`gdalinfo "${filePath}"`)

const execPromise = execAsync(cmd)
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('gdalinfo timeout')), timeoutMs)
)

const { stdout } = await Promise.race([execPromise, timeoutPromise])
```

**要点：**
- 10 秒超时限制
- 使用 `Promise.race()` 实现超时控制
- 超时后自动中断 GDAL 进程

---

## 🌍 跨平台兼容性

### Windows 错误代码
- `EPERM`: operation not permitted

### Linux 错误代码
- `EACCES`: permission denied
- `EBUSY`: device or resource busy
- `EAGAIN`: resource temporarily unavailable

### 统一处理
```javascript
const isFileAccessError = ['EPERM', 'EACCES', 'EBUSY', 'EAGAIN'].includes(err.code)
```

---

## 🧪 测试建议

### 本地测试（Windows）
1. 上传大文件（>500MB）
2. 启用自动优化
3. 观察是否出现 EPERM 错误
4. 检查优化文件是否正常生成

### 服务器测试（Linux）
1. 部署更新后的代码
2. 执行优化任务
3. 检查日志，确认重试机制是否触发
4. 验证文件访问错误是否被正确处理

### 日志关键字
```
⚠️ 文件访问失败 [EPERM] (尝试 1/3)
⚠️ 获取优化文件状态失败 [EPERM]，重试中... (1/3)
⚠️ TIF文件读取失败 [EPERM]，重试中... (1/3)
```

---

## 📝 总结

**修复内容：**
1. ✅ 文件访问重试机制（3次，每次间隔500ms）
2. ✅ 优化完成后延迟 500ms
3. ✅ 跨平台错误代码兼容（Windows + Linux）
4. ✅ GDAL 命令 10 秒超时控制
5. ✅ TIF 文件读取重试机制

**预期效果：**
- 消除 `EPERM: operation not permitted` 错误
- 提高文件操作的鲁棒性
- 兼容 Windows 开发环境和 Linux 生产环境
- 自动处理文件系统延迟问题

**修改文件：**
- `server/routes/image.js` (5处修改)

---

## 🔗 相关文档

- [TIF处理完整指南.md](./TIF处理完整指南.md)
- [问题修复与故障排查完整指南.md](./问题修复与故障排查完整指南.md)

---

**修复时间**: 2025-01-XX  
**测试状态**: ⏳ 待测试  
**部署状态**: ⏳ 待部署

