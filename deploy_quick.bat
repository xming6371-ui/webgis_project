#!/bin/bash
# ==========================================
# WebGIS 快速部署脚本（只重启，不重新构建）
# 适用场景：只修改了代码，没改依赖
# 执行时间：约10秒
# ==========================================

set -e  # 遇到错误立即停止

echo "========================================="
echo "  WebGIS 快速部署"
echo "  开始时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="

# 进入项目目录
cd /root/webgis_project

# 1. 拉取最新代码
echo ""
echo "[1/4] 拉取GitHub最新代码..."
git fetch origin main
git reset --hard origin/main
echo "✅ 代码已更新"

# 2. 显示当前版本
echo ""
echo "[2/4] 当前版本信息："
git log -1 --pretty=format:"   Commit: %h%n   作者: %an%n   时间: %ar%n   说明: %s%n"

# 3. 重启服务
echo ""
echo "[3/4] 重启服务..."
docker compose restart
echo "✅ 服务已重启"

# 4. 验证
echo ""
echo "[4/4] 验证部署..."
sleep 5
docker compose ps

echo ""
echo "========================================="
echo "✅ 快速部署完成！"
echo "========================================="
echo "访问地址: http://120.26.239.62"
echo "注意：浏览器需要强制刷新（Ctrl+Shift+R）"
echo "========================================="