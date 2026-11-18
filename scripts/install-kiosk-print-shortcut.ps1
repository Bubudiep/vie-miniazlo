$launcher = Join-Path $PSScriptRoot "start-kiosk-print.cmd"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "H2 Billiards.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcher
$shortcut.WorkingDirectory = Split-Path $launcher
$shortcut.Description = "Mở H2 Billiards và in bill trực tiếp"
$shortcut.Save()

Write-Host "Đã tạo shortcut: $shortcutPath"
