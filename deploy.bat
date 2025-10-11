@echo off
echo 🚀 Запуск локального деплоя TrailSpot
echo.

REM Проверяем наличие PowerShell
powershell -Command "if (Get-Command ssh -ErrorAction SilentlyContinue) { Write-Host '✅ SSH найден' -ForegroundColor Green } else { Write-Host '❌ SSH не найден. Установите OpenSSH' -ForegroundColor Red; exit 1 }"

REM Запускаем деплой
powershell -ExecutionPolicy Bypass -File "deploy_local.ps1"

pause
