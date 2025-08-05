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
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Videocam as VideocamIcon,
  School as SchoolIcon,
  CheckCircle as PresentIcon
} from '@mui/icons-material';
import axios from 'axios';
import toast from 'react-hot-toast';

const AttendanceMarking = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [systemRunning, setSystemRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [systemLogs, setSystemLogs] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0 });
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null });
  const hasLogged = useRef(false);

  useEffect(() => {
    fetchClasses();
    fetchSystemStatus();
    fetchSystemLogs();
    
    if (!hasLogged.current) {
      logActivity('Attendance marking page visited');
      hasLogged.current = true;
    }

    // Refresh logs and status every 3 seconds when system is running
    const interval = setInterval(() => {
      if (systemRunning) {
        fetchSystemLogs();
        fetchAttendanceStats();
      }
      fetchSystemStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [systemRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  const logActivity = async (activity) => {
    try {
      await axios.post('/api/activity-log', { activity });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await axios.get('/api/classes');
      // Filter classes for today
      const today = new Date().toISOString().split('T')[0];
      const todayClasses = response.data.filter(cls => 
        cls.date.startsWith(today)
      );
      setClasses(todayClasses);
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast.error('Failed to load classes');
    }
  };

  const fetchSystemStatus = async () => {
    try {
      const response = await axios.get('/api/system/status');
      setSystemRunning(response.data.attendanceSystemRunning);
    } catch (error) {
      console.error('Error fetching system status:', error);
    }
  };

  const fetchSystemLogs = async () => {
    try {
      const response = await axios.get('/api/system/logs');
      setSystemLogs(response.data.slice(0, 10)); // Show latest 10 logs
    } catch (error) {
      console.error('Error fetching system logs:', error);
    }
  };

  const fetchAttendanceStats = async () => {
    if (!selectedClass) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await axios.get('/api/reports/attendance', {
        params: {
          startDate: today,
          endDate: today,
          classId: selectedClass
        }
      });
      
      const stats = response.data.reduce((acc, record) => {
        if (record.status === 'present') acc.present++;
        else if (record.status === 'absent') acc.absent++;
        return acc;
      }, { present: 0, absent: 0 });
      
      setAttendanceStats(stats);
    } catch (error) {
      console.error('Error fetching attendance stats:', error);
    }
  };

  const startAttendanceSystem = async () => {
    if (!selectedClass) {
      toast.error('Please select a class first');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/system/start-attendance', {
        classId: selectedClass
      });
      
      if (response.data.success) {
        setSystemRunning(true);
        toast.success(`Attendance system started for ${response.data.className}`);
        await logActivity(`Started attendance marking for class: ${response.data.className}`);
        fetchAttendanceStats();
      }
    } catch (error) {
      console.error('Error starting attendance system:', error);
      toast.error(error.response?.data?.error || 'Failed to start attendance system');
    } finally {
      setLoading(false);
      setConfirmDialog({ open: false, action: null });
    }
  };

  const stopAttendanceSystem = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/system/stop-attendance');
      
      if (response.data.success) {
        setSystemRunning(false);
        toast.success('Attendance system stopped');
        await logActivity('Stopped attendance marking system');
      }
    } catch (error) {
      console.error('Error stopping attendance system:', error);
      toast.error('Failed to stop attendance system');
    } finally {
      setLoading(false);
      setConfirmDialog({ open: false, action: null });
    }
  };

  const handleConfirmAction = () => {
    if (confirmDialog.action === 'start') {
      startAttendanceSystem();
    } else if (confirmDialog.action === 'stop') {
      stopAttendanceSystem();
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getSelectedClassName = () => {
    const selected = classes.find(cls => cls.id === selectedClass);
    return selected ? selected.class_name : '';
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        🎯 Live Attendance Marking
      </Typography>
      
      <Grid container spacing={3}>
        {/* Control Panel */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <SchoolIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Control Panel
              </Typography>
              
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Select Class</InputLabel>
                <Select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  disabled={systemRunning}
                  label="Select Class"
                >
                  {classes.map((cls) => (
                    <MenuItem key={cls.id} value={cls.id}>
                      {cls.class_name} - {cls.start_time} to {cls.end_time}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {classes.length === 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  No classes scheduled for today
                </Alert>
              )}

              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => setConfirmDialog({ open: true, action: 'start' })}
                  disabled={loading || !selectedClass || systemRunning}
                  startIcon={loading ? <CircularProgress size={20} /> : <StartIcon />}
                  fullWidth
                >
                  Start System
                </Button>
                
                <Button
                  variant="contained"
                  color="error"
                  onClick={() => setConfirmDialog({ open: true, action: 'stop' })}
                  disabled={loading || !systemRunning}
                  startIcon={loading ? <CircularProgress size={20} /> : <StopIcon />}
                  fullWidth
                >
                  Stop System
                </Button>
              </Box>

              <Chip
                label={systemRunning ? 'System Running' : 'System Stopped'}
                color={systemRunning ? 'success' : 'default'}
                icon={systemRunning ? <PresentIcon /> : <StopIcon />}
                fullWidth
              />
            </CardContent>
          </Card>

          {/* Attendance Stats */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📊 Live Stats
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="success.main">
                      {attendanceStats.present}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Present
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="error.main">
                      {attendanceStats.absent}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Absent
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Camera Feeds */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              📹 Live Camera Feeds
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper 
                  sx={{ 
                    height: 300, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    backgroundColor: systemRunning ? '#e8f5e8' : '#f5f5f5',
                    border: systemRunning ? '2px solid #4caf50' : '2px dashed #ccc'
                  }}
                >
                  <Box textAlign="center">
                    <VideocamIcon 
                      sx={{ 
                        fontSize: 64, 
                        color: systemRunning ? '#4caf50' : '#888', 
                        mb: 1 
                      }} 
                    />
                    <Typography variant="h6" color={systemRunning ? 'success.main' : 'text.secondary'}>
                      Camera 1 - Present
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {systemRunning ? 'Monitoring for present students' : 'Camera ready'}
                    </Typography>
                    {systemRunning && (
                      <Chip 
                        label="LIVE" 
                        color="success" 
                        size="small" 
                        sx={{ mt: 1 }}
                      />
                    )}
                  </Box>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper 
                  sx={{ 
                    height: 300, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    backgroundColor: systemRunning ? '#fff3e0' : '#f5f5f5',
                    border: systemRunning ? '2px solid #ff9800' : '2px dashed #ccc'
                  }}
                >
                  <Box textAlign="center">
                    <VideocamIcon 
                      sx={{ 
                        fontSize: 64, 
                        color: systemRunning ? '#ff9800' : '#888', 
                        mb: 1 
                      }} 
                    />
                    <Typography variant="h6" color={systemRunning ? 'warning.main' : 'text.secondary'}>
                      Camera 2 - Absent
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {systemRunning ? 'Monitoring for absent students' : 'Camera ready'}
                    </Typography>
                    {systemRunning && (
                      <Chip 
                        label="LIVE" 
                        color="warning" 
                        size="small" 
                        sx={{ mt: 1 }}
                      />
                    )}
                  </Box>
                </Paper>
              </Grid>
            </Grid>

            {systemRunning && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>System Active:</strong> Students can now mark attendance by showing their face to the appropriate camera.
                  Present = Camera 1, Absent = Camera 2
                </Typography>
              </Alert>
            )}

            {!systemRunning && selectedClass && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Ready to start:</strong> Class "{getSelectedClassName()}" selected. 
                  Click "Start System" to begin attendance marking.
                </Typography>
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* Real-time Logs */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              📝 Real-time Activity Logs
            </Typography>
            
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ height: 300, overflow: 'auto' }}>
              {systemLogs.length > 0 ? (
                systemLogs.map((log, index) => (
                  <Box 
                    key={index} 
                    sx={{ 
                      mb: 1, 
                      p: 2, 
                      backgroundColor: index === 0 ? '#e3f2fd' : '#f8f9fa', 
                      borderRadius: 1,
                      borderLeft: index === 0 ? '4px solid #2196f3' : 'none'
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">
                        {log.activity}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatTimestamp(log.created_at)}
                      </Typography>
                    </Box>
                  </Box>
                ))
              ) : (
                <Box 
                  sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    No activity logs yet. Start the system to see real-time updates.
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, action: null })}>
        <DialogTitle>
          {confirmDialog.action === 'start' ? 'Start Attendance System' : 'Stop Attendance System'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {confirmDialog.action === 'start' 
              ? `Are you sure you want to start the attendance system for "${getSelectedClassName()}"?`
              : 'Are you sure you want to stop the attendance system?'
            }
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, action: null })}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmAction} 
            variant="contained"
            color={confirmDialog.action === 'start' ? 'success' : 'error'}
          >
            {confirmDialog.action === 'start' ? 'Start' : 'Stop'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AttendanceMarking;
