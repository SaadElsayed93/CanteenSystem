@echo off
chcp 65001 > nul
title السماح للمنظومة عبر جدار حماية ويندوز (Windows Firewall)
color 0B

echo ===============================================================================
echo   المستشفى العسكري ق.م بالإسماعيلية - إعدادات جدار حماية ويندوز للشبكة
echo ===============================================================================
echo.
echo  جاري إضافة قاعدة سماح للمنفذ 8000 (Port 8000) في جدار الحماية (Windows Firewall)...
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [تنبيه هام] يرجى تشغيل هذا الملف كمسؤول (Run as administrator) لفتح المنفذ!
    echo  اضغط كليك يمين على هذا الملف واختر:
    echo  "تشغيل كمسؤول / Run as administrator"
    echo.
    pause
    exit /b 1
)

netsh advfirewall firewall delete rule name="Canteen_System_Port_8000" >nul 2>&1
netsh advfirewall firewall add rule name="Canteen_System_Port_8000" dir=in action=allow protocol=TCP localport=8000 profile=any >nul 2>&1

if %errorlevel% equ 0 (
    echo.
    echo  [نجاح] تم فتح المنفذ 8000 بنجاح في جدار حماية ويندوز!
    echo  الآن يمكن لأي جهاز كمبيوتر أو شاشة كاشير أو موبايل على نفس الشبكة
    echo  فتح المنظومة بكل سهولة وسرعة وبدون أي حظر.
) else (
    echo.
    echo  [تنبيه] لم تتم إضافة القاعدة. تأكد من تشغيل الملف كمسؤول.
)

echo.
echo ===============================================================================
pause
