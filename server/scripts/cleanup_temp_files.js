/**
 * 清理临时文件和备份文件的元数据记录
 * 用于修复元数据同步错误识别临时文件的问题
 */

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '../../public/data')
const TIF_DIR = path.join(DATA_DIR, 'data_tif')
const METADATA_FILE = path.join(DATA_DIR, 'imageData.json')

console.log('🧹 开始清理临时文件和备份文件...\n')

// 1. 清理文件系统中的临时文件和备份文件
try {
  const files = fs.readdirSync(TIF_DIR)
  const tempFiles = files.filter(f => 
    f.startsWith('temp_optimized_') || 
    f.startsWith('temp_scaled_') || 
    f.startsWith('backup_')
  )
  
  if (tempFiles.length === 0) {
    console.log('✅ 文件系统中没有临时文件或备份文件')
  } else {
    console.log(`📁 找到 ${tempFiles.length} 个临时/备份文件:`)
    tempFiles.forEach(file => {
      const filePath = path.join(TIF_DIR, file)
      try {
        const stats = fs.statSync(filePath)
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2)
        console.log(`   - ${file} (${sizeMB}MB)`)
        
        fs.unlinkSync(filePath)
        console.log(`   ✅ 已删除`)
      } catch (err) {
        console.error(`   ❌ 删除失败: ${err.message}`)
      }
    })
  }
} catch (err) {
  console.error('❌ 扫描文件系统失败:', err.message)
}

console.log()

// 2. 清理元数据中的临时文件和备份文件记录
try {
  if (!fs.existsSync(METADATA_FILE)) {
    console.log('⚠️ 元数据文件不存在')
    process.exit(0)
  }
  
  const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'))
  const originalCount = metadata.images.length
  
  console.log(`💾 元数据中有 ${originalCount} 条记录`)
  
  // 过滤掉临时文件和备份文件
  const filteredImages = metadata.images.filter(img => {
    const isTemp = img.name.startsWith('temp_optimized_') || 
                   img.name.startsWith('temp_scaled_') || 
                   img.name.startsWith('backup_')
    
    if (isTemp) {
      console.log(`   🗑️ 移除记录: ${img.id} - ${img.name}`)
    }
    
    return !isTemp
  })
  
  const removedCount = originalCount - filteredImages.length
  
  if (removedCount === 0) {
    console.log('✅ 元数据中没有临时文件或备份文件记录')
  } else {
    console.log(`\n📊 清理结果:`)
    console.log(`   原始记录: ${originalCount} 条`)
    console.log(`   移除记录: ${removedCount} 条`)
    console.log(`   剩余记录: ${filteredImages.length} 条`)
    
    // 保存更新后的元数据
    metadata.images = filteredImages
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2))
    console.log('\n✅ 元数据已更新')
  }
  
} catch (err) {
  console.error('❌ 处理元数据失败:', err.message)
  process.exit(1)
}

console.log('\n✅ 清理完成！请刷新主控界面查看效果。\n')

