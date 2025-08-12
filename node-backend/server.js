const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const { body, validationResult } = require('express-validator');
const WebSocket = require('ws');
const http = require('http');
const { spawn } = require('child_process');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server
const server = http.createServer(app);

// Middleware
app.use(helmet());
app.use(morgan('combined'));

// Dynamic CORS configuration for production
const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '').split(',').filter(Boolean)
    : [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'http://localhost:3002',  // Web attendance terminals
        'http://localhost:3005'   // Additional React dashboard port
    ];

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Database connection
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = process.env.UPLOAD_PATH || './uploads';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.includes('excel') || file.mimetype.includes('spreadsheet')) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files are allowed!'), false);
        }
    }
});

// Image upload configuration for student photos
const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = './uploads/student-photos';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const studentId = req.body.student_id || 'temp';
        const ext = path.extname(file.originalname);
        cb(null, `${studentId}-${Date.now()}${ext}`);
    }
});

const uploadImage = multer({
    storage: imageStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            cb(null, true);
        } else {
            cb(new Error('Only image files (jpeg, jpg, png, gif) are allowed!'), false);
        }
    }
});

// JWT middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Activity logging helper function
const logActivity = async (activity, details = null) => {
    try {
        const connection = await pool.getConnection();
        const logMessage = details ? `${activity} - ${JSON.stringify(details)}` : activity;
        await connection.execute(
            'INSERT INTO activity_logs (activity) VALUES (?)',
            [logMessage]
        );
        connection.release();
        console.log(`Activity logged: ${logMessage}`);
    } catch (error) {
        console.error('Failed to log activity:', error);
    }
};

// Admin login
app.post('/api/auth/login', [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password } = req.body;

        // Simple admin authentication
        if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
            const token = jwt.sign(
                { username: username, role: 'admin' },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            // Log successful login
            await logActivity('Admin login successful', { username });

            res.json({
                success: true,
                token: token,
                user: { username: username, role: 'admin' }
            });
        } else {
            // Log failed login attempt
            await logActivity('Admin login failed', { username, ip: req.ip });
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get dashboard statistics
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();

        // Get total students
        const [studentCount] = await connection.execute('SELECT COUNT(*) as count FROM students');
        
        // Get today's classes
        const [todayClasses] = await connection.execute(
            'SELECT COUNT(*) as count FROM classes WHERE date = CURDATE()'
        );
        
        // Get today's total attendance
        const [todayAttendance] = await connection.execute(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present
            FROM attendance a
            JOIN classes c ON a.class_id = c.id
            WHERE DATE(c.date) = CURDATE()
        `);

        // Get overall attendance percentage
        const [overallAttendance] = await connection.execute(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present
            FROM attendance
        `);

        connection.release();

        const stats = {
            totalStudents: studentCount[0].count,
            todayClasses: todayClasses[0].count,
            todayPresent: todayAttendance[0].present || 0,
            todayTotal: todayAttendance[0].total || 0,
            overallAttendanceRate: overallAttendance[0].total > 0 
                ? ((overallAttendance[0].present / overallAttendance[0].total) * 100).toFixed(2)
                : 0
        };

        res.json(stats);
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }
});

// Get all students
app.get('/api/students', authenticateToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [students] = await connection.execute(`
            SELECT 
                s.id, s.student_id, s.name, s.email, s.created_at, s.photo_path,
                COUNT(a.id) as total_classes,
                SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_classes
            FROM students s
            LEFT JOIN attendance a ON s.student_id = a.student_id
            GROUP BY s.id, s.student_id, s.name, s.email, s.created_at, s.photo_path
            ORDER BY s.name
        `);
        
        // Calculate attendance percentage for each student
        const studentsWithAttendance = students.map(student => ({
            ...student,
            attendanceRate: student.total_classes > 0 
                ? ((student.present_classes / student.total_classes) * 100).toFixed(2)
                : 0,
            photo_url: student.photo_path ? `/uploads/student-photos/${path.basename(student.photo_path)}` : null
        }));

        connection.release();
        res.json(studentsWithAttendance);
    } catch (error) {
        console.error('Students fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch students' });
    }
});

