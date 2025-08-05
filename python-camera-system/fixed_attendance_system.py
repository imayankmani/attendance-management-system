import os
import cv2
import face_recognition
import numpy as np
import mysql.connector
from datetime import datetime, timedelta
import threading
import time
import logging
from dotenv import load_dotenv

load_dotenv()

class FixedAttendanceSystem:
    def __init__(self):
        self.setup_logging()
        self.setup_database()
        self.load_valid_faces()
        self.current_class = None
        self.class_start_time = None
        self.absent_toggle_timer = {}
        self.camera = None
        self.system_active = False
        
    def setup_logging(self):
        """Setup comprehensive logging"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('attendance_system.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        self.logger.info("=== Fixed Attendance System Starting ===")
    
    def setup_database(self):
        """Setup database connection with error handling"""
        try:
            self.db_connection = mysql.connector.connect(
                host=os.getenv('DB_HOST'),
                user=os.getenv('DB_USER'),
                password=os.getenv('DB_PASSWORD'),
                database=os.getenv('DB_NAME'),
                auth_plugin='mysql_native_password'
            )
            self.cursor = self.db_connection.cursor()
            self.logger.info("Database connection established successfully")
            return True
        except Exception as e:
            self.logger.error(f"Database connection failed: {e}")
            return False
    
    def load_valid_faces(self):
        """Load only valid face encodings from database"""
        try:
            self.cursor.execute("SELECT student_id, name, face_encoding FROM students")
            students = self.cursor.fetchall()
            
            self.known_face_encodings = []
            self.known_face_names = []
            self.known_face_ids = []
            
            valid_count = 0
            invalid_count = 0
            
            for student_id, name, encoding_str in students:
                try:
                    # Convert string back to numpy array
                    encoding = np.fromstring(encoding_str, sep=',')
                    
                    # Only accept 128-dimensional encodings
                    if encoding.shape[0] == 128:
                        self.known_face_encodings.append(encoding)
                        self.known_face_names.append(name)
                        self.known_face_ids.append(student_id)
                        valid_count += 1
                        self.logger.info(f"✅ Loaded valid encoding for {name} ({student_id})")
                    else:
                        invalid_count += 1
                        self.logger.warning(f"❌ Skipped invalid encoding for {name} ({student_id}) - Shape: {encoding.shape}")
                        
                except Exception as e:
                    invalid_count += 1
                    self.logger.warning(f"❌ Failed to load encoding for {name} ({student_id}): {e}")
            
            self.logger.info(f"Face encoding summary: {valid_count} valid, {invalid_count} invalid")
            
            if valid_count > 0:
                # Test if we can create a numpy array from valid encodings
                try:
                    test_array = np.array(self.known_face_encodings)
                    self.logger.info(f"Face encodings array shape: {test_array.shape}")
                    return True
                except Exception as e:
                    self.logger.error(f"Error creating face encodings array: {e}")
                    return False
            else:
                self.logger.error("No valid face encodings found!")
                return False
            
        except Exception as e:
            self.logger.error(f"Error loading known faces: {e}")
            return False
    
    def get_current_class(self):
        """Get current active class with improved time handling"""
        try:
            current_time = datetime.now().time()
            current_date = datetime.now().date()
            
            query = """
            SELECT id, class_name, start_time, end_time
            FROM classes
            WHERE date = %s AND start_time <= %s AND end_time >= %s
            ORDER BY start_time DESC
            LIMIT 1
            """
            
            self.cursor.execute(query, (current_date, current_time, current_time))
            result = self.cursor.fetchone()
            
            if result:
                class_id, class_name, start_time, end_time = result
                
                # Handle different time data types
                if isinstance(start_time, timedelta):
                    start_time = (datetime.min + start_time).time()
                if isinstance(end_time, timedelta):
                    end_time = (datetime.min + end_time).time()
                
                return {
                    'id': class_id,
                    'name': class_name,
                    'start_time': start_time,
                    'end_time': end_time
                }
            return None
        except Exception as e:
            self.logger.error(f"Error getting current class: {e}")
            return None
    
    def initialize_camera(self):
        """Initialize camera with multiple backend support"""
        try:
            # Try different camera backends
            backends = [cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY]
            camera_index = 0
            
            for backend in backends:
                try:
                    self.logger.info(f"Trying camera with backend: {backend}")
                    self.camera = cv2.VideoCapture(camera_index, backend)
                    
                    if self.camera.isOpened():
                        # Test if we can actually read frames
                        ret, frame = self.camera.read()
                        if ret and frame is not None:
                            # Set camera properties
                            self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                            self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                            self.camera.set(cv2.CAP_PROP_FPS, 30)
                            
                            self.logger.info(f"Camera initialized successfully with backend {backend}")
                            return True
                    
                    self.camera.release()
                except Exception as e:
                    self.logger.warning(f"Backend {backend} failed: {e}")
                    continue
            
            raise Exception("All camera backends failed")
            
        except Exception as e:
            self.logger.error(f"Camera initialization failed: {e}")
            return False
    
    def process_frame(self):
        """Process camera frame for face detection and recognition"""
        if not self.camera or not self.camera.isOpened():
            return None, None
        
        ret, frame = self.camera.read()
        if not ret or frame is None:
            return None, None
        
        # Resize frame for faster processing
        small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
        rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
        
        detected_students = []
        
        try:
            # Find faces in the frame
            face_locations = face_recognition.face_locations(rgb_small_frame)
            
            if len(face_locations) > 0:
                self.logger.debug(f"Found {len(face_locations)} faces in frame")
                
                # Get face encodings with error handling
                try:
                    face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations)
                    
                    # Only proceed if we have valid known faces
                    if len(self.known_face_encodings) > 0:
                        # Compare with known faces
                        for i, face_encoding in enumerate(face_encodings):
                            try:
                                matches = face_recognition.compare_faces(self.known_face_encodings, face_encoding, tolerance=0.6)
                                face_distances = face_recognition.face_distance(self.known_face_encodings, face_encoding)
                                
                                if len(face_distances) > 0:
                                    best_match_index = np.argmin(face_distances)
                                    
                                    if matches[best_match_index] and face_distances[best_match_index] < 0.6:
                                        student_id = self.known_face_ids[best_match_index]
                                        student_name = self.known_face_names[best_match_index]
                                        confidence = 1 - face_distances[best_match_index]
                                        
                                        detected_students.append({
                                            'id': student_id,
                                            'name': student_name,
                                            'confidence': confidence,
                                            'location': face_locations[i]
                                        })
                                        
                                        self.logger.info(f"🎯 RECOGNIZED: {student_name} ({student_id}) - Confidence: {confidence:.2f}")
                            except Exception as e:
                                self.logger.warning(f"Face comparison error: {e}")
                    else:
                        self.logger.warning("No valid known faces loaded for comparison")
                        
                except Exception as e:
                    self.logger.warning(f"Face encoding error: {e}")
        
        except Exception as e:
            self.logger.error(f"Frame processing error: {e}")
        
        return detected_students, frame
    
    def mark_attendance(self, student_id, status='present'):
        """Mark attendance for a student with comprehensive logging"""
        if not self.current_class:
            self.logger.warning("No active class - cannot mark attendance")
            return False
        
        try:
            current_time = datetime.now()
            
            # Check if attendance already exists for this class
            check_query = """
            SELECT id, status, marked_at FROM attendance
            WHERE student_id = %s AND class_id = %s
            ORDER BY marked_at DESC LIMIT 1
            """
            self.cursor.execute(check_query, (student_id, self.current_class['id']))
            existing = self.cursor.fetchone()
            
            if existing:
                # Update existing attendance
                update_query = """
                UPDATE attendance SET status = %s, marked_at = %s
                WHERE id = %s
                """
                self.cursor.execute(update_query, (status, current_time, existing[0]))
                self.logger.info(f"📝 UPDATED: {student_id} attendance changed from {existing[1]} to {status}")
            else:
                # Insert new attendance record
                insert_query = """
                INSERT INTO attendance (student_id, class_id, status, marked_at)
                VALUES (%s, %s, %s, %s)
                """
                self.cursor.execute(insert_query, (student_id, self.current_class['id'], status, current_time))
                self.logger.info(f"📝 NEW RECORD: {student_id} marked as {status} at {current_time}")
            
            self.db_connection.commit()
            
            # Log activity
            activity = f"Student {student_id} marked {status} for class {self.current_class['name']} at {current_time}"
            self.log_activity(activity)
            
            return True
        except Exception as e:
            self.logger.error(f"Error marking attendance for {student_id}: {e}")
            return False
    
    def log_activity(self, activity):
        """Log system activity to database"""
        try:
            query = "INSERT INTO activity_logs (activity) VALUES (%s)"
            self.cursor.execute(query, (activity,))
            self.db_connection.commit()
        except Exception as e:
            self.logger.error(f"Error logging activity: {e}")
    
    def handle_absent_toggle(self, student_id, duration=3):
        """Handle absent toggle timer to prevent rapid status changes"""
        def clear_timer():
            time.sleep(duration)
            if student_id in self.absent_toggle_timer:
                del self.absent_toggle_timer[student_id]
        
        if student_id not in self.absent_toggle_timer:
            self.absent_toggle_timer[student_id] = threading.Thread(target=clear_timer)
            self.absent_toggle_timer[student_id].start()
            return True
        return False
    
    def draw_detection_info(self, frame, detected_students):
        """Draw detection information on frame"""
        if not detected_students:
            return frame
        
        for student in detected_students:
            # Scale up the face location since we processed a smaller frame
            top, right, bottom, left = student['location']
            top *= 4
            right *= 4
            bottom *= 4
            left *= 4
            
            # Draw rectangle around face
            cv2.rectangle(frame, (left, top), (right, bottom), (0, 255, 0), 2)
            
            # Draw label
            label = f"{student['name']} ({student['confidence']:.2f})"
            cv2.rectangle(frame, (left, bottom - 35), (right, bottom), (0, 255, 0), cv2.FILLED)
            cv2.putText(frame, label, (left + 6, bottom - 6), cv2.FONT_HERSHEY_DUPLEX, 0.6, (255, 255, 255), 1)
        
        return frame
    
    def run_system(self):
        """Main system loop with comprehensive error handling"""
        self.system_active = True
        self.logger.info("Starting main attendance marking loop")
        
        while self.system_active:
            try:
                # Check for current class
                current_class = self.get_current_class()
                
                if current_class:
                    # New class detected
                    if self.current_class != current_class:
                        self.current_class = current_class
                        self.class_start_time = datetime.now()
                        self.log_activity(f"Class started: {current_class['name']}")
                        self.logger.info(f"*** CLASS STARTED: {current_class['name']} (ID: {current_class['id']}) ***")
                    
                    # Initialize camera if needed
                    if not self.camera:
                        if not self.initialize_camera():
                            self.logger.error("Failed to initialize camera, waiting 5 seconds...")
                            time.sleep(5)
                            continue
                    
                    # Process frame
                    detected_students, frame = self.process_frame()
                    
                    if frame is not None:
                        # Mark attendance for detected students
                        if detected_students:
                            for student in detected_students:
                                self.mark_attendance(student['id'], 'present')
                                self.handle_absent_toggle(student['id'])
                        
                        # Draw detection info on frame
                        display_frame = self.draw_detection_info(frame.copy(), detected_students)
                        
                        # Add system info overlay
                        cv2.putText(display_frame, f"Class: {self.current_class['name']}", (10, 30), 
                                  cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                        cv2.putText(display_frame, f"Known Students: {len(self.known_face_encodings)}", (10, 60), 
                                  cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                        cv2.putText(display_frame, f"Detected: {len(detected_students) if detected_students else 0}", (10, 90), 
                                  cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                        
                        # Show frame
                        cv2.imshow('Fixed Attendance System', display_frame)
                    
                    # Check for quit command
                    key = cv2.waitKey(1) & 0xFF
                    if key == ord('q'):
                        self.logger.info("User requested system shutdown")
                        break
                    elif key == ord('s'):
                        # Save screenshot
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        if frame is not None:
                            cv2.imwrite(f"attendance_screenshot_{timestamp}.jpg", frame)
                            self.logger.info(f"Screenshot saved: attendance_screenshot_{timestamp}.jpg")
                
                else:
                    # No active class
                    if self.camera:
                        self.camera.release()
                        self.camera = None
                        cv2.destroyAllWindows()
                        self.current_class = None
                        self.log_activity("Camera shut down - no active class")
                        self.logger.info("No active class - camera shut down")
                    
                    time.sleep(10)  # Check for classes every 10 seconds
            
            except Exception as e:
                self.logger.error(f"Error in main loop: {e}")
                time.sleep(5)
        
        # Cleanup
        if self.camera:
            self.camera.release()
        cv2.destroyAllWindows()
        if self.db_connection:
            self.db_connection.close()
        self.logger.info("=== Fixed Attendance System Stopped ===")
    
    def start(self):
        """Start the attendance system with initial checks"""
        self.logger.info("Performing system checks...")
        
        # Check database connection
        if not self.setup_database():
            self.logger.error("Database connection failed - cannot start system")
            return False
        
        # Load valid faces
        if not self.load_valid_faces():
            self.logger.error("No valid face encodings loaded - cannot start system")
            return False
        
        # Check for active class
        current_class = self.get_current_class()
        if current_class:
            self.logger.info(f"Active class found: {current_class['name']}")
        else:
            self.logger.warning("No active class currently - waiting for class to start")
        
        self.logger.info("System checks passed - starting attendance system")
        self.logger.info("Controls: Press 'q' to quit, 's' to save screenshot")
        
        try:
            self.run_system()
        except KeyboardInterrupt:
            self.logger.info("System interrupted by user")
        finally:
            self.system_active = False

if __name__ == "__main__":
    system = FixedAttendanceSystem()
    system.start()
