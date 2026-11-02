# Run from the billiard folder: .\scripts\start-dev-backend.ps1

if (-not (Test-Path "pocketbase\pocketbase.exe")) {
    Write-Error "pocketbase\pocketbase.exe not found. Run this script from the billiard folder."
    exit 1
}

try {
    Invoke-WebRequest -Uri "http://127.0.0.1:8390/api/health" -TimeoutSec 2 -ErrorAction Stop | Out-Null
    Write-Host "PocketBase is already running at http://127.0.0.1:8390"
    exit 0
} catch {
    Write-Host "Starting PocketBase at http://127.0.0.1:8390..."
}

$pbProcess = Start-Process -FilePath (Resolve-Path "pocketbase\pocketbase.exe") `
    -ArgumentList "serve", "--http=127.0.0.1:8390" `
    -WorkingDirectory (Resolve-Path "pocketbase") `
    -PassThru

Start-Sleep -Seconds 3
try {
    Invoke-WebRequest -Uri "http://127.0.0.1:8390/api/health" -TimeoutSec 2 -ErrorAction Stop | Out-Null
    Write-Host "PocketBase started (PID: $($pbProcess.Id)). Admin UI: http://127.0.0.1:8390/_/"
} catch {
    Write-Error "PocketBase failed to start. Check the PocketBase process output."
    exit 1
}
