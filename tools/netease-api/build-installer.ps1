[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$sourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $sourceDir)
$distRoot = Join-Path $projectRoot "dist"
$workRoot = Join-Path $distRoot ".music-installer-build"
$payloadRoot = Join-Path $workRoot "payload"
$runtimeRoot = Join-Path $payloadRoot "runtime"
$payloadZip = Join-Path $workRoot "payload.zip"
$sedPath = Join-Path $workRoot "music-bridge.sed"
$outputPath = Join-Path $distRoot "wallpaper11-music-setup.exe"
$iexpress = Join-Path $env:WINDIR "System32\iexpress.exe"

if (-not (Test-Path -LiteralPath $iexpress)) {
    throw "IExpress is not available on this Windows installation."
}

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $nodeCommand -or -not $npmCommand) {
    throw "Node.js and npm are required to build the installer."
}

New-Item -ItemType Directory -Path $distRoot -Force | Out-Null
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
    "install.ps1",
    "uninstall.ps1",
    "status.ps1",
    "run-hidden.cmd",
    "start-hidden.vbs"
)
foreach ($file in $files) {
    Copy-Item -LiteralPath (Join-Path $sourceDir $file) -Destination $payloadRoot
}
Copy-Item -LiteralPath (Join-Path $sourceDir "node_modules") -Destination $payloadRoot -Recurse
Copy-Item -LiteralPath $nodeCommand.Source -Destination (Join-Path $runtimeRoot "node.exe")

$nodeVersion = (& $nodeCommand.Source -p "process.version").Trim().TrimStart("v")
$licenseUrl = "https://raw.githubusercontent.com/nodejs/node/v$nodeVersion/LICENSE"
Invoke-WebRequest -UseBasicParsing -Uri $licenseUrl -OutFile (Join-Path $runtimeRoot "NODE-LICENSE.txt")

Write-Host "[wallpaper11] Compressing self-contained runtime..."
Compress-Archive -Path (Join-Path $payloadRoot "*") -DestinationPath $payloadZip -CompressionLevel Optimal
Copy-Item -LiteralPath (Join-Path $sourceDir "installer-bootstrap.ps1") -Destination $workRoot

$sourceWithSlash = $workRoot.TrimEnd("\") + "\"
$sed = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=0
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=%InstallPrompt%
DisplayLicense=%DisplayLicense%
FinishMessage=%FinishMessage%
TargetName=%TargetName%
FriendlyName=%FriendlyName%
AppLaunched=%AppLaunched%
PostInstallCmd=%PostInstallCmd%
AdminQuietInstCmd=%AdminQuietInstCmd%
UserQuietInstCmd=%UserQuietInstCmd%
SourceFiles=SourceFiles
[Strings]
InstallPrompt=Install wallpaper11 Music Bridge?
DisplayLicense=
FinishMessage=
TargetName=$outputPath
FriendlyName=wallpaper11 Music Bridge
AppLaunched=powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File installer-bootstrap.ps1
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=
FILE0="installer-bootstrap.ps1"
FILE1="payload.zip"
[SourceFiles]
SourceFiles0=$sourceWithSlash
[SourceFiles0]
%FILE0%=
%FILE1%=
"@
Set-Content -LiteralPath $sedPath -Value $sed -Encoding ASCII

if (Test-Path -LiteralPath $outputPath) {
    Remove-Item -LiteralPath $outputPath -Force
}
Write-Host "[wallpaper11] Building single-file installer..."
$launchTime = Get-Date
& $iexpress /N $sedPath

$iexpressProcess = $null
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    $iexpressProcess = Get-Process iexpress -ErrorAction SilentlyContinue |
        Where-Object { $_.StartTime -ge $launchTime.AddSeconds(-2) } |
        Sort-Object StartTime -Descending |
        Select-Object -First 1
    if ($iexpressProcess) { break }
    Start-Sleep -Milliseconds 250
}
if (-not $iexpressProcess) {
    throw "IExpress did not start."
}
Wait-Process -Id $iexpressProcess.Id -Timeout 180 -ErrorAction SilentlyContinue

if ((Get-Process -Id $iexpressProcess.Id -ErrorAction SilentlyContinue) -or
    -not (Test-Path -LiteralPath $outputPath)) {
    throw "IExpress failed to create the installer."
}

$sizeMb = [math]::Round((Get-Item -LiteralPath $outputPath).Length / 1MB, 1)
Remove-Item -LiteralPath $workRoot -Recurse -Force
Write-Host "[wallpaper11] Music Bridge installer -> $outputPath ($sizeMb MB)"