// Add new student
app.post('/api/students', authenticateToken, [
    body('student_id').notEmpty().withMessage('Student ID is required'),
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { student_id, name, email } = req.body;
        const connection = await pool.getConnection();

        const [result] = await connection.execute(
            'INSERT INTO students (student_id, name, email, face_encoding) VALUES (?, ?, ?, ?)',
            [student_id, name, email, ''] // Face encoding will be added later via Python system
        );

        connection.release();
        
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('Add student error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'Student ID already exists' });
        } else {
            res.status(500).json({ error: 'Failed to add student' });
        }
    }
});

// Serve uploaded photos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Debug endpoint to check available photos
app.get('/api/debug/photos', authenticateToken, (req, res) => {
    try {
        const photoDir = path.join(__dirname, 'uploads', 'student-photos');
        if (fs.existsSync(photoDir)) {
            const files = fs.readdirSync(photoDir);
            res.json({ 
                directory: photoDir,
                files: files.map(file => ({
                    filename: file,
                    url: `/uploads/student-photos/${file}`,
                    fullPath: path.join(photoDir, file)
                }))
            });
        } else {
            res.json({ directory: photoDir, files: [], message: 'Directory does not exist' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add new student with photo
app.post('/api/students/with-photo', authenticateToken, uploadImage.single('photo'), async (req, res) => {
    try {
        const { student_id, name, email } = req.body;
        
        if (!student_id || !name || !email) {
            return res.status(400).json({ error: 'Student ID, name, and email are required' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Photo is required' });
        }

        const connection = await pool.getConnection();
        const photoPath = req.file.path;

        try {
            // Insert student record with photo path
            const [result] = await connection.execute(
                'INSERT INTO students (student_id, name, email, face_encoding, photo_path) VALUES (?, ?, ?, ?, ?)',
                [student_id, name, email, '', photoPath]
            );

            // Call Python script to process the face encoding
            const { spawn } = require('child_process');
            const pythonScript = path.join(__dirname, '..', 'python-camera-system', 'register_student.py');
            
            const pythonProcess = spawn('python', [pythonScript, student_id, name, email, photoPath]);
            
            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    console.log(`Face encoding processed successfully for student ${student_id}`);
                } else {
                    console.error(`Face encoding failed for student ${student_id}, code: ${code}`);
                }
            });

            connection.release();
            
            res.json({ 
                success: true, 
                id: result.insertId, 
                message: 'Student added successfully with photo. Face encoding is being processed.' 
            });

        } catch (dbError) {
            connection.release();
            // Clean up uploaded file if database insert fails
            if (fs.existsSync(photoPath)) {
                fs.unlinkSync(photoPath);
            }
            throw dbError;
        }

    } catch (error) {
        console.error('Add student with photo error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'Student ID already exists' });
        } else {
            res.status(500).json({ error: 'Failed to add student with photo' });
        }
    }
});

// Delete student
app.delete('/api/students/:studentId', authenticateToken, async (req, res) => {
    try {
        const { studentId } = req.params;
        const connection = await pool.getConnection();

        // First, get student info including photo path
        const [studentInfo] = await connection.execute(
            'SELECT photo_path FROM students WHERE student_id = ?',
            [studentId]
        );

        if (studentInfo.length === 0) {
            connection.release();
            return res.status(404).json({ error: 'Student not found' });
        }

        const photoPath = studentInfo[0].photo_path;

        // Delete attendance records first (foreign key constraint)
        await connection.execute(
            'DELETE FROM attendance WHERE student_id = ?',
            [studentId]
        );

        // Delete student record
        const [result] = await connection.execute(
            'DELETE FROM students WHERE student_id = ?',
            [studentId]
        );

        connection.release();

        // Delete photo file if it exists
        if (photoPath && fs.existsSync(photoPath)) {
            try {
                fs.unlinkSync(photoPath);
                console.log(`Deleted photo file: ${photoPath}`);
            } catch (fileError) {
                console.error(`Failed to delete photo file: ${fileError.message}`);
            }
        }

        if (result.affectedRows > 0) {
            console.log(`Student ${studentId} deleted successfully`);
            res.json({ success: true, message: 'Student deleted successfully' });
        } else {
            res.status(404).json({ error: 'Student not found' });
        }

    } catch (error) {
        console.error('Delete student error:', error);
        res.status(500).json({ error: 'Failed to delete student' });
    }
});

// Get all classes
app.get('/api/classes', authenticateToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [classes] = await connection.execute(`
            SELECT 
                c.*,
                COUNT(a.id) as total_attendance,
                SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count
            FROM classes c
            LEFT JOIN attendance a ON c.id = a.class_id
            GROUP BY c.id
            ORDER BY c.date DESC, c.start_time ASC
        `);

        connection.release();
        res.json(classes);
    } catch (error) {
        console.error('Classes fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch classes' });
    }
});

// Add new class
app.post('/api/classes', authenticateToken, [
    body('class_name').notEmpty().withMessage('Class name is required'),
    body('start_time').notEmpty().withMessage('Start time is required'),
    body('end_time').notEmpty().withMessage('End time is required'),
    body('date').isISO8601().withMessage('Valid date is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { class_name, start_time, end_time, date } = req.body;
        const connection = await pool.getConnection();

        const [result] = await connection.execute(
            'INSERT INTO classes (class_name, start_time, end_time, date) VALUES (?, ?, ?, ?)',
            [class_name, start_time, end_time, date]
        );

        connection.release();
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('Add class error:', error);
        res.status(500).json({ error: 'Failed to add class' });
    }
});

// Delete class
app.delete('/api/classes/:id', authenticateToken, async (req, res) => {
    try {
        const classId = req.params.id;
        const connection = await pool.getConnection();

        // Check if class exists
        const [classExists] = await connection.execute(
            'SELECT class_name FROM classes WHERE id = ?',
            [classId]
        );

        if (classExists.length === 0) {
            connection.release();
            return res.status(404).json({ error: 'Class not found' });
        }

        // Delete related attendance records first
        await connection.execute(
            'DELETE FROM attendance WHERE class_id = ?',
            [classId]
        );

        // Delete the class
        await connection.execute(
            'DELETE FROM classes WHERE id = ?',
            [classId]
        );

        await logActivity(`Class deleted: ${classExists[0].class_name}`, { classId, deletedBy: req.user.username });

        connection.release();
        res.json({ success: true, message: 'Class deleted successfully' });
    } catch (error) {
        console.error('Delete class error:', error);
        res.status(500).json({ error: 'Failed to delete class' });
    }
});

// Upload timetable
app.post('/api/upload/timetable', authenticateToken, upload.single('timetable'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        const connection = await pool.getConnection();
        let insertedCount = 0;

        for (const row of data) {
            // Assuming Excel columns: class_name, start_time, end_time, date
            if (row.class_name && row.start_time && row.end_time && row.date) {
                try {
                    await connection.execute(
                        'INSERT INTO classes (class_name, start_time, end_time, date) VALUES (?, ?, ?, ?)',
                        [row.class_name, row.start_time, row.end_time, row.date]
                    );
                    insertedCount++;
                } catch (insertError) {
                    console.log('Error inserting row:', insertError);
                }
            }
        }

        connection.release();

        // Delete uploaded file
        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            message: `${insertedCount} classes uploaded successfully`
        });
    } catch (error) {
        console.error('Timetable upload error:', error);
        res.status(500).json({ error: 'Failed to upload timetable' });
    }
});

