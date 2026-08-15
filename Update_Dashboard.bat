@echo off
setlocal
title YMR Dashboard - Refresh Data
cd /d "%~dp0"

echo ===============================================
echo  YMR Dashboard - refreshing data from Excel
echo ===============================================
echo.

where python >nul 2>nul
if errorlevel 1 (
    where py >nul 2>nul
    if errorlevel 1 (
        echo ERROR: Python was not found on this machine.
        echo.
        echo Install Python from https://www.python.org/downloads/
        echo ^(tick "Add python.exe to PATH" during setup^), then run this
        echo file again.
        echo.
        pause
        exit /b 1
    ) else (
        set "PYCMD=py"
    )
) else (
    set "PYCMD=python"
)

%PYCMD% -c "import openpyxl" >nul 2>nul
if errorlevel 1 (
    echo Installing required package "openpyxl" ^(one-time setup^)...
    %PYCMD% -m pip install --quiet openpyxl
    if errorlevel 1 (
        echo ERROR: failed to install openpyxl. Run manually:
        echo     %PYCMD% -m pip install openpyxl
        pause
        exit /b 1
    )
)

echo Reading Data\YMR.xlsx ...
%PYCMD% "scripts\refresh_data.py"
if errorlevel 1 (
    echo.
    echo ERROR: data refresh failed - see message above.
    pause
    exit /b 1
)

echo.
echo Opening dashboard in Chrome...
set "DASHBOARD=%~dp0dashboard.html"

where chrome >nul 2>nul
if not errorlevel 1 (
    start "" chrome "%DASHBOARD%"
    goto :done
)

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

echo Chrome was not found automatically - opening with the default browser instead.
start "" "%DASHBOARD%"

:done
echo.
echo Done. The dashboard tab will refresh automatically if it was already open
echo ^(press Ctrl+R / F5 on it after this window finishes^).
timeout /t 3 >nul
endlocal
