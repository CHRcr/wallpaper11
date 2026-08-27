[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName PresentationFramework
$tempRoot = Join-Path $env:TEMP ("wallpaper11-music-" + [guid]::NewGuid().ToString("N"))

try {
    New-Item -ItemType Directory -Path $tempRoot | Out-Null
    Expand-Archive -LiteralPath (Join-Path $PSScriptRoot "payload.zip") -DestinationPath $tempRoot -Force
    & (Join-Path $tempRoot "install.ps1") -Bundled
    [System.Windows.MessageBox]::Show(
        "Music Bridge is installed and running.`nYou can manage it from the wallpaper settings.",
        "wallpaper11 Music Bridge",
        [System.Windows.MessageBoxButton]::OK,
        [System.Windows.MessageBoxImage]::Information
    ) | Out-Null
} catch {
    [System.Windows.MessageBox]::Show(
        $_.Exception.Message,
        "wallpaper11 Music Bridge - Installation failed",
        [System.Windows.MessageBoxButton]::OK,
        [System.Windows.MessageBoxImage]::Error
    ) | Out-Null
    exit 1
} finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
