[CmdletBinding()]
param(
    [string]$LivelyZip = "",
    [string]$BridgeZip = ""
)

$ErrorActionPreference = "Stop"

$script:LivelyUninstallKeys = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{E3E43E1B-DEC8-44BF-84A6-243DBA3F2CB1}_is1",
    "HKCU:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\{E3E43E1B-DEC8-44BF-84A6-243DBA3F2CB1}_is1",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{E3E43E1B-DEC8-44BF-84A6-243DBA3F2CB1}_is1",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\{E3E43E1B-DEC8-44BF-84A6-243DBA3F2CB1}_is1"
)
$script:AppRoot = Join-Path $env:LOCALAPPDATA "wallpaper11"
$script:LogPath = Join-Path $script:AppRoot "wallpaper11-install.log"

function Log-Info {
    param([string]$Message)
    try {
        New-Item -ItemType Directory -Path $script:AppRoot -Force | Out-Null
        Add-Content -LiteralPath $script:LogPath -Value ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message) -Encoding ASCII
    } catch { }
    Write-Host "[wallpaper11] $Message"
}

function Read-Json {
    param([string]$Path)
    Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Set-JsonIntegerProperty {
    param([object]$Object, [string]$Name, [int]$Value)
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) {
        $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value
    } else {
        $property.Value = $Value
    }
}