// Get attendance for a specific class
app.get('/api/attendance/class/:classId', authenticateToken, async (req, res) => {
    try {
        const { classId } = req.params;
        const connection = await pool.getConnection();

        const [attendance] = await connection.execute(`
            SELECT 
                a.id, a.status, a.marked_at,
                s.student_id, s.name, s.email
            FROM attendance a
            JOIN students s ON a.student_id = s.student_id
            WHERE a.class_id = ?
            ORDER BY s.name
        `, [classId]);

        connection.release();
        res.json(attendance);
    } catch (error) {
        console.error('Class attendance fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch class attendance' });
    }
});

// Get attendance report for date range
app.get('/api/reports/attendance', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate, studentId } = req.query;
        const connection = await pool.getConnection();

        let query = `
            SELECT 
                s.student_id, s.name,
                c.class_name, c.date, c.start_time, c.end_time,
                a.status, a.marked_at
            FROM attendance a
            JOIN students s ON a.student_id = s.student_id
            JOIN classes c ON a.class_id = c.id
            WHERE 1=1
        `;
        
        const params = [];

        if (startDate) {
            query += ' AND c.date >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND c.date <= ?';
            params.push(endDate);
        }

        if (studentId) {
            query += ' AND s.student_id = ?';
            params.push(studentId);
        }

        query += ' ORDER BY c.date DESC, c.start_time ASC, s.name ASC';

        const [report] = await connection.execute(query, params);
        connection.release();

        res.json(report);
    } catch (error) {
        console.error('Attendance report error:', error);
        res.status(500).json({ error: 'Failed to generate attendance report' });
    }
});

