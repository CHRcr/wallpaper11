[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$scriptDir = $PSScriptRoot
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)
$distRoot = Join-Path $projectRoot "dist"
$buildRoot = Join-Path $distRoot ".setup-build"
$issWorkRoot = Join-Path $buildRoot "iss"
$livelyCacheDir = Join-Path $buildRoot "lively"
$innoPortableDir = Join-Path $buildRoot "inno-portable"

$LivelySetupName = "lively_setup_x86_full_v2210.exe"
$LivelyVersion = "2.2.1.0"
$LivelyUrl = "https://github.com/rocksdanister/lively/releases/download/v$LivelyVersion/$LivelySetupName"
$InnoPortableUrl = "https://github.com/jrsoftware/issrc/releases/download/is-7_1_0/innosetup-7.1.0-x64.exe"
$InnoPortableInstaller = Join-Path $buildRoot "innosetup-7.1.0-x64.exe"
$InnoIslBase = "https://raw.githubusercontent.com/jrsoftware/issrc/is-7_1_0/Files/Languages/Unofficial"

function Ensure-InnoLanguageFiles {
    param([string]$Iscc)
    $innoRoot = Split-Path -Parent $Iscc
    $languagesDir = Join-Path $innoRoot "Languages"
    New-Item -ItemType Directory -Path $languagesDir -Force | Out-Null
    foreach ($suffix in @("ChineseSimplified", "ChineseTraditional")) {
        $target = Join-Path $languagesDir "$suffix.isl"
        if (Test-Path -LiteralPath $target) { continue }
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -UseBasicParsing -Uri "$InnoIslBase/$suffix.isl" -OutFile $target -TimeoutSec 120
            $bytes = [IO.File]::ReadAllBytes($target)
            if ($bytes.Length -lt 3 -or $bytes[0] -ne 0xEF -or $bytes[1] -ne 0xBB -or $bytes[2] -ne 0xBF) {
                $utf8WithBom = New-Object System.Text.UTF8Encoding($true)
                [IO.File]::WriteAllText($target, [IO.File]::ReadAllText($target), $utf8WithBom)
            }
        } catch {
            Write-Host "[wallpaper11] Warning: could not fetch $suffix.isl for Inno Setup."
        }
    }
}

function Get-PackageVersion {
    $package = Get-Content -LiteralPath (Join-Path $projectRoot "package.json") -Raw | ConvertFrom-Json
    return $package.version
}

function Find-ISCC {
    if ($env:ISCC -and (Test-Path -LiteralPath $env:ISCC)) { return $env:ISCC }
    $candidates = @(
        "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
        "$env:ProgramFiles\Inno Setup 7\ISCC.exe",
        "${env:ProgramFiles(x86)}\Inno Setup 7\ISCC.exe",
        "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    $command = Get-Command iscc.exe -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    return ""
}

function Bootstrap-InnoPortable {
    New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null
    Write-Host "[wallpaper11] Downloading Inno Setup portable..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -UseBasicParsing -Uri $InnoPortableUrl -OutFile $InnoPortableInstaller -TimeoutSec 1200
    $target = Join-Path $innoPortableDir "Inno Setup"
    $process = Start-Process -FilePath $InnoPortableInstaller `
        -ArgumentList "/PORTABLE=1", "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/DIR=`"$target`"" `
        -PassThru -Wait
    if ($process.ExitCode -ne 0) {
        throw "Inno Setup portable install exited with code $($process.ExitCode)."
    }
    return (Join-Path $target "ISCC.exe")
}

function Get-LivelySetupFile {
    if ($env:LIVELY_SETUP_EXE -and (Test-Path -LiteralPath $env:LIVELY_SETUP_EXE)) {
        Write-Host "[wallpaper11] Using LIVELY_SETUP_EXE: $env:LIVELY_SETUP_EXE"
        return $env:LIVELY_SETUP_EXE
    }
    $downloads = Join-Path ([Environment]::GetFolderPath("UserProfile")) "Downloads"
    $downloadsCandidate = Join-Path $downloads $LivelySetupName
    if (Test-Path -LiteralPath $downloadsCandidate) {
        Write-Host "[wallpaper11] Using Downloads cache: $downloadsCandidate"
        return $downloadsCandidate
    }
    $cached = Join-Path $livelyCacheDir "lively_setup_x86_full_v2210.exe"
    if (Test-Path -LiteralPath $cached) {
        Write-Host "[wallpaper11] Using build cache: $cached"
        return $cached
    }
    New-Item -ItemType Directory -Path $livelyCacheDir -Force | Out-Null
    Write-Host "[wallpaper11] Downloading Lively Wallpaper $LivelyVersion installer (~208 MB) from GitHub..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -UseBasicParsing -Uri $LivelyUrl -OutFile $cached -TimeoutSec 7200
    return $cached
}

if (-not (Test-Path -LiteralPath $distRoot)) {
    New-Item -ItemType Directory -Path $distRoot -Force | Out-Null
}

Write-Host "[wallpaper11] Step 1/5: building Lively wallpaper package..."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $projectRoot "tools\package-lively.ps1")
if ($LASTEXITCODE -ne 0) { throw "package-lively.ps1 failed with exit code $LASTEXITCODE." }

