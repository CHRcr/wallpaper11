$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$appRoot = Join-Path $projectRoot "app"
$distRoot = Join-Path $projectRoot "dist"
$zipPath = Join-Path $distRoot "wallpaper11-lively.zip"

& node (Join-Path $PSScriptRoot "prepare-lively-media.js")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& node (Join-Path $PSScriptRoot "check-lively.js")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

New-Item -ItemType Directory -Path $distRoot -Force | Out-Null
if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -Path (Join-Path $appRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal
Write-Host "[wallpaper11] Lively package -> $zipPath"
