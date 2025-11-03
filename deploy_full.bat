#!/bin/bash
# ==========================================
# WebGIS 完整部署脚本（重新构建）
# 适用场景：修改了依赖、Dockerfile、配置文件
# 执行时间：约5-15分钟
# ==========================================

set -e

echo "========================================="
echo "  WebGIS 完整部署（重新构建）"
echo "  开始时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="

cd /root/webgis_project

# 1. 备份data目录
echo ""
echo "[1/7] 备份data目录..."
BACKUP_DIR="/root/backups"
BACKUP_FILE="$BACKUP_DIR/data_backup_$(date +%Y%m%d_%H%M%S).tar.gz"
mkdir -p $BACKUP_DIR
if [ -d "public/data" ]; then
    cp -r public/data /tmp/data_backup_temp
    echo "✅ data已备份到 /tmp/data_backup_temp"xieyi
else
    echo "⚠️  data目录不存在，跳过备份"
fi

# 2. 拉取最新代码
echo ""
echo "[2/7] 拉取GitHub最新代码..."
git fetch origin main
git reset --hard origin/main
echo "✅ 代码已更新"

# 3. 显示版本信息
echo ""
echo "[3/7] 当前版本信息："
git log -1 --pretty=format:"   Commit: %h%n   作者: %an%n   时间: %ar%n   说明: %s%n"

# 4. 确保data目录存在
echo ""
echo "[4/7] 检查data目录..."
mkdir -p public/data/{data_tif,data_shp,data_geojson,data_kmz,data_reports,data_analysis_results}
echo "✅ 目录结构已确保"

# 5. 停止旧服务
echo ""
echo "[5/7] 停止旧服务..."
docker compose down
echo "✅ 旧服务已停止"

# 6. 重新构建（前端不使用缓存，确保使用最新代码）
echo ""
echo "[6/7] 重新构建镜像..."
echo "提示: 前端将不使用缓存以确保代码最新，后端使用缓存以加快构建"
echo "提示: 可以按Ctrl+C中断，但建议等待完成"
docker compose build --no-cache frontend
docker compose build backend
echo "✅ 构建完成"

# 7. 启动新服务
echo ""
echo "[7/7] 启动新服务..."
docker compose up -d
echo "✅ 服务已启动"

# 等待服务启动
echo ""
echo "等待服务启动..."
sleep 10

# 验证
echo ""
echo "验证部署结果："
docker compose ps

# 查看日志
echo ""
echo "后端日志（最后10行）："
docker compose logs backend --tail 10

echo ""
echo "========================================="
echo "✅ 完整部署完成！"
echo "========================================="
echo "访问地址: http://120.26.239.62"
echo "备份位置: $BACKUP_FILE"
echo "查看日志: docker compose logs -f"
echo "注意：浏览器需要清除缓存并强制刷新"
echo "========================================="