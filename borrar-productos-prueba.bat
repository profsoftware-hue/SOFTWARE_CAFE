@echo off
title CCP Pereira - Borrar productos de prueba
cd /d "%~dp0backend"
echo ==========================================
echo  Borrar TODOS los datos de prueba (TEST-)
echo ==========================================
echo.
echo Se eliminaran productos TEST-, sus movimientos de inventario,
echo items de ventas/compras/ajustes y documentos que queden vacios.
echo.
set /p CONFIRM="Escribe SI para continuar: "
if /i not "%CONFIRM%"=="SI" (
  echo.
  echo Cancelado. No se borro nada.
  pause
  exit /b 0
)
echo.
python scripts/cleanup_test_data.py
pause
