const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// 1. تشغيل_الكانتين.bat (Ultra clean, no chcp 65001 to avoid Raster Font crash)
const startCanteen = [
  '@echo off',
  'cd /d "%~dp0"',
  'title Canteen System - Military Hospital',
  'color 0A',
  '',
  'echo ===============================================================================',
  'echo   Canteen System - Hospital Server',
  'echo ===============================================================================',
  'echo.',
  'echo Starting Server and opening browser...',
  'echo.',
  '',
  'start "" http://localhost:8000',
  'node backend/src/index.js',
  '',
  'if errorlevel 1 (',
  '    echo.',
  '    echo ===============================================================================',
  '    echo [ERROR] Node.js is not recognized or server stopped!',
  '    echo Please make sure Node.js is installed on this PC.',
  '    echo ===============================================================================',
  ')',
  '',
  'echo.',
  'pause'
].join('\r\n');

// 2. فتح_الشبكة_Firewall.bat
const firewallBat = [
  '@echo off',
  'cd /d "%~dp0"',
  'title Windows Firewall - Port 8000',
  'color 0B',
  '',
  'echo ===============================================================================',
  'echo   Configuring Windows Firewall for Port 8000...',
  'echo ===============================================================================',
  'echo.',
  '',
  'net session >nul 2>&1',
  'if errorlevel 1 (',
  '    echo [ERROR] Please run this file as Administrator!',
  '    echo Right click this file and select: Run as administrator',
  '    echo.',
  '    pause',
  '    exit /b 1',
  ')',
  '',
  'netsh advfirewall firewall delete rule name="Canteen_System_Port_8000" >nul 2>&1',
  'netsh advfirewall firewall add rule name="Canteen_System_Port_8000" dir=in action=allow protocol=TCP localport=8000 profile=any',
  '',
  'echo.',
  'echo [SUCCESS] Port 8000 is now open in Windows Firewall!',
  'echo You can now access the system from other PCs and mobile devices on the network.',
  'echo ===============================================================================',
  'pause'
].join('\r\n');

// 3. run.bat & تشغيل_النظام.bat
const runDev = [
  '@echo off',
  'cd /d "%~dp0"',
  'title Canteen System - Dev Mode',
  'color 0B',
  '',
  'echo Starting Dev Server...',
  'start "Canteen Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"',
  'start "Canteen Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"',
  'timeout /t 3 >nul',
  'start http://localhost:5173'
].join('\r\n');

fs.writeFileSync(path.join(root, 'تشغيل_الكانتين.bat'), startCanteen, 'utf8');
fs.writeFileSync(path.join(root, 'فتح_الشبكة_Firewall.bat'), firewallBat, 'utf8');
fs.writeFileSync(path.join(root, 'run.bat'), runDev, 'utf8');
fs.writeFileSync(path.join(root, 'تشغيل_النظام.bat'), runDev, 'utf8');

console.log('Successfully updated all batch files without chcp 65001 to prevent device write error.');
