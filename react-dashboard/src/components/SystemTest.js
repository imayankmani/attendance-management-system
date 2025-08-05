import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Chip,
  Divider
} from '@mui/material';
import {
  Videocam as VideocamIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  CheckCircle as SuccessIcon,
  Camera as CameraIcon
} from '@mui/icons-material';
import axios from 'axios';
import toast from 'react-hot-toast';

const SystemTest = () => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [systemLogs, setSystemLogs] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const hasLogged = useRef(false);

  useEffect(() => {
    fetchSystemStatus();
    fetchSystemLogs();
    if (!hasLogged.current) {
      logActivity('System test page visited');
      hasLogged.current = true;
    }

    // Refresh logs every 5 seconds
    const interval = setInterval(fetchSystemLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const logActivity = async (activity) => {
    try {
      await axios.post('/api/activity-log', { activity });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const fetchSystemStatus = async () => {
    try {
      const response = await axios.get('/api/system/status');
      setSystemStatus(response.data);
    } catch (error) {
      console.error('Error fetching system status:', error);
    }
  };

  const fetchSystemLogs = async () => {
    try {
      const response = await axios.get('/api/system/logs');
      setSystemLogs(response.data);
    } catch (error) {
      console.error('Error fetching system logs:', error);
    }
  };

  const testCameras = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      toast.loading('Testing cameras...', { duration: 2000 });
      await logActivity('Camera test initiated from test page');
      
      const response = await axios.post('/api/system/test-cameras');
      setTestResult(response.data);
      
      if (response.data.success) {
        toast.success('Camera test completed successfully!');
        await logActivity('Camera test completed successfully');
      } else {
        toast.error('Camera test failed');
        await logActivity('Camera test failed');
      }
    } catch (error) {
      console.error('Camera test error:', error);
      toast.error('Failed to run camera test');
      setTestResult({
        success: false,
        error: error.response?.data?.error || 'Failed to test cameras'
      });
    } finally {
      setTesting(false);
      fetchSystemLogs();
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        🧪 System Testing & Diagnostics
      </Typography>
      
      <Grid container spacing={3}>
        {/* System Status Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <CameraIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                System Status
              </Typography>
              
              {systemStatus && (
                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={systemStatus.attendanceSystemRunning ? 'System Running' : 'System Stopped'}
                    color={systemStatus.attendanceSystemRunning ? 'success' : 'default'}
                    icon={systemStatus.attendanceSystemRunning ? <SuccessIcon /> : <StopIcon />}
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    Last checked: {formatTimestamp(systemStatus.timestamp)}
                  </Typography>
                </Box>
              )}

              <Button
                variant="contained"
                onClick={fetchSystemStatus}
                startIcon={<RefreshIcon />}
                size="small"
              >
                Refresh Status
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Camera Test Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <VideocamIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Camera Test
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Test both cameras for attendance marking and face recognition
              </Typography>

              <Button
                variant="contained"
                color="primary"
                onClick={testCameras}
                disabled={testing}
                startIcon={testing ? <CircularProgress size={20} /> : <StartIcon />}
                fullWidth
                sx={{ mb: 2 }}
              >
                {testing ? 'Testing Cameras...' : 'Run Camera Test'}
              </Button>

              {testResult && (
                <Alert 
                  severity={testResult.success ? 'success' : 'error'}
                  sx={{ mt: 2 }}
                >
                  <Typography variant="subtitle2">
                    Test Result: {testResult.success ? 'PASSED' : 'FAILED'}
                  </Typography>
                  {testResult.output && (
                    <Typography variant="body2" sx={{ mt: 1, fontFamily: 'monospace' }}>
                      {testResult.output.substring(0, 200)}
                      {testResult.output.length > 200 && '...'}
                    </Typography>
                  )}
                  {testResult.error && (
                    <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                      Error: {testResult.error}
                    </Typography>
                  )}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Camera Feed Simulation */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              📹 Camera Feeds Preview
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper 
                  sx={{ 
                    height: 200, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    backgroundColor: '#f5f5f5',
                    border: '2px dashed #ccc'
                  }}
                >
                  <Box textAlign="center">
                    <VideocamIcon sx={{ fontSize: 48, color: '#888', mb: 1 }} />
                    <Typography variant="h6" color="text.secondary">
                      Camera 1 (Present)
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {testing ? 'Testing...' : 'Ready for testing'}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper 
                  sx={{ 
                    height: 200, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    backgroundColor: '#f5f5f5',
                    border: '2px dashed #ccc'
                  }}
                >
                  <Box textAlign="center">
                    <VideocamIcon sx={{ fontSize: 48, color: '#888', mb: 1 }} />
                    <Typography variant="h6" color="text.secondary">
                      Camera 2 (Absent)
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {testing ? 'Testing...' : 'Ready for testing'}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            </Grid>

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Camera Test Instructions:</strong><br />
                1. Click "Run Camera Test" to test both cameras<br />
                2. Ensure good lighting conditions<br />
                3. Check that faces are clearly visible<br />
                4. Verify face recognition functionality
              </Typography>
            </Alert>
          </Paper>
        </Grid>

        {/* System Logs */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: 400, overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              🔍 Real-time System Logs
            </Typography>
            
            <Divider sx={{ mb: 2 }} />
            
            {systemLogs.length > 0 ? (
              systemLogs.map((log, index) => (
                <Box key={index} sx={{ mb: 2, p: 1, backgroundColor: '#f8f9fa', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {formatTimestamp(log.created_at)}
                  </Typography>
                  <Typography variant="body2">
                    {log.activity}
                  </Typography>
                </Box>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                No system logs available
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* System Information */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              ℹ️ System Information
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle2">Face Recognition</Typography>
                <Typography variant="body2" color="text.secondary">
                  OpenCV + face_recognition library
                </Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle2">Camera Detection</Typography>
                <Typography variant="body2" color="text.secondary">
                  Dual camera setup (Present/Absent)
                </Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle2">Database</Typography>
                <Typography variant="body2" color="text.secondary">
                  MySQL with face encoding storage
                </Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle2">Status</Typography>
                <Chip 
                  label="Ready for Testing" 
                  color="success" 
                  size="small"
                  icon={<SuccessIcon />}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SystemTest;
