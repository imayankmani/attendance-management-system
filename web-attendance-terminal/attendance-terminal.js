class AttendanceTerminal {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('overlay');
        this.ctx = this.canvas.getContext('2d');
        this.stream = null;
        this.recognitionActive = false;
        this.currentClass = null;
        this.terminalId = this.generateTerminalId();
        this.wsConnection = null;
        this.apiBaseUrl = window.location.origin.replace('3002', '3001'); // Backend URL
        this.isLoggedIn = false;
        this.currentOperator = null;
        this.autoScheduleTimer = null;
        this.classCheckInterval = null;
        this.cameraIdleTimeout = null;
        this.isAutoMode = false;
        
        this.initializeTerminal();
        this.setupEventListeners();
        this.connectWebSocket();
        this.startAutoScheduling();
    }

    generateTerminalId() {
        return Math.random().toString(36).substr(2, 9).toUpperCase();
    }

    initializeTerminal() {
        document.getElementById('terminalId').textContent = this.terminalId;
        this.updateStatus('terminalStatus', 'Ready');
        this.showLoginForm();
        this.updateDebugInfo('Terminal initialized, ready for login');
    }

    setupEventListeners() {
        document.getElementById('loginBtn').addEventListener('click', () => this.handleLogin());
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());
        document.getElementById('startBtn').addEventListener('click', () => this.startCamera());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopCamera());
        document.getElementById('toggleRecognition').addEventListener('click', () => this.toggleRecognition());
        document.getElementById('classSelect').addEventListener('change', (e) => this.selectClass(e.target.value));
        document.getElementById('autoModeToggle').addEventListener('change', (e) => this.toggleAutoMode(e.target.checked));
        
        // Login form enter key
        document.getElementById('operatorName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
    }

    async connectWebSocket() {
        try {
            const wsUrl = window.location.origin.replace('http', 'ws').replace('3002', '3001') + '/ws';
            this.wsConnection = new WebSocket(wsUrl);
            
            this.wsConnection.onopen = () => {
                this.updateConnectionStatus('🟢 Connected');
                this.log('Connected to attendance server', 'success');
            };
            
            this.wsConnection.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            };
            
            this.wsConnection.onclose = () => {
                this.updateConnectionStatus('🔴 Disconnected');
                this.log('Disconnected from server', 'error');
                // Attempt to reconnect after 5 seconds
                setTimeout(() => this.connectWebSocket(), 5000);
            };
            
            this.wsConnection.onerror = (error) => {
                this.log('Connection error: ' + error.message, 'error');
            };
        } catch (error) {
            this.log('WebSocket connection failed: ' + error.message, 'error');
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'attendance_marked':
                this.log(`Attendance marked: ${data.student_name}`, 'success');
                this.updateCounter('attendanceMarked', data.total_marked);
                this.showNotification(`✅ ${data.student_name} marked present`, 'success');
                break;
            case 'student_detected':
                this.updateCounter('studentsDetected', data.count);
                break;
            case 'class_started':
                this.log(`Class started: ${data.class_name}`, 'info');
                break;
            case 'system_status':
                this.updateSystemStatus(data);
                break;
        }
    }

    async loadClasses() {
        try {
            console.log('loadClasses() called - starting to fetch classes');
            this.updateDebugInfo('Loading classes from API...');
            
            const response = await fetch(`${this.apiBaseUrl}/api/terminal/classes`);
            console.log('Response received:', response.status, response.statusText);
            
            this.updateDebugInfo(`API response: ${response.status} ${response.statusText}`);
            
            const data = await response.json();
            console.log('Raw data from API:', data);
            
            const classes = data.value || data; // Handle both array and object responses
            console.log('Processed classes array:', classes);
            console.log('Classes is array?', Array.isArray(classes));
            console.log('Classes length:', classes ? classes.length : 'null/undefined');
            
            this.updateDebugInfo(`Received ${Array.isArray(classes) ? classes.length : 'invalid'} classes from API`);
            
            const select = document.getElementById('classSelect');
            console.log('classSelect element found:', !!select);
            
            if (!select) {
                console.error('ERROR: classSelect element not found in DOM!');
                this.log('ERROR: classSelect element not found in DOM!', 'error');
                this.updateDebugInfo('ERROR: classSelect dropdown not found in DOM!');
                return;
            }
            
            select.innerHTML = '<option value="">Select a class...</option>';
            console.log('Reset dropdown with default option');
            
            // Filter classes - show current and upcoming classes only
            const now = new Date();
            const currentTime = now.toTimeString().slice(0, 8);
            // Use local date to match backend format
            const currentDate = now.getFullYear() + '-' + 
                               String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                               String(now.getDate()).padStart(2, '0');
            
            console.log('Current date:', currentDate, 'Current time:', currentTime);
            
            if (!Array.isArray(classes)) {
                console.error('ERROR: classes is not an array:', typeof classes, classes);
                this.log('ERROR: Classes data is not an array', 'error');
                this.updateDebugInfo(`ERROR: Classes data is not an array (${typeof classes})`);
                return;
            }
            
            console.log('TEMPORARILY SKIPPING FILTERING - Adding all classes directly to dropdown');
            this.updateDebugInfo('Processing classes for dropdown...');
            
            // TEMPORARILY SKIP FILTERING - ADD ALL CLASSES
            classes.forEach((classItem, index) => {
                console.log(`Adding option ${index + 1}:`, classItem);
                const option = document.createElement('option');
                option.value = classItem.class_id;
                
                const startTime = classItem.start_time.slice(0, 5); // HH:MM format
                const endTime = classItem.end_time.slice(0, 5);
                option.textContent = `${classItem.class_name} (${startTime}-${endTime})`;
                
                // Mark current classes
                if (this.isClassCurrentlyActive(classItem)) {
                    option.textContent += ' - ACTIVE NOW';
                    option.style.fontWeight = 'bold';
                    option.style.color = '#2196F3';
                }
                
                select.appendChild(option);
                console.log(`Option added to dropdown: ${option.textContent}`);
            });
            
            console.log('Final dropdown innerHTML:', select.innerHTML);
            console.log('Final dropdown options count:', select.options.length);
            
            this.updateDebugInfo(`SUCCESS: Loaded ${classes.length} classes into dropdown!`);
            this.log(`Loaded ${classes.length} classes (UNFILTERED FOR DEBUGGING)`, 'info');
        } catch (error) {
            console.error('Error in loadClasses:', error);
            this.log('Failed to load classes: ' + error.message, 'error');
            this.updateDebugInfo(`ERROR loading classes: ${error.message}`);
            
            // Display error on page for debugging
            const select = document.getElementById('classSelect');
            if (select) {
                select.innerHTML = `<option value="">ERROR: ${error.message}</option>`;
            }
            
            // Show a visual notification
            this.showNotification('ERROR: Failed to load classes - ' + error.message, 'error');
        }
    }

    isClassCurrentlyActive(classItem) {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 8);
        // Use local date to match backend format
        const currentDate = now.getFullYear() + '-' + 
                           String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                           String(now.getDate()).padStart(2, '0');
        
        return classItem.date === currentDate && 
               classItem.start_time <= currentTime && 
               classItem.end_time >= currentTime;
    }

    handleLogin() {
        console.log('handleLogin() called');
        this.updateDebugInfo('Login button clicked, processing...');
        
        const operatorName = document.getElementById('operatorName').value.trim();
        console.log('Operator name:', operatorName);
        
        if (!operatorName) {
            alert('Please enter operator name');
            this.updateDebugInfo('Login failed: No operator name entered');
            return;
        }
        
        console.log('Setting login state and calling related functions...');
        this.updateDebugInfo('Login successful, loading classes...');
        
        this.isLoggedIn = true;
        this.currentOperator = operatorName;
        this.updateStatus('operatorStatus', operatorName);
        this.hideLoginForm();
        this.showMainInterface();
        
        console.log('About to call loadClasses()...');
        this.loadClasses();
        
        this.log(`Operator ${operatorName} logged in`, 'success');
        console.log('handleLogin() completed');
    }

    handleLogout() {
        if (this.stream) {
            this.stopCamera();
        }
        this.stopAutoScheduling();
        
        this.isLoggedIn = false;
        this.currentOperator = null;
        this.currentClass = null;
        this.isAutoMode = false;
        
        this.updateStatus('operatorStatus', 'Not logged in');
        this.updateStatus('activeClass', 'None');
        this.showLoginForm();
        this.hideMainInterface();
        this.log('Operator logged out', 'info');
    }

    toggleAutoMode(enabled) {
        this.isAutoMode = enabled;
        if (enabled) {
            this.log('Auto mode enabled - system will automatically manage classes', 'success');
            this.checkForCurrentClass();
        } else {
            this.log('Auto mode disabled - manual class selection required', 'info');
            this.stopAutoScheduling();
        }
    }

    startAutoScheduling() {
        // Check for current/upcoming classes every 30 seconds
        this.classCheckInterval = setInterval(() => {
            if (this.isAutoMode && this.isLoggedIn) {
                this.checkForCurrentClass();
            }
        }, 30000);
    }

    stopAutoScheduling() {
        if (this.classCheckInterval) {
            clearInterval(this.classCheckInterval);
            this.classCheckInterval = null;
        }
        if (this.cameraIdleTimeout) {
            clearTimeout(this.cameraIdleTimeout);
            this.cameraIdleTimeout = null;
        }
    }

    async checkForCurrentClass() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/terminal/current-class`);
            const result = await response.json();
            
            if (result.hasCurrentClass) {
                const currentClass = result.class;
                
                // If different class than currently selected, switch to it
                if (!this.currentClass || this.currentClass.class_id !== currentClass.class_id) {
                    await this.autoSelectClass(currentClass);
                }
                
                // Ensure camera is running during class time
                if (!this.stream && this.isAutoMode) {
                    this.startCamera();
                    this.log(`Auto-started camera for ${currentClass.class_name}`, 'success');
                }
            } else {
                // No current class - stop camera to save resources
                if (this.stream && this.isAutoMode) {
                    this.scheduleCameraStop();
                }
            }
        } catch (error) {
            this.log('Failed to check current class: ' + error.message, 'error');
        }
    }

    async autoSelectClass(classData) {
        this.currentClass = classData;
        this.updateStatus('activeClass', classData.class_name);
        
        // Update dropdown selection
        const select = document.getElementById('classSelect');
        select.value = classData.class_id;
        
        this.log(`Auto-selected class: ${classData.class_name}`, 'success');
        
        // Notify server
        if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
            this.wsConnection.send(JSON.stringify({
                type: 'class_selected',
                terminalId: this.terminalId,
                classId: classData.class_id,
                operator: this.currentOperator,
                autoMode: true
            }));
        }
    }

    scheduleCameraStop() {
        // Stop camera after 2 minutes of no active class
        if (this.cameraIdleTimeout) {
            clearTimeout(this.cameraIdleTimeout);
        }
        
        this.cameraIdleTimeout = setTimeout(() => {
            if (this.stream && this.isAutoMode) {
                this.stopCamera();
                this.log('Auto-stopped camera - no active classes', 'info');
            }
        }, 120000); // 2 minutes
    }

    showLoginForm() {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('mainInterface').style.display = 'none';
    }

    hideLoginForm() {
        document.getElementById('loginForm').style.display = 'none';
    }

    showMainInterface() {
        document.getElementById('mainInterface').style.display = 'block';
    }

    hideMainInterface() {
        document.getElementById('mainInterface').style.display = 'none';
    }

    async selectClass(classId) {
        if (!classId) {
            this.currentClass = null;
            this.updateStatus('activeClass', 'None');
            return;
        }

        if (!this.isLoggedIn) {
            this.log('Please login first', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/terminal/classes/${classId}`);
            const classData = await response.json();
            
            this.currentClass = classData;
            this.updateStatus('activeClass', classData.class_name);
            this.log(`Selected class: ${classData.class_name}`, 'info');
            
            // Notify server about class selection
            if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
                this.wsConnection.send(JSON.stringify({
                    type: 'class_selected',
                    classId: classId,
                    terminalId: this.terminalId,
                    operator: this.currentOperator,
                    autoMode: false
                }));
            }
        } catch (error) {
            this.log('Failed to select class: ' + error.message, 'error');
        }
    }

    async startCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                }
            });
            
            this.video.srcObject = this.stream;
            this.video.onloadedmetadata = () => {
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
            };
            
            document.getElementById('startBtn').disabled = true;
            document.getElementById('stopBtn').disabled = false;
            document.getElementById('toggleRecognition').disabled = false;
            
            this.updateStatus('cameraStatus', 'On');
            this.log('Camera started successfully', 'success');
        } catch (error) {
            this.log('Failed to start camera: ' + error.message, 'error');
            this.showNotification('Camera access denied', 'error');
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.video.srcObject = null;
        }
        
        this.stopRecognition();
        
        document.getElementById('startBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;
        document.getElementById('toggleRecognition').disabled = true;
        
        this.updateStatus('cameraStatus', 'Off');
        this.log('Camera stopped', 'info');
    }

    toggleRecognition() {
        if (this.recognitionActive) {
            this.stopRecognition();
        } else {
            this.startRecognition();
        }
    }

    startRecognition() {
        if (!this.currentClass) {
            this.showNotification('Please select a class first', 'error');
            return;
        }

        this.recognitionActive = true;
        this.recognitionInterval = setInterval(() => this.processFrame(), 1000); // Process every second
        
        document.getElementById('toggleRecognition').textContent = 'Stop Recognition';
        document.getElementById('toggleRecognition').className = 'btn btn-danger';
        this.updateStatus('recognitionStatus', 'Active');
        this.log('Face recognition started', 'success');
    }

    stopRecognition() {
        this.recognitionActive = false;
        if (this.recognitionInterval) {
            clearInterval(this.recognitionInterval);
        }
        
        document.getElementById('toggleRecognition').textContent = 'Start Recognition';
        document.getElementById('toggleRecognition').className = 'btn btn-secondary';
        this.updateStatus('recognitionStatus', 'Off');
        this.log('Face recognition stopped', 'info');
    }

    async processFrame() {
        if (!this.recognitionActive || !this.video.videoWidth) return;

        // Capture frame from video
        const canvas = document.createElement('canvas');
        canvas.width = this.video.videoWidth;
        canvas.height = this.video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.video, 0, 0);
        
        // Convert to base64
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        
        try {
            // Send frame to backend for processing
            const response = await fetch(`${this.apiBaseUrl}/api/process-frame`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    image: imageData,
                    class_id: this.currentClass.class_id,
                    terminal_id: this.terminalId
                })
            });
            
            const result = await response.json();
            
            if (result.faces && result.faces.length > 0) {
                this.drawFaceBoxes(result.faces);
                this.updateCounter('studentsDetected', result.faces.length);
            }
        } catch (error) {
            console.error('Frame processing error:', error);
        }
    }

    drawFaceBoxes(faces) {
        // Clear previous drawings
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        faces.forEach(face => {
            if (face.recognized) {
                // Draw green box for recognized faces
                this.ctx.strokeStyle = '#4CAF50';
                this.ctx.lineWidth = 3;
                this.ctx.strokeRect(face.x, face.y, face.width, face.height);
                
                // Draw label
                this.ctx.fillStyle = '#4CAF50';
                this.ctx.fillRect(face.x, face.y - 25, 200, 25);
                this.ctx.fillStyle = 'white';
                this.ctx.font = '14px Arial';
                this.ctx.fillText(face.name, face.x + 5, face.y - 8);
            } else {
                // Draw red box for unrecognized faces
                this.ctx.strokeStyle = '#f44336';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(face.x, face.y, face.width, face.height);
                
                this.ctx.fillStyle = '#f44336';
                this.ctx.fillRect(face.x, face.y - 25, 100, 25);
                this.ctx.fillStyle = 'white';
                this.ctx.font = '14px Arial';
                this.ctx.fillText('Unknown', face.x + 5, face.y - 8);
            }
        });
    }

    updateStatus(elementId, value) {
        document.getElementById(elementId).textContent = value;
    }

    updateDebugInfo(message) {
        const debugElement = document.getElementById('debugInfo');
        if (debugElement) {
            const timestamp = new Date().toLocaleTimeString();
            debugElement.innerHTML = `<strong>DEBUG STATUS:</strong><br>[${timestamp}] ${message}`;
        }
        console.log(`DEBUG: ${message}`);
    }

    updateCounter(elementId, value) {
        document.getElementById(elementId).textContent = value;
    }

    updateConnectionStatus(status) {
        document.getElementById('connectionStatus').textContent = status;
    }

    log(message, type = 'info') {
        const logContainer = document.getElementById('logContainer');
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
        
        logContainer.insertBefore(logEntry, logContainer.firstChild);
        
        // Keep only last 20 entries
        while (logContainer.children.length > 20) {
            logContainer.removeChild(logContainer.lastChild);
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }
}

// Initialize the terminal when page loads
document.addEventListener('DOMContentLoaded', () => {
    new AttendanceTerminal();
});
