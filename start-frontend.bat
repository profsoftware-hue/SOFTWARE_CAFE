@echo off
title CCP Pereira - Frontend (Web)
cd /d "%~dp0frontend"
echo ==========================================
echo  CCP Pereira - Frontend Web
echo  http://localhost:5173
echo ==========================================
echo.
call npm run dev
pause