// Export attendance to Excel
app.get('/api/export/attendance', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const connection = await pool.getConnection();

        const [data] = await connection.execute(`
            SELECT 
                s.student_id as 'Student ID',
                s.name as 'Student Name',
                c.class_name as 'Class Name',
                c.date as 'Date',
                c.start_time as 'Start Time',
                c.end_time as 'End Time',
                a.status as 'Status',
                a.marked_at as 'Marked At'
            FROM attendance a
            JOIN students s ON a.student_id = s.student_id
            JOIN classes c ON a.class_id = c.id
            WHERE c.date BETWEEN ? AND ?
            ORDER BY c.date DESC, c.start_time ASC, s.name ASC
        `, [startDate || '2023-01-01', endDate || new Date().toISOString().split('T')[0]]);

        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');

        // Generate buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        connection.release();

        res.setHeader('Content-Disposition', 'attachment; filename=attendance_report.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export attendance data' });
    }
});

// Get activity logs (password protected)
app.post('/api/logs', authenticateToken, [
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { password } = req.body;

        if (password !== process.env.LOG_PASSWORD) {
            return res.status(401).json({ error: 'Invalid log password' });
        }

        const connection = await pool.getConnection();
        const [logs] = await connection.execute(`
            SELECT * FROM activity_logs 
            ORDER BY timestamp DESC 
            LIMIT 1000
        `);

        connection.release();
        res.json(logs);
    } catch (error) {
        console.error('Logs fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
});

// Client-side activity logging endpoint
app.post('/api/activity-log', authenticateToken, [
    body('activity').notEmpty().withMessage('Activity is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { activity } = req.body;
        const userInfo = req.user ? ` (User: ${req.user.username})` : '';
        await logActivity(`${activity}${userInfo}`);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Client activity log error:', error);
        res.status(500).json({ error: 'Failed to log activity' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Database health check endpoint
app.get('/api/health/db', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        await connection.execute('SELECT 1');
        await connection.end();
        res.json({ 
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Database health check failed:', error);
        res.status(500).json({ 
            database: 'error', 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Attendance summary endpoint
app.get('/api/attendance/summary', authenticateToken, async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // Get summary statistics
        const [summaryResult] = await connection.execute(`
            SELECT 
                COUNT(DISTINCT student_id) as total_students,
                COUNT(*) as total_attendance_records,
                COUNT(DISTINCT class_id) as classes_with_attendance,
                DATE(MIN(marked_at)) as first_attendance,
                DATE(MAX(marked_at)) as last_attendance
            FROM attendance
        `);
        
        // Get recent attendance
        const [recentResult] = await connection.execute(`
            SELECT 
                a.marked_at,
                s.name as student_name,
                c.class_name as class_name
            FROM attendance a
            JOIN students s ON a.student_id = s.student_id
            JOIN classes c ON a.class_id = c.id
            ORDER BY a.marked_at DESC
            LIMIT 10
        `);
        
        await connection.end();
        
        res.json({
            summary: summaryResult[0] || {},
            recent_attendance: recentResult || []
        });
    } catch (error) {
        console.error('Attendance summary error:', error);
        res.status(500).json({ error: 'Failed to get attendance summary' });
    }
});

// Camera and System Control Endpoints - DISABLED for stability
/* 
app.post('/api/system/test-cameras', authenticateToken, async (req, res) => {
    try {
        const { spawn } = require('child_process');
        const pythonProcess = spawn('python', ['test_camera.py', '--non-interactive'], {
            cwd: path.join(__dirname, '..', 'python-camera-system'),
            stdio: 'pipe'
        });

        let output = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pythonProcess.on('close', async (code) => {
            const success = code === 0;
            await logActivity(success ? 'Camera test completed successfully' : 'Camera test failed', { 
                exitCode: code, 
                output: output.substring(0, 500),
                user: req.user.username 
            });
            
            res.json({
                success: success,
                exitCode: code,
                output: output,
                error: errorOutput
            });
        });

        // Timeout after 30 seconds
        setTimeout(() => {
            pythonProcess.kill();
        }, 30000);

    } catch (error) {
        console.error('Camera test error:', error);
        await logActivity('Camera test failed', { error: error.message, user: req.user.username });
        res.status(500).json({ error: 'Failed to test cameras' });
    }
});
*/

// Disabled camera endpoints - can be re-enabled later when camera issues are resolved
app.post('/api/system/test-cameras', authenticateToken, async (req, res) => {
    res.status(503).json({ 
        error: 'Camera testing is temporarily disabled for system stability',
        message: 'This feature has been disabled to prevent server crashes. It will be re-enabled once camera compatibility issues are resolved.'
    });
});

app.post('/api/system/start-attendance', authenticateToken, async (req, res) => {
    res.status(503).json({ 
        error: 'Live attendance marking is temporarily disabled for system stability',
        message: 'This feature has been disabled to prevent server crashes. It will be re-enabled once camera compatibility issues are resolved.'
    });
});

app.post('/api/system/stop-attendance', authenticateToken, async (req, res) => {
    res.status(503).json({ 
        error: 'Live attendance marking is temporarily disabled for system stability',
        message: 'This feature has been disabled to prevent server crashes. It will be re-enabled once camera compatibility issues are resolved.'
    });
});

app.get('/api/system/status', authenticateToken, async (req, res) => {
    try {
        // Camera system is disabled for stability
        res.json({ 
            attendanceSystemRunning: false,
            message: 'Camera system temporarily disabled for stability',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('System status error:', error);
        res.status(500).json({ error: 'Failed to get system status' });
    }
});

// Get real-time system logs
app.get('/api/system/logs', authenticateToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [logs] = await connection.execute(`
            SELECT * FROM activity_logs 
            WHERE activity LIKE '%Camera%' OR activity LIKE '%Attendance system%' OR activity LIKE '%Face%'
            ORDER BY timestamp DESC 
            LIMIT 50
        `);
        connection.release();
        
        res.json(logs);
    } catch (error) {
        console.error('System logs error:', error);
        res.status(500).json({ error: 'Failed to fetch system logs' });
    }
});
// Frame processing endpoint for web terminals
app.post('/api/process-frame', async (req, res) => {
    try {
        const { image, class_id, terminal_id } = req.body;
        
        if (!image || !class_id || !terminal_id) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Convert base64 image to file
        const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const tempImagePath = path.join(__dirname, 'temp', `frame_${terminal_id}_${Date.now()}.jpg`);
        
        // Ensure temp directory exists
        const tempDir = path.dirname(tempImagePath);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        fs.writeFileSync(tempImagePath, imageBuffer);

        // Process frame with Python face recognition
        const pythonScript = path.join(__dirname, '..', 'python-camera-system', 'process_web_frame.py');
        const pythonProcess = spawn('python', [pythonScript, tempImagePath, class_id, terminal_id]);

        let output = '';
        let errorOutput = '';
        let responseCompleted = false;

        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pythonProcess.on('close', (code) => {
            // Clean up temp file
            if (fs.existsSync(tempImagePath)) {
                fs.unlinkSync(tempImagePath);
            }

            // Check if response was already sent
            if (res.headersSent || responseCompleted) {
                return;
            }
            
            responseCompleted = true;
            clearTimeout(timeoutId);

            if (code === 0) {
                try {
                    const result = JSON.parse(output);
                    
                    // Broadcast to WebSocket clients if attendance was marked
                    if (result.attendance_marked && result.attendance_marked.length > 0) {
                        result.attendance_marked.forEach(attendance => {
                            broadcast({
                                type: 'attendance_marked',
                                student_name: attendance.student_name,
                                student_id: attendance.student_id,
                                class_id: class_id,
                                terminal_id: terminal_id,
                                timestamp: new Date().toISOString()
                            });
                        });
                    }
                    
                    res.json(result);
                } catch (parseError) {
                    console.error('Error parsing Python output:', parseError);
                    res.status(500).json({ error: 'Failed to process frame' });
                }
            } else {
                console.error('Python process error:', errorOutput);
                res.status(500).json({ error: 'Face recognition processing failed' });
            }
        });

        // Timeout after 10 seconds
        const timeoutId = setTimeout(() => {
            // Check if response was already sent
            if (res.headersSent || responseCompleted) {
                return;
            }
            
            responseCompleted = true;
            pythonProcess.kill();
            if (fs.existsSync(tempImagePath)) {
                fs.unlinkSync(tempImagePath);
            }
            res.status(500).json({ error: 'Frame processing timeout' });
        }, 10000);

    } catch (error) {
        console.error('Frame processing error:', error);
        res.status(500).json({ error: 'Failed to process frame' });
    }
});

// Get current active class for auto-scheduling
app.get('/api/terminal/current-class', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 8);
        // Use local date to avoid timezone issues
        const currentDate = now.getFullYear() + '-' + 
                           String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                           String(now.getDate()).padStart(2, '0');
        
        const [classes] = await connection.execute(`
            SELECT 
                c.id as class_id,
                c.class_name,
                DATE_FORMAT(c.date, '%Y-%m-%d') as date,
                TIME_FORMAT(c.start_time, '%H:%i:%s') as start_time,
                TIME_FORMAT(c.end_time, '%H:%i:%s') as end_time
            FROM classes c
            WHERE DATE_FORMAT(c.date, '%Y-%m-%d') = ?
            AND TIME_FORMAT(c.start_time, '%H:%i:%s') <= ?
            AND TIME_FORMAT(c.end_time, '%H:%i:%s') >= ?
            ORDER BY c.start_time ASC
            LIMIT 1
        `, [currentDate, currentTime, currentTime]);

        if (classes.length > 0) {
            connection.release();
            res.json({
                hasCurrentClass: true,
                class: classes[0],
                currentTime: currentTime,
                currentDate: currentDate
            });
        } else {
            // Check for upcoming classes within next hour
            const nextHour = new Date(now.getTime() + 60*60*1000).toTimeString().slice(0, 8);
            
            const [upcomingClasses] = await connection.execute(`
                SELECT 
                    c.id as class_id,
                    c.class_name,
                    DATE_FORMAT(c.date, '%Y-%m-%d') as date,
                    TIME_FORMAT(c.start_time, '%H:%i:%s') as start_time,
                    TIME_FORMAT(c.end_time, '%H:%i:%s') as end_time
                FROM classes c
                WHERE DATE_FORMAT(c.date, '%Y-%m-%d') = ?
                AND TIME_FORMAT(c.start_time, '%H:%i:%s') > ?
                AND TIME_FORMAT(c.start_time, '%H:%i:%s') <= ?
                ORDER BY c.start_time ASC
                LIMIT 1
            `, [currentDate, currentTime, nextHour]);
            
            connection.release();
            res.json({
                hasCurrentClass: false,
                hasUpcomingClass: upcomingClasses.length > 0,
                upcomingClass: upcomingClasses.length > 0 ? upcomingClasses[0] : null,
                currentTime: currentTime,
                currentDate: currentDate
            });
        }
    } catch (error) {
        console.error('Current class fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch current class' });
    }
});

// Get classes for terminals (public endpoint)
app.get('/api/terminal/classes', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [classes] = await connection.execute(`
            SELECT 
                c.id as class_id,
                c.class_name,
                DATE_FORMAT(c.date, '%Y-%m-%d') as date,
                TIME_FORMAT(c.start_time, '%H:%i:%s') as start_time,
                TIME_FORMAT(c.end_time, '%H:%i:%s') as end_time,
                COUNT(a.id) as total_attendance,
                SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count
            FROM classes c
            LEFT JOIN attendance a ON c.id = a.class_id
            WHERE c.date >= CURDATE()
            GROUP BY c.id, c.class_name, c.date, c.start_time, c.end_time
            ORDER BY c.date ASC, c.start_time ASC
        `);

        connection.release();
        res.json(classes);
    } catch (error) {
        console.error('Classes fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch classes' });
    }
});

// Get specific class details for terminals  
app.get('/api/terminal/classes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const connection = await pool.getConnection();
        
        const [classes] = await connection.execute(`
            SELECT 
                c.id as class_id,
                c.class_name,
                DATE_FORMAT(c.date, '%Y-%m-%d') as date,
                TIME_FORMAT(c.start_time, '%H:%i:%s') as start_time,
                TIME_FORMAT(c.end_time, '%H:%i:%s') as end_time
            FROM classes c
            WHERE c.id = ?
        `, [id]);

        connection.release();
        
        if (classes.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }
        
        res.json(classes[0]);
    } catch (error) {
        console.error('Class fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch class' });
    }
});

