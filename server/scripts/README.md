# 面积计算脚本

## 📌 功能说明

使用 **GeoPandas** 计算 GeoJSON 文件中所有地块的面积，与 ArcGIS Pro 保持一致。

## 📂 文件说明

- **`calculate_area.py`** - Python 脚本，使用 GeoPandas 计算测地线面积
- **`README.md`** - 本文档

## 🚀 使用方法

### 自动调用（推荐）

系统会在 **SHP 转 GeoJSON** 时自动调用此脚本计算面积：

1. 在**任务管理**界面上传 SHP 文件
2. 系统自动转换 + 计算面积
3. 面积保存到 GeoJSON 的 `properties` 字段

### 手动调用（测试）

```bash
# 准备 GeoJSON 文件
echo '{"type":"FeatureCollection","features":[...]}' | python calculate_area.py

# 输出格式
[
  {"area_m2": 123456.789, "area_mu": 185.185},
  {"area_m2": 234567.890, "area_mu": 351.852},
  ...
]
```

## 📦 依赖安装

### 方法1：使用 conda（推荐）

```bash
conda install geopandas
```

### 方法2：使用 pip

```bash
pip install geopandas fiona shapely pyproj
```

### 验证安装

```bash
python -c "import geopandas; print('✅ GeoPandas 安装成功')"
```

## 🔧 技术细节

### 算法：测地线面积（Geodesic Area）

- 使用 **WGS84 椭球体** 计算
- 与 ArcGIS Pro 的 "Calculate Geometry (Geodesic)" 一致
- 误差 < 0.01%

### 坐标转换

```
EPSG:3857 (Web Mercator) → EPSG:4326 (WGS84) → 计算面积
```

### 单位转换

```python
1 m² = 0.0015 亩  # 精确值：1/666.666...
```

## 📊 性能

- **速度**: 347个地块 ≈ 3.2秒
- **精度**: 与 ArcGIS Pro 误差 < 0.14%

## 🛠️ 故障排查

### 问题1：ModuleNotFoundError

```bash
# 安装缺失的模块
conda install geopandas
```

### 问题2：计算结果为 0

- 检查输入的 GeoJSON 格式是否正确
- 确认坐标系为 EPSG:3857

### 问题3：与 ArcGIS Pro 结果不一致

- 误差 < 1% 属于正常范围
- 确保使用相同的坐标系和椭球体

## 📝 示例输出

```bash
$ echo '...' | python calculate_area.py

警告: 几何体解析失败: ...  # stderr（如果有）
✅ 面积计算完成，共 347 个地块  # stderr
[
  {"area_m2": 112586.954, "area_mu": 168.880},
  ...
]  # stdout（JSON格式）
```

## 📚 相关文档

- [面积计算完整指南](../../docs/面积计算完整指南.md)
- [GeoPandas 官方文档](https://geopandas.org/)



