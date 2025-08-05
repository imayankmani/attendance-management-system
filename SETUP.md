# 🚀 Quick Setup Guide

This guide will help you set up the Attendance Management System quickly on your local machine or server.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 18+** and npm ([Download here](https://nodejs.org/))
- **Python 3.8+** and pip ([Download here](https://python.org/))
- **MySQL 8.0+** ([Download here](https://dev.mysql.com/downloads/))
- **Git** ([Download here](https://git-scm.com/))

## 🔧 Quick Installation

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/attendance-management-system.git
cd attendance-management-system
```

### 2. Database Setup
```bash
# Login to MySQL
mysql -u root -p

# Create database
CREATE DATABASE attendance_system;
USE attendance_system;

# Import schema
source database/schema.sql;

# Exit MySQL
exit;
```

### 3. Install Dependencies
```bash
# Install all Node.js dependencies
npm run install-deps

# Install Python dependencies
cd python-camera-system
pip install -r requirements.txt
cd ..
```

### 4. Configure Environment Variables

#### Backend Configuration
```bash
cd node-backend
cp .env.example .env

# Edit .env file with your settings:
# DB_HOST=localhost
# DB_USER=root
# DB_PASSWORD=yourpassword
# DB_NAME=attendance_system
# JWT_SECRET=your_secret_key
# EMAIL_USER=your-email@gmail.com (optional)
# EMAIL_PASSWORD=your-app-password (optional)
```

#### Python Configuration
```bash
cd python-camera-system
cp .env.example .env

# Edit .env file with your database settings:
# DB_HOST=localhost
# DB_USER=root
# DB_PASSWORD=yourpassword
# DB_NAME=attendance_system
```

### 5. Start the System

#### Option A: Manual Start (Recommended for Development)
```bash
# Terminal 1 - Backend Server
cd node-backend
npm start

# Terminal 2 - React Dashboard
cd react-dashboard
npm start

# Terminal 3 - Web Terminal
cd web-attendance-terminal
npm start

# Terminal 4 - Python Face Recognition (Optional)
cd python-camera-system
python fixed_attendance_system.py
```

#### Option B: Quick Start (All Services)
```bash
# Start backend and frontend together
npm run dev
```

### 6. Access the System

- **Admin Dashboard**: http://localhost:3000
- **Web Terminal**: http://localhost:3002
- **Backend API**: http://localhost:3001

#### Default Login Credentials
- **Username**: admin
- **Password**: admin123

## 🎯 First Steps After Installation

### 1. Login to Admin Dashboard
1. Open http://localhost:3000
2. Login with admin/admin123
3. Change default password in settings

### 2. Add Students
1. Go to "Students" page
2. Click "Add Student" or "Upload Excel"
3. Add student photos for face recognition

### 3. Create Classes
1. Go to "Classes" page
2. Add class schedules
3. Set appropriate time slots

### 4. Test Attendance Marking
1. Open http://localhost:3002 (Web Terminal)
2. Select active class
3. Test face recognition with camera

### 5. Configure Email (Optional)
1. Set up Gmail app password
2. Update EMAIL_USER and EMAIL_PASSWORD in .env
3. Test email functionality in "Send Emails" page

## 🔍 Troubleshooting

### Common Issues

**Database Connection Error**
```bash
# Check MySQL service is running
# Verify credentials in .env file
# Ensure database exists
```

**Camera Not Working**
```bash
# Allow camera permissions in browser
# Check if camera is being used by another application
# Verify WebRTC support in browser
```

**Python Dependencies Error**
```bash
# Update pip
pip install --upgrade pip

# Install with specific versions
pip install opencv-python==4.8.0.74
pip install face-recognition==1.3.0
```

**Port Already in Use**
```bash
# Find and kill process using port
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3001 | xargs kill -9
```

### Performance Issues
- **Large datasets**: Ensure proper database indexing
- **Slow face recognition**: Reduce image resolution or frame rate
- **Memory usage**: Monitor Python process memory consumption

## 🚀 Production Deployment

### Environment Variables for Production
```bash
NODE_ENV=production
DB_HOST=your-production-db-host
DB_USER=your-production-db-user
DB_PASSWORD=your-secure-password
JWT_SECRET=your-very-secure-jwt-secret
```

### Security Considerations
1. Change default admin credentials
2. Use strong JWT secret
3. Enable HTTPS
4. Configure firewall rules
5. Regular security updates

### Performance Optimization
1. Enable database query caching
2. Use CDN for static assets
3. Implement Redis for session storage
4. Configure load balancing

## 📞 Support

Need help? 
- Check [Troubleshooting Guide](TROUBLESHOOTING.md)
- Read [Contributing Guidelines](CONTRIBUTING.md)
- Create an [Issue](https://github.com/yourusername/attendance-management-system/issues)

## 🎉 You're All Set!

Your Attendance Management System is now ready to use. Enjoy managing attendance with AI-powered face recognition!

For advanced configuration and customization, check our detailed documentation.
