@echo off
cd /d "%~dp0"
if not exist "%LOCALAPPDATA%\wallpaper11" mkdir "%LOCALAPPDATA%\wallpaper11"
set "NODE_EXE=%~dp0runtime\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
"%NODE_EXE%" "%~dp0server.js" >> "%LOCALAPPDATA%\wallpaper11\music-bridge.log" 2>&1
