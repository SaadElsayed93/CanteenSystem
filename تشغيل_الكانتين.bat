@echo off
cd /d "%~dp0"
title Canteen System - Military Hospital
color 0A

echo ===============================================================================
echo   Canteen System - Hospital Server
echo ===============================================================================
echo.
echo Starting Server and opening browser...
echo.

start "" http://localhost:8000
node backend/src/index.js

if errorlevel 1 (
    echo.
    echo ===============================================================================
    echo [ERROR] Node.js is not recognized or server stopped!
    echo Please make sure Node.js is installed on this PC.
    echo ===============================================================================
)

echo.
pause