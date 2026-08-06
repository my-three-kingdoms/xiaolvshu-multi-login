@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install the current LTS release, then run this file again.
  pause
  exit /b 1
)

if not exist "node_modules\playwright-core\package.json" (
  echo Installing the first-run dependency...
  call npm ci
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

start "Xiaolvshu Dashboard" http://127.0.0.1:8790
npm run dashboard
pause
