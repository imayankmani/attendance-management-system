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
  Chip,
  Avatar,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { 
  Add as AddIcon, 
  Person as PersonIcon, 
  PhotoCamera,
  Delete as DeleteIcon,
  DeleteForever as DeleteForeverIcon
} from '@mui/icons-material';
import axios from 'axios';
import toast from 'react-hot-toast';

const Students = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [withPhoto, setWithPhoto] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, student: null });
  const [deleting, setDeleting] = useState(false);
  const [newStudent, setNewStudent] = useState({
    student_id: '',
    name: '',
    email: ''
  });
  const hasLoggedPageVisit = useRef(false);

  useEffect(() => {
    fetchStudents();
    // Log page visit only once
    if (!hasLoggedPageVisit.current) {
      logActivity('Students page visited');
      hasLoggedPageVisit.current = true;
    }
  }, []);

  const logActivity = async (activity, details = null) => {
    try {
      const logMessage = details ? `${activity} - ${JSON.stringify(details)}` : activity;
      await axios.post('/api/activity-log', { activity: logMessage });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await axios.get('/api/students');
      setStudents(response.data);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async () => {
    try {
      setUploading(true);
      
      if (withPhoto) {
        if (!selectedFile) {
          toast.error('Please select a photo');
          return;
        }
        
        // Upload student with photo
        const formData = new FormData();
        formData.append('student_id', newStudent.student_id);
        formData.append('name', newStudent.name);
        formData.append('email', newStudent.email);
        formData.append('photo', selectedFile);
        
        await axios.post('/api/students/with-photo', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        
        await logActivity('Student added with photo', { 
          student_id: newStudent.student_id, 
          name: newStudent.name 
        });
        
        toast.success('Student added successfully with photo! Face encoding is being processed.');
      } else {
        // Add student without photo
        await axios.post('/api/students', newStudent);
        
        await logActivity('Student added without photo', { 
          student_id: newStudent.student_id, 
          name: newStudent.name 
        });
        
        toast.success('Student added successfully');
      }
      
      setOpenDialog(false);
      resetForm();
      fetchStudents();
    } catch (error) {
      console.error('Error adding student:', error);
      toast.error(error.response?.data?.error || 'Failed to add student');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setNewStudent({ student_id: '', name: '', email: '' });
    setSelectedFile(null);
    setPreviewUrl(null);
    setWithPhoto(true);
  };

  const handleDelete = async () => {
    console.log('handleDelete called with student:', deleteDialog.student);
    if (!deleteDialog.student) return;
    
    setDeleting(true);
    try {
      console.log('Making DELETE request to:', `/api/students/${deleteDialog.student.student_id}`);
      await axios.delete(`/api/students/${deleteDialog.student.student_id}`);
      setStudents(students.filter(s => s.id !== deleteDialog.student.id));
      setDeleteDialog({ open: false, student: null });
      
      await logActivity('Student deleted from dashboard', { 
        student_id: deleteDialog.student.student_id, 
        name: deleteDialog.student.name 
      });
      
      toast.success('Student deleted successfully');
    } catch (error) {
      console.error('Error deleting student:', error);
      toast.error(error.response?.data?.error || 'Failed to delete student');
    } finally {
      setDeleting(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please select a valid image file (JPEG, PNG, GIF)');
        return;
      }
      
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      
      setSelectedFile(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const columns = [
    {
      field: 'photo_url',
      headerName: 'Photo',
      width: 80,
      renderCell: (params) => {
        const photoUrl = params.value ? `http://localhost:3001${params.value}` : null;
        console.log('Rendering photo for:', params.row.name, 'URL:', photoUrl);
        return (
          <Avatar
            src={photoUrl}
            sx={{ width: 40, height: 40 }}
            onError={(e) => {
              console.error('Image failed to load:', photoUrl, e);
              e.target.style.display = 'none';
            }}
            onLoad={() => {
              console.log('Image loaded successfully:', photoUrl);
            }}
          >
            {(!photoUrl || photoUrl === 'http://localhost:3001null') && params.row.name?.charAt(0)}
          </Avatar>
        );
      },
      sortable: false,
      filterable: false
    },
    { field: 'student_id', headerName: 'Student ID', width: 130 },
    { field: 'name', headerName: 'Name', width: 200 },
    { field: 'email', headerName: 'Email', width: 250 },
    { 
      field: 'total_classes', 
      headerName: 'Total Classes', 
      width: 130,
      type: 'number'
    },
    { 
      field: 'present_classes', 
      headerName: 'Present', 
      width: 100,
      type: 'number'
    },
    {
      field: 'attendanceRate',
      headerName: 'Attendance Rate',
      width: 150,
      renderCell: (params) => {
        const rate = parseFloat(params.value);
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
      headerName: 'Enrolled Date', 
      width: 180,
      valueFormatter: (params) => {
        return new Date(params.value).toLocaleDateString();
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Delete Student">
            <IconButton
              color="error"
              onClick={() => {
                console.log('Delete button clicked for student:', params.row);
                setDeleteDialog({ open: true, student: params.row });
              }}
              size="small"
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    }
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Students Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          Add Student
        </Button>
      </Box>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={students}
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

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <PersonIcon sx={{ mr: 1 }} />
          Add New Student
        </DialogTitle>
        <DialogContent>
          <FormControlLabel
            control={
              <Switch
                checked={withPhoto}
                onChange={(e) => setWithPhoto(e.target.checked)}
                color="primary"
              />
            }
            label="Upload Photo for Face Recognition"
            sx={{ mb: 2 }}
          />
          
          {withPhoto && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Student Photo
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoCamera />}
                  sx={{ mb: 1 }}
                >
                  Choose Photo
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </Button>
                {selectedFile && (
                  <Typography variant="body2" color="success.main">
                    {selectedFile.name}
                  </Typography>
                )}
              </Box>
              
              {previewUrl && (
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                  <Avatar
                    src={previewUrl}
                    sx={{ width: 120, height: 120 }}
                  />
                </Box>
              )}
              
              {withPhoto && !selectedFile && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Please upload a clear photo of the student's face for face recognition.
                </Alert>
              )}
            </Box>
          )}
          
          <TextField
            autoFocus
            margin="dense"
            label="Student ID"
            type="text"
            fullWidth
            variant="outlined"
            value={newStudent.student_id}
            onChange={(e) => setNewStudent({ ...newStudent, student_id: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Full Name"
            type="text"
            fullWidth
            variant="outlined"
            value={newStudent.name}
            onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Email Address"
            type="email"
            fullWidth
            variant="outlined"
            value={newStudent.email}
            onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenDialog(false); resetForm(); }}>Cancel</Button>
          <Button 
            onClick={handleAddStudent} 
            variant="contained"
            disabled={uploading || (withPhoto && !selectedFile)}
            startIcon={uploading && <CircularProgress size={20} />}
          >
            {uploading ? 'Adding...' : 'Add Student'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => !deleting && setDeleteDialog({ open: false, student: null })}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" color="error.main">
            <DeleteForeverIcon sx={{ mr: 1 }} />
            Confirm Delete Student
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to delete the following student?
          </Typography>
          <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1, mb: 2 }}>
            <Typography variant="subtitle2">Student ID: <strong>{deleteDialog.student?.student_id}</strong></Typography>
            <Typography variant="subtitle2">Name: <strong>{deleteDialog.student?.name}</strong></Typography>
            <Typography variant="subtitle2">Email: <strong>{deleteDialog.student?.email}</strong></Typography>
          </Box>
          <Typography variant="body2" color="error" sx={{ fontWeight: 'bold' }}>
            ⚠️ This action cannot be undone. All attendance records and student photo will be permanently deleted.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setDeleteDialog({ open: false, student: null })}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDelete}
            variant="contained"
            color="error"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={20} /> : <DeleteForeverIcon />}
          >
            {deleting ? 'Deleting...' : 'Delete Student'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Students;