function Get-LivelyExe {
    foreach ($key in $script:LivelyUninstallKeys) {
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

function Get-LivelyMajor {
    param([string]$Exe)
    try {
        $fileVersion = (Get-Item -LiteralPath $Exe).VersionInfo.FileVersion
        $major = [int]($fileVersion -split "\.")[0]
        return $major
    } catch { }
    return 2
}

function Stop-Lively {
    param([string]$Exe)
    if (-not (Test-Path -LiteralPath $Exe)) { return }
    if (-not (Test-LivelyPipe)) {
        Log-Info "No running Lively instance detected; skip shutdown."
        return
    }
    Log-Info "Lively is running; requesting shutdown..."
    try {
        & $Exe "--shutdown" "true" | Out-Null
    } catch { }
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if (-not (Get-Process -Name "Lively" -ErrorAction SilentlyContinue)) { return }
        Start-Sleep -Milliseconds 500
    }
}

$script:PipeName = "Grpc_LIVELY:DESKTOPWALLPAPERSYSTEM" + $env:USERNAME

function Test-LivelyPipe {
    param([int]$TimeoutMs = 400)
    try {
        $client = New-Object System.IO.Pipes.NamedPipeClientStream(".", $script:PipeName, [System.IO.Pipes.PipeDirection]::InOut)
        $client.Connect($TimeoutMs)
        $client.Dispose()
        return $true
    } catch {
        return $false
    }
}

function Start-LivelyAndWaitReady {
    param([string]$Exe, [int]$WaitSeconds = 40)
    if (-not (Test-LivelyPipe)) {
        Log-Info "Starting Lively main instance..."
        Start-Process -FilePath $Exe -WindowStyle Hidden | Out-Null
    }
    $swatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($swatch.Elapsed.TotalSeconds -lt $WaitSeconds) {
        if (Test-LivelyPipe) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Set-LivelyFocusPauseSettings {
    param([string]$Exe)
    $appDataDir = Join-Path $env:LOCALAPPDATA "Lively Wallpaper"
    $settingsPath = Join-Path $appDataDir "Settings.json"

    if (-not (Test-Path -LiteralPath $settingsPath)) {
        Log-Info "Lively settings are not initialized; starting Lively once..."
        if (-not (Start-LivelyAndWaitReady -Exe $Exe -WaitSeconds 40)) {
            throw "Lively did not initialize Settings.json."
        }
        Start-Sleep -Milliseconds 750
        Stop-Lively -Exe $Exe
    }
    if (-not (Test-Path -LiteralPath $settingsPath)) {
        throw "Lively Settings.json was not found at '$settingsPath'."
    }

    $settings = Read-Json -Path $settingsPath
    # Lively enum value 0 means pause. Foreground monitoring makes Windows focus,
    # rather than wallpaper coverage area, the single source of pause decisions.
    Set-JsonIntegerProperty -Object $settings -Name "AppFocusPause" -Value 0
    Set-JsonIntegerProperty -Object $settings -Name "AppFullscreenPause" -Value 0
    Set-JsonIntegerProperty -Object $settings -Name "ProcessMonitorAlgorithm" -Value 0

    $tempPath = Join-Path $appDataDir "Settings.wallpaper11.tmp.json"
    try {
        $json = $settings | ConvertTo-Json -Depth 100 -Compress
        $utf8 = New-Object System.Text.UTF8Encoding($false)
        [IO.File]::WriteAllText($tempPath, $json, $utf8)
        $verified = Read-Json -Path $tempPath
        if ([int]$verified.AppFocusPause -ne 0 -or
            [int]$verified.AppFullscreenPause -ne 0 -or
            [int]$verified.ProcessMonitorAlgorithm -ne 0) {
            throw "Lively focus pause settings failed verification."
        }
        Move-Item -LiteralPath $tempPath -Destination $settingsPath -Force
    } finally {
        Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
    }
    Log-Info "Configured Lively to pause for the Windows foreground application."
}

function Test-WallpaperApplied {
    param([string]$Target)
    $layoutPath = Join-Path $env:LOCALAPPDATA "Lively Wallpaper\WallpaperLayout.json"
    if (-not (Test-Path -LiteralPath $layoutPath)) { return $false }
    try {
        $layout = Read-Json -Path $layoutPath
        foreach ($entry in $layout) {
            if ($entry.LivelyInfoPath -and
                $entry.LivelyInfoPath.Equals($Target, [StringComparison]::OrdinalIgnoreCase)) {
                return $true
            }
        }
    } catch { }
    return $false
}

function Apply-Wallpaper {
    param([string]$Exe, [string]$Target, [int]$Major)
    for ($attempt = 1; $attempt -le 4; $attempt++) {
        if (-not (Start-LivelyAndWaitReady -Exe $Exe -WaitSeconds 40)) {
            Log-Info "WARNING: Lively RPC pipe not ready on attempt $attempt."
            continue
        }
        if ($Major -lt 2) {
            Log-Info "Applying wallpaper (legacy --wallpaper)..."
            & $Exe "--wallpaper" $Target
        } else {
            Log-Info "Applying wallpaper via Lively setwp (attempt $attempt)..."
            & $Exe "setwp" "--file" $Target
        }
        $swatch = [System.Diagnostics.Stopwatch]::StartNew()
        while ($swatch.Elapsed.TotalSeconds -lt 12) {
            if (Test-WallpaperApplied -Target $Target) {
                Log-Info "Wallpaper switch confirmed (WallpaperLayout.json)."
                return $true
            }
            Start-Sleep -Milliseconds 500
        }
        Log-Info "WARNING: wallpaper switch not confirmed on attempt $attempt; retrying."
    }
    return $false
}

function Expand-Zip {
    param([string]$ZipPath, [string]$Destination)
    Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction Stop
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $Destination)
    $sw.Stop()
    return $sw.Elapsed
}

Log-Info "Install started (LivelyZip=$LivelyZip, BridgeZip=$BridgeZip)"

$bridgeDir = Join-Path $script:AppRoot "bridge"
$bridgeOk = $true

if (-not (Test-Path -LiteralPath $BridgeZip)) {
    Log-Info "WARNING: bridge-payload.zip is missing; skipping Music Bridge."
    $bridgeOk = $false
} else {
    Log-Info "Extracting Music Bridge payload..."
    if (Test-Path -LiteralPath $bridgeDir) {
        if (-not $bridgeDir.StartsWith($script:AppRoot, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to replace an unexpected bridge path."
        }
        Remove-Item -LiteralPath $bridgeDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $bridgeDir -Force | Out-Null
    try {
        $elapsed = Expand-Zip -ZipPath $BridgeZip -Destination $bridgeDir
        Log-Info ("Bridge payload extracted in {0:n1}s" -f $elapsed.TotalSeconds)
    } catch {
        Log-Info "ERROR: cannot extract bridge payload: $($_.Exception.Message)"
        $bridgeOk = $false
    }
    if ($bridgeOk) {
        Log-Info "Installing Music Bridge..."
        try {
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $bridgeDir "install.ps1") -Bundled
            if ($LASTEXITCODE -ne 0) {
                Log-Info "WARNING: Music Bridge install failed (exit code $LASTEXITCODE); continuing."
                $bridgeOk = $false
            } else {
                Log-Info "Music Bridge installed and running on 127.0.0.1:16311."
            }
        } catch {
            Log-Info "WARNING: Music Bridge install failed ($($_.Exception.Message)); continuing."
            $bridgeOk = $false
        }
    }
    if (-not $bridgeOk) {
        try { Remove-Item -LiteralPath $bridgeDir -Recurse -Force } catch { }
    }
}

$exe = Get-LivelyExe
if (-not $exe) {
    throw "Lively Wallpaper is not installed and could not be found."
}
if (-not (Test-Path -LiteralPath $LivelyZip)) {
    throw "wallpaper11-lively.zip is missing."
}

Log-Info "Stopping Lively for wallpaper import..."
Stop-Lively -Exe $exe
Set-LivelyFocusPauseSettings -Exe $exe

$wallpaperDir = Get-WallpaperDir
$wallpapersRoot = Join-Path $wallpaperDir "wallpapers"
$target = Join-Path $wallpapersRoot "wallpaper11"

if (Test-Path -LiteralPath $target) {
    $infoPath = Join-Path $target "LivelyInfo.json"
    $isOurs = $false
    if (Test-Path -LiteralPath $infoPath) {
        try {
            $metadata = Read-Json -Path $infoPath
            $isOurs = ($metadata.Title -eq "wallpaper11")
        } catch { }
    }
    if (-not $isOurs) {
        throw "The Lively library folder '$target' is not wallpaper11-owned; refusing to replace it."
    }
    Remove-Item -LiteralPath $target -Recurse -Force
}

New-Item -ItemType Directory -Path $wallpapersRoot -Force | Out-Null
Log-Info "Extracting wallpaper package (this includes local media files)..."
try {
    $elapsed = Expand-Zip -ZipPath $LivelyZip -Destination $target
    Log-Info ("Wallpaper extracted in {0:n1}s" -f $elapsed.TotalSeconds)
} catch {
    if (Test-Path -LiteralPath $target) {
        Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue
    }
    throw "Cannot unpack wallpaper package: $($_.Exception.Message)"
}
Log-Info "wallpaper11 copied to $target"

$major = Get-LivelyMajor -Exe $exe
$applied = Apply-Wallpaper -Exe $exe -Target $target -Major $major
if (-not $applied) {
    throw "wallpaper11 was installed but Lively did not apply it automatically; try clicking it in the Lively library."
}

Log-Info "Collapsing Lively window..."
try {
    & $exe "app" "--showApp" "false"
} catch { }

Log-Info "Install finished."
if (-not $bridgeOk) { Log-Info "Note: Music Bridge needs attention, see messages above." }
