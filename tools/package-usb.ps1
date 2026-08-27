[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$distRoot = Join-Path $projectRoot "dist"
$usbRoot = Join-Path $distRoot "wallpaper11-usb"

& (Join-Path $PSScriptRoot "package-lively.ps1")
& (Join-Path $PSScriptRoot "netease-api\build-installer.ps1")

if (Test-Path -LiteralPath $usbRoot) {
    $resolvedDist = [IO.Path]::GetFullPath($distRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
    $resolvedUsb = [IO.Path]::GetFullPath($usbRoot)
    if (-not $resolvedUsb.StartsWith($resolvedDist + [IO.Path]::DirectorySeparatorChar,
            [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to replace an unexpected USB package path."
    }
    Remove-Item -LiteralPath $usbRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $usbRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $distRoot "wallpaper11-lively.zip") -Destination $usbRoot
Copy-Item -LiteralPath (Join-Path $distRoot "wallpaper11-music-setup.exe") -Destination $usbRoot

$instructions = @"
wallpaper11 USB package

1. Install Lively Wallpaper.
2. Import wallpaper11-lively.zip into Lively.
3. Double-click wallpaper11-music-setup.exe for NetEase search and playback.
4. In Lively performance settings, pause when other applications are focused.

Music Bridge can be checked from the wallpaper settings or removed from
Windows Settings > Apps > Installed apps.
"@
Set-Content -LiteralPath (Join-Path $usbRoot "README.txt") -Value $instructions -Encoding UTF8
Write-Host "[wallpaper11] USB package -> $usbRoot"
