# 诊断description字段

请在浏览器控制台运行以下代码，查看实际的description内容：

```javascript
// 查看第一个KMZ图层的要素
const firstKmzLayer = window.map.getLayers().getArray().find(layer => {
  return layer.get('fileName')
})

if (firstKmzLayer) {
  const source = firstKmzLayer.getSource()
  const features = source.getFeatures()
  
  console.log('=== Description字段诊断 ===')
  console.log('总要素数:', features.length)
  
  // 查看前5个要素的description
  features.slice(0, 5).forEach((feature, idx) => {
    const props = feature.getProperties()
    console.log(`\n要素 ${idx + 1}:`)
    console.log('name:', props.name)
    console.log('description长度:', props.description?.length)
    console.log('description前500字符:', props.description?.substring(0, 500))
    
    // 尝试不同的匹配方式
    if (props.description) {
      const desc = props.description
      
      console.log('匹配测试:')
      console.log('  包含"种植":', desc.includes('种植'))
      console.log('  包含"已种植":', desc.includes('已种植'))
      console.log('  包含"未种植":', desc.includes('未种植'))
      
      // 尝试所有可能的匹配
      const matches = [
        desc.match(/种植情况.*?<td>([^<]+)<\/td>/i),
        desc.match(/<td>(已种植|未种植)<\/td>/i),
        desc.match(/>(已种植|未种植)</i),
        desc.match(/已种植/),
        desc.match(/未种植/)
      ]
      
      matches.forEach((m, i) => {
        console.log(`  匹配方式${i + 1}:`, m ? m[1] || m[0] : null)
      })
    }
  })
} else {
  console.log('未找到KMZ图层')
}
```

运行后，请将输出结果发给我！

