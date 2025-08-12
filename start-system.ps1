# Attendance Management System - Complete Startup Script
# This script starts all components of the attendance system

param(
    [switch]$SkipPython,
    [switch]$Help
)

if ($Help) {
    Write-Host "Attendance Management System Startup Script" -ForegroundColor Green
    Write-Host "Usage: .\start-system.ps1 [options]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -SkipPython    Skip starting the Python camera system"
    Write-Host "  -Help          Show this help message"
    Write-Host ""
    Write-Host "The script will start:" -ForegroundColor Cyan
    Write-Host "  1. Backend API (Node.js) on port 3001"
    Write-Host "  2. React Dashboard on port 3000"
    Write-Host "  3. Web Terminal on port 3002"
    Write-Host "  4. Python Camera System (optional)"
    Write-Host ""
    Write-Host "Press Ctrl+C to stop all services"
    exit 0
}

# Set error action preference
$ErrorActionPreference = "Continue"

# Get the script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = $ScriptDir

Write-Host "🚀 Starting Attendance Management System..." -ForegroundColor Green
Write-Host "📁 Root Directory: $RootDir" -ForegroundColor Cyan
Write-Host ""

# Check if required directories exist
$RequiredDirs = @(
    "$RootDir\node-backend",
    "$RootDir\react-dashboard", 
    "$RootDir\web-attendance-terminal",
    "$RootDir\python-camera-system"
)

