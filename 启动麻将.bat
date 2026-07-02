@echo off
chcp 65001 >nul
title 中国麻将 - 本地服务
cd /d "%~dp0"
echo 正在启动麻将游戏本地服务...
echo 浏览器打开: http://localhost:8081
echo 按 Ctrl+C 停止
npx --yes serve -l 8081 -s .
