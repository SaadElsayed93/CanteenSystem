@echo off
cd /d "%~dp0"
title Windows Firewall - Port 8000
color 0B

echo ===============================================================================
echo   Configuring Windows Firewall for Port 8000...
echo ===============================================================================
echo.

net session >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Please run this file as Administrator!
    echo Right click this file and select: Run as administrator
    echo.
    pause
    exit /b 1
)

netsh advfirewall firewall delete rule name="Canteen_System_Port_8000" >nul 2>&1
netsh advfirewall firewall add rule name="Canteen_System_Port_8000" dir=in action=allow protocol=TCP localport=8000 profile=any

echo.
echo [SUCCESS] Port 8000 is now open in Windows Firewall!
echo You can now access the system from other PCs and mobile devices on the network.
echo ===============================================================================
pause