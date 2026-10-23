const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// 1. تشغيل_الكانتين.bat
const startCanteen = [
  '@echo off',
  'chcp 65001 >nul',
  'title منظومة إدارة الكانتين والمطبخ - المستشفى العسكري',
  'color 0A',
  '',
  'cd /d "%~dp0"',
  '',
  'where node >nul 2>&1',
  'if errorlevel 1 goto :NO_NODE',
  '',
  'echo ===============================================================================',
  'echo        المستشفى العسكري ق.م بالإسماعيلية - منظومة إدارة الكانتين والمطبخ',
  'echo ===============================================================================',
  'echo.',
  'echo جاري تشغيل السيرفر الموحد وفتح المتصفح تلقائيا...',
  'echo.',
  '',
  'start "" http://localhost:8000',
  'node backend/src/index.js',
  '',
  'echo.',
  'echo تم إيقاف السيرفر.',
  'pause',
  'exit /b 0',
  '',
  ':NO_NODE',
  'echo.',
  'echo ===============================================================================',
  'echo [تنبيه هام] محرك Node.js غير مثبت على هذا الجهاز!',
  'echo يرجى تثبيت Node.js أولا لتشغيل المنظومة.',
  'echo ===============================================================================',
  'echo.',
  'pause',
  'exit /b 1'
].join('\r\n');

// 2. فتح_الشبكة_Firewall.bat
const firewallBat = [
  '@echo off',
  'chcp 65001 >nul',
  'title إعدادات جدار حماية ويندوز - منفذ 8000',
  'color 0B',
  '',
  'echo ===============================================================================',
  'echo   المستشفى العسكري ق.م بالإسماعيلية - إعدادات جدار حماية ويندوز للشبكة',
  'echo ===============================================================================',
  'echo.',
  'echo جاري إضافة قاعدة سماح للمنفذ 8000 في جدار الحماية Windows Firewall...',
  'echo.',
  '',
  'net session >nul 2>&1',
  'if errorlevel 1 goto :NOT_ADMIN',
  '',
  'netsh advfirewall firewall delete rule name="Canteen_System_Port_8000" >nul 2>&1',
  'netsh advfirewall firewall add rule name="Canteen_System_Port_8000" dir=in action=allow protocol=TCP localport=8000 profile=any >nul 2>&1',
  '',
  'echo.',
  'echo [نجاح] تم فتح المنفذ 8000 بنجاح في جدار حماية ويندوز!',
  'echo الآن يمكن لأي جهاز كمبيوتر أو شاشة كاشير أو موبايل على نفس الشبكة',
  'echo فتح المنظومة بكل سهولة وسرعة وبدون أي حظر.',
  'echo.',
  'echo ===============================================================================',
  'pause',
  'exit /b 0',
  '',
  ':NOT_ADMIN',
  'echo.',
  'echo ===============================================================================',
  'echo [تنبيه هام] يرجى تشغيل هذا الملف كمسؤول Run as administrator!',
  'echo اضغط كليك يمين على هذا الملف واختر:',
  'echo "تشغيل كمسؤول / Run as administrator"',
  'echo ===============================================================================',
  'echo.',
  'pause',
  'exit /b 1'
].join('\r\n');

// 3. run.bat & تشغيل_النظام.bat
const runDev = [
  '@echo off',
  'chcp 65001 >nul',
  'title تشغيل نظام الكانتين - وضع التطوير',
  'color 0B',
  '',
  'cd /d "%~dp0"',
  '',
  'where node >nul 2>&1',
  'if errorlevel 1 goto :NO_NODE',
  '',
  'echo ======================================================',
  'echo       جاري تشغيل نظام إدارة الكانتين - وضع التطوير',
  'echo ======================================================',
  'echo 1. تشغيل خادم الباك إند على Port 8000...',
  'start "Canteen Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"',
  '',
  'echo 2. تشغيل واجهة الفرونت إند على Port 5173...',
  'start "Canteen Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"',
  '',
  'echo.',
  'echo ======================================================',
  'echo تم تشغيل الباك إند والفرونت إند بنجاح!',
  'echo رابط النظام في المتصفح: http://localhost:5173',
  'echo ======================================================',
  'timeout /t 3 >nul',
  'start http://localhost:5173',
  'exit /b 0',
  '',
  ':NO_NODE',
  'echo.',
  'echo [تنبيه] محرك Node.js غير مثبت على هذا الجهاز!',
  'pause',
  'exit /b 1'
].join('\r\n');

fs.writeFileSync(path.join(root, 'تشغيل_الكانتين.bat'), startCanteen, 'utf8');
fs.writeFileSync(path.join(root, 'فتح_الشبكة_Firewall.bat'), firewallBat, 'utf8');
fs.writeFileSync(path.join(root, 'run.bat'), runDev, 'utf8');
fs.writeFileSync(path.join(root, 'تشغيل_النظام.bat'), runDev, 'utf8');

console.log('All .bat files updated with CRLF and safe syntax successfully.');
