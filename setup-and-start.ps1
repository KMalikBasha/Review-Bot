$ErrorActionPreference = "Continue"
$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir  = Join-Path $ScriptDir "backend.zip"
$FrontendDir = Join-Path $ScriptDir "frontend"
$ToolsDir    = Join-Path $ScriptDir "tools"
$NodeDir     = Join-Path $ToolsDir "nodejs"

function Write-Ok($m)   { Write-Host "  [OK]   $m" -ForegroundColor Green }
function Write-Warn($m) { Write-Host "  [WARN] $m" -ForegroundColor Yellow }
function Write-Err($m)  { Write-Host "  [ERR]  $m" -ForegroundColor Red }
function Write-Step($m) { Write-Host "`n  >> $m" -ForegroundColor Cyan }

function Refresh-Path {
    $m = [System.Environment]::GetEnvironmentVariable("PATH", "Machine")
    $u = [System.Environment]::GetEnvironmentVariable("PATH", "User")
    $env:PATH = "$m;$u"
}

Clear-Host
Write-Host ""
Write-Host "  ================================================" -ForegroundColor Magenta
Write-Host "         Review Bot  --  One-Click Launcher       " -ForegroundColor Magenta
Write-Host "  ================================================" -ForegroundColor Magenta

# --- 1. Node.js ---
Write-Step "Step 1/5 -- Node.js"

$nodeExe = Join-Path $NodeDir "node.exe"
$npmExe  = Join-Path $NodeDir "npm.cmd"

if (-not (Test-Path $nodeExe)) {
    Write-Host "      Portable Node.js not found -- downloading (no admin needed)..." -ForegroundColor Gray
    New-Item -ItemType Directory -Path $ToolsDir -Force | Out-Null
    $nodeZip = Join-Path $ToolsDir "node.zip"
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip" -OutFile $nodeZip -UseBasicParsing
    Expand-Archive -Path $nodeZip -DestinationPath $ToolsDir -Force
    $extracted = Get-ChildItem $ToolsDir -Directory | Where-Object { $_.Name -like "node-*" } | Select-Object -First 1
    if ($extracted) { Rename-Item $extracted.FullName $NodeDir }
    Remove-Item $nodeZip -Force -ErrorAction SilentlyContinue
}

if (Test-Path $nodeExe) {
    if ($env:PATH -notlike "*$NodeDir*") { $env:PATH = "$NodeDir;$env:PATH" }
    $userPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")
    if ($userPath -notlike "*$NodeDir*") {
        [System.Environment]::SetEnvironmentVariable("PATH", "$NodeDir;$userPath", "User")
    }
    $nodeVer = & $nodeExe --version 2>&1
    Write-Ok "Node.js $nodeVer"
} else {
    Write-Err "Node.js not found. Cannot continue."
    Read-Host "`n  Press Enter to exit"
    exit 1
}

# --- 2. Ollama ---
Write-Step "Step 2/5 -- Ollama (local AI)"

$ollamaExe = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
if (-not (Test-Path $ollamaExe)) {
    $ollamaExe = "C:\Users\$env:USERNAME\AppData\Local\Programs\Ollama\ollama.exe"
}

if (-not (Test-Path $ollamaExe)) {
    Write-Host "      Ollama not found -- installing via winget..." -ForegroundColor Gray
    winget install Ollama.Ollama --silent --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
    Start-Sleep -Seconds 3
    $ollamaExe = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
}

if (Test-Path $ollamaExe) {
    $ollamaVer = & $ollamaExe --version 2>&1
    Write-Ok "Ollama $ollamaVer"
} else {
    Write-Warn "Ollama not installed -- AI features will be degraded."
    $ollamaExe = $null
}

# --- 3. ngrok ---
Write-Step "Step 3/5 -- ngrok"

$ngrokExe = Join-Path $ScriptDir "ngrok.exe"

if (-not ((Test-Path $ngrokExe) -and (Get-Item $ngrokExe).Length -gt 1000)) {
    $wingetNgrok = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter "ngrok.exe" -Recurse -ErrorAction SilentlyContinue |
                   Where-Object { $_.Length -gt 1000 } | Select-Object -First 1
    if ($wingetNgrok) {
        Copy-Item $wingetNgrok.FullName $ngrokExe -Force
        Write-Ok "ngrok copied from winget packages"
    } else {
        Write-Host "      ngrok not found -- installing via winget..." -ForegroundColor Gray
        winget install Ngrok.Ngrok --silent --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
        Start-Sleep -Seconds 2
        $wingetNgrok = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter "ngrok.exe" -Recurse -ErrorAction SilentlyContinue |
                       Where-Object { $_.Length -gt 1000 } | Select-Object -First 1
        if ($wingetNgrok) { Copy-Item $wingetNgrok.FullName $ngrokExe -Force }
    }
}

