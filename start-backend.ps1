# Doc2Learn Backend Startup Script
# Run this after activating conda environment: conda activate Doc2learn310

Write-Host "🚀 Starting Doc2Learn Backend..." -ForegroundColor Cyan
Write-Host ""

# Check if in conda environment
$condaEnv = $env:CONDA_DEFAULT_ENV
if ($condaEnv -ne "Doc2learn310") {
    Write-Host "⚠️  Warning: Not in Doc2learn310 environment!" -ForegroundColor Yellow
    Write-Host "   Run: conda activate Doc2learn310" -ForegroundColor Yellow
    Write-Host ""
}

# Check if MongoDB is running
Write-Host "🔍 Checking MongoDB..." -ForegroundColor White
try {
    $mongoStatus = Get-Service -Name MongoDB -ErrorAction SilentlyContinue
    if ($mongoStatus.Status -eq "Running") {
        Write-Host "   ✅ MongoDB is running" -ForegroundColor Green
    } else {
        Write-Host "   ❌ MongoDB is not running" -ForegroundColor Red
        Write-Host "   💡 Starting MongoDB..." -ForegroundColor Yellow
        Start-Service -Name MongoDB
        Start-Sleep -Seconds 2
        Write-Host "   ✅ MongoDB started" -ForegroundColor Green
    }
} catch {
    Write-Host "   ⚠️  Could not check MongoDB status" -ForegroundColor Yellow
    Write-Host "   Make sure MongoDB is installed and running" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🔥 Starting Flask Backend..." -ForegroundColor Cyan
Write-Host "   Backend will run on: http://localhost:5000" -ForegroundColor White
Write-Host "   Press Ctrl+C to stop" -ForegroundColor White
Write-Host ""

# Start Flask app
python -m backend.app
