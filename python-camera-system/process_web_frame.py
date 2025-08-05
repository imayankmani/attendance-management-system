#!/usr/bin/env python3
"""
Web Frame Processing Script for Attendance System
Processes camera frames sent from web terminals
"""

import sys
import json
import cv2
import numpy as np
import face_recognition
import mysql.connector
from datetime import datetime
import os
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def load_database_config():
    """Load database configuration from environment or defaults"""
    return {
        'host': os.getenv('DB_HOST', 'localhost'),
        'user': os.getenv('DB_USER', 'root'),
        'password': os.getenv('DB_PASSWORD', 'mani123'),
        'database': os.getenv('DB_NAME', 'attendance_system'),
        'port': int(os.getenv('DB_PORT', 3306))
    }

def load_known_faces():
    """Load known face encodings from database"""
    try:
        db_config = load_database_config()
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT student_id, name, face_encoding 
            FROM students 
            WHERE face_encoding IS NOT NULL AND face_encoding != ''
        """)
        
        students = cursor.fetchall()
        known_encodings = []
        known_names = []
        known_ids = []
        
        for student in students:
            try:
                # Parse face encoding from comma-separated string
                encoding_str = student['face_encoding'].strip()
                if encoding_str:
                    encoding_list = [float(x) for x in encoding_str.split(',')]
                    if len(encoding_list) == 128:  # Valid face encoding
                        known_encodings.append(np.array(encoding_list))
                        known_names.append(student['name'])
                        known_ids.append(student['student_id'])
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid face encoding for student {student['student_id']}: {e}")
                continue
        
        cursor.close()
        connection.close()
        
        logger.info(f"Loaded {len(known_encodings)} valid face encodings")
        return known_encodings, known_names, known_ids
        
    except Exception as e:
        logger.error(f"Error loading known faces: {e}")
        return [], [], []

def mark_attendance(student_id, class_id, terminal_id):
    """Mark attendance for a student"""
    try:
        db_config = load_database_config()
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor()
        
        # Check if attendance already exists for this class
        cursor.execute("""
            SELECT id FROM attendance 
            WHERE student_id = %s AND class_id = %s
        """, (student_id, class_id))
        
        if cursor.fetchone():
            cursor.close()
            connection.close()
            return False  # Already marked
        
        # Mark attendance as present
        cursor.execute("""
            INSERT INTO attendance (student_id, class_id, status, marked_at, terminal_id)
            VALUES (%s, %s, 'present', NOW(), %s)
        """, (student_id, class_id, terminal_id))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        logger.info(f"Attendance marked for student {student_id} in class {class_id}")
        return True
        
    except Exception as e:
        logger.error(f"Error marking attendance: {e}")
        return False

def process_frame(image_path, class_id, terminal_id):
    """Process a single frame for face recognition"""
    try:
        # Load the image
        image = cv2.imread(image_path)
        if image is None:
            logger.error("Could not load image")
            return {"error": "Could not load image"}
        
        # Convert BGR to RGB
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Find faces in the image
        face_locations = face_recognition.face_locations(rgb_image)
        face_encodings = face_recognition.face_encodings(rgb_image, face_locations)
        
        if not face_locations:
            return {"faces": [], "attendance_marked": []}
        
        # Load known faces
        known_encodings, known_names, known_ids = load_known_faces()
        
        if not known_encodings:
            logger.warning("No known face encodings available")
            return {"faces": [], "attendance_marked": []}
        
        faces_data = []
        attendance_marked = []
        
        for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
            # Compare with known faces
            matches = face_recognition.compare_faces(known_encodings, face_encoding, tolerance=0.6)
            distances = face_recognition.face_distance(known_encodings, face_encoding)
            
            if len(distances) > 0:
                best_match_index = np.argmin(distances)
                
                if matches[best_match_index] and distances[best_match_index] < 0.6:
                    # Recognized face
                    student_name = known_names[best_match_index]
                    student_id = known_ids[best_match_index]
                    
                    face_data = {
                        "x": left,
                        "y": top,
                        "width": right - left,
                        "height": bottom - top,
                        "recognized": True,
                        "name": student_name,
                        "student_id": student_id,
                        "confidence": 1 - distances[best_match_index]
                    }
                    
                    # Try to mark attendance
                    if mark_attendance(student_id, class_id, terminal_id):
                        attendance_marked.append({
                            "student_id": student_id,
                            "student_name": student_name
                        })
                else:
                    # Unknown face
                    face_data = {
                        "x": left,
                        "y": top,
                        "width": right - left,
                        "height": bottom - top,
                        "recognized": False,
                        "name": "Unknown",
                        "confidence": 0
                    }
            else:
                # No known encodings to compare
                face_data = {
                    "x": left,
                    "y": top,
                    "width": right - left,
                    "height": bottom - top,
                    "recognized": False,
                    "name": "Unknown",
                    "confidence": 0
                }
            
            faces_data.append(face_data)
        
        return {
            "faces": faces_data,
            "attendance_marked": attendance_marked,
            "total_faces": len(faces_data)
        }
        
    except Exception as e:
        logger.error(f"Error processing frame: {e}")
        return {"error": str(e)}

def main():
    """Main function"""
    if len(sys.argv) != 4:
        print(json.dumps({"error": "Usage: python process_web_frame.py <image_path> <class_id> <terminal_id>"}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    class_id = sys.argv[2]
    terminal_id = sys.argv[3]
    
    result = process_frame(image_path, class_id, terminal_id)
    print(json.dumps(result))

if __name__ == "__main__":
    main()
