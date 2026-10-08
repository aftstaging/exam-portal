# Starts the local AFT stack: WordPress at http://localhost/ and the exam
# portal at http://localhost/exam/.
#
# Usage (from the repository root):
#   powershell -ExecutionPolicy Bypass -File deploy\local\start.ps1
#
# Re-running is safe: the build is reused and WordPress is only installed once.

$ErrorActionPreference = "Stop"
$composeFile = "docker-compose.local.yml"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $root

function Info($m) { Write-Host "==> $m" -ForegroundColor Cyan }

function Ensure-Docker {
    docker info *> $null
    if ($?) { return }
    Info "Docker daemon not running; starting Docker Desktop..."
    $dd = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dd) { Start-Process $dd | Out-Null }
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 5
        docker info *> $null
        if ($?) { Info "Docker is up."; return }
    }
    throw "Docker did not start within 5 minutes."
}

function Invoke-Compose { param([Parameter(ValueFromRemainingArguments = $true)]$Args)
    & docker compose -f $composeFile @Args
}

function Run-Wp { param([Parameter(ValueFromRemainingArguments = $true)]$Args)
    & docker compose -f $composeFile --profile tools run --rm wpcli --allow-root @Args
}

Ensure-Docker

Info "Building and starting the stack (first run downloads images and installs dependencies)..."
Invoke-Compose up -d --build

Info "Waiting for WordPress and MySQL to come up..."
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        $r = Invoke-WebRequest "http://localhost/" -UseBasicParsing -TimeoutSec 5
        if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { $ready = $true; break }
    } catch { }
    Start-Sleep -Seconds 5
}
if (-not $ready) { throw "WordPress did not answer on http://localhost/." }

Info "Checking WordPress installation state..."
$installed = $false
for ($i = 0; $i -lt 30; $i++) {
    $out = Run-Wp core is-installed 2>&1
    if ($LASTEXITCODE -eq 0) { $installed = $true; break }
    Start-Sleep -Seconds 5
}

if (-not $installed) {
    Info "Installing WordPress..."
    Run-Wp core install `
        --url="http://localhost" `
        --title="Accountants for Tomorrow" `
        --admin_user="admin" `
        --admin_password="admin" `
        --admin_email="owner@example.com" `
        --skip-email
}

Info "Activating the AFT theme and configuring the exam portal link..."
Run-Wp theme activate aft
Run-Wp rewrite structure "/%postname%/" | Out-Null
Run-Wp eval "set_theme_mod('exam_url','http://localhost/exam/');" | Out-Null
Run-Wp option update blogdescription "Professional accounting learning and exam preparation" | Out-Null

Write-Host ""
Write-Host "AFT local environment is ready" -ForegroundColor Green
Write-Host "  WordPress (main):  http://localhost/"
Write-Host "  Exam portal:       http://localhost/exam/"
Write-Host "  WP admin:          http://localhost/wp-admin/  (admin / admin)"
Write-Host ""
Write-Host "Stop:   docker compose -f $composeFile down"
Write-Host "Reset:  docker compose -f $composeFile down -v"