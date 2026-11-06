@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>&1
if not errorlevel 1 (
  node.exe server.js --open
  exit /b
)
set "GAME_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%GAME_NODE%" (
  "%GAME_NODE%" server.js --open
  exit /b
)
echo Node.js 22 or newer is required. Install Node.js and run this launcher again.
pause
