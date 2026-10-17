@echo off
title LePraMim - baixar bibliotecas opcionais
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0baixar-bibliotecas.ps1"
echo.
pause
