@echo off
setlocal
echo [1/4] Pulling latest code...
git pull
if errorlevel 1 goto end
echo [2/4] Installing deps...
npm install
if errorlevel 1 goto end
echo [3/4] Stopping old bot (node.exe)...
for /f "tokens=2 delims=," %%A in ('tasklist /FI "IMAGENAME eq node.exe" /FO CSV ^| find /I "node.exe"') do taskkill /F /PID %%~A >nul 2>&1
echo [4/4] Starting bot...
start "HellLadder Bot" cmd /c "npm start"
:end
pause
