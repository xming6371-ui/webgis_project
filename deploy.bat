@echo off
chcp 65001 >nul
echo =========================================
echo   WebGIS 一键部署脚本
echo   本地推送 + 服务器部署
echo =========================================
echo.

echo [1/3] 本地推送到GitHub...
git add .
git commit -m "更新: %date% %time%"
git push origin main
if errorlevel 1 (
    echo ❌ Git push 失败
    pause
    exit /b 1
)
echo ✅ 已推送到GitHub
echo.

echo [2/3] 服务器拉取最新代码...
ssh root@120.26.239.62 "bash /root/deploy_quick.sh"
if errorlevel 1 (
    echo ❌ 服务器部署失败
    pause
    exit /b 1
)
echo ✅ 服务器部署完成
echo.

echo [3/3] 打开浏览器...
start http://120.26.239.62
echo.

echo =========================================
echo   🎉 部署完成！
echo =========================================
echo   访问地址: http://120.26.239.62
echo   提示: 按 Ctrl+Shift+R 强制刷新浏览器
echo =========================================
echo.
pause