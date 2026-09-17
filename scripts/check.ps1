# Windows PowerShell Quality Gate Runner for TEF Platform
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "TEF Platform -- Quality Gate Verification" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$Root = Split-Path -Parent $PSScriptRoot

# 1. Backend Linting
Write-Host ""
Write-Host "[1/6] Running Ruff linter [Backend]..." -ForegroundColor Yellow
Set-Location "$Root\apps\api"
uv run ruff check .
uv run ruff format --check .
Write-Host "[OK] Backend lint clean." -ForegroundColor Green

# 2. Backend Type Checking
Write-Host ""
Write-Host "[2/6] Running Mypy type checker [Backend]..." -ForegroundColor Yellow
uv run mypy app
Write-Host "[OK] Backend types clean." -ForegroundColor Green

# 3. Backend Tests
Write-Host ""
Write-Host "[3/6] Running Pytest test suite [Backend]..." -ForegroundColor Yellow
uv run pytest -v
Write-Host "[OK] Backend tests passed." -ForegroundColor Green

# 4. Backend Security Audits
Write-Host ""
Write-Host "[4/6] Running Bandit and Pip-Audit security scans..." -ForegroundColor Yellow
uv run bandit -r app
uv run pip-audit
Write-Host "[OK] Security scans clean." -ForegroundColor Green

# 5. Frontend Type Check and Build
Write-Host ""
Write-Host "[5/6] Running TypeScript check and build [Frontend]..." -ForegroundColor Yellow
Set-Location "$Root\apps\web"
pnpm exec tsc -b
pnpm build
Write-Host "[OK] Frontend build clean." -ForegroundColor Green

# 6. Frontend Vitest
Write-Host ""
Write-Host "[6/6] Running Vitest test suite [Frontend]..." -ForegroundColor Yellow
pnpm test
Write-Host "[OK] Frontend tests passed." -ForegroundColor Green

Set-Location $Root

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "ALL QUALITY GATES PASSED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