if ((Test-Path $ngrokExe) -and (Get-Item $ngrokExe).Length -gt 1000) {
    $ngrokSizeMB = [math]::Round((Get-Item $ngrokExe).Length/1MB, 1)
    Write-Ok "ngrok ready ($ngrokSizeMB MB)"
} else {
    Write-Warn "ngrok not found -- Slack webhooks won't work from localhost."
    $ngrokExe = $null
}

# --- 4. npm install ---
Write-Step "Step 4/5 -- npm dependencies"

if (-not (Test-Path (Join-Path $BackendDir "node_modules"))) {
    Write-Host "      Installing backend packages..." -ForegroundColor Gray
    Push-Location $BackendDir
    & $npmExe install 2>&1 | Where-Object { $_ -notmatch "^npm warn|^npm notice" }
    Pop-Location
    Write-Ok "Backend packages installed"
} else {
    Write-Ok "Backend packages: already present"
}

if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Host "      Installing frontend packages..." -ForegroundColor Gray
    Push-Location $FrontendDir
    & $npmExe install 2>&1 | Where-Object { $_ -notmatch "^npm warn|^npm notice" }
    Pop-Location
    Write-Ok "Frontend packages installed"
} else {
    Write-Ok "Frontend packages: already present"
}

# --- 5. Ollama model ---
Write-Step "Step 5/5 -- AI model (gemma3:1b)"

if ($ollamaExe) {
    $models = & $ollamaExe list 2>&1
    if ("$models" -match "gemma3:1b") {
        Write-Ok "gemma3:1b model ready"
    } else {
        Write-Host "      Pulling gemma3:1b (first time only ~815 MB, a few minutes)..." -ForegroundColor Gray
        & $ollamaExe pull gemma3:1b 2>&1 | Out-Null
        Write-Ok "gemma3:1b downloaded"
    }
} else {
    Write-Warn "Skipping model pull (Ollama not installed)"
}

# --- Desktop shortcut ---
try {
    $lnk = [System.IO.Path]::Combine([System.Environment]::GetFolderPath("Desktop"), "Review Bot.lnk")
    $wsh = New-Object -ComObject WScript.Shell
    $sc  = $wsh.CreateShortcut($lnk)
    $sc.TargetPath       = Join-Path $ScriptDir "Start.bat"
    $sc.WorkingDirectory = $ScriptDir
    $sc.Description      = "Start Review Bot (Frontend + Backend + ngrok + Ollama)"
    $sc.Save()
    Write-Ok "Desktop shortcut updated: Review Bot.lnk"
} catch { }

# --- Launch services ---
Write-Host ""
Write-Host "  ================================================" -ForegroundColor Green
Write-Host "              Launching all services              " -ForegroundColor Green
Write-Host "  ================================================" -ForegroundColor Green

Refresh-Path
if ($env:PATH -notlike "*$NodeDir*") { $env:PATH = "$NodeDir;$env:PATH" }

function Start-Service($title, $bgColor, $workDir, $cmd) {
    $init = "`$env:PATH = '$NodeDir' + ';' + `$env:PATH;" +
            "`$Host.UI.RawUI.WindowTitle = '$title';" +
            "Write-Host '  $title  ' -BackgroundColor $bgColor -ForegroundColor White;" +
            "Write-Host ''"
    Start-Process powershell -ArgumentList @("-NoExit", "-Command", "$init; Set-Location '$workDir'; $cmd")
}

Write-Host "  Starting Backend   :4000 ..." -ForegroundColor White
Start-Service "Review Bot - Backend :4000" "DarkBlue" $BackendDir "npm run dev"
Start-Sleep -Seconds 2

Write-Host "  Starting Frontend  :5173 ..." -ForegroundColor White
Start-Service "Review Bot - Frontend :5173" "DarkGreen" $FrontendDir "npm run dev"

if ($ngrokExe) {
    Write-Host "  Starting ngrok tunnel -> :4000 ..." -ForegroundColor White
    Start-Service "Review Bot - ngrok tunnel" "DarkRed" $ScriptDir "& '$ngrokExe' http 4000"
}

if ($ollamaExe) {
    Write-Host "  Starting Ollama AI :11434 ..." -ForegroundColor White
    Start-Service "Review Bot - Ollama AI :11434" "DarkCyan" $ScriptDir "& '$ollamaExe' serve"
}

Write-Host "  Opening browser in 4 seconds..." -ForegroundColor Gray
Start-Sleep -Seconds 4
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "  ================================================" -ForegroundColor Green
Write-Host "   Frontend  ->  http://localhost:5173            " -ForegroundColor White
Write-Host "   Backend   ->  http://localhost:4000/health     " -ForegroundColor White
Write-Host "   Ollama    ->  http://localhost:11434           " -ForegroundColor White
Write-Host "   ngrok     ->  http://localhost:4040 (dashboard)" -ForegroundColor White
Write-Host "  ------------------------------------------------" -ForegroundColor DarkGray
Write-Host "   Close each terminal window to stop a service.  " -ForegroundColor DarkGray
Write-Host "  ================================================" -ForegroundColor Green
Write-Host ""
Read-Host "  Press Enter to close this launcher"
