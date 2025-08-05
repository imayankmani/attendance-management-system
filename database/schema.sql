-- Attendance Management System Database Schema
-- Run this script to create the database structure

CREATE DATABASE IF NOT EXISTS attendance_system;
USE attendance_system;

-- Students table
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    face_encoding LONGTEXT NOT NULL,
    photo_path VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student_id (student_id),
    INDEX idx_email (email)
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_date (date),
    INDEX idx_class_name (class_name),
    INDEX idx_time_range (date, start_time, end_time)
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL,
    class_id INT NOT NULL,
    status ENUM('present', 'absent') DEFAULT 'absent',
    marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    UNIQUE KEY unique_student_class (student_id, class_id),
    INDEX idx_student_id (student_id),
    INDEX idx_class_id (class_id),
    INDEX idx_status (status),
    INDEX idx_marked_at (marked_at)
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activity TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_timestamp (timestamp)
);

-- Admin users table (for future expansion)
CREATE TABLE IF NOT EXISTS admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    INDEX idx_username (username)
);

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_setting_key (setting_key)
);

-- Email templates table
CREATE TABLE IF NOT EXISTS email_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    template_name VARCHAR(100) UNIQUE NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body_html LONGTEXT NOT NULL,
    body_text LONGTEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_template_name (template_name)
);

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('attendance_threshold', '75', 'Minimum attendance percentage for warning'),
('class_start_buffer', '10', 'Minutes after class start when no new students can be marked present'),
('class_end_buffer', '20', 'Minutes before class end when no attendance changes are allowed'),
('absent_toggle_duration', '3', 'Seconds to wait before marking absent after present detection'),
('email_enabled', 'true', 'Whether to send daily email reports'),
('system_active', 'true', 'Whether the camera system is active')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Insert default email template
INSERT INTO email_templates (template_name, subject, body_html, body_text) VALUES
('daily_attendance_report', 
 'Daily Attendance Report - {{date}}',
 '<html><body><h2>Daily Attendance Report</h2><p>Dear {{student_name}},</p><p>Here is your attendance report for {{date}}:</p>{{attendance_table}}<h3>Overall Attendance: {{attendance_percentage}}%</h3>{{warning_message}}</body></html>',
 'Daily Attendance Report\n\nDear {{student_name}},\n\nHere is your attendance report for {{date}}:\n\n{{attendance_text}}\n\nOverall Attendance: {{attendance_percentage}}%\n\n{{warning_text}}'
)
ON DUPLICATE KEY UPDATE 
    subject = VALUES(subject),
    body_html = VALUES(body_html),
    body_text = VALUES(body_text);

-- Create views for reporting
CREATE OR REPLACE VIEW student_attendance_summary AS
SELECT 
    s.id,
    s.student_id,
    s.name,
    s.email,
    COUNT(a.id) as total_classes_attended,
    SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as classes_present,
    SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as classes_absent,
    ROUND(
        (SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / COUNT(a.id)) * 100, 
        2
    ) as attendance_percentage
FROM students s
LEFT JOIN attendance a ON s.student_id = a.student_id
GROUP BY s.id, s.student_id, s.name, s.email;

CREATE OR REPLACE VIEW daily_attendance_summary AS
SELECT 
    DATE(c.date) as attendance_date,
    COUNT(DISTINCT c.id) as total_classes,
    COUNT(a.id) as total_attendance_records,
    SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as total_present,
    SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as total_absent,
    ROUND(
        (SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / COUNT(a.id)) * 100, 
        2
    ) as daily_attendance_rate
FROM classes c
LEFT JOIN attendance a ON c.id = a.class_id
GROUP BY DATE(c.date)
ORDER BY attendance_date DESC;

-- Create stored procedures for common operations
DELIMITER //

CREATE PROCEDURE GetStudentAttendanceReport(
    IN p_student_id VARCHAR(50),
    IN p_start_date DATE,
    IN p_end_date DATE
)
BEGIN
    SELECT 
        s.student_id,
        s.name,
        c.class_name,
        c.date,
        c.start_time,
        c.end_time,
        a.status,
        a.marked_at
    FROM students s
    LEFT JOIN attendance a ON s.student_id = a.student_id
    LEFT JOIN classes c ON a.class_id = c.id
    WHERE s.student_id = p_student_id
    AND c.date BETWEEN p_start_date AND p_end_date
    ORDER BY c.date DESC, c.start_time ASC;
END //

CREATE PROCEDURE GetClassAttendanceReport(
    IN p_class_id INT
)
BEGIN
    SELECT 
        c.class_name,
        c.date,
        c.start_time,
        c.end_time,
        s.student_id,
        s.name,
        s.email,
        COALESCE(a.status, 'absent') as status,
        a.marked_at
    FROM classes c
    CROSS JOIN students s
    LEFT JOIN attendance a ON c.id = a.class_id AND s.student_id = a.student_id
    WHERE c.id = p_class_id
    ORDER BY s.name;
END //

CREATE PROCEDURE MarkAttendance(
    IN p_student_id VARCHAR(50),
    IN p_class_id INT,
    IN p_status ENUM('present', 'absent')
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
    
    INSERT INTO attendance (student_id, class_id, status)
    VALUES (p_student_id, p_class_id, p_status)
    ON DUPLICATE KEY UPDATE 
        status = p_status,
        marked_at = CURRENT_TIMESTAMP;
    
    INSERT INTO activity_logs (activity)
    VALUES (CONCAT('Student ', p_student_id, ' marked ', p_status, ' for class ID ', p_class_id));
    
    COMMIT;
END //

DELIMITER ;

-- Create triggers for audit logging
DELIMITER //

CREATE TRIGGER attendance_insert_log
    AFTER INSERT ON attendance
    FOR EACH ROW
BEGIN
    INSERT INTO activity_logs (activity)
    VALUES (CONCAT('New attendance record created: Student ', NEW.student_id, ' - ', NEW.status, ' for class ID ', NEW.class_id));
END //

CREATE TRIGGER attendance_update_log
    AFTER UPDATE ON attendance
    FOR EACH ROW
BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO activity_logs (activity)
        VALUES (CONCAT('Attendance updated: Student ', NEW.student_id, ' changed from ', OLD.status, ' to ', NEW.status, ' for class ID ', NEW.class_id));
    END IF;
END //

CREATE TRIGGER student_insert_log
    AFTER INSERT ON students
    FOR EACH ROW
BEGIN
    INSERT INTO activity_logs (activity)
    VALUES (CONCAT('New student registered: ', NEW.name, ' (', NEW.student_id, ')'));
END //

CREATE TRIGGER class_insert_log
    AFTER INSERT ON classes
    FOR EACH ROW
BEGIN
    INSERT INTO activity_logs (activity)
    VALUES (CONCAT('New class created: ', NEW.class_name, ' on ', NEW.date, ' from ', NEW.start_time, ' to ', NEW.end_time));
END //

DELIMITER ;

-- Insert sample data (optional - for testing)
-- INSERT INTO students (student_id, name, email, face_encoding) VALUES
-- ('STD001', 'John Doe', 'john.doe@example.com', ''),
-- ('STD002', 'Jane Smith', 'jane.smith@example.com', ''),
-- ('STD003', 'Bob Johnson', 'bob.johnson@example.com', '');

-- INSERT INTO classes (class_name, start_time, end_time, date) VALUES
-- ('Mathematics 101', '09:00:00', '10:30:00', CURDATE()),
-- ('Physics 201', '11:00:00', '12:30:00', CURDATE()),
-- ('Chemistry 301', '14:00:00', '15:30:00', CURDATE());

COMMIT;
