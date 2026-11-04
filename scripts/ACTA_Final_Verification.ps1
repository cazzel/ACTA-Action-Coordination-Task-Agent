[CmdletBinding()]
param(
    [string]$BackendUrl = "http://127.0.0.1:8000",
    [string]$FrontendUrl = "http://localhost:5173"
)

$ErrorActionPreference = "Continue"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$FrontendPath = Join-Path $ProjectRoot "frontend"
$BackendPath = Join-Path $ProjectRoot "ACTA_step5_backend\backend"
$PassCount = 0
$WarnCount = 0
$FailCount = 0

function Write-Check {
    param([string]$Status, [string]$Message)
    switch ($Status) {
        "PASS" { $script:PassCount++; Write-Host "[PASS] $Message" -ForegroundColor Green }
        "WARN" { $script:WarnCount++; Write-Host "[WARN] $Message" -ForegroundColor Yellow }
        "FAIL" { $script:FailCount++; Write-Host "[FAIL] $Message" -ForegroundColor Red }
    }
}

Write-Host "`nACTA FINAL VERIFICATION" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"
Write-Host "This script performs build and read-only API checks. It does not create or modify records."

# 1) Frontend production build
if (-not (Test-Path (Join-Path $FrontendPath "package.json"))) {
    Write-Check "FAIL" "Frontend package.json was not found."
} else {
    Push-Location $FrontendPath
    try {
        Write-Host "`nRunning npm run build..." -ForegroundColor Cyan
        & npm.cmd run build
        if ($LASTEXITCODE -eq 0 -and (Test-Path (Join-Path $FrontendPath "dist\index.html"))) {
            Write-Check "PASS" "Vite production build completed and dist/index.html exists."
        } else {
            Write-Check "FAIL" "Frontend production build failed. Review the npm output above."
        }
    } catch {
        Write-Check "FAIL" "Could not run npm build: $($_.Exception.Message)"
    } finally {
        Pop-Location
    }
}

# 2) Backend Python syntax compilation (no database writes)
$VenvPython = Join-Path $BackendPath ".venv\Scripts\python.exe"
if (Test-Path $VenvPython) {
    $PythonExe = $VenvPython
} else {
    $PythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if ($PythonCommand) { $PythonExe = $PythonCommand.Source } else { $PythonExe = $null }
}
if ($PythonExe) {
    Push-Location $BackendPath
    try {
        & $PythonExe -m compileall -q app
        if ($LASTEXITCODE -eq 0) {
            Write-Check "PASS" "Backend Python files compile successfully."
        } else {
            Write-Check "FAIL" "Backend Python syntax compilation failed."
        }
    } catch {
        Write-Check "FAIL" "Could not compile backend source: $($_.Exception.Message)"
    } finally {
        Pop-Location
    }
} else {
    Write-Check "WARN" "Python was not found; backend compilation was skipped."
}

# 3) Non-mutating API checks
function Invoke-ReadOnlyApiCheck {
    param([string]$Path, [string]$Label)
    try {
        $null = Invoke-RestMethod -Uri "$BackendUrl$Path" -Method Get -TimeoutSec 10
        Write-Check "PASS" "$Label responded successfully."
        return $true
    } catch {
        $detail = $_.Exception.Message
        Write-Check "FAIL" "$Label failed: $detail"
        return $false
    }
}

Write-Host "`nChecking backend read-only endpoints..." -ForegroundColor Cyan
$HealthOk = Invoke-ReadOnlyApiCheck -Path "/health" -Label "Backend health"
if ($HealthOk) {
    $null = Invoke-ReadOnlyApiCheck -Path "/api/divisions" -Label "Divisions / Supabase read"
    $null = Invoke-ReadOnlyApiCheck -Path "/api/employees" -Label "Employees / Supabase read"
    $null = Invoke-ReadOnlyApiCheck -Path "/api/action-items" -Label "Action items / Supabase read"
    $null = Invoke-ReadOnlyApiCheck -Path "/api/meetings" -Label "Meetings / Supabase read"

    try {
        $Integration = Invoke-RestMethod -Uri "$BackendUrl/api/integrations/status" -Method Get -TimeoutSec 10
        Write-Check "PASS" "Integration status endpoint responded."
        foreach ($Name in @("telegram", "google_calendar", "transcription")) {
            $Item = $Integration.$Name
            if ($null -eq $Item) {
                Write-Check "WARN" "Integration status '$Name' was not present in the response."
            } elseif ($Name -eq "google_calendar") {
                if ($Item.configured -and $Item.authorized) {
                    Write-Check "PASS" "Google Calendar is configured and authorized."
                } else {
                    Write-Check "WARN" "Google Calendar is not fully configured/authorized."
                }
            } elseif ($Item.configured) {
                Write-Check "PASS" "$Name is configured."
            } else {
                Write-Check "WARN" "$Name is not configured."
            }
        }
    } catch {
        Write-Check "FAIL" "Integration status endpoint failed: $($_.Exception.Message)"
    }
} else {
    Write-Check "WARN" "Skipped dependent API checks because the backend health endpoint is unreachable."
}

# 4) Development server availability (informational only)
try {
    $null = Invoke-WebRequest -Uri $FrontendUrl -Method Get -TimeoutSec 5 -UseBasicParsing
    Write-Check "PASS" "Frontend dev server responded at $FrontendUrl."
} catch {
    Write-Check "WARN" "Frontend dev server is not responding at $FrontendUrl. Start it with 'npm run dev' for browser checks."
}

Write-Host "`nRESULT: $PassCount passed | $WarnCount warnings | $FailCount failed" -ForegroundColor Cyan
Write-Host "This script does not send Telegram messages, create Calendar events, upload files, or modify database records."
if ($FailCount -gt 0) { exit 1 }
exit 0
