@echo off
setlocal
title YMR Dashboard - Refresh Data
cd /d "%~dp0"

echo ===============================================
echo  YMR Dashboard - refreshing data from Excel
echo ===============================================
echo.

if not exist "Data\YMR.xlsx" (
    echo ERROR: Data\YMR.xlsx was not found next to this file.
    echo Expected: %~dp0Data\YMR.xlsx
    echo.
    pause
    exit /b 1
)

if not exist "scripts\refresh_data.ps1" (
    echo ERROR: scripts\refresh_data.ps1 is missing.
    echo.
    pause
    exit /b 1
)

echo Reading Data\YMR.xlsx ...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\refresh_data.ps1"
if errorlevel 1 (
    echo.
    echo ERROR: data refresh failed - see the message above.
    echo.
    echo Most common cause: Data\YMR.xlsx is still open in Excel.
    echo Close the file in Excel and run this again.
    echo.
    pause
    exit /b 1
)

echo.
echo Opening dashboard in Chrome...
set "DASHBOARD=%~dp0dashboard.html"

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%DASHBOARD%"
    goto :done
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%DASHBOARD%"
    goto :done
)
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" "%DASHBOARD%"
    goto :done
)

rem Chrome installed somewhere else - ask the registry where it lives.
for /f "tokens=2,*" %%A in ('reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" /ve 2^>nul ^| find "REG_SZ"') do set "CHROMEEXE=%%B"
if not defined CHROMEEXE (
    for /f "tokens=2,*" %%A in ('reg query "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" /ve 2^>nul ^| find "REG_SZ"') do set "CHROMEEXE=%%B"
)
if defined CHROMEEXE (
    if exist "%CHROMEEXE%" (
        start "" "%CHROMEEXE%" "%DASHBOARD%"
        goto :done
    )
)

echo Chrome was not found automatically - opening with the default browser instead.
start "" "%DASHBOARD%"

:done
echo.
echo Done. If the dashboard was already open in a tab, press Ctrl+R on it
echo to pick up the refreshed data.
ping -n 4 127.0.0.1 >nul
endlocal