// Email configuration
const emailTransporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Test email configuration on startup
emailTransporter.verify((error, success) => {
    if (error) {
        console.warn('Email configuration error:', error.message);
        console.warn('Email features will be disabled');
    } else {
        console.log('Email service ready');
    }
});

// Send attendance email to all students
app.post('/api/send-attendance-email', authenticateToken, async (req, res) => {
    try {
        const { classId, subject, customMessage } = req.body;
        
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
            return res.status(400).json({ 
                error: 'Email service not configured. Please check environment variables.' 
            });
        }

        const connection = await pool.getConnection();
        
        let query, params;
        let emailSubject = subject || 'Attendance Report';
        
        if (classId) {
            // Send for specific class
            query = `
                SELECT 
                    s.student_id,
                    s.name,
                    s.email,
                    c.class_name,
                    c.date,
                    c.start_time,
                    c.end_time,
                    COALESCE(a.status, 'absent') as status,
                    a.marked_at
                FROM students s
                CROSS JOIN classes c
                LEFT JOIN attendance a ON s.student_id = a.student_id AND c.id = a.class_id
                WHERE c.id = ?
                ORDER BY s.name
            `;
            params = [classId];
        } else {
            // Send for all recent classes (last 7 days)
            query = `
                SELECT 
                    s.student_id,
                    s.name,
                    s.email,
                    c.class_name,
                    c.date,
                    c.start_time,
                    c.end_time,
                    COALESCE(a.status, 'absent') as status,
                    a.marked_at
                FROM students s
                CROSS JOIN classes c
                LEFT JOIN attendance a ON s.student_id = a.student_id AND c.id = a.class_id
                WHERE c.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                ORDER BY s.name, c.date DESC, c.start_time DESC
            `;
            params = [];
        }
        
        const [attendanceData] = await connection.execute(query, params);
        connection.release();
        
        if (attendanceData.length === 0) {
            return res.status(404).json({ error: 'No attendance data found' });
        }
        
        // Group data by student
        const studentData = {};
        attendanceData.forEach(record => {
            if (!studentData[record.student_id]) {
                studentData[record.student_id] = {
                    name: record.name,
                    email: record.email,
                    classes: []
                };
            }
            
            if (record.email) { // Only include students with email addresses
                studentData[record.student_id].classes.push({
                    class_name: record.class_name,
                    date: record.date,
                    start_time: record.start_time,
                    end_time: record.end_time,
                    status: record.status,
                    marked_at: record.marked_at
                });
            }
        });
        
        const emailResults = [];
        let successCount = 0;
        let failureCount = 0;
        
        // Send email to each student
        for (const studentId in studentData) {
            const student = studentData[studentId];
            
            if (!student.email) {
                failureCount++;
                emailResults.push({
                    student: student.name,
                    email: 'N/A',
                    status: 'failed',
                    error: 'No email address'
                });
                continue;
            }
            
            try {
                // Create attendance summary
                const totalClasses = student.classes.length;
                const presentClasses = student.classes.filter(c => c.status === 'present').length;
                const absentClasses = totalClasses - presentClasses;
                const attendancePercentage = totalClasses > 0 ? ((presentClasses / totalClasses) * 100).toFixed(1) : 0;
                
                // Create HTML email content
                const htmlContent = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
                            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
                            .content { padding: 30px; }
                            .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
                            .stats { display: flex; justify-content: space-around; margin: 20px 0; }
                            .stat { text-align: center; }
                            .stat-number { font-size: 24px; font-weight: bold; color: #667eea; }
                            .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
                            .attendance-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                            .attendance-table th, .attendance-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
                            .attendance-table th { background-color: #f8f9fa; font-weight: bold; }
                            .status-present { color: #28a745; font-weight: bold; }
                            .status-absent { color: #dc3545; font-weight: bold; }
                            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>📚 Attendance Report</h1>
                                <p>Your attendance summary for ${student.name}</p>
                            </div>
                            
                            <div class="content">
                                <div class="summary">
                                    <h2>Attendance Summary</h2>
                                    <div class="stats">
                                        <div class="stat">
                                            <div class="stat-number">${attendancePercentage}%</div>
                                            <div class="stat-label">Attendance Rate</div>
                                        </div>
                                        <div class="stat">
                                            <div class="stat-number">${presentClasses}</div>
                                            <div class="stat-label">Present</div>
                                        </div>
                                        <div class="stat">
                                            <div class="stat-number">${absentClasses}</div>
                                            <div class="stat-label">Absent</div>
                                        </div>
                                        <div class="stat">
                                            <div class="stat-number">${totalClasses}</div>
                                            <div class="stat-label">Total Classes</div>
                                        </div>
                                    </div>
                                </div>
                                
                                ${customMessage ? `<div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;"><strong>Message from Admin:</strong><br>${customMessage}</div>` : ''}
                                
                                <h3>Class Details</h3>
                                <table class="attendance-table">
                                    <thead>
                                        <tr>
                                            <th>Class Name</th>
                                            <th>Date</th>
                                            <th>Time</th>
                                            <th>Status</th>
                                            <th>Marked At</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${student.classes.map(cls => `
                                            <tr>
                                                <td>${cls.class_name}</td>
                                                <td>${new Date(cls.date).toLocaleDateString()}</td>
                                                <td>${cls.start_time} - ${cls.end_time}</td>
                                                <td class="status-${cls.status}">${cls.status.toUpperCase()}</td>
                                                <td>${cls.marked_at ? new Date(cls.marked_at).toLocaleString() : 'Not marked'}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                            
                            <div class="footer">
                                <p>This is an automated message from the Attendance Management System.</p>
                                <p>Generated on ${new Date().toLocaleString()}</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `;
                
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: student.email,
                    subject: `${emailSubject} - ${student.name}`,
                    html: htmlContent
                };
                
                await emailTransporter.sendMail(mailOptions);
                successCount++;
                emailResults.push({
                    student: student.name,
                    email: student.email,
                    status: 'sent',
                    attendancePercentage: attendancePercentage
                });
                
            } catch (emailError) {
                failureCount++;
                emailResults.push({
                    student: student.name,
                    email: student.email,
                    status: 'failed',
                    error: emailError.message
                });
            }
        }
        
        // Log the activity
        const activityMessage = `Attendance emails sent: ${successCount} successful, ${failureCount} failed`;
        const connection2 = await pool.getConnection();
        await connection2.execute(
            'INSERT INTO activity_logs (activity) VALUES (?)',
            [activityMessage]
        );
        connection2.release();
        
        res.json({
            message: 'Email sending completed',
            summary: {
                totalStudents: Object.keys(studentData).length,
                successCount,
                failureCount,
                successRate: Object.keys(studentData).length > 0 ? 
                    ((successCount / Object.keys(studentData).length) * 100).toFixed(1) : 0
            },
            results: emailResults
        });
        
    } catch (error) {
        console.error('Email sending error:', error);
        res.status(500).json({ 
            error: 'Failed to send attendance emails',
            details: error.message 
        });
    }
});

// Get email configuration status
app.get('/api/email/status', authenticateToken, (req, res) => {
    const isConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);
    res.json({
        configured: isConfigured,
        service: process.env.EMAIL_SERVICE || 'gmail',
        user: isConfigured ? process.env.EMAIL_USER : null
    });
});

// WebSocket server for real-time communication
const wss = new WebSocket.Server({ 
    server,
    path: '/ws'
});

const connectedClients = new Set();

wss.on('connection', (ws, req) => {
    connectedClients.add(ws);
    console.log('Client connected to WebSocket');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('WebSocket message:', data);
            
            // Handle different message types
            switch (data.type) {
                case 'terminal_register':
                    ws.terminalId = data.terminal_id;
                    break;
                    
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    });
    
    ws.on('close', () => {
        connectedClients.delete(ws);
        console.log('Client disconnected from WebSocket');
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        connectedClients.delete(ws);
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'connection_established',
        timestamp: new Date().toISOString()
    }));
});

// Broadcast function for WebSocket
function broadcast(message) {
    connectedClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    });
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
server.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    console.log(`WebSocket server ready at ws://localhost:${PORT}/ws`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;

