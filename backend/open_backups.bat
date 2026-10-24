@echo off
if "%~1"=="" (
    start "" "%~dp0backups"
) else (
    if exist "%~dp0backups\%~1" (
        start "" "%~dp0backups"
    ) else if exist "%~1" (
        start "" "%~1"
    ) else (
        start "" "%~dp0backups"
    )
)
exit /b 0
