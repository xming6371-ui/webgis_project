ssh root@120.26.239.62 << 'ENDSSH'
cd /root/webgis_project

echo "========================================="
echo "  服务器代码版本检查"
echo "========================================="

# 1. 获取GitHub最新版本
echo ""
echo "【1】获取GitHub最新信息..."
git fetch origin main
echo "✅ 已获取GitHub最新信息"

# 2. 显示服务器当前版本
echo ""
echo "【2】服务器当前版本："
echo "   Commit: $(git rev-parse HEAD)"
echo "   简短: $(git rev-parse --short HEAD)"
echo "   说明: $(git log -1 --pretty=format:'%s')"
echo "   作者: $(git log -1 --pretty=format:'%an')"
echo "   时间: $(git log -1 --pretty=format:'%ar')"

# 3. 显示GitHub最新版本
echo ""
echo "【3】GitHub最新版本："
echo "   Commit: $(git rev-parse origin/main)"
echo "   简短: $(git rev-parse --short origin/main)"
echo "   说明: $(git log -1 --pretty=format:'%s' origin/main)"
echo "   作者: $(git log -1 --pretty=format:'%an' origin/main)"
echo "   时间: $(git log -1 --pretty=format:'%ar' origin/main)"

# 4. 对比版本
echo ""
echo "【4】版本对比："
if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ]; then
    echo "   ✅ 服务器代码是最新的！"
else
    echo "   ❌ 服务器代码不是最新的！"
    echo ""
    echo "   落后的提交："
    git log HEAD..origin/main --oneline
fi

# 5. 检查关键文件修改时间
echo ""
echo "【5】关键文件修改时间："
ls -lh src/App.vue 2>/dev/null || echo "   App.vue 不存在"
ls -lh server/app.js 2>/dev/null || echo "   server/app.js 不存在"
ls -lh src/views/TaskManagement/index.vue 2>/dev/null || echo "   TaskManagement 不存在"

# 6. 检查容器内的代码版本
echo ""
echo "【6】容器内的代码版本："
docker exec webgis-backend ls -lh /app/server/app.js 2>/dev/null || echo "   容器未运行或文件不存在"

# 7. 检查是否有未提交的修改
echo ""
echo "【7】本地修改状态："
if [ -z "$(git status --porcelain)" ]; then
    echo "   ✅ 工作区干净，没有未提交的修改"
else
    echo "   ⚠️  有未提交的修改："
    git status --short
fi

echo ""
echo "========================================="
ENDSSH

# 检查某个文件的内容
ssh root@120.26.239.62 << 'ENDSSH'
cd /root/webgis_project

echo "=== 检查 TemporalMapViewEnhanced.vue ==="
echo "文件修改时间:"
ls -lh src/views/ResultCompare/components/TemporalMapViewEnhanced.vue

echo ""
echo "文件前10行内容:"
head -10 src/views/ResultCompare/components/TemporalMapViewEnhanced.vue

echo ""
echo "搜索关键字（你最近添加的）:"
grep -n "你添加的某个关键字" src/views/ResultCompare/components/TemporalMapViewEnhanced.vue || echo "未找到"
ENDSSH