Write-Host "[wallpaper11] Step 2/5: building bridge-payload.zip..."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $scriptDir "bridge-payload.ps1") -OutZip (Join-Path $distRoot "bridge-payload.zip")
if ($LASTEXITCODE -ne 0) { throw "bridge-payload.ps1 failed with exit code $LASTEXITCODE." }

$payloadRoot = Join-Path $issWorkRoot "payload"
$scriptsRoot = Join-Path $issWorkRoot "scripts"
New-Item -ItemType Directory -Path $payloadRoot -Force | Out-Null
New-Item -ItemType Directory -Path $scriptsRoot -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $distRoot "wallpaper11-lively.zip") -Destination $payloadRoot -Force
Copy-Item -LiteralPath (Join-Path $distRoot "bridge-payload.zip") -Destination $payloadRoot -Force
foreach ($script in @("lively-install.ps1", "download-lively.ps1", "uninstall-wallpaper11.ps1")) {
    Copy-Item -LiteralPath (Join-Path $scriptDir $script) -Destination $scriptsRoot -Force
}

Write-Host "[wallpaper11] Step 3/5: embedding Lively installer..."
$livelySource = Get-LivelySetupFile
if (-not $livelySource) { throw "Lively installer source is missing." }
Copy-Item -LiteralPath $livelySource -Destination (Join-Path $payloadRoot $LivelySetupName) -Force

Write-Host "[wallpaper11] Step 4/5: locating Inno Setup..."
$iscc = Find-ISCC
if (-not $iscc) {
    Write-Host "[wallpaper11] Inno Setup not found; installing portable copy..."
    $iscc = Bootstrap-InnoPortable
}
if (-not (Test-Path -LiteralPath $iscc)) {
    throw "Inno Setup Compiler (ISCC.exe) was not found. Install Inno Setup 7 or point ISCC env var at ISCC.exe."
}
Ensure-InnoLanguageFiles -Iscc $iscc
Write-Host "[wallpaper11] ISCC: $iscc"

$version = Get-PackageVersion
Write-Host "[wallpaper11] Step 5/5: compiling installer (version $version)..."
$issSource = Join-Path $scriptDir "setup.iss"
$issOutput = Join-Path $issWorkRoot "setup.iss"
$content = [IO.File]::ReadAllText($issSource)
[IO.File]::WriteAllText($issOutput, $content, (New-Object System.Text.UTF8Encoding($true)))

$outputName = "wallpaper11-setup"
$arguments = @()
$arguments += "/Q"
$arguments += "/DMyAppVersion=$version"
$arguments += "/DEMBED_LIVELY"
$arguments += "/F$outputName"
$arguments += "/O$distRoot"
$arguments += $issOutput

$process = Start-Process -FilePath $iscc -ArgumentList $arguments -PassThru -Wait
if ($process.ExitCode -ne 0) {
    throw "ISCC failed with exit code $($process.ExitCode)."
}

$outputPath = Join-Path $distRoot "$outputName.exe"
if (-not (Test-Path -LiteralPath $outputPath)) {
    throw "Installer was not created: $outputPath"
}

$hash = (Get-FileHash -LiteralPath $outputPath -Algorithm SHA256).Hash
[IO.File]::WriteAllText($outputPath + ".sha256", $hash.ToLower() + "`n")

$sizeMb = [math]::Round((Get-Item -LiteralPath $outputPath).Length / 1MB, 1)
Write-Host "[wallpaper11] Unified installer -> $outputPath ($sizeMb MB)"
