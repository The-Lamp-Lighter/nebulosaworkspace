@echo off
title LePraMim - servidor local
echo.
echo  LePraMim - iniciando o servidor local (somente neste computador)...
echo  Mantenha esta janela aberta enquanto usa o programa.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor-local.ps1"
if errorlevel 1 pause
