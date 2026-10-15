param(
  [string]$MediaDir = (Join-Path $PSScriptRoot 'media'),
  [int]$Fps = 10,
  [int]$Width = 960,
  [int]$Quality = 62
)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
 Write-Host 'FFmpeg not found. Install: winget install Gyan.FFmpeg, then RESTART PowerShell.' -ForegroundColor Red
 exit 1
}
$names = @('01-entrance','02-blessings-mehndi','03-mehndi-barat','04-barat-walima','05-walima-farewell')
$root = Join-Path $MediaDir 'sequences'
New-Item -ItemType Directory -Force -Path $root | Out-Null
$manifest = @{}
foreach ($name in $names) {
 $inputPath = Join-Path $MediaDir "$name.mp4"
 if (-not (Test-Path -LiteralPath $inputPath)) { throw "Missing MP4: $inputPath" }
 $outDir = Join-Path $root $name
 New-Item -ItemType Directory -Force -Path $outDir | Out-Null
 Get-ChildItem -LiteralPath $outDir -Filter '*.webp' | Remove-Item -Force
 Write-Host "Extracting $name at $Fps fps, width $Width ..." -ForegroundColor Cyan
 $outputPattern = Join-Path $outDir '%04d.webp'
 & ffmpeg -hide_banner -loglevel error -y -i $inputPath -vf "fps=$Fps,scale=${Width}:-2:flags=lanczos" -c:v libwebp -quality $Quality -compression_level 5 -start_number 0 $outputPattern
 if ($LASTEXITCODE -ne 0) { throw "FFmpeg failed for $name" }
 $count = @(Get-ChildItem -LiteralPath $outDir -Filter '*.webp').Count
 if ($count -lt 2) { throw "Too few frames generated for $name" }
 $manifest[$name] = @{ count = $count; fps = $Fps }
 Write-Host "  $count frames" -ForegroundColor Green
}
[System.IO.File]::WriteAllText((Join-Path $root 'manifest.json'), ($manifest | ConvertTo-Json -Depth 4), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Done. Frames: $root" -ForegroundColor Green
Write-Host "Upload the 'sequences' folder into your GitHub repository's media/ directory."
