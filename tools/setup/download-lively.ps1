[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Local,
    [string]$DestDir = ""
)

$ErrorActionPreference = "Stop"

$appRoot = Join-Path $env:LOCALAPPDATA "wallpaper11"
$logPath = Join-Path $appRoot "lively-install.log"

function Log-Info {
    param([string]$Message)
    try {
        New-Item -ItemType Directory -Path $appRoot -Force | Out-Null
        Add-Content -LiteralPath $logPath -Value ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message) -Encoding ASCII
    } catch { }
    Write-Host "[wallpaper11] $Message"
}

Log-Info "Lively install step started (Local=$Local)"

if ($DestDir -eq "") {
    $DestDir = Join-Path $env:TEMP ("lively-setup-" + [guid]::NewGuid().ToString("N"))
}
New-Item -ItemType Directory -Path $DestDir -Force | Out-Null

$setupPath = Join-Path $DestDir "lively_setup_x86_full_v2210.exe"

if (-not (Test-Path -LiteralPath $Local)) {
    throw "Bundled Lively installer is missing: $Local"
}
Log-Info "Copying embedded Lively installer..."
$sw = [System.Diagnostics.Stopwatch]::StartNew()
Copy-Item -LiteralPath $Local -Destination $setupPath -Force
$sw.Stop()
Log-Info ("Copied in {0:n1}s ({1:n0} MB)" -f $sw.Elapsed.TotalSeconds, ((Get-Item -LiteralPath $setupPath).Length / 1MB))

Log-Info "Installing Lively Wallpaper (VERYSILENT); this installs VC++ and .NET runtimes too..."
Log-Info "If a Windows permission prompt appears, click Yes; the installer waits for it."
$process = Start-Process -FilePath $setupPath -ArgumentList "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART" -PassThru
if (-not $process.WaitForExit(600000)) {
    try { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue } catch { }
    Log-Info "ERROR: Lively installer did not finish within 600 seconds."
    Remove-Item -LiteralPath $DestDir -Recurse -Force -ErrorAction SilentlyContinue
    throw "Lively installer timed out; the Windows permission prompt may be waiting."
}
Log-Info "Lively installer exited with code $($process.ExitCode)."
if ($process.ExitCode -ne 0) {
    Log-Info "ERROR: Lively installer failed."
    Remove-Item -LiteralPath $DestDir -Recurse -Force -ErrorAction SilentlyContinue
    throw "Lively installer exited with code $($process.ExitCode)."
}

Log-Info "Lively Wallpaper installed."
Remove-Item -LiteralPath $DestDir -Recurse -Force -ErrorAction SilentlyContinue
