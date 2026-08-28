# AdTraffic - one-line demo installer (Windows / PowerShell).
#
#   powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/kikiavalon/adtraffic/main/install.ps1 | iex"
#
# Downloads the public repo as a zip, makes sure Node.js is present (via winget
# when available), then hands off to scripts/demo.mjs which installs deps,
# builds, launches DEMO_MODE, and opens the browser. All behind friendly output.

$ErrorActionPreference = 'Stop'

$Repo         = 'kikiavalon/adtraffic'
$Branch       = 'main'
$Dest         = Join-Path $HOME 'AdTraffic-Demo'
$ZipUrl       = "https://github.com/$Repo/archive/refs/heads/$Branch.zip"
$MinNodeMajor = 20

Write-Host ''
Write-Host '  ----------------------------------'
Write-Host '     AdTraffic - Demo Installer'
Write-Host '  ----------------------------------'
Write-Host ''

# 1) Ensure Node.js >= MinNodeMajor -----------------------------------------
function Test-NodeOk {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return $false }
  try { $major = [int](& node -p "process.versions.node.split('.')[0]") } catch { return $false }
  return $major -ge $MinNodeMajor
}

if (-not (Test-NodeOk)) {
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Host '  Installing Node.js (this can take a few minutes)...'
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements | Out-Null
    # Refresh PATH so the freshly installed node is reachable in this session.
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('Path', 'User')
  }
  if (-not (Test-NodeOk)) {
    Write-Host '  AdTraffic needs Node.js (version 20 or newer).'
    Write-Host '  Please install the LTS version from:  https://nodejs.org/en/download'
    Write-Host '  Then run this command again.'
    Start-Process 'https://nodejs.org/en/download'
    exit 1
  }
}

# 2) Download the code (zip, no git) ----------------------------------------
if (Test-Path (Join-Path $Dest 'package.json')) {
  Write-Host "  Using your existing copy at $Dest"
  Write-Host '  (delete that folder if you want a fresh download)'
} else {
  Write-Host '  Downloading AdTraffic...'
  $zipPath     = Join-Path $env:TEMP 'adtraffic-demo.zip'
  $extractPath = Join-Path $env:TEMP 'adtraffic-demo-extract'
  Invoke-WebRequest -Uri $ZipUrl -OutFile $zipPath
  if (Test-Path $extractPath) { Remove-Item -Recurse -Force $extractPath }
  Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force
  # The zip contains a single top-level folder: adtraffic-<branch>
  $inner = Get-ChildItem -Directory $extractPath | Select-Object -First 1
  if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
  Move-Item $inner.FullName $Dest
  Remove-Item -Force $zipPath -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force $extractPath -ErrorAction SilentlyContinue
}

# 3) Hand off to the cross-platform runner ----------------------------------
Set-Location $Dest
& node scripts/demo.mjs
