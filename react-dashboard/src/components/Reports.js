import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { 
  Download as DownloadIcon,
  Assessment as ReportIcon,
  FilterList as FilterIcon,
  Email as EmailIcon
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import dayjs from 'dayjs';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const Reports = () => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const hasLogged = useRef(false);
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    startDate: dayjs().subtract(30, 'day'),
    endDate: dayjs(),
    studentId: ''
  });

  useEffect(() => {
    fetchStudents();
    fetchAttendanceReport();
    if (!hasLogged.current) {
      logActivity('Reports page visited');
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

  const fetchStudents = async () => {
    try {
      const response = await axios.get('/api/students');
      setStudents(response.data);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchAttendanceReport = async () => {
    setLoading(true);
    try {
      const params = {
        startDate: filters.startDate.format('YYYY-MM-DD'),
        endDate: filters.endDate.format('YYYY-MM-DD'),
        ...(filters.studentId && { studentId: filters.studentId })
      };

      const response = await axios.get('/api/reports/attendance', { params });
      setAttendanceData(response.data);
    } catch (error) {
      console.error('Error fetching attendance report:', error);
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleExportToExcel = async () => {
    try {
      const params = {
        startDate: filters.startDate.format('YYYY-MM-DD'),
        endDate: filters.endDate.format('YYYY-MM-DD')
      };

      const response = await axios.get('/api/export/attendance', {
        params,
        responseType: 'blob'
      });

      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_report_${dayjs().format('YYYY-MM-DD')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('Report exported successfully');
    } catch (error) {
      console.error('Error exporting report:', error);
      toast.error('Failed to export report');
    }
  };

  const columns = [
    { field: 'student_id', headerName: 'Student ID', width: 130 },
    { field: 'name', headerName: 'Student Name', width: 200 },
    { field: 'class_name', headerName: 'Class', width: 150 },
    { 
      field: 'date', 
      headerName: 'Date', 
      width: 130,
      valueFormatter: (params) => {
        return new Date(params.value).toLocaleDateString();
      }
    },
    { field: 'start_time', headerName: 'Start Time', width: 120 },
    { field: 'end_time', headerName: 'End Time', width: 120 },
    { 
      field: 'status', 
      headerName: 'Status', 
      width: 120,
      renderCell: (params) => (
        <span style={{ 
          color: params.value === 'present' ? 'green' : 'red',
          fontWeight: 'bold'
        }}>
          {params.value?.toUpperCase()}
        </span>
      )
    },
    { 
      field: 'marked_at', 
      headerName: 'Marked At', 
      width: 180,
      valueFormatter: (params) => {
        return new Date(params.value).toLocaleString();
      }
    }
  ];

  // Generate summary statistics
  const totalRecords = attendanceData.length;
  const presentRecords = attendanceData.filter(record => record.status === 'present').length;
  const absentRecords = totalRecords - presentRecords;
  const attendanceRate = totalRecords > 0 ? ((presentRecords / totalRecords) * 100).toFixed(1) : 0;

  // Generate chart data
  const chartData = attendanceData.reduce((acc, record) => {
    const date = new Date(record.date).toLocaleDateString();
    const existing = acc.find(item => item.date === date);
    
    if (existing) {
      if (record.status === 'present') {
        existing.present += 1;
      } else {
        existing.absent += 1;
      }
    } else {
      acc.push({
        date,
        present: record.status === 'present' ? 1 : 0,
        absent: record.status === 'absent' ? 1 : 0
      });
    }
    
    return acc;
  }, []).slice(-7); // Last 7 days

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" gutterBottom>
            Attendance Reports
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<EmailIcon />}
              onClick={() => navigate('/emails')}
              color="primary"
            >
              Send Email Reports
            </Button>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleExportToExcel}
            >
              Export to Excel
            </Button>
          </Box>
        </Box>

        {/* Filters */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <FilterIcon sx={{ mr: 1 }} />
            Filters
          </Typography>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={3}>
              <DatePicker
                label="Start Date"
                value={filters.startDate}
                onChange={(newValue) => setFilters({ ...filters, startDate: newValue })}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <DatePicker
                label="End Date"
                value={filters.endDate}
                onChange={(newValue) => setFilters({ ...filters, endDate: newValue })}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Student</InputLabel>
                <Select
                  value={filters.studentId}
                  label="Student"
                  onChange={(e) => setFilters({ ...filters, studentId: e.target.value })}
                >
                  <MenuItem value="">All Students</MenuItem>
                  {students.map((student) => (
                    <MenuItem key={student.student_id} value={student.student_id}>
                      {student.name} ({student.student_id})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                variant="contained"
                onClick={fetchAttendanceReport}
                fullWidth
                startIcon={<ReportIcon />}
              >
                Generate Report
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Summary Statistics */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Records
                </Typography>
                <Typography variant="h4">
                  {totalRecords}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Present Records
                </Typography>
                <Typography variant="h4" color="success.main">
                  {presentRecords}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Absent Records
                </Typography>
                <Typography variant="h4" color="error.main">
                  {absentRecords}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Attendance Rate
                </Typography>
                <Typography variant="h4" color="primary.main">
                  {attendanceRate}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Charts */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Daily Attendance Trend
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="present" stroke="#4caf50" name="Present" />
                  <Line type="monotone" dataKey="absent" stroke="#f44336" name="Absent" />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>

        {/* Data Table */}
        <Paper sx={{ height: 600, width: '100%' }}>
          <DataGrid
            rows={attendanceData}
            columns={columns}
            pageSize={15}
            rowsPerPageOptions={[15, 25, 50]}
            disableSelectionOnClick
            loading={loading}
            getRowId={(row) => `${row.student_id}-${row.class_name}-${row.date}`}
            sx={{
              '& .MuiDataGrid-cell:hover': {
                color: 'primary.main',
              },
            }}
          />
        </Paper>
      </Box>
    </LocalizationProvider>
  );
};

export default Reports;
