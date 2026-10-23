@echo off
cd /d "%~dp0"
title Canteen System - Dev Mode
color 0B

echo Starting Dev Server...
start "Canteen Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
start "Canteen Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
timeout /t 3 >nul
start http://localhost:5173const hostname = window.location.hostname;