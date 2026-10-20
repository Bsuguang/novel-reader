@echo off
REM 一键启动小说阅读器（双击即可，无需手动敲命令）
REM 首次使用前请先在本目录执行一次：npm install
REM 用法：
REM   start.bat               启动阅读器（进入首页/书架）
REM   start.bat "书.txt"       直接打开某本小说（双击 .txt 关联后也走这条路径）
cd /d "%~dp0"
npm start -- %*
