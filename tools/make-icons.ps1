# make-icons.ps1 - draw wallpaper11 icon (dusk plum + gold note) via System.Drawing
# outputs: src-tauri/icons/*.png + icon.ico
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot '..\host\src-tauri\icons'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function New-IconBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)

  $u = $size / 256.0   # unit scale

  # rounded square, plum gradient
  $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $r = 56 * $u
  $d = $r * 2
  $path.AddArc(0, 0, $d, $d, 180, 90)
  $path.AddArc($size - $d, 0, $d, $d, 270, 90)
  $path.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
  $path.AddArc(0, $size - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 62, 30, 54),
    [System.Drawing.Color]::FromArgb(255, 34, 18, 36),
    115.0)
  $g.FillPath($brush, $path)

  $gold = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 207, 156))
  $pen  = New-Object System.Drawing.Pen -ArgumentList $gold, ([single](13 * $u))
  $pen.StartCap = 'Round'; $pen.EndCap = 'Round'

  # note stem + beam
  $g.DrawLine($pen, 100 * $u, 186 * $u, 100 * $u, 84 * $u)
  $g.DrawLine($pen, 172 * $u, 174 * $u, 172 * $u, 72 * $u)
  $g.DrawLine($pen, 100 * $u, 84 * $u, 172 * $u, 72 * $u)
  # two note heads
  $g.FillEllipse($gold, (62 * $u), (168 * $u), (38 * $u), (30 * $u))
  $g.FillEllipse($gold, (134 * $u), (156 * $u), (38 * $u), (30 * $u))

  $g.Dispose()
  return ,$bmp
}

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$pngBytes = @{}
foreach ($s in $sizes) {
  $bmp = New-IconBitmap $s
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngBytes[$s] = $ms.ToArray()
  $bmp.Dispose()
  $ms.Dispose()
}

# individual pngs for tauri
[System.IO.File]::WriteAllBytes((Join-Path $outDir '32x32.png'), $pngBytes[32])
[System.IO.File]::WriteAllBytes((Join-Path $outDir '128x128.png'), $pngBytes[128])
[System.IO.File]::WriteAllBytes((Join-Path $outDir '128x128@2x.png'), $pngBytes[256])
[System.IO.File]::WriteAllBytes((Join-Path $outDir 'icon.png'), $pngBytes[256])

# icon.ico: PNG-compressed entries (Vista+)
$icoEntries = @(16, 32, 48, 256)
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
$bw.Write([uint16]0)                 # reserved
$bw.Write([uint16]1)                 # type: icon
$bw.Write([uint16]$icoEntries.Count)
$offset = 6 + 16 * $icoEntries.Count
foreach ($s in $icoEntries) {
  $data = $pngBytes[$s]
  $bw.Write([byte]($(if ($s -ge 256) { 0 } else { $s })))  # width (0 = 256)
  $bw.Write([byte]($(if ($s -ge 256) { 0 } else { $s })))  # height
  $bw.Write([byte]0)                 # palette
  $bw.Write([byte]0)                 # reserved
  $bw.Write([uint16]1)               # planes
  $bw.Write([uint16]32)              # bpp
  $bw.Write([uint32]$data.Length)
  $bw.Write([uint32]$offset)
  $offset += $data.Length
}
foreach ($s in $icoEntries) { $bw.Write($pngBytes[$s]) }
$bw.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $outDir 'icon.ico'), $ms.ToArray())

Write-Output "icons -> $outDir"
