# Tarang Expense Intelligence - PowerShell Launcher
$ErrorActionPreference = "Stop"

$workspaceRoot = $PSScriptRoot
$env:PATH = "D:\swb\shell\bin;D:\swb\shell\lib\Python3.13;D:\swb\shell\lib\Python3.13\DLLs;D:\;$env:PATH"
$env:PYTHONPATH = $workspaceRoot

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "   Starting Tarang Expense Intelligence (Backend + Frontend)       " -ForegroundColor Yellow
Write-Host "====================================================================" -ForegroundColor Cyan

# Check if ports are already listening
$port8000 = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if (-not $port8000) {
    Write-Host "[1/2] Launching Backend on http://127.0.0.1:8000 ..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PATH = 'D:\swb\shell\bin;D:\swb\shell\lib\Python3.13;D:\swb\shell\lib\Python3.13\DLLs;D:\;$env:PATH'; `$env:PYTHONPATH = '$workspaceRoot'; cd '$workspaceRoot'; python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"
    Start-Sleep -Seconds 3
} else {
    Write-Host "[1/2] Backend is ALREADY running on http://127.0.0.1:8000" -ForegroundColor Yellow
}

$port5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
if (-not $port5173) {
    Write-Host "[2/2] Launching Frontend on http://localhost:5173 ..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PATH = 'D:\;D:\node.exe;$env:PATH'; cd '$workspaceRoot\frontend'; npm run dev -- --host 127.0.0.1 --port 5173"
    Start-Sleep -Seconds 3
} else {
    Write-Host "[2/2] Frontend is ALREADY running on http://localhost:5173" -ForegroundColor Yellow
}

Write-Host "`nOpening http://localhost:5173 in default browser..." -ForegroundColor Cyan
Start-Process "http://localhost:5173"

Write-Host "`n====================================================================" -ForegroundColor Cyan
Write-Host "   Both services are LIVE:" -ForegroundColor Green
Write-Host "   • Web App:    http://localhost:5173" -ForegroundColor White
Write-Host "   • API Docs:   http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "   • Health:     http://127.0.0.1:8000/api/health" -ForegroundColor White
Write-Host "====================================================================" -ForegroundColor Cyan
