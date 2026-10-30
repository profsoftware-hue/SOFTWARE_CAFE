@echo off
setlocal
title CCP Pereira - POS kiosco (impresion silenciosa)
set "URL=http://localhost:5173/pos"
set "PROFILE=%LOCALAPPDATA%\CCP-Pereira-POS-Kiosk"
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "CHROME86=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
set "EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set "EDGE64=C:\Program Files\Microsoft\Edge\Application\msedge.exe"

echo Abriendo POS en modo kiosco con impresion silenciosa...
echo Usa Alt+F4 para cerrar la ventana.
echo.

if exist "%CHROME%" (
  start "" "%CHROME%" --kiosk --kiosk-printing --user-data-dir="%PROFILE%" "%URL%"
  exit /b 0
)
if exist "%CHROME86%" (
  start "" "%CHROME86%" --kiosk --kiosk-printing --user-data-dir="%PROFILE%" "%URL%"
  exit /b 0
)
if exist "%EDGE%" (
  start "" "%EDGE%" --kiosk --kiosk-printing --user-data-dir="%PROFILE%" "%URL%"
  exit /b 0
)
if exist "%EDGE64%" (
  start "" "%EDGE64%" --kiosk --kiosk-printing --user-data-dir="%PROFILE%" "%URL%"
  exit /b 0
)

echo No se encontro Chrome ni Edge.
pause
