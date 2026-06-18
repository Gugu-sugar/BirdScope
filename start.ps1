# BirdScope one-click startup script
# Usage (from project root):
#   .\start.ps1              - check status, then start backend + frontend
#   .\start.ps1 -CheckOnly   - status check only, no launch
#   .\start.ps1 -NoBackend   - skip backend
#   .\start.ps1 -NoFrontend  - skip frontend

param(
    [switch]$CheckOnly,
    [switch]$NoFrontend,
    [switch]$NoBackend
)

$ROOT = $PSScriptRoot

# ── helpers ──────────────────────────────────────────────────────────────────

function Write-Status {
    param([string]$Label, [string]$Status, [string]$Detail = "")
    $color = switch ($Status) {
        "OK"    { "Green" }
        "WARN"  { "Yellow" }
        "FAIL"  { "Red" }
        "INFO"  { "Cyan" }
        default { "White" }
    }
    Write-Host ("  {0,-24}" -f $Label) -NoNewline
    Write-Host ("[{0}]" -f $Status) -ForegroundColor $color -NoNewline
    if ($Detail) { Write-Host "  $Detail" } else { Write-Host "" }
}

function Test-Http {
    param([string]$Url, [int]$TimeoutSec = 5)
    try {
        $r = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec $TimeoutSec -Proxy "" -ErrorAction Stop
        return [int]$r.StatusCode
    } catch { return 0 }
}

function Get-EnvValue {
    param([string]$File, [string]$Key)
    $line = Get-Content $File | Select-String "^${Key}=" | Select-Object -First 1
    if ($line) { return ($line.Line -split "=", 2)[1].Trim() }
    return $null
}

# ── load config ───────────────────────────────────────────────────────────────

$envFile = Join-Path $ROOT "backend\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "[ERROR] backend\.env not found. Copy from .env.example and fill in values." -ForegroundColor Red
    exit 1
}

$PYTHON        = Get-EnvValue $envFile "PYTHON_PATH"
$GS_URL        = Get-EnvValue $envFile "GEOSERVER_URL"

if (-not $PYTHON -or -not (Test-Path $PYTHON)) {
    Write-Host "[ERROR] PYTHON_PATH invalid: $PYTHON" -ForegroundColor Red
    exit 1
}

$GS_REST = "$GS_URL/rest/about/version.json"

# ── status check ──────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor DarkCyan
Write-Host "  BirdScope  --  Status Check" -ForegroundColor Cyan
Write-Host "  ==========================================" -ForegroundColor DarkCyan
Write-Host ""

# PostgreSQL
$pgSvc = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pgSvc) {
    if ($pgSvc.Status -eq "Running") {
        Write-Status "PostgreSQL" "OK" "service $($pgSvc.Name)"
    } else {
        Write-Status "PostgreSQL" "WARN" "service $($pgSvc.Name) is $($pgSvc.Status) -- attempting start"
        try {
            Start-Service -Name $pgSvc.Name -ErrorAction Stop
            Start-Sleep 3
            $pgSvc.Refresh()
            if ($pgSvc.Status -eq "Running") {
                Write-Status "PostgreSQL" "OK" "service $($pgSvc.Name) started"
            } else {
                Write-Status "PostgreSQL" "WARN" "still $($pgSvc.Status) -- trying elevated start"
                Start-Process cmd -ArgumentList "/c net start $($pgSvc.Name)" -Verb RunAs -Wait
                Start-Sleep 3
                $pgSvc.Refresh()
                if ($pgSvc.Status -eq "Running") {
                    Write-Status "PostgreSQL" "OK" "service started (elevated)"
                } else {
                    Write-Status "PostgreSQL" "FAIL" "could not start -- check Windows Event Log"
                }
            }
        } catch {
            Write-Status "PostgreSQL" "WARN" "permission denied -- trying elevated start"
            Start-Process cmd -ArgumentList "/c net start $($pgSvc.Name)" -Verb RunAs -Wait
            Start-Sleep 3
            $pgSvc.Refresh()
            if ($pgSvc.Status -eq "Running") {
                Write-Status "PostgreSQL" "OK" "service started (elevated)"
            } else {
                Write-Status "PostgreSQL" "FAIL" "could not start -- check Windows Event Log"
            }
        }
    }
} else {
    $pgOk = Test-NetConnection localhost -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue 2>$null
    if ($pgOk) {
        Write-Status "PostgreSQL" "OK" "port 5432 reachable"
    } else {
        Write-Status "PostgreSQL" "FAIL" "port 5432 unreachable and no postgresql* service found"
    }
}

# GeoServer Windows service
$gsSvc     = Get-Service -Name "GeoServer" -ErrorAction SilentlyContinue
$gsWinOk   = $false
if ($gsSvc) {
    if ($gsSvc.Status -eq "Running") {
        $gsWinOk = $true
        Write-Status "GeoServer (service)" "OK" "Windows service running"
    } else {
        Write-Status "GeoServer (service)" "WARN" "Windows service status: $($gsSvc.Status)"
    }
} else {
    Write-Status "GeoServer (service)" "WARN" "Windows service 'GeoServer' not found"
}

# GeoServer HTTP
$gsCode = Test-Http $GS_REST
if ($gsCode -eq 200) {
    Write-Status "GeoServer HTTP" "OK" $GS_URL
} elseif ($gsWinOk) {
    Write-Status "GeoServer HTTP" "WARN" "Service up but HTTP unresponsive (possible zombie)"
} else {
    Write-Status "GeoServer HTTP" "FAIL" "port 8080 unreachable"
}

