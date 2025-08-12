# Attendance Management System

A face recognition-based attendance system with web dashboard.

## 🚀 Quick Start (Single Command)

### Option 1: PowerShell Script (Recommended)
```powershell
# Start all services including Python camera system
.\start-system.ps1

# Start without Python camera system
.\start-system.ps1 -SkipPython

# Show help
.\start-system.ps1 -Help
```

### Option 2: Batch File
```batch
# Double-click or run from command prompt
start-system.bat
```

### Option 3: NPM Scripts
```bash
# Install all dependencies
npm run install:all

# Start backend, frontend, and terminal (without Python)
npm run dev

# Start complete system using PowerShell script
npm run system:start

# Start system without Python camera
npm run system:start-no-python
```

## 📱 Access Points

After running any startup method:

- **Dashboard**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Web Terminal**: http://localhost:3002

**Default Login**: 
- Username: `admin`
- Password: `admin123`

## 🔧 Manual Setup (If needed)

1. **Database Setup**
   ```bash
   mysql -u root -p < database/schema.sql
   ```

2. **Backend**
   ```bash
   cd node-backend
   npm install
   npm run dev
   ```

3. **Frontend**
   ```bash
   cd react-dashboard
   npm install
   npm start
   ```

4. **Web Terminal**
   ```bash
   cd web-attendance-terminal
   npm install
   npm start
   ```

5. **Python Face Recognition**
   ```bash
   cd python-camera-system
   pip install -r requirements.txt
   python fixed_attendance_system.py
   ```

## 🛠️ System Components

### Startup Scripts
- `start-system.ps1` - PowerShell script with advanced features
- `start-system.bat` - Simple batch file for quick startup
- `package.json` - NPM scripts for development

### Services
1. **Backend API** (Port 3001)
   - Node.js/Express server
   - MySQL database connection
   - Authentication & authorization
   - REST API endpoints

2. **React Dashboard** (Port 3000)
   - Modern web interface
   - Student management
   - Class scheduling
   - Attendance reports

3. **Web Terminal** (Port 3002)
   - Browser-based attendance marking
   - Real-time updates
   - WebSocket communication

4. **Python Camera System**
   - Face recognition using OpenCV
   - Real-time attendance marking
   - Camera integration

## 🔑 Features

### PowerShell Script Features
- ✅ Automatic dependency installation
- ✅ Port conflict detection
- ✅ Service status monitoring
- ✅ Interactive control (quit, status, logs)
- ✅ Browser auto-launch
- ✅ Colored output for better UX
- ✅ Error handling and recovery

### Batch Script Features
- ✅ Simple one-click startup
- ✅ Dependency installation
- ✅ Service startup in separate windows
- ✅ Browser auto-launch
- ✅ User-friendly interface

## 📋 Commands (PowerShell Script)

When running `start-system.ps1`, you can use these interactive commands:

- `q` + Enter - Quit all services
- `s` + Enter - Show service status
- `l` + Enter - Show recent service logs
- `o` + Enter - Open dashboard in browser

## 🔧 Configuration

Configure `.env` files in each directory with your database credentials and settings:

### node-backend/.env
```env
NODE_ENV=development
PORT=3001
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=attendance_system
JWT_SECRET=your-jwt-secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

### python-camera-system/.env
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=attendance_system
CONFIDENCE_THRESHOLD=0.6
```

## 🚨 Troubleshooting

### Port Conflicts
If you get port conflict errors:
1. Check what's using the ports: `netstat -ano | findstr :3000`
2. Kill the processes or change ports in configuration

### Python Not Found
If Python camera system fails to start:
1. Update the Python path in `start-system.ps1`
2. Install required Python packages: `pip install -r python-camera-system/requirements.txt`

### Database Connection Issues
1. Ensure MySQL is running
2. Check database credentials in `.env` files
3. Run the database schema: `mysql -u root -p < database/schema.sql`

### Permission Issues (PowerShell)
If you get execution policy errors:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 📁 Project Structure
```
attendance-management-system/
├── start-system.ps1          # Main PowerShell startup script
├── start-system.bat          # Batch startup script
├── package.json              # NPM scripts and dependencies
├── database/                 # Database schema and setup
├── node-backend/             # Express.js API server
├── react-dashboard/          # React.js web interface
├── web-attendance-terminal/  # Web-based attendance terminal
└── python-camera-system/     # Face recognition system
```

## 🎯 Usage Workflow

1. **System Startup**: Run `start-system.ps1` or `start-system.bat`
2. **Access Dashboard**: Go to http://localhost:3000
3. **Login**: Use admin/admin123
4. **Add Students**: Upload photos and register students
5. **Create Classes**: Schedule classes for attendance
6. **Start Camera**: Python system will automatically detect faces
7. **Monitor Attendance**: View real-time attendance in dashboard

## 📈 Development

For development mode with hot-reloading:
```bash
npm run dev
```

This starts backend, frontend, and terminal with automatic reloading on file changes.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `start-system.ps1`
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.