foreach ($dir in $RequiredDirs) {
    if (!(Test-Path $dir)) {
        Write-Host "❌ Required directory not found: $dir" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ All required directories found" -ForegroundColor Green
Write-Host ""

# Function to check if a port is already in use
function Test-Port {
    param([int]$Port)
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
        $listener.Start()
        $listener.Stop()
        return $false
    }
    catch {
        return $true
    }
}

# Check if ports are available
$Ports = @(3001, 3000, 3002)
foreach ($port in $Ports) {
    if (Test-Port $port) {
        Write-Host "⚠️  Port $port is already in use. Please close the application using this port." -ForegroundColor Yellow
    }
}

# Array to store background jobs
$Jobs = @()

Write-Host "🔧 Installing dependencies..." -ForegroundColor Yellow

# Install backend dependencies
Write-Host "📦 Installing backend dependencies..." -ForegroundColor Cyan
Set-Location "$RootDir\node-backend"
try {
    npm install --silent
    Write-Host "✅ Backend dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install backend dependencies" -ForegroundColor Red
}

# Install frontend dependencies
Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Cyan
Set-Location "$RootDir\react-dashboard"
try {
    npm install --silent
    Write-Host "✅ Frontend dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install frontend dependencies" -ForegroundColor Red
}

# Install web terminal dependencies
Write-Host "📦 Installing web terminal dependencies..." -ForegroundColor Cyan
Set-Location "$RootDir\web-attendance-terminal"
try {
    npm install --silent
    Write-Host "✅ Web terminal dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install web terminal dependencies" -ForegroundColor Red
}

Write-Host ""
Write-Host "🚀 Starting services..." -ForegroundColor Yellow

# Start Backend Server
Write-Host "🔹 Starting Backend API..." -ForegroundColor Cyan
Set-Location "$RootDir\node-backend"
$BackendJob = Start-Job -ScriptBlock {
    param($Path)
    Set-Location $Path
    npm run dev
} -ArgumentList "$RootDir\node-backend"
$Jobs += $BackendJob
Write-Host "✅ Backend started (Job ID: $($BackendJob.Id))" -ForegroundColor Green

# Wait a bit for backend to start
Start-Sleep -Seconds 3

# Start React Dashboard
Write-Host "🔹 Starting React Dashboard..." -ForegroundColor Cyan
Set-Location "$RootDir\react-dashboard"
$FrontendJob = Start-Job -ScriptBlock {
    param($Path)
    Set-Location $Path
    $env:BROWSER = "none"  # Prevent auto-opening browser
    npm start
} -ArgumentList "$RootDir\react-dashboard"
$Jobs += $FrontendJob
Write-Host "✅ React Dashboard started (Job ID: $($FrontendJob.Id))" -ForegroundColor Green

# Wait a bit for frontend to start
Start-Sleep -Seconds 3

# Start Web Terminal
Write-Host "🔹 Starting Web Terminal..." -ForegroundColor Cyan
Set-Location "$RootDir\web-attendance-terminal"
$TerminalJob = Start-Job -ScriptBlock {
    param($Path)
    Set-Location $Path
    npm start
} -ArgumentList "$RootDir\web-attendance-terminal"
$Jobs += $TerminalJob
Write-Host "✅ Web Terminal started (Job ID: $($TerminalJob.Id))" -ForegroundColor Green

# Start Python Camera System (optional)
if (!$SkipPython) {
    Write-Host "🔹 Starting Python Camera System..." -ForegroundColor Cyan
    Set-Location "$RootDir\python-camera-system"
    
    # Check if Python is available
    try {
        $PythonExe = "C:/Users/mayan/AppData/Local/Programs/Python/Python313/python.exe"
        if (Test-Path $PythonExe) {
            $PythonJob = Start-Job -ScriptBlock {
                param($Path, $PythonExe)
                Set-Location $Path
                & $PythonExe "fixed_attendance_system.py"
            } -ArgumentList "$RootDir\python-camera-system", $PythonExe
            $Jobs += $PythonJob
            Write-Host "✅ Python Camera System started (Job ID: $($PythonJob.Id))" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Python executable not found. Skipping camera system." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "⚠️  Failed to start Python Camera System: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "⏭️  Skipping Python Camera System" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 System startup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Access Points:" -ForegroundColor Cyan
Write-Host "  🌐 React Dashboard:    http://localhost:3000" -ForegroundColor White
Write-Host "  🔧 Backend API:        http://localhost:3001" -ForegroundColor White
Write-Host "  💻 Web Terminal:       http://localhost:3002" -ForegroundColor White
Write-Host ""
Write-Host "🔑 Default Login:" -ForegroundColor Cyan
Write-Host "  Username: admin" -ForegroundColor White
Write-Host "  Password: admin123" -ForegroundColor White
Write-Host ""
Write-Host "⚡ System Status:" -ForegroundColor Yellow

# Wait a bit for services to fully start
Start-Sleep -Seconds 5

# Check job status
foreach ($job in $Jobs) {
    $status = if ($job.State -eq "Running") { "✅ Running" } else { "❌ $($job.State)" }
    $name = switch ($job.Id) {
        $BackendJob.Id { "Backend API" }
        $FrontendJob.Id { "React Dashboard" }
        $TerminalJob.Id { "Web Terminal" }
        default { "Python Camera" }
    }
    Write-Host "  $name : $status" -ForegroundColor $(if ($job.State -eq "Running") { "Green" } else { "Red" })
}

Write-Host ""
Write-Host "📋 Commands:" -ForegroundColor Yellow
Write-Host "  Press 'q' + Enter to quit all services" -ForegroundColor White
Write-Host "  Press 's' + Enter to show service status" -ForegroundColor White
Write-Host "  Press 'l' + Enter to show service logs" -ForegroundColor White
Write-Host "  Press 'o' + Enter to open dashboard in browser" -ForegroundColor White
Write-Host ""

# Set location back to root
Set-Location $RootDir

# Monitor and control loop
while ($true) {
    $input = Read-Host "Enter command (q/s/l/o)"
    
    switch ($input.ToLower()) {
        'q' {
            Write-Host ""
            Write-Host "🛑 Stopping all services..." -ForegroundColor Yellow
            foreach ($job in $Jobs) {
                Stop-Job $job -Force
                Remove-Job $job -Force
            }
            Write-Host "✅ All services stopped" -ForegroundColor Green
            Write-Host "👋 Goodbye!" -ForegroundColor Cyan
            exit 0
        }
        's' {
            Write-Host ""
            Write-Host "📊 Service Status:" -ForegroundColor Cyan
            foreach ($job in $Jobs) {
                $status = if ($job.State -eq "Running") { "✅ Running" } else { "❌ $($job.State)" }
                $name = switch ($job.Id) {
                    $BackendJob.Id { "Backend API" }
                    $FrontendJob.Id { "React Dashboard" }
                    $TerminalJob.Id { "Web Terminal" }
                    default { "Python Camera" }
                }
                Write-Host "  $name : $status" -ForegroundColor $(if ($job.State -eq "Running") { "Green" } else { "Red" })
            }
            Write-Host ""
        }
        'l' {
            Write-Host ""
            Write-Host "📜 Recent Service Logs:" -ForegroundColor Cyan
            foreach ($job in $Jobs) {
                $name = switch ($job.Id) {
                    $BackendJob.Id { "Backend API" }
                    $FrontendJob.Id { "React Dashboard" }
                    $TerminalJob.Id { "Web Terminal" }
                    default { "Python Camera" }
                }
                Write-Host "--- $name ---" -ForegroundColor Yellow
                try {
                    $output = Receive-Job $job -Keep | Select-Object -Last 5
                    if ($output) {
                        $output | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
                    } else {
                        Write-Host "  No recent output" -ForegroundColor Gray
                    }
                } catch {
                    Write-Host "  Unable to retrieve logs" -ForegroundColor Red
                }
                Write-Host ""
            }
        }
        'o' {
            Write-Host "🌐 Opening dashboard in browser..." -ForegroundColor Cyan
            Start-Process "http://localhost:3000"
        }
        default {
            Write-Host "❓ Unknown command. Use q/s/l/o" -ForegroundColor Red
        }
    }
}
