const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

const app = express();
const PORT = process.env.TERMINAL_PORT || 3002;

// Serve static files
app.use(express.static(__dirname));

// Serve the attendance terminal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'attendance-terminal'
    });
});

const server = http.createServer(app);

// WebSocket server for real-time communication
const wss = new WebSocket.Server({ 
    server,
    path: '/ws'
});

const terminals = new Map();

wss.on('connection', (ws, req) => {
    const terminalId = req.url.split('=')[1] || 'unknown';
    terminals.set(terminalId, ws);
    
    console.log(`Terminal ${terminalId} connected`);
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`Message from terminal ${terminalId}:`, data);
            
            // Handle different message types
            switch (data.type) {
                case 'class_selected':
                    // Broadcast to other systems if needed
                    broadcast({
                        type: 'terminal_class_selected',
                        terminal_id: terminalId,
                        class_id: data.class_id
                    }, terminalId);
                    break;
                    
                case 'attendance_marked':
                    // Broadcast attendance update to all terminals
                    broadcast({
                        type: 'attendance_update',
                        student_id: data.student_id,
                        class_id: data.class_id,
                        timestamp: new Date().toISOString()
                    });
                    break;
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });
    
    ws.on('close', () => {
        terminals.delete(terminalId);
        console.log(`Terminal ${terminalId} disconnected`);
    });
    
    ws.on('error', (error) => {
        console.error(`Terminal ${terminalId} error:`, error);
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'connection_established',
        terminal_id: terminalId,
        timestamp: new Date().toISOString()
    }));
});

function broadcast(message, excludeTerminal = null) {
    terminals.forEach((ws, terminalId) => {
        if (terminalId !== excludeTerminal && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    });
}

// Function to send message to specific terminal
function sendToTerminal(terminalId, message) {
    const ws = terminals.get(terminalId);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        return true;
    }
    return false;
}

// Export functions for use by main backend
module.exports = {
    broadcast,
    sendToTerminal,
    getConnectedTerminals: () => Array.from(terminals.keys())
};

server.listen(PORT, () => {
    console.log(`🖥️  Attendance Terminal Server running on port ${PORT}`);
    console.log(`📡 WebSocket server ready at ws://localhost:${PORT}/ws`);
    console.log(`🌐 Access terminals at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
    });
});
