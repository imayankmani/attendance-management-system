# 🎓 Attendance Management System

A comprehensive web-based attendance management system with AI-powered face recognition, real-time monitoring, and automated email reports.

## ✨ Features

### 🤖 AI-Powered Face Recognition
- Real-time face detection and recognition using OpenCV and Python
- 128-dimensional face encoding for accurate student identification
- Configurable confidence thresholds for reliable attendance marking

### 📱 Web-Based Terminals
- Modern web interface for attendance marking
- WebRTC camera integration for live video feed
- Real-time synchronization across multiple terminals
- Touch-friendly responsive design

### 🎛️ Admin Dashboard
- Beautiful React-based admin interface with Material-UI
- Real-time attendance monitoring and statistics
- Student and class management
- Comprehensive reporting with data visualization
- Excel export functionality

### 📧 Email Reports
- Automated personalized attendance reports for students
- Professional HTML email templates
- Flexible targeting (all students or specific classes)
- Custom message support
- Gmail/Outlook/Yahoo integration

### 🔄 Real-Time Communication
- WebSocket-based live updates
- Cross-terminal synchronization
- Real-time dashboard statistics
- Live attendance marking notifications

### 🔐 Security Features
- JWT-based authentication
- Role-based access control
- SQL injection prevention
- XSS protection
- Rate limiting
- Secure file upload validation

## 🏗️ System Architecture

### Multi-Tier Architecture
- **Frontend**: React.js dashboard + Vanilla JS terminals
- **Backend**: Node.js/Express.js API server
- **Database**: MySQL with normalized schema
- **AI Engine**: Python face recognition system
- **Communication**: REST APIs + WebSocket real-time updates

### Technology Stack

#### Frontend
- **React 18** with Hooks and Context API
- **Material-UI (MUI)** for component library
- **Recharts** for data visualization
- **Axios** for HTTP requests
- **React Router** for navigation
- **WebRTC** for camera access

#### Backend
- **Node.js** runtime environment
- **Express.js** web framework
- **MySQL2** database driver with connection pooling
- **WebSocket (ws)** for real-time communication
- **JWT** for authentication
- **Nodemailer** for email functionality
- **Multer** for file uploads

#### AI/ML
- **Python 3.8+** runtime
- **OpenCV** for computer vision
- **face_recognition** library (dlib wrapper)
- **NumPy** for numerical operations

#### Database
- **MySQL 8.0+** with InnoDB engine
- **Normalized schema** (3NF)
- **Indexed queries** for performance
- **Foreign key constraints** for data integrity

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.8+ with pip
- MySQL 8.0+
- Modern web browser with WebRTC support

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/attendance-management-system.git
cd attendance-management-system
```

### 2. Database Setup
```bash
# Import database schema
mysql -u root -p < database/schema.sql
```

### 3. Backend Setup
```bash
cd node-backend
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your database and email settings

npm start
```

### 4. Frontend Setup
```bash
cd react-dashboard
npm install
npm start
```

### 5. Web Terminal Setup
```bash
cd web-attendance-terminal
npm install
npm start
```

### 6. Python Face Recognition Setup
```bash
cd python-camera-system
pip install -r requirements.txt

# Configure Python environment variables
cp .env.example .env
# Edit .env with your database settings
```

## ⚙️ Configuration

### Environment Variables

#### Backend (.env)
```bash
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=attendance_system

# JWT
JWT_SECRET=your_jwt_secret_key

# Email (Optional)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Server
PORT=3001
NODE_ENV=development
```

#### Python (.env)
```bash
# Database connection
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=attendance_system
```

### Email Setup (Optional)
For Gmail integration:
1. Enable 2-factor authentication
2. Generate app password
3. Use app password in EMAIL_PASSWORD

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login

### Students
- `GET /api/students` - List all students
- `POST /api/students` - Add new student
- `POST /api/students/with-photo` - Add student with photo
- `DELETE /api/students/:id` - Delete student

### Classes
- `GET /api/classes` - List all classes
- `POST /api/classes` - Create new class
- `DELETE /api/classes/:id` - Delete class

### Attendance
- `GET /api/attendance/class/:classId` - Class attendance
- `POST /api/process-frame` - Process camera frame
- `GET /api/reports/attendance` - Attendance reports

### Email
- `POST /api/send-attendance-email` - Send email reports
- `GET /api/email/status` - Email configuration status

## 🗄️ Database Schema

### Core Tables
- **students**: Student information and face encodings
- **classes**: Class schedules and details
- **attendance**: Attendance records with timestamps
- **activity_logs**: System activity tracking

### Key Features
- Foreign key relationships
- Indexed columns for performance
- Timestamp tracking
- ACID compliance

## 🔧 Development

### Project Structure
```
attendance-system/
├── node-backend/          # Express.js API server
├── react-dashboard/       # Admin dashboard
├── web-attendance-terminal/ # Attendance terminals
├── python-camera-system/  # Face recognition
├── database/             # SQL schemas
└── docs/                # Documentation
```

### Running in Development
```bash
# Backend (Terminal 1)
cd node-backend && npm run dev

# React Dashboard (Terminal 2)
cd react-dashboard && npm start

# Web Terminal (Terminal 3)
cd web-attendance-terminal && npm start

# Python System (Terminal 4)
cd python-camera-system && python fixed_attendance_system.py
```

## 📦 Deployment

### Production Deployment
1. **Database**: Set up MySQL server
2. **Backend**: Deploy Node.js application
3. **Frontend**: Build and serve React application
4. **Web Server**: Configure Nginx reverse proxy
5. **SSL**: Set up Let's Encrypt certificates

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
```

### Cloud Deployment
- Compatible with AWS, Google Cloud, Azure
- Supports containerized deployment
- Environment variable configuration
- Horizontal scaling ready

## 🔍 Troubleshooting

### Common Issues
1. **Camera not working**: Check WebRTC permissions
2. **Face recognition errors**: Verify Python dependencies
3. **Database connection**: Check MySQL credentials
4. **Email not sending**: Verify SMTP configuration

### Performance Optimization
- Database indexing for large datasets
- Image compression for face recognition
- Connection pooling for concurrent users
- Caching for frequent queries

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request


## 🙏 Acknowledgments

- **OpenCV** community for computer vision tools
- **face_recognition** library by Adam Geitgey
- **Material-UI** team for beautiful React components
- **Node.js** and **Express.js** communities

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation in `/docs`
- Review the troubleshooting guide

---

**Built with ❤️ for modern educational institutions**
