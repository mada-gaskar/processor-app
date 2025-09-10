@echo off
setlocal
title Popo2 - Start
chcp 65001 >nul

REM Ensure we are in the project directory
cd /d "%~dp0"

REM Install dependencies on first run if node_modules is missing
if not exist "node_modules" (
  echo [Popo2] Installing dependencies...
  npm install
  if errorlevel 1 (
    echo [Popo2] Failed to install dependencies. Press any key to exit.
    pause >nul
    exit /b 1
  )
)

echo [Popo2] Starting development server and Electron...
npm run dev

if errorlevel 1 (
  echo [Popo2] The app exited with errors. Press any key to close.
  pause >nul
) else (
  echo [Popo2] The app has stopped. Press any key to close.
  pause >nul
)