# FastAPI backend
$apiCode = Test-Http "http://localhost:8000/health"
if ($apiCode -eq 200) {
    Write-Status "FastAPI backend" "OK" "http://localhost:8000"
} else {
    Write-Status "FastAPI backend" "INFO" "not running (will start)"
}

# Vite frontend
$feCode = Test-Http "http://localhost:5173"
if ($feCode -gt 0) {
    Write-Status "Vite frontend" "OK" "http://localhost:5173"
} else {
    Write-Status "Vite frontend" "INFO" "not running (will start)"
}

Write-Host ""

# ── GeoServer zombie recovery ──────────────────────────────────────────────────

if ($gsWinOk -and $gsCode -ne 200) {
    Write-Host "  [WARN] GeoServer zombie: TCP alive but HTTP timeout." -ForegroundColor Yellow
    Write-Host "         Manual fix: Start-Process cmd '/c net stop GeoServer & net start GeoServer' -Verb RunAs" -ForegroundColor Yellow
    Write-Host ""
    $ans = Read-Host "  Restart GeoServer now (requires UAC elevation)? [y/N]"
    if ($ans -match "^[yY]") {
        Write-Host "  Requesting elevated restart..." -ForegroundColor Cyan
        Start-Process cmd -ArgumentList '/c net stop GeoServer & net start GeoServer' -Verb RunAs -Wait
        Write-Host "  Waiting 30s for GeoServer..." -ForegroundColor Cyan
        Start-Sleep 30
        if ((Test-Http $GS_REST 10) -eq 200) {
            Write-Host "  GeoServer recovered OK" -ForegroundColor Green
        } else {
            Write-Host "  GeoServer still not responding -- check manually" -ForegroundColor Red
        }
        Write-Host ""
    }
}

if ($CheckOnly) {
    Write-Host "  (CheckOnly -- not starting services)" -ForegroundColor DarkGray
    Write-Host ""
    exit 0
}

# ── start backend ─────────────────────────────────────────────────────────────

if (-not $NoBackend) {
    if ($apiCode -eq 200) {
        Write-Host "  Backend already running, skipping." -ForegroundColor DarkGray
    } else {
        Write-Host "  Starting FastAPI backend..." -ForegroundColor Cyan
        $backendDir  = Join-Path $ROOT "backend"
        $backendCmd  = "cd '$backendDir'; & '$PYTHON' -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
        Start-Process powershell.exe -ArgumentList @("-NoExit", "-Command", $backendCmd) -WindowStyle Normal
    }
}

# ── start frontend ────────────────────────────────────────────────────────────

if (-not $NoFrontend) {
    if ($feCode -gt 0) {
        Write-Host "  Frontend already running, skipping." -ForegroundColor DarkGray
    } else {
        Write-Host "  Starting Vite frontend..." -ForegroundColor Cyan
        $frontendDir = Join-Path $ROOT "frontend"
        $frontendCmd = "cd '$frontendDir'; npm.cmd run dev"
        Start-Process powershell.exe -ArgumentList @("-NoExit", "-Command", $frontendCmd) -WindowStyle Normal
    }
}

# ── wait and recheck ──────────────────────────────────────────────────────────

$needWait = ((-not $NoBackend -and $apiCode -ne 200) -or (-not $NoFrontend -and $feCode -eq 0))
if ($needWait) {
    Write-Host ""
    Write-Host "  Waiting for services (max 60s)..." -ForegroundColor DarkGray

    $deadline      = (Get-Date).AddSeconds(60)
    $backendReady  = ($apiCode -eq 200)
    $frontendReady = ($feCode -gt 0)

    while ((Get-Date) -lt $deadline) {
        Start-Sleep 3
        if (-not $backendReady  -and -not $NoBackend)  { $backendReady  = ((Test-Http "http://localhost:8000/health") -eq 200) }
        if (-not $frontendReady -and -not $NoFrontend) { $frontendReady = ((Test-Http "http://localhost:5173") -gt 0) }
        if ($backendReady -and $frontendReady) { break }
    }

    Write-Host ""
    Write-Host "  ==========================================" -ForegroundColor DarkCyan
    Write-Host "  Startup Result" -ForegroundColor Cyan
    Write-Host "  ==========================================" -ForegroundColor DarkCyan
    Write-Host ""
    if (-not $NoBackend) {
        if ($backendReady)  { Write-Status "FastAPI backend" "OK"   "http://localhost:8000" }
        else                { Write-Status "FastAPI backend" "FAIL" "not ready after 60s -- check backend window" }
    }
    if (-not $NoFrontend) {
        if ($frontendReady) { Write-Status "Vite frontend"   "OK"   "http://localhost:5173" }
        else                { Write-Status "Vite frontend"   "FAIL" "not ready after 60s -- check frontend window" }
    }
    Write-Host ""
}

# ── links ─────────────────────────────────────────────────────────────────────

Write-Host "  Quick links:" -ForegroundColor Cyan
Write-Host "    Frontend   http://localhost:5173"
Write-Host "    API docs   http://localhost:8000/docs"
Write-Host "    Health     http://localhost:8000/health"
Write-Host "    GeoServer  $GS_URL/web/"
Write-Host ""
Write-Host "  Tip: .\start.ps1 -CheckOnly   (status only, no launch)" -ForegroundColor DarkGray
Write-Host ""
