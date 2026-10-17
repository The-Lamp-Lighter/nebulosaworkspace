@echo off
title Nebulosa Workspace - servidor local
echo.
echo  Nebulosa Workspace - iniciando o servidor local (somente neste computador)...
echo  Mantenha esta janela aberta enquanto usa os programas.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\servidor-local.ps1"
if errorlevel 1 pause
