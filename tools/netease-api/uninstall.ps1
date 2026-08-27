[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

if (-not $env:LOCALAPPDATA) {
    throw "LOCALAPPDATA is not available."
}

$appRoot = Join-Path $env:LOCALAPPDATA "wallpaper11"
$installDir = Join-Path $appRoot "music-bridge"
$pidFile = Join-Path $installDir "bridge.pid"
$serverPath = Join-Path $installDir "server.js"
$shortcutPath = Join-Path ([Environment]::GetFolderPath("Startup")) "wallpaper11 Music Bridge.lnk"
$logPath = Join-Path $appRoot "music-bridge.log"
$musicCookiePath = Join-Path $appRoot "music-cookie.txt"
$uninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\wallpaper11 Music Bridge"

# The installed script may be launched by the bridge while its working directory
# is the install directory. Move away before removing that directory.
Set-Location $env:TEMP

if (Test-Path -LiteralPath $pidFile) {
    $savedPid = 0
    if ([int]::TryParse((Get-Content -LiteralPath $pidFile -Raw).Trim(), [ref]$savedPid)) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $savedPid" -ErrorAction SilentlyContinue
        if ($process -and $process.CommandLine -and
            $process.CommandLine.IndexOf($serverPath, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
            Stop-Process -Id $savedPid -Force
            Wait-Process -Id $savedPid -Timeout 5 -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 250
        }
    }
}

if (Test-Path -LiteralPath $shortcutPath) {
    Remove-Item -LiteralPath $shortcutPath -Force
}

if (Test-Path -LiteralPath $uninstallKey) {
    Remove-Item -LiteralPath $uninstallKey -Recurse -Force
}

if (Test-Path -LiteralPath $installDir) {
    $resolvedRoot = [IO.Path]::GetFullPath($appRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
    $resolvedInstall = [IO.Path]::GetFullPath($installDir)
    if (-not $resolvedInstall.StartsWith($resolvedRoot + [IO.Path]::DirectorySeparatorChar,
            [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove an unexpected install path."
    }
    Remove-Item -LiteralPath $installDir -Recurse -Force
}

if (Test-Path -LiteralPath $logPath) {
    Remove-Item -LiteralPath $logPath -Force
}
if (Test-Path -LiteralPath $musicCookiePath) {
    Remove-Item -LiteralPath $musicCookiePath -Force
}
if (Test-Path -LiteralPath $appRoot) {
    $remaining = Get-ChildItem -LiteralPath $appRoot -Force -ErrorAction SilentlyContinue
    if (-not $remaining) {
        Remove-Item -LiteralPath $appRoot -Force
    }
}

Write-Host "[wallpaper11] Music Bridge was removed."
