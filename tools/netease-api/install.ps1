[CmdletBinding()]
param(
    [switch]$Bundled
)

$ErrorActionPreference = "Stop"

if (-not $env:LOCALAPPDATA) {
    throw "LOCALAPPDATA is not available."
}

$sourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appRoot = Join-Path $env:LOCALAPPDATA "wallpaper11"
$installDir = Join-Path $appRoot "music-bridge"
$pidFile = Join-Path $installDir "bridge.pid"
$startupDir = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupDir "wallpaper11 Music Bridge.lnk"
$serverPath = Join-Path $installDir "server.js"
$bridgeVersion = (Get-Content -LiteralPath (Join-Path $sourceDir "package.json") -Raw |
    ConvertFrom-Json).version

function Stop-InstalledBridge {
    if (-not (Test-Path -LiteralPath $pidFile)) {
        return
    }

    $savedPid = 0
    if (-not [int]::TryParse((Get-Content -LiteralPath $pidFile -Raw).Trim(), [ref]$savedPid)) {
        return
    }

    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $savedPid" -ErrorAction SilentlyContinue
    if ($process -and $process.CommandLine -and
        $process.CommandLine.IndexOf($serverPath, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
        Stop-Process -Id $savedPid -Force
        Wait-Process -Id $savedPid -Timeout 5 -ErrorAction SilentlyContinue
    }
}

$bundledNode = Join-Path $sourceDir "runtime\node.exe"
$bundledModules = Join-Path $sourceDir "node_modules"
$nodeCommand = $null
$npmCommand = $null
if ($Bundled) {
    if (-not (Test-Path -LiteralPath $bundledNode) -or
        -not (Test-Path -LiteralPath $bundledModules)) {
        throw "The installer payload is incomplete."
    }
} else {
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $nodeCommand -or -not $npmCommand) {
        throw "Node.js and npm are required. Use wallpaper11-music-setup.exe for a self-contained install."
    }
}

Write-Host "[wallpaper11] Installing Music Bridge..."
Stop-InstalledBridge
Start-Sleep -Milliseconds 250

if (Test-Path -LiteralPath $installDir) {
    $resolvedRoot = [IO.Path]::GetFullPath($appRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
    $resolvedInstall = [IO.Path]::GetFullPath($installDir)
    if (-not $resolvedInstall.StartsWith($resolvedRoot + [IO.Path]::DirectorySeparatorChar,
            [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to replace an unexpected install path."
    }
    Remove-Item -LiteralPath $installDir -Recurse -Force
}

New-Item -ItemType Directory -Path $installDir -Force | Out-Null
$files = @(
    "package.json",
    "package-lock.json",
    "server.js",
    "run-hidden.cmd",
    "start-hidden.vbs",
    "status.ps1",
    "uninstall.ps1"
)
foreach ($file in $files) {
    Copy-Item -LiteralPath (Join-Path $sourceDir $file) -Destination $installDir
}

if ($Bundled) {
    Copy-Item -LiteralPath (Join-Path $sourceDir "runtime") -Destination $installDir -Recurse
    Copy-Item -LiteralPath $bundledModules -Destination $installDir -Recurse
} else {
    Push-Location $installDir
    try {
        & $npmCommand.Source ci --omit=dev
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci failed with exit code $LASTEXITCODE."
        }
    } finally {
        Pop-Location
    }
}

$wscript = Join-Path $env:WINDIR "System32\wscript.exe"
$vbsPath = Join-Path $installDir "start-hidden.vbs"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $wscript
$shortcut.Arguments = '"' + $vbsPath + '"'
$shortcut.WorkingDirectory = $installDir
$shortcut.Description = "wallpaper11 local Music Bridge"
$shortcut.Save()

$uninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\wallpaper11 Music Bridge"
$uninstallScript = Join-Path $installDir "uninstall.ps1"
$uninstallCommand = 'powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $uninstallScript + '"'
$estimatedSize = [math]::Ceiling(((Get-ChildItem -LiteralPath $installDir -Recurse -File |
    Measure-Object -Property Length -Sum).Sum) / 1KB)
New-Item -Path $uninstallKey -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name "DisplayName" -Value "wallpaper11 Music Bridge" -PropertyType String -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name "DisplayVersion" -Value $bridgeVersion -PropertyType String -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name "Publisher" -Value "CHRcr" -PropertyType String -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name "InstallLocation" -Value $installDir -PropertyType String -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name "UninstallString" -Value $uninstallCommand -PropertyType String -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name "QuietUninstallString" -Value $uninstallCommand -PropertyType String -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name "NoModify" -Value 1 -PropertyType DWord -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name "NoRepair" -Value 1 -PropertyType DWord -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name "EstimatedSize" -Value $estimatedSize -PropertyType DWord -Force | Out-Null

Start-Process -FilePath $wscript -ArgumentList ('"' + $vbsPath + '"') -WindowStyle Hidden

$health = $null
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 250
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:16311/health" -TimeoutSec 1
        if ($health.ok) {
            break
        }
    } catch {
        $health = $null
    }
}

if (-not $health -or -not $health.ok) {
    throw "Music Bridge was installed but did not start. Check $appRoot\music-bridge.log"
}

Write-Host "[wallpaper11] Music Bridge is running on http://127.0.0.1:16311"
Write-Host "[wallpaper11] It will start silently when this user signs in."
