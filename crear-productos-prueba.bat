@echo off
title CCP Pereira - Crear productos de prueba
cd /d "%~dp0backend"
echo ==========================================
echo  Creando productos de prueba (prefijo TEST-)
echo ==========================================
echo.
python scripts/seed_test_products.py
echo.
echo Puedes verlos en: http://localhost:5173/productos
pause
