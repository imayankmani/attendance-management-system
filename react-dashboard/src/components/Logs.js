import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Paper,
  Alert,
  Chip
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { 
  Lock as LockIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from 'axios';
import toast from 'react-hot-toast';

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openPasswordDialog, setOpenPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const hasLogged = useRef(false);

  useEffect(() => {
    if (!hasLogged.current) {
      logActivity('Activity logs page visited');
      hasLogged.current = true;
    }
  }, []);

  const logActivity = async (activity) => {
    try {
      await axios.post('/api/activity-log', { activity });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const handlePasswordSubmit = async () => {
    try {
      const response = await axios.post('/api/logs', { password });
      setLogs(response.data);
      setIsAuthenticated(true);
      setOpenPasswordDialog(false);
      setPassword('');
      toast.success('Activity logs loaded successfully');
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error(error.response?.data?.error || 'Invalid password');
    }
  };

  const refreshLogs = async () => {
    if (!isAuthenticated) {
      setOpenPasswordDialog(true);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/logs', { password: 'admin123' }); // Use stored password
      setLogs(response.data);
      toast.success('Logs refreshed');
    } catch (error) {
      console.error('Error refreshing logs:', error);
      toast.error('Failed to refresh logs');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const getActivityType = (activity) => {
    if (activity.toLowerCase().includes('marked present')) return 'present';
    if (activity.toLowerCase().includes('marked absent')) return 'absent';
    if (activity.toLowerCase().includes('class started')) return 'class_start';
    if (activity.toLowerCase().includes('cameras shut down')) return 'system';
    if (activity.toLowerCase().includes('student')) return 'student';
    return 'other';
  };

  const getActivityColor = (type) => {
    const colors = {
      present: 'success',
      absent: 'error',
      class_start: 'primary',
      system: 'warning',
      student: 'info',
      other: 'default'
    };
    return colors[type] || 'default';
  };

  const columns = [
    { 
      field: 'timestamp', 
      headerName: 'Timestamp', 
      width: 200,
      valueFormatter: (params) => {
        return new Date(params.value).toLocaleString();
      }
    },
    {
      field: 'activity',
      headerName: 'Activity',
      width: 500,
      renderCell: (params) => {
        const type = getActivityType(params.value);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Chip
              label={type.replace('_', ' ').toUpperCase()}
              color={getActivityColor(type)}
              size="small"
              sx={{ mr: 1, minWidth: 80 }}
            />
            <Typography variant="body2">
              {params.value}
            </Typography>
          </Box>
        );
      }
    },
    { 
      field: 'id', 
      headerName: 'Log ID', 
      width: 100,
      type: 'number'
    }
  ];

  if (!isAuthenticated) {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" gutterBottom>
            Activity Logs
          </Typography>
        </Box>

        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <LockIcon sx={{ fontSize: 60, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Protected Content
          </Typography>
          <Typography variant="body1" color="textSecondary" gutterBottom>
            This section contains sensitive system activity logs and requires authentication.
          </Typography>
          <Button
            variant="contained"
            startIcon={<LockIcon />}
            onClick={() => setOpenPasswordDialog(true)}
            sx={{ mt: 2 }}
          >
            Enter Password to View Logs
          </Button>
        </Paper>

        <Dialog open={openPasswordDialog} onClose={() => setOpenPasswordDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
            <LockIcon sx={{ mr: 1 }} />
            Authentication Required
          </DialogTitle>
          <DialogContent>
            <Alert severity="info" sx={{ mb: 2 }}>
              Enter the system log password to access activity logs.
            </Alert>
            <TextField
              autoFocus
              margin="dense"
              label="Log Password"
              type="password"
              fullWidth
              variant="outlined"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handlePasswordSubmit();
                }
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenPasswordDialog(false)}>Cancel</Button>
            <Button onClick={handlePasswordSubmit} variant="contained">Access Logs</Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Activity Logs
        </Typography>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={refreshLogs}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh Logs'}
        </Button>
      </Box>

      <Alert severity="warning" sx={{ mb: 3 }}>
        <Typography variant="subtitle2">Security Notice</Typography>
        This section contains detailed system activity logs including student attendance marking, 
        camera operations, and system events. Handle this information with appropriate care.
      </Alert>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={logs}
          columns={columns}
          pageSize={15}
          rowsPerPageOptions={[15, 25, 50]}
          disableSelectionOnClick
          loading={loading}
          sx={{
            '& .MuiDataGrid-cell:hover': {
              color: 'primary.main',
            },
          }}
          initialState={{
            sorting: {
              sortModel: [{ field: 'timestamp', sort: 'desc' }],
            },
          }}
        />
      </Paper>

      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="textSecondary">
          Showing the latest 1000 system activities. Logs are automatically cleaned up after 30 days.
        </Typography>
      </Box>
    </Box>
  );
};

export default Logs;
