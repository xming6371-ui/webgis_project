#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
GeoJSON 面积计算脚本
使用 GeoPandas 计算测地线面积（与 ArcGIS Pro 一致）

输入：stdin 接收 GeoJSON 字符串
输出：stdout 输出面积数组 JSON
"""

import sys
import json
import geopandas as gpd
from shapely.geometry import shape
from pyproj import Geod

def calculate_areas(geojson_data):
    """
    计算GeoJSON中所有feature的面积
    
    参数:
        geojson_data: GeoJSON对象
    
    返回:
        areas: 面积数组 [{area_m2, area_mu}, ...]
    """
    
    try:
        features = geojson_data['features']
        
        # 创建几何体列表
        geometries = []
        for f in features:
            try:
                geom = shape(f['geometry'])
                geometries.append(geom)
            except Exception as e:
                # 如果某个几何体解析失败，添加None
                geometries.append(None)
                print(f"警告: 几何体解析失败: {str(e)}", file=sys.stderr)
        
        # 创建GeoDataFrame（假设原始坐标系是 EPSG:3857）
        gdf = gpd.GeoDataFrame(geometry=geometries, crs='EPSG:3857')
        
        # 转换到WGS84用于测地线计算
        gdf_wgs84 = gdf.to_crs('EPSG:4326')
        
        # 使用WGS84椭球体计算测地线面积
        geod = Geod(ellps='WGS84')
        
        areas = []
        for idx, geom in enumerate(gdf_wgs84.geometry):
            if geom is None or geom.is_empty:
                # 无效几何体
                areas.append({
                    'area_m2': 0,
                    'area_mu': 0,
                    'error': True
                })
                continue
            
            try:
                # 计算测地线面积
                if geom.geom_type == 'Polygon':
                    area_m2, _ = geod.geometry_area_perimeter(geom)
                    area_m2 = abs(area_m2)
                elif geom.geom_type == 'MultiPolygon':
                    area_m2 = 0
                    for poly in geom.geoms:
                        poly_area, _ = geod.geometry_area_perimeter(poly)
                        area_m2 += abs(poly_area)
                else:
                    area_m2 = 0
                
                # 转换为亩（1 m² = 0.0015 亩）
                area_mu = area_m2 * 0.0015
                
                areas.append({
                    'area_m2': round(area_m2, 6),
                    'area_mu': round(area_mu, 6)
                })
            except Exception as e:
                print(f"警告: 地块{idx+1}面积计算失败: {str(e)}", file=sys.stderr)
                areas.append({
                    'area_m2': 0,
                    'area_mu': 0,
                    'error': True
                })
        
        return areas
    
    except Exception as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        raise

if __name__ == '__main__':
    try:
        # 从stdin读取GeoJSON
        input_data = sys.stdin.read()
        
        if not input_data.strip():
            print("错误: 未接收到输入数据", file=sys.stderr)
            sys.exit(1)
        
        geojson_data = json.loads(input_data)
        
        # 计算面积
        areas = calculate_areas(geojson_data)
        
        # 输出结果到stdout（JSON格式）
        print(json.dumps(areas))
        
        sys.exit(0)
    
    except Exception as e:
        print(f"致命错误: {str(e)}", file=sys.stderr)
        sys.exit(1)


