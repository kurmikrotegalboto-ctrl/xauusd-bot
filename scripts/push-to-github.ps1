# ============================================================
# XAUUSD Bot — GitHub Push Helper for Windows
# Run in PowerShell:
#   .\push-to-github.ps1
# ============================================================

# Stop on first error
$ErrorActionPreference = "Stop"

# --- Config ---
$RepoName = "xauusd-bot"
$RepoDesc = "XAUUSD price prediction bot with paper trading + Redis persistence"
$DefaultBranch = "main"
$Bundle = "xauusd-bot-bundle.tar.gz"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  XAUUSD Bot - GitHub Push Helper (Windows)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# --- Check prerequisites ---
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

# Check git
$gitOk = $false
try {
    $gitVersion = git --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        $gitOk = $true
        Write-Host "  [OK] Git found: $gitVersion" -ForegroundColor Green
    }
} catch { }

if (-not $gitOk) {
    Write-Host "  [FAIL] Git not installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Install Git for Windows first:" -ForegroundColor Yellow
    Write-Host "    https://git-scm.com/download/win" -ForegroundColor Cyan
    Write-Host "  After install, RESTART PowerShell and run this script again." -ForegroundColor Yellow
    exit 1
}

# Check tar (Windows 10+ has tar built-in)
try {
    $tarVersion = tar --version 2>$null | Select-Object -First 1
    Write-Host "  [OK] tar found: $tarVersion" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] tar not found. Use Windows 10 or newer." -ForegroundColor Red
    exit 1
}

# Check curl (Windows 10+ has curl built-in)
try {
    $curlVersion = curl --version 2>$null | Select-Object -First 1
    Write-Host "  [OK] curl found" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] curl not found. Use Windows 10 or newer." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Prerequisites OK!" -ForegroundColor Green
Write-Host ""

# --- Check bundle ---
if (-not (Test-Path $Bundle)) {
    Write-Host "ERROR: Bundle '$Bundle' not found in current folder." -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure you are in the folder where you downloaded:" -ForegroundColor Yellow
    Write-Host "  - $Bundle" -ForegroundColor Cyan
    Write-Host "  - push-to-github.ps1 (this script)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Current folder: $(Get-Location)" -ForegroundColor Gray
    exit 1
}

# --- Get GitHub credentials ---
Write-Host "GitHub credentials needed." -ForegroundColor Yellow
Write-Host "  - Username: your GitHub login (e.g. 'johndoe')" -ForegroundColor Gray
Write-Host "  - Token: Personal Access Token with 'repo' scope" -ForegroundColor Gray
Write-Host "    Create at: https://github.com/settings/tokens" -ForegroundColor Gray
Write-Host "    (Generate new token -> classic -> check 'repo')" -ForegroundColor Gray
Write-Host ""

$GhUser = Read-Host "GitHub username"
$GhToken = Read-Host "GitHub Personal Access Token" -AsSecureString
$GhTokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($GhToken)
)

$inputRepo = Read-Host "Repository name (press Enter for default: $RepoName)"
if ($inputRepo) { $RepoName = $inputRepo }

# --- Step 1: Extract bundle ---
Write-Host ""
Write-Host "Step 1/4: Extracting bundle..." -ForegroundColor Cyan

if (Test-Path $RepoName) {
    Write-Host "  Folder '$RepoName' already exists. Using existing." -ForegroundColor Yellow
} else {
    tar xzf $Bundle
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: tar extraction failed." -ForegroundColor Red
        exit 1
    }
}

Set-Location $RepoName
Write-Host "  Extracted to: $(Get-Location)" -ForegroundColor Green

# --- Step 2: Create GitHub repo via API ---
Write-Host ""
Write-Host "Step 2/4: Creating GitHub repository..." -ForegroundColor Cyan

$body = @{ name = $RepoName; description = $RepoDesc; private = $false } | ConvertTo-Json
$headers = @{
    "Authorization" = "token $GhTokenPlain"
    "Accept"        = "application/vnd.github.v3+json"
    "User-Agent"    = "PowerShell"
}

try {
    $response = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method Post -Headers $headers -Body $body -ContentType "application/json"
    Write-Host "  [OK] Repository created: https://github.com/$GhUser/$RepoName" -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 422) {
        Write-Host "  [WARN] Repository already exists. Pushing to existing." -ForegroundColor Yellow
    } else {
        Write-Host "  ERROR: Failed to create repo (HTTP $statusCode)" -ForegroundColor Red
        Write-Host $_.Exception.Message
        exit 1
    }
}

# --- Step 3: Add remote ---
Write-Host ""
Write-Host "Step 3/4: Adding git remote..." -ForegroundColor Cyan

# Remove existing origin if any
git remote remove origin 2>$null | Out-Null

# Build remote URL with token embedded (so push doesn't prompt for password)
$remoteUrl = "https://$GhUser`:$GhTokenPlain@github.com/$GhUser/$RepoName.git"
git remote add origin $remoteUrl
Write-Host "  [OK] Remote added" -ForegroundColor Green

# --- Step 4: Push ---
Write-Host ""
Write-Host "Step 4/4: Pushing to GitHub..." -ForegroundColor Cyan

git push -u origin $DefaultBranch
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: git push failed." -ForegroundColor Red
    Write-Host "  Check your token has 'repo' scope." -ForegroundColor Yellow
    exit 1
}

# Clear token from remote URL (security)
git remote set-url origin "https://github.com/$GhUser/$RepoName.git"
Write-Host "  [OK] Token cleared from git config" -ForegroundColor Green

# --- Done ---
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Push complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Repository: https://github.com/$GhUser/$RepoName" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps (FREE deployment):" -ForegroundColor Yellow
Write-Host "  1. Go to https://upstash.com -> Sign up with GitHub -> Create Redis DB"
Write-Host "     Copy the connection URL (rediss://default:PASSWORD@HOST:PORT)"
Write-Host ""
Write-Host "  2. Go to https://render.com -> Sign up with GitHub"
Write-Host "     New + -> Blueprint -> Select repo '$RepoName'"
Write-Host "     render.yaml will be auto-detected"
Write-Host ""
Write-Host "  3. In Render -> service 'xauusd-bot' -> Environment -> add:"
Write-Host "     REDIS_URL = <paste Upstash URL from step 1>"
Write-Host "     TWELVEDATA_API_KEY = 2f7f8b157aee4c619ce29f293d34b1cd"
Write-Host ""
Write-Host "  4. Save -> wait for redeploy (~3-5 min)"
Write-Host "  5. Open https://$RepoName.onrender.com - done!"
Write-Host ""
Write-Host "Full guide: see DEPLOYMENT.md inside the repo" -ForegroundColor Gray
