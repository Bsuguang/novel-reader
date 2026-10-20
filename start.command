#!/bin/bash
# macOS 一键启动（等同 Windows 的 start.bat）：双击本文件或 `./start.command [书.txt]`
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "首次运行：安装依赖中（需要联网）…"
  npm install
fi

if [ $# -gt 0 ]; then
  npx electron . "$1"
else
  npx electron .
fi
