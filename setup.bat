@echo off
REM Attendance System Setup Script for Windows
REM Run this script to set up the complete attendance management system

echo 🎓 Attendance Management System Setup
echo ======================================

REM Check if required commands exist
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install it first.
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install Node.js first.
    pause
    exit /b 1
)

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Python is not installed. Please install it first.
    pause
    exit /b 1
)

where mysql >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ MySQL is not installed or not in PATH. Please install it first.
    pause
    exit /b 1
)

echo ✅ All prerequisites found!

REM Setup Database
echo.
echo 📊 Setting up database...
set /p mysql_user=Enter MySQL username: 
set /p mysql_password=Enter MySQL password: 

mysql -u %mysql_user% -p%mysql_password% -e "CREATE DATABASE IF NOT EXISTS attendance_system;"
mysql -u %mysql_user% -p%mysql_password% attendance_system < database/schema.sql

if %errorlevel% equ 0 (
    echo ✅ Database setup completed!
) else (
    echo ❌ Database setup failed!
    pause
    exit /b 1
)

REM Setup Python environment
echo.
echo 🐍 Setting up Python environment...
cd python-camera-system

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating Python virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install Python dependencies
pip install -r requirements.txt

if %errorlevel% equ 0 (
    echo ✅ Python setup completed!
) else (
    echo ❌ Python setup failed!
    pause
    exit /b 1
)

cd ..

REM Setup Node.js backend
echo.
echo ⚙️ Setting up Node.js backend...
cd node-backend

call npm install

if %errorlevel% equ 0 (
    echo ✅ Node.js backend setup completed!
) else (
    echo ❌ Node.js backend setup failed!
    pause
    exit /b 1
)

cd ..

REM Setup React dashboard
echo.
echo ⚛️ Setting up React dashboard...
cd react-dashboard

call npm install

if %errorlevel% equ 0 (
    echo ✅ React dashboard setup completed!
) else (
    echo ❌ React dashboard setup failed!
    pause
    exit /b 1
)

cd ..

REM Setup Web Attendance Terminal
echo.
echo 🖥️ Setting up Web Attendance Terminal...
cd web-attendance-terminal

call npm install

if %errorlevel% equ 0 (
    echo ✅ Web Attendance Terminal setup completed!
) else (
    echo ❌ Web Attendance Terminal setup failed!
    pause
    exit /b 1
)

cd ..

REM Create environment files if they don't exist
echo.
echo 📝 Environment files are already configured with default values

echo.
echo 🎉 Setup completed successfully!
echo.
echo 📋 Next steps:
echo 1. Configure environment files (.env) in both python-camera-system and node-backend directories
echo 2. Update database credentials in the .env files
echo 3. Configure email settings for notifications
echo 4. Test camera connectivity
echo.
echo 🚀 To start the system:
echo 1. Start the backend: cd node-backend ^&^& npm start
echo 2. Start the dashboard: cd react-dashboard ^&^& npm start
echo 3. Start the attendance terminal server: cd web-attendance-terminal ^&^& npm start
echo 4. Access attendance terminals at: http://localhost:3002
echo 5. For local camera system: cd python-camera-system ^&^& python fixed_attendance_system.py
echo.
echo 📖 For detailed instructions, see README.md

pause
