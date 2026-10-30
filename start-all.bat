@echo off
title CCP Pereira - Iniciando sistema
echo ==========================================
echo  Iniciando CCP Pereira (Backend + Frontend)
echo ==========================================
echo.
start "CCP Pereira - Backend" cmd /k "%~dp0start-backend.bat"
timeout /t 3 /nobreak >nul
start "CCP Pereira - Frontend" cmd /k "%~dp0start-frontend.bat"
timeout /t 5 /nobreak >nul
start "" http://localhost:5173
exit
