@echo off
chcp 65001 >nul
title تشغيل نظام الكانتين (Canteen System - وضع التطوير)
echo ======================================================
echo       جاري تشغيل نظام إدارة الكانتين (وضع التطوير)
echo ======================================================
echo 1. تشغيل خادم الباك إند (Port 8000)...
start "Canteen Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo 2. تشغيل واجهة الفرونت إند (Port 5173)...
start "Canteen Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ======================================================
echo تم تشغيل الباك إند والفرونت إند بنجاح!
echo رابط النظام في المتصفح: http://localhost:5173
echo ======================================================
timeout /t 3 >nul
start http://localhost:5173
