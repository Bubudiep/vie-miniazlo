# Script to start PocketBase server
# Run this to start the backend

Write-Host "Starting PocketBase server..." -ForegroundColor Green

Set-Location -Path "pocketbase"

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
