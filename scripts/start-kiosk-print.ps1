param(
  [string]$Url = "https://h2.chamcongchua.com"
)

$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) {
  throw "Không tìm thấy Google Chrome. Hãy cài Chrome trên máy quầy rồi chạy lại."
}

$profile = Join-Path $env:LOCALAPPDATA "H2Billiards\ChromeProfile"
Start-Process -FilePath $chrome -ArgumentList @(
  "--kiosk-printing",
  "--app=$Url",
  "--user-data-dir=$profile"
)
