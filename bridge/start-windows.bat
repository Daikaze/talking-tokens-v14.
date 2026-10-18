@echo off
setlocal
title Talking Tokens Discord Bridge
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not on PATH.
  echo Install Node.js 24.17 or newer from https://nodejs.org/
  pause
  exit /b 1
)
if not exist ".env" (
  if not exist ".env.example" (
    echo [ERROR] Missing .env.example.
    pause
    exit /b 1
  )
  copy /y ".env.example" ".env" >nul
  echo Created .env file. Edit the Discord token, server ID and voice channel ID.
  echo %~dp0.env
  pause
  exit /b 1
)
if not exist "node_modules\@discordjs\voice" (
  echo Installing Node packages for the first run...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)
echo Starting Talking Tokens voice bridge...
call npm start
echo.
echo [Bridge] Stopped. Review the messages above if it failed.
pause
