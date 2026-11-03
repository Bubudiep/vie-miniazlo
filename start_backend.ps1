# Script to start PocketBase server
# Run this to start the backend

Write-Host "Starting PocketBase server..." -ForegroundColor Green

$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^\s*SEPAY_WEBHOOK_SECRET\s*=\s*(.+?)\s*$') {
            $env:SEPAY_WEBHOOK_SECRET = $matches[1].Trim().Trim('"').Trim("'")
        }
    }
}

Set-Location -Path (Join-Path $PSScriptRoot "pocketbase")

# Kill existing PocketBase process if running
$processes = Get-Process -Name "pocketbase" -ErrorAction SilentlyContinue
if ($processes) {
    Write-Host "Stopping existing PocketBase process..." -ForegroundColor Yellow
    $processes | Stop-Process -Force
    Start-Sleep -Seconds 2
}

# Run migrations first
Write-Host "Running migrations..." -ForegroundColor Cyan
.\pocketbase.exe migrate

# Start PocketBase
Write-Host "Starting PocketBase on http://127.0.0.1:8390" -ForegroundColor Cyan
Write-Host "Admin UI: http://127.0.0.1:8390/_/" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
.\pocketbase.exe serve --http="127.0.0.1:8390"
