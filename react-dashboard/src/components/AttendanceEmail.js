import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Chip,
  Alert,
  AlertTitle,
  CircularProgress,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider
} from '@mui/material';
import {
  Email as EmailIcon,
  Send as SendIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Settings as SettingsIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import axios from 'axios';
import toast from 'react-hot-toast';

const AttendanceEmail = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [emailSubject, setEmailSubject] = useState('Attendance Report');
  const [customMessage, setCustomMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailConfig, setEmailConfig] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [resultsDialog, setResultsDialog] = useState(false);
  const [emailResults, setEmailResults] = useState(null);

  // Fetch classes and email configuration on component mount
  useEffect(() => {
    fetchClasses();
    fetchEmailConfig();
  }, []);

  const fetchClasses = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/classes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClasses(response.data);
    } catch (error) {
      toast.error('Failed to fetch classes');
      console.error('Error fetching classes:', error);
    }
  };

  const fetchEmailConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/email/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmailConfig(response.data);
    } catch (error) {
      console.error('Error fetching email config:', error);
    }
  };

  const handleSendEmails = async () => {
    if (!emailConfig?.configured) {
      toast.error('Email service is not configured');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        subject: emailSubject,
        customMessage: customMessage.trim() || undefined
      };

      if (selectedClass) {
        payload.classId = selectedClass;
      }

      const response = await axios.post('/api/send-attendance-email', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setEmailResults(response.data);
      setResultsDialog(true);
      setConfirmDialog(false);
      
      toast.success(`Emails sent: ${response.data.summary.successCount} successful, ${response.data.summary.failureCount} failed`);
      
    } catch (error) {
      toast.error('Failed to send emails');
      console.error('Email sending error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenConfirmDialog = () => {
    if (!emailConfig?.configured) {
      toast.error('Email service is not configured. Please check environment variables.');
      return;
    }
    setConfirmDialog(true);
  };

  const getSelectedClassName = () => {
    if (!selectedClass) return 'All Recent Classes (Last 7 Days)';
    const classObj = classes.find(c => c.id === selectedClass);
    return classObj ? `${classObj.class_name} - ${new Date(classObj.date).toLocaleDateString()}` : 'Unknown Class';
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <EmailIcon color="primary" />
        Send Attendance Emails
      </Typography>

      <Grid container spacing={3}>
        {/* Email Configuration Status */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <SettingsIcon color={emailConfig?.configured ? 'success' : 'error'} />
                <Typography variant="h6">Email Service Status</Typography>
              </Box>
              
              {emailConfig?.configured ? (
                <Alert severity="success">
                  <AlertTitle>Email Service Ready</AlertTitle>
                  Service: {emailConfig.service} | Email: {emailConfig.user}
                </Alert>
              ) : (
                <Alert severity="error">
                  <AlertTitle>Email Service Not Configured</AlertTitle>
                  Please configure EMAIL_USER and EMAIL_PASSWORD environment variables to enable email functionality.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Email Configuration Form */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmailIcon />
                Email Settings
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Select Class (Optional)</InputLabel>
                    <Select
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      label="Select Class (Optional)"
                    >
                      <MenuItem value="">
                        <em>All Recent Classes (Last 7 Days)</em>
                      </MenuItem>
                      {classes.map((cls) => (
                        <MenuItem key={cls.id} value={cls.id}>
                          {cls.class_name} - {new Date(cls.date).toLocaleDateString()} 
                          ({cls.start_time} - {cls.end_time})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Email Subject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Attendance Report"
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Custom Message (Optional)"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Add a custom message that will be included in all emails..."
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Email Preview */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PeopleIcon />
                Email Preview
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">Subject:</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  {emailSubject || 'Attendance Report'}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">Target:</Typography>
                <Chip 
                  label={getSelectedClassName()}
                  color="primary"
                  size="small"
                />
              </Box>

              {customMessage && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">Custom Message:</Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2">
                      {customMessage}
                    </Typography>
                  </Paper>
                </Box>
              )}

              <Alert severity="info" sx={{ mb: 2 }}>
                Each student will receive their personalized attendance summary with:
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>Attendance percentage</li>
                  <li>Present/Absent count</li>
                  <li>Detailed class breakdown</li>
                  <li>Professional HTML formatting</li>
                </ul>
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Send Button */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
                  onClick={handleOpenConfirmDialog}
                  disabled={loading || !emailConfig?.configured}
                  sx={{ minWidth: 200 }}
                >
                  {loading ? 'Sending Emails...' : 'Send Attendance Emails'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog} onClose={() => setConfirmDialog(false)} maxWidth="md">
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmailIcon />
            Confirm Email Sending
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <AlertTitle>Are you sure you want to send emails?</AlertTitle>
            This action will send attendance reports to all students with email addresses.
          </Alert>

          <Typography variant="body1" sx={{ mb: 2 }}>
            <strong>Email Details:</strong>
          </Typography>
          <ul>
            <li><strong>Subject:</strong> {emailSubject}</li>
            <li><strong>Target:</strong> {getSelectedClassName()}</li>
            <li><strong>Custom Message:</strong> {customMessage || 'None'}</li>
          </ul>

          <Alert severity="info" sx={{ mt: 2 }}>
            Only students with valid email addresses will receive the report.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSendEmails}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <SendIcon />}
          >
            {loading ? 'Sending...' : 'Send Emails'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Results Dialog */}
      <Dialog 
        open={resultsDialog} 
        onClose={() => setResultsDialog(false)} 
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmailIcon />
            Email Sending Results
          </Box>
        </DialogTitle>
        <DialogContent>
          {emailResults && (
            <>
              {/* Summary */}
              <Alert 
                severity={emailResults.summary.failureCount === 0 ? 'success' : 'warning'}
                sx={{ mb: 3 }}
              >
                <AlertTitle>Email Sending Summary</AlertTitle>
                <Grid container spacing={2}>
                  <Grid item xs={3}>
                    <Typography variant="body2">Total Students:</Typography>
                    <Typography variant="h6">{emailResults.summary.totalStudents}</Typography>
                  </Grid>
                  <Grid item xs={3}>
                    <Typography variant="body2">Successful:</Typography>
                    <Typography variant="h6" color="success.main">
                      {emailResults.summary.successCount}
                    </Typography>
                  </Grid>
                  <Grid item xs={3}>
                    <Typography variant="body2">Failed:</Typography>
                    <Typography variant="h6" color="error.main">
                      {emailResults.summary.failureCount}
                    </Typography>
                  </Grid>
                  <Grid item xs={3}>
                    <Typography variant="body2">Success Rate:</Typography>
                    <Typography variant="h6">{emailResults.summary.successRate}%</Typography>
                  </Grid>
                </Grid>
              </Alert>

              {/* Detailed Results */}
              <Typography variant="h6" gutterBottom>Detailed Results</Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Student Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Attendance %</TableCell>
                      <TableCell>Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {emailResults.results.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell>{result.student}</TableCell>
                        <TableCell>{result.email}</TableCell>
                        <TableCell>
                          <Chip
                            label={result.status}
                            color={result.status === 'sent' ? 'success' : 'error'}
                            size="small"
                            icon={result.status === 'sent' ? <SuccessIcon /> : <ErrorIcon />}
                          />
                        </TableCell>
                        <TableCell>
                          {result.attendancePercentage ? `${result.attendancePercentage}%` : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {result.error && (
                            <Typography variant="body2" color="error">
                              {result.error}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResultsDialog(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AttendanceEmail;
