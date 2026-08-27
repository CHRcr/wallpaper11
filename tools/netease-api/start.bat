@echo off
cd /d "%~dp0"
node "%~dp0server.js"
if errorlevel 1 pause
