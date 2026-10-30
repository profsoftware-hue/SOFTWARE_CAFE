@echo off
title CCP Pereira - Backend (API)
cd /d "%~dp0backend"
echo ==========================================
echo  CCP Pereira - API Backend
echo  http://localhost:8000
echo  Swagger: http://localhost:8000/docs
echo ==========================================
echo.
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
