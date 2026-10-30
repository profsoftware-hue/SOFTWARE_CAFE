@echo off
setlocal
title CCP Pereira - POS impresión directa
set "URL=http://localhost:5173/pos"
set "PROFILE=%LOCALAPPDATA%\CCP-Pereira-POS"
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "CHROME86=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
set "EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set "EDGE64=C:\Program Files\Microsoft\Edge\Application\msedge.exe"

echo Abriendo POS en modo de impresion directa...
echo La impresora usada sera la predeterminada de Windows.
echo.

if exist "%CHROME%" (
  start "" "%CHROME%" --kiosk-printing --disable-print-preview --new-window --user-data-dir="%PROFILE%" "%URL%"
  exit /b 0
)
if exist "%CHROME86%" (
  start "" "%CHROME86%" --kiosk-printing --disable-print-preview --new-window --user-data-dir="%PROFILE%" "%URL%"
  exit /b 0
)
if exist "%EDGE%" (
  start "" "%EDGE%" --kiosk-printing --disable-print-preview --new-window --user-data-dir="%PROFILE%" "%URL%"
  exit /b 0
)
if exist "%EDGE64%" (
  start "" "%EDGE64%" --kiosk-printing --disable-print-preview --new-window --user-data-dir="%PROFILE%" "%URL%"
  exit /b 0
)

echo No se encontro Chrome ni Edge.
echo Instala Google Chrome o Microsoft Edge y vuelve a intentar.
pause
