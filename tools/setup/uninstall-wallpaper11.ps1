[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"

$appRoot = Join-Path $env:LOCALAPPDATA "wallpaper11"
$bridgeDir = Join-Path $appRoot "bridge"
$bridgeUninstall = Join-Path $bridgeDir "uninstall.ps1"

function Read-Json {
    param([string]$Path)
    Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Get-LivelyExe {
    $keys = @(
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{E3E43E1B-DEC8-44BF-84A6-243DBA3F2CB1}_is1",
        "HKCU:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\{E3E43E1B-DEC8-44BF-84A6-243DBA3F2CB1}_is1",
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{E3E43E1B-DEC8-44BF-84A6-243DBA3F2CB1}_is1",
        "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\{E3E43E1B-DEC8-44BF-84A6-243DBA3F2CB1}_is1"
    )
    foreach ($key in $keys) {
        if (Test-Path -LiteralPath $key) {
            $location = (Get-ItemProperty -LiteralPath $key -ErrorAction SilentlyContinue).InstallLocation
            if ($location -and (Test-Path -LiteralPath (Join-Path $location "Lively.exe"))) {
                return (Join-Path $location "Lively.exe")
            }
        }
    }
    $candidates = @(
        (Join-Path "$env:LOCALAPPDATA\Programs\Lively Wallpaper" "Lively.exe"),
        (Join-Path "$env:ProgramFiles\Lively Wallpaper" "Lively.exe"),
        (Join-Path (Join-Path ${env:ProgramFiles(x86)} "Lively Wallpaper") "Lively.exe")
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    return ""
}

function Get-WallpaperDir {
    $appDataDir = Join-Path $env:LOCALAPPDATA "Lively Wallpaper"
    $settingsPath = Join-Path $appDataDir "Settings.json"
    if (Test-Path -LiteralPath $settingsPath) {
        try {
            $settings = Read-Json -Path $settingsPath
            if ($settings.wallpaperDir) { return $settings.wallpaperDir }
        } catch { }
    }
    return (Join-Path $appDataDir "Library")
}

Set-Location $env:TEMP

if (Test-Path -LiteralPath $bridgeUninstall) {
    try {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $bridgeUninstall
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Music Bridge uninstaller exited with code $LASTEXITCODE."
        }
    } catch {
        Write-Warning "Music Bridge uninstall failed: $($_.Exception.Message)"
    }
} else {
    $pidFile = Join-Path $bridgeDir "bridge.pid"
    if (Test-Path -LiteralPath $pidFile) {
        try {
            $savedPid = [int](Get-Content -LiteralPath $pidFile -Raw).Trim()
            Stop-Process -Id $savedPid -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 250
        } catch { }
    }
}

$startupShortcut = Join-Path ([Environment]::GetFolderPath("Startup")) "wallpaper11 Music Bridge.lnk"
Remove-Item -LiteralPath $startupShortcut -Force -ErrorAction SilentlyContinue

$exe = Get-LivelyExe
if ($exe) {
    try {
        & $exe "closewp" "--monitor" "-1" | Out-Null
        Start-Sleep -Milliseconds 500
        & $exe "--shutdown" "true" | Out-Null
    } catch { }
}

$wallpaperDir = Get-WallpaperDir
$target = Join-Path $wallpaperDir "wallpapers" "wallpaper11"
if (Test-Path -LiteralPath $target) {
    $infoPath = Join-Path $target "LivelyInfo.json"
    $isOurs = $false
    if (Test-Path -LiteralPath $infoPath) {
        try {
            $metadata = Read-Json -Path $infoPath
            $isOurs = ($metadata.Title -eq "wallpaper11")
        } catch { }
    }
    if ($isOurs) {
        Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue
    } else {
        Write-Warning "Leaving unexpected Lively library folder in place: $target"
    }
}

Remove-Item -LiteralPath (Join-Path $appRoot "music-cookie.txt") -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $appRoot "music-bridge.log") -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $appRoot "music-uninstall.log") -Force -ErrorAction SilentlyContinue

Write-Host "[wallpaper11] wallpaper11 removal completed."
