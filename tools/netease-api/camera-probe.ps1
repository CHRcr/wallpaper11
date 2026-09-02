# camera-probe.ps1 - wallpaper11 camera in-use probe (ASCII only)
# Detection reads Windows privacy access-session records and never opens the
# camera. Device power state is intentionally ignored because integrated
# classroom cameras may remain in D0 even when no application is capturing.
# LastUsedTimeStart newer than LastUsedTimeStop (or an empty stop time) means
# Windows still has an active webcam access session.
#
# Prints one line per tick to stdout: <0|1>|<method>
#   method: none  = no Camera-class device present
#           session = an active Windows webcam access session exists
#           idle    = access records exist, none are active
#
# Runs as a long-lived child of the Music Bridge (node server.js spawns it)
# and exits by itself when its parent process disappears.
# Use -Once to print a single status and exit (debugging).

param([switch]$Once)

$ErrorActionPreference = 'SilentlyContinue'

function Convert-ToInt64($value) {
    if ($null -eq $value) { return [int64]0 }
    try { return [Convert]::ToInt64($value) } catch { return [int64]0 }
}

function Test-CameraInUse {
    $roots = @(
        'Registry::HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\webcam',
        'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\webcam'
    )
    $hasRecords = $false

    foreach ($root in $roots) {
        if (-not (Test-Path -LiteralPath $root)) { continue }
        $keys = @((Get-Item -LiteralPath $root)) + @(Get-ChildItem -LiteralPath $root -Recurse)
        foreach ($key in $keys) {
            if (-not $key) { continue }
            $record = Get-ItemProperty -LiteralPath $key.PSPath
            $start = Convert-ToInt64 $record.LastUsedTimeStart
            $stop = Convert-ToInt64 $record.LastUsedTimeStop
            if ($start -le 0) { continue }
            $hasRecords = $true
            if ($stop -le 0 -or $start -gt $stop) { return '1|session' }
        }
    }

    if ($hasRecords) { return '0|idle' }
    return '0|none'
}

function Write-Status {
    [Console]::Out.WriteLine((Test-CameraInUse))
    [Console]::Out.Flush()
}

if ($Once) {
    Write-Status
    exit
}

$parentPid = 0
try {
    $info = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $PID)
    if ($info) { $parentPid = [int]$info.ParentProcessId }
} catch {
    $parentPid = 0
}

while ($true) {
    Write-Status
    Start-Sleep -Seconds 1
    if ($parentPid -gt 0) {
        try {
            $null = [System.Diagnostics.Process]::GetProcessById($parentPid)
        } catch {
            break
        }
    }
}
