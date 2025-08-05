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
  Card,
  CardContent,
  Grid,
  Chip,
  Input,
  IconButton
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { 
  Add as AddIcon, 
  Upload as UploadIcon,
  School as SchoolIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import axios from 'axios';
import toast from 'react-hot-toast';

const Classes = () => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [openUploadDialog, setOpenUploadDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const hasLogged = useRef(false);
  const [newClass, setNewClass] = useState({
    class_name: '',
    start_time: dayjs(),
    end_time: dayjs(),
    date: dayjs()
  });

  useEffect(() => {
    fetchClasses();
    if (!hasLogged.current) {
      logActivity('Classes page visited');
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

  const fetchClasses = async () => {
    try {
      const response = await axios.get('/api/classes');
      setClasses(response.data);
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast.error('Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  const handleAddClass = async () => {
    try {
      const classData = {
        class_name: newClass.class_name,
        start_time: newClass.start_time.format('HH:mm:ss'),
        end_time: newClass.end_time.format('HH:mm:ss'),
        date: newClass.date.format('YYYY-MM-DD')
      };

      await axios.post('/api/classes', classData);
      toast.success('Class added successfully');
      setOpenDialog(false);
      setNewClass({
        class_name: '',
        start_time: dayjs(),
        end_time: dayjs(),
        date: dayjs()
      });
      fetchClasses();
    } catch (error) {
      console.error('Error adding class:', error);
      toast.error(error.response?.data?.error || 'Failed to add class');
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    const formData = new FormData();
    formData.append('timetable', selectedFile);

    try {
      const response = await axios.post('/api/upload/timetable', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      toast.success(response.data.message);
      setOpenUploadDialog(false);
      setSelectedFile(null);
      fetchClasses();
    } catch (error) {
      console.error('Error uploading timetable:', error);
      toast.error(error.response?.data?.error || 'Failed to upload timetable');
    }
  };

  const handleDeleteClass = async (classId) => {
    if (window.confirm('Are you sure you want to delete this class? This action cannot be undone.')) {
      try {
        await axios.delete(`/api/classes/${classId}`);
        toast.success('Class deleted successfully');
        logActivity(`Class deleted: ID ${classId}`);
        fetchClasses();
      } catch (error) {
        console.error('Error deleting class:', error);
        toast.error('Failed to delete class');
      }
    }
  };

  const columns = [
    { field: 'class_name', headerName: 'Class Name', width: 200 },
    { 
      field: 'date', 
      headerName: 'Date', 
      width: 130,
      valueFormatter: (params) => {
        return new Date(params.value).toLocaleDateString();
      }
    },
    { field: 'start_time', headerName: 'Start Time', width: 130 },
    { field: 'end_time', headerName: 'End Time', width: 130 },
    { 
      field: 'total_attendance', 
      headerName: 'Total Students', 
      width: 130,
      type: 'number'
    },
    { 
      field: 'present_count', 
      headerName: 'Present', 
      width: 100,
      type: 'number'
    },
    {
      field: 'attendance_rate',
      headerName: 'Attendance Rate',
      width: 150,
      renderCell: (params) => {
        const total = params.row.total_attendance || 0;
        const present = params.row.present_count || 0;
        const rate = total > 0 ? ((present / total) * 100).toFixed(1) : 0;
        const color = rate >= 75 ? 'success' : rate >= 50 ? 'warning' : 'error';
        return (
          <Chip 
            label={`${rate}%`} 
            color={color} 
            size="small" 
          />
        );
      }
    },
    { 
      field: 'created_at', 
      headerName: 'Created', 
      width: 180,
      valueFormatter: (params) => {
        return new Date(params.value).toLocaleDateString();
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      renderCell: (params) => (
        <IconButton
          color="error"
          onClick={() => handleDeleteClass(params.row.id)}
          title="Delete Class"
        >
          <DeleteIcon />
        </IconButton>
      )
    }
  ];

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" gutterBottom>
            Classes Management
          </Typography>
          <Box>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => setOpenUploadDialog(true)}
              sx={{ mr: 2 }}
            >
              Upload Timetable
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenDialog(true)}
            >
              Add Class
            </Button>
          </Box>
        </Box>

        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Classes
                </Typography>
                <Typography variant="h4">
                  {classes.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Today's Classes
                </Typography>
                <Typography variant="h4">
                  {classes.filter(c => 
                    new Date(c.date).toDateString() === new Date().toDateString()
                  ).length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Upcoming Classes
                </Typography>
                <Typography variant="h4">
                  {classes.filter(c => 
                    new Date(c.date) > new Date()
                  ).length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Completed Classes
                </Typography>
                <Typography variant="h4">
                  {classes.filter(c => 
                    new Date(c.date) < new Date()
                  ).length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Paper sx={{ height: 600, width: '100%' }}>
          <DataGrid
            rows={classes}
            columns={columns}
            pageSize={10}
            rowsPerPageOptions={[10, 25, 50]}
            disableSelectionOnClick
            loading={loading}
            sx={{
              '& .MuiDataGrid-cell:hover': {
                color: 'primary.main',
              },
            }}
          />
        </Paper>

        {/* Add Class Dialog */}
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
            <SchoolIcon sx={{ mr: 1 }} />
            Add New Class
          </DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Class Name"
              type="text"
              fullWidth
              variant="outlined"
              value={newClass.class_name}
              onChange={(e) => setNewClass({ ...newClass, class_name: e.target.value })}
              sx={{ mb: 2 }}
            />
            <DatePicker
              label="Date"
              value={newClass.date}
              onChange={(newValue) => setNewClass({ ...newClass, date: newValue })}
              renderInput={(params) => <TextField {...params} fullWidth sx={{ mb: 2 }} />}
              sx={{ mb: 2, width: '100%' }}
            />
            <TimePicker
              label="Start Time"
              value={newClass.start_time}
              onChange={(newValue) => setNewClass({ ...newClass, start_time: newValue })}
              renderInput={(params) => <TextField {...params} fullWidth sx={{ mb: 2, mr: 1 }} />}
              sx={{ mb: 2, width: '48%', mr: 1 }}
            />
            <TimePicker
              label="End Time"
              value={newClass.end_time}
              onChange={(newValue) => setNewClass({ ...newClass, end_time: newValue })}
              renderInput={(params) => <TextField {...params} fullWidth sx={{ mb: 2 }} />}
              sx={{ mb: 2, width: '48%' }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button onClick={handleAddClass} variant="contained">Add Class</Button>
          </DialogActions>
        </Dialog>

        {/* Upload Timetable Dialog */}
        <Dialog open={openUploadDialog} onClose={() => setOpenUploadDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
            <CloudUploadIcon sx={{ mr: 1 }} />
            Upload Timetable
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Upload an Excel file with columns: class_name, start_time, end_time, date
            </Typography>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setSelectedFile(e.target.files[0])}
              fullWidth
              sx={{ mb: 2 }}
            />
            {selectedFile && (
              <Typography variant="body2" color="primary">
                Selected: {selectedFile.name}
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenUploadDialog(false)}>Cancel</Button>
            <Button onClick={handleFileUpload} variant="contained">Upload</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default Classes;
