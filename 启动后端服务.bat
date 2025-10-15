@echo off
chcp 65001
echo ====================================
echo   WebGIS 后端服务启动脚本
echo ====================================
echo.

cd server

echo 检查依赖...
if not exist "node_modules" (
    echo 首次运行，正在安装依赖...
    call npm install
    echo.
)

echo 启动后端服务器...
echo 提示: 使用 Ctrl+C 停止服务
echo.
call npm run dev

pause

