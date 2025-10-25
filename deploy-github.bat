@echo off
chcp 65001 >nul
echo ========================================
echo   WebGIS 项目一键部署（GitHub版）
echo   目标服务器: 120.26.239.62
echo ========================================
echo.

echo [1/6] 本地构建前端...
call npm run build
if errorlevel 1 (
    echo ❌ 前端构建失败
    pause
    exit /b 1
)
echo ✅ 前端构建完成
echo.

echo [2/6] 推送代码到 GitHub...
git add .
git commit -m "Update: %date% %time%"
git push origin main
if errorlevel 1 (
    echo ⚠️ Git push 失败，继续部署...
)
echo ✅ 代码已推送到 GitHub
echo.

echo [3/6] 服务器拉取最新代码...
ssh root@120.26.239.62 "cd /root/webgis_project && git pull origin main"
if errorlevel 1 (
    echo ❌ Git pull 失败
    pause
    exit /b 1
)
echo ✅ 服务器代码已更新
echo.

echo [4/6] 上传本地构建的 dist...
scp -r dist root@120.26.239.62:/root/webgis_project/
if errorlevel 1 (
    echo ❌ dist 上传失败
    pause
    exit /b 1
)
echo ✅ dist 上传完成
echo.

echo [5/6] 重新构建 Docker 镜像...
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose build"
if errorlevel 1 (
    echo ❌ Docker 构建失败
    pause
    exit /b 1
)
echo ✅ Docker 构建完成
echo.

echo [6/6] 重启服务...
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose up -d"
if errorlevel 1 (
    echo ❌ 服务启动失败
    pause
    exit /b 1
)
echo ✅ 服务启动完成
echo.

echo ========================================
echo   🎉 部署成功！
echo ========================================
echo   访问地址: http://120.26.239.62
echo   后端API: http://120.26.239.62/api/health
echo ========================================
echo.

echo 正在查看服务状态...
ssh root@120.26.239.62 "cd /root/webgis_project && docker compose ps"
echo.

pause


