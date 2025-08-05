"""
Student Face Registration Utility
Run this script to add student face images to the system
Can be used for both camera capture and processing uploaded photos
"""

import os
import sys
import cv2
import face_recognition
import mysql.connector
from dotenv import load_dotenv
import numpy as np

load_dotenv()

def connect_to_database():
    """Connect to the MySQL database"""
    try:
        connection = mysql.connector.connect(
            host=os.getenv('DB_HOST'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            database=os.getenv('DB_NAME')
        )
        return connection
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None

def process_photo_file(photo_path, student_id, student_name, student_email):
    """Process an uploaded photo file to extract face encoding"""
    print(f"Processing photo for {student_name} ({student_id})")
    
    try:
        # Load the image
        image = cv2.imread(photo_path)
        if image is None:
            print(f"Error: Could not load image from {photo_path}")
            return False
        
        # Convert BGR to RGB (face_recognition uses RGB)
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Find face locations
        face_locations = face_recognition.face_locations(rgb_image)
        
        if len(face_locations) == 0:
            print("Error: No face found in the image")
            return False
        
        if len(face_locations) > 1:
            print("Warning: Multiple faces found, using the first one")
        
        # Extract face encoding
        face_encodings = face_recognition.face_encodings(rgb_image, face_locations)
        
        if len(face_encodings) == 0:
            print("Error: Could not extract face encoding")
            return False
        
        face_encoding = face_encodings[0]
        
        # Convert to string for database storage
        encoding_str = ','.join([str(x) for x in face_encoding])
        
        # Update database with face encoding
        connection = connect_to_database()
        if not connection:
            return False
        
        try:
            cursor = connection.cursor()
            
            # Update the student record with face encoding
            update_query = """
                UPDATE students 
                SET face_encoding = %s 
                WHERE student_id = %s
            """
            cursor.execute(update_query, (encoding_str, student_id))
            connection.commit()
            
            print(f"✅ Face encoding saved for {student_name}")
            return True
            
        except Exception as e:
            print(f"Error updating database: {e}")
            return False
        finally:
            connection.close()
            
    except Exception as e:
        print(f"Error processing photo: {e}")
        return False

def capture_student_image(student_id, student_name):
    """Capture and process student image for face recognition"""
    print(f"Capturing image for {student_name} ({student_id})")
    print("Press SPACE to capture image, ESC to cancel")
    
    # Initialize camera
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Could not open camera")
        return None
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        # Display the frame
        cv2.imshow('Capture Student Image', frame)
        
        key = cv2.waitKey(1) & 0xFF
        if key == ord(' '):  # Space to capture
            # Save the captured image
            image_path = f"temp_student_{student_id}.jpg"
            cv2.imwrite(image_path, frame)
            cap.release()
            cv2.destroyAllWindows()
            return image_path
        elif key == 27:  # ESC to cancel
            cap.release()
            cv2.destroyAllWindows()
            return None
    
    cap.release()
    cv2.destroyAllWindows()
    return None

def process_face_encoding(image_path):
    """Process image and extract face encoding"""
    try:
        # Load image
        image = face_recognition.load_image_file(image_path)
        
        # Find face encodings
        face_encodings = face_recognition.face_encodings(image)
        
        if len(face_encodings) == 0:
            print("No face found in the image!")
            return None
        
        if len(face_encodings) > 1:
            print("Multiple faces found. Using the first one.")
        
        # Return the first face encoding
        return face_encodings[0]
    
    except Exception as e:
        print(f"Error processing image: {e}")
        return None

def add_student_to_database(student_id, name, email, face_encoding):
    """Add student to database with face encoding"""
    connection = connect_to_database()
    if not connection:
        return False
    
    try:
        cursor = connection.cursor()
        
        # Convert face encoding to string
        encoding_str = ','.join(map(str, face_encoding))
        
        # Insert student data
        query = """
        INSERT INTO students (student_id, name, email, face_encoding)
        VALUES (%s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        email = VALUES(email),
        face_encoding = VALUES(face_encoding)
        """
        
        cursor.execute(query, (student_id, name, email, encoding_str))
        connection.commit()
        
        print(f"Student {name} ({student_id}) successfully added to database!")
        return True
        
    except Exception as e:
        print(f"Error adding student to database: {e}")
        return False
    
    finally:
        cursor.close()
        connection.close()

def register_student_interactive():
    """Interactive student registration"""
    print("=== Student Face Registration ===")
    
    # Get student details
    student_id = input("Enter Student ID: ").strip()
    if not student_id:
        print("Student ID is required!")
        return
    
    name = input("Enter Student Name: ").strip()
    if not name:
        print("Student name is required!")
        return
    
    email = input("Enter Student Email: ").strip()
    if not email:
        print("Student email is required!")
        return
    
    # Capture image
    image_path = capture_student_image(student_id, name)
    if not image_path:
        print("Image capture cancelled or failed!")
        return
    
    # Process face encoding
    face_encoding = process_face_encoding(image_path)
    if face_encoding is None:
        print("Failed to process face from image!")
        # Clean up temp file
        if os.path.exists(image_path):
            os.remove(image_path)
        return
    
    # Add to database
    success = add_student_to_database(student_id, name, email, face_encoding)
    
    # Clean up temp file
    if os.path.exists(image_path):
        os.remove(image_path)
    
    if success:
        print("Student registration completed successfully!")
    else:
        print("Failed to register student!")

def register_from_file(image_file_path):
    """Register student from existing image file"""
    print("=== Register Student from Image File ===")
    
    if not os.path.exists(image_file_path):
        print(f"Image file not found: {image_file_path}")
        return
    
    # Get student details
    student_id = input("Enter Student ID: ").strip()
    if not student_id:
        print("Student ID is required!")
        return
    
    name = input("Enter Student Name: ").strip()
    if not name:
        print("Student name is required!")
        return
    
    email = input("Enter Student Email: ").strip()
    if not email:
        print("Student email is required!")
        return
    
    # Process face encoding
    face_encoding = process_face_encoding(image_file_path)
    if face_encoding is None:
        return
    
    # Add to database
    success = add_student_to_database(student_id, name, email, face_encoding)
    
    if success:
        print("Student registration completed successfully!")
    else:
        print("Failed to register student!")

def main():
    """Main function"""
    if len(sys.argv) == 5:
        # Called from web dashboard: python register_student.py student_id name email photo_path
        student_id = sys.argv[1]
        student_name = sys.argv[2]
        student_email = sys.argv[3]
        photo_path = sys.argv[4]
        
        success = process_photo_file(photo_path, student_id, student_name, student_email)
        if success:
            print(f"Successfully processed photo for {student_name}")
            sys.exit(0)
        else:
            print(f"Failed to process photo for {student_name}")
            sys.exit(1)
            
    elif len(sys.argv) > 1:
        # Register from file
        image_path = sys.argv[1]
        register_from_file(image_path)
    else:
        # Interactive registration
        register_student_interactive()

if __name__ == "__main__":
    main()
