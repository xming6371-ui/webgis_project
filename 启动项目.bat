@echo off
chcp 65001
echo ====================================================
echo   新疆WebGIS监测与分析系统
echo ====================================================
echo.
echo 正在启动开发服务器...
echo.

cd /d %~dp0

if not exist "node_modules" (
    echo [提示] 首次运行需要安装依赖，请稍候...
    echo.
    call npm install
    echo.
    echo 依赖安装完成！
    echo.
)

echo 启动中...
echo 浏览器将自动打开 http://localhost:3000
echo.
echo 按 Ctrl+C 停止服务器
echo ====================================================
echo.

npm run dev

pause

