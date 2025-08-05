#!/bin/bash

# Attendance System Setup Script
# Run this script to set up the complete attendance management system

echo "🎓 Attendance Management System Setup"
echo "======================================"

# Check if required commands exist
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is not installed. Please install it first."
        exit 1
    fi
}

echo "🔍 Checking prerequisites..."
check_command "node"
check_command "npm"
check_command "python"
check_command "mysql"

echo "✅ All prerequisites found!"

# Setup Database
echo ""
echo "📊 Setting up database..."
read -p "Enter MySQL username: " mysql_user
read -sp "Enter MySQL password: " mysql_password
echo ""

mysql -u $mysql_user -p$mysql_password -e "CREATE DATABASE IF NOT EXISTS attendance_system;"
mysql -u $mysql_user -p$mysql_password attendance_system < database/schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Database setup completed!"
else
    echo "❌ Database setup failed!"
    exit 1
fi

# Setup Python environment
echo ""
echo "🐍 Setting up Python environment..."
cd python-camera-system

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python -m venv venv
fi

# Activate virtual environment (adjust for your OS)
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi

# Install Python dependencies
pip install -r requirements.txt

if [ $? -eq 0 ]; then
    echo "✅ Python setup completed!"
else
    echo "❌ Python setup failed!"
    exit 1
fi

cd ..

# Setup Node.js backend
echo ""
echo "⚙️ Setting up Node.js backend..."
cd node-backend

npm install

if [ $? -eq 0 ]; then
    echo "✅ Node.js backend setup completed!"
else
    echo "❌ Node.js backend setup failed!"
    exit 1
fi

cd ..

# Setup React dashboard
echo ""
echo "⚛️ Setting up React dashboard..."
cd react-dashboard

npm install

if [ $? -eq 0 ]; then
    echo "✅ React dashboard setup completed!"
else
    echo "❌ React dashboard setup failed!"
    exit 1
fi

cd ..

# Create environment files if they don't exist
echo ""
echo "📝 Setting up environment files..."

# Python .env
if [ ! -f "python-camera-system/.env" ]; then
    cp python-camera-system/.env python-camera-system/.env.example
    echo "📝 Please configure python-camera-system/.env with your settings"
fi

# Node.js .env
if [ ! -f "node-backend/.env" ]; then
    cp node-backend/.env node-backend/.env.example
    echo "📝 Please configure node-backend/.env with your settings"
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Configure environment files (.env) in both python-camera-system and node-backend directories"
echo "2. Update database credentials in the .env files"
echo "3. Configure email settings for notifications"
echo "4. Test camera connectivity"
echo ""
echo "🚀 To start the system:"
echo "1. Start the backend: cd node-backend && npm start"
echo "2. Start the dashboard: cd react-dashboard && npm start"
echo "3. Start the camera system: cd python-camera-system && python attendance_system.py"
echo ""
echo "📖 For detailed instructions, see README.md"
