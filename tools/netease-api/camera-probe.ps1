# camera-probe.ps1 - wallpaper11 camera in-use probe (ASCII only)
# Detection is hardware-signal based and does NOT touch the camera:
# it reads each Camera-class device's PnP power-state property
# (DEVPKEY_Device_PowerData). USB video devices sleep (S3) while idle
# and wake to D0 when a capture session actually streams - including
# background watchers (e.g. Seewo classroom remote view).
# Isolated from device names/vendors: any Camera class device counts.
#
# Prints one line per tick to stdout: <0|1>|<method>
#   method: none  = no Camera-class device present
#           power = a camera device is awake (D0) - stream in use
#           idle  = camera present, all devices asleep
#
# Runs as a long-lived child of the Music Bridge (node server.js spawns it)
# and exits by itself when its parent process disappears.
# Use -Once to print a single status and exit (debugging).

param([switch]$Once)

$ErrorActionPreference = 'SilentlyContinue'

function Get-PowerState($instanceId) {
    $prop = Get-PnpDeviceProperty -InstanceId $instanceId -KeyName 'DEVPKEY_Device_PowerData'
    if ($prop -and $prop.Data -is [byte[]] -and $prop.Data.Count -ge 8) {
        return [System.BitConverter]::ToUInt32($prop.Data, 4)
    }
    return -1
}

function Test-CameraInUse {
    $cameras = @(Get-PnpDevice -Class 'Camera' -PresentOnly)
    if ($cameras.Count -eq 0) { return '0|none' }
    foreach ($camera in $cameras) {
        $state = Get-PowerState $camera.InstanceId
        if ($state -eq 1) { return '1|power' }   # D0 wake: the camera is streaming
    }
    return '0|idle'
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
