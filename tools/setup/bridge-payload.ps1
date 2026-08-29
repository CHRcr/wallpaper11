[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$OutZip
)

$ErrorActionPreference = "Stop"

$sourceDir = Join-Path (Split-Path -Parent $PSScriptRoot) "netease-api"
$distRoot = Split-Path -Parent (Split-Path -Parent $sourceDir)
$workRoot = Join-Path $distRoot ".setup-build\bridge-payload"
$payloadRoot = Join-Path $workRoot "payload"
$runtimeRoot = Join-Path $payloadRoot "runtime"

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $nodeCommand -or -not $npmCommand) {
    throw "Node.js and npm are required to build the bridge payload."
}

if (Test-Path -LiteralPath $workRoot) {
    $resolvedDist = [IO.Path]::GetFullPath($distRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
    $resolvedWork = [IO.Path]::GetFullPath($workRoot)
    if (-not $resolvedWork.StartsWith($resolvedDist + [IO.Path]::DirectorySeparatorChar,
            [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to replace an unexpected build path."
    }
    Remove-Item -LiteralPath $workRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $payloadRoot -Force | Out-Null
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null

Write-Host "[wallpaper11] Preparing Music Bridge dependencies..."
Push-Location $sourceDir
try {
    & $npmCommand.Source ci --omit=dev
    if ($LASTEXITCODE -ne 0) {
        throw "npm ci failed with exit code $LASTEXITCODE."
    }
} finally {
    Pop-Location
}

$files = @(
    "package.json",
    "package-lock.json",
    "server.js",
    "camera-probe.ps1",
    "install.ps1",
    "uninstall.ps1",
    "status.ps1",
    "run-hidden.cmd",
    "start-hidden.vbs",
    "uninstall-hidden.vbs"
)
foreach ($file in $files) {
    Copy-Item -LiteralPath (Join-Path $sourceDir $file) -Destination $payloadRoot
}
Copy-Item -LiteralPath (Join-Path $sourceDir "node_modules") -Destination $payloadRoot -Recurse
Copy-Item -LiteralPath $nodeCommand.Source -Destination (Join-Path $runtimeRoot "node.exe")

$nodeVersion = (& $nodeCommand.Source -p "process.version").Trim().TrimStart("v")
$licenseUrl = "https://raw.githubusercontent.com/nodejs/node/v$nodeVersion/LICENSE"
$licenseTarget = Join-Path $runtimeRoot "NODE-LICENSE.txt"
try {
    Invoke-WebRequest -UseBasicParsing -Uri $licenseUrl -OutFile $licenseTarget -TimeoutSec 30
} catch {
    $localLicense = Join-Path (Split-Path -Parent $nodeCommand.Source) "LICENSE"
    if (Test-Path -LiteralPath $localLicense) {
        Copy-Item -LiteralPath $localLicense -Destination $licenseTarget
    } else {
        Write-Host "[wallpaper11] Warning: license download skipped (no network, no local license)."
    }
}

$outDir = Split-Path -Parent $OutZip
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
if (Test-Path -LiteralPath $OutZip) {
    Remove-Item -LiteralPath $OutZip -Force
}
Write-Host "[wallpaper11] Compressing self-contained bridge runtime..."
Compress-Archive -Path (Join-Path $payloadRoot "*") -DestinationPath $OutZip -CompressionLevel Optimal
Remove-Item -LiteralPath $workRoot -Recurse -Force

$sizeMb = [math]::Round((Get-Item -LiteralPath $OutZip).Length / 1MB, 1)
Write-Host "[wallpaper11] Bridge payload -> $OutZip ($sizeMb MB)"
