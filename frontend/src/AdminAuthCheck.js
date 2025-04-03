import React, { useState, useEffect } from 'react';
import supabase from './supabaseClient';
import { Alert, Button, Card, Container, Spinner } from 'react-bootstrap';

// Component to verify and fix admin authentication
const AdminAuthCheck = () => {
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('');
  const [logDetails, setLogDetails] = useState([]);

  const logAction = (action) => {
    setLogDetails(prev => [...prev, { time: new Date().toISOString(), action }]);
  };

  // Check admin authentication status
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    setStatus('checking');
    setMessage('Checking current authentication status...');
    logAction('Starting authentication check');

    try {
      // Check current session
      const { data: sessionData } = await supabase.auth.getSession();
      logAction(`Session check result: ${sessionData.session ? 'Active session found' : 'No active session'}`);

      if (!sessionData.session) {
        setStatus('error');
        setMessage('No active session found. Please login as admin first.');
        return;
      }

      // Check if user has a profile in the profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionData.session.user.id)
        .single();

      if (profileError) {
        logAction(`Profile error: ${profileError.message}`);
        setStatus('warning');
        setMessage('User authenticated but profile not found. Repair needed.');
      } else {
        logAction(`Profile found: ${profileData.first_name} ${profileData.last_name}`);
        setStatus('success');
        setMessage(`Authentication verified! Logged in as: ${profileData.first_name} ${profileData.last_name}`);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      logAction(`Error: ${error.message}`);
      setStatus('error');
      setMessage(`Authentication check failed: ${error.message}`);
    }
  };

  // Repair admin authentication by creating/updating profile
  const repairAdminAuth = async () => {
    setStatus('repairing');
    setMessage('Repairing admin authentication...');
    logAction('Starting authentication repair');

    try {
      // Get current session
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        logAction('Cannot repair: No active session found');
        setStatus('error');
        setMessage('No active session found. Please login as admin first.');
        return;
      }

      const userId = sessionData.session.user.id;
      const userEmail = sessionData.session.user.email;
      
      logAction(`Creating/updating profile for user ID: ${userId}`);

      // Create or update the profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .upsert([{
          id: userId,
          first_name: 'Admin',
          last_name: 'User',
          email: userEmail,
          is_admin: true,
          is_premium: true,
          updated_at: new Date().toISOString()
        }])
        .select();

      if (profileError) {
        logAction(`Profile update error: ${profileError.message}`);
        setStatus('error');
        setMessage(`Failed to update profile: ${profileError.message}`);
        return;
      }

      logAction('Profile updated successfully');
      
      // Verify the repair by testing a simple database operation
      const { data: testTaskData, error: testTaskError } = await supabase
        .from('tasks')
        .select('count')
        .limit(1);

      if (testTaskError) {
        logAction(`Test query error: ${testTaskError.message}`);
        setStatus('warning');
        setMessage('Profile updated but still having permission issues. Manual database setup may be required.');
      } else {
        logAction('Test query successful');
        setStatus('success');
        setMessage('Admin authentication repaired successfully! You can now create tasks.');
      }
    } catch (error) {
      console.error('Repair error:', error);
      logAction(`Error: ${error.message}`);
      setStatus('error');
      setMessage(`Repair failed: ${error.message}`);
    }
  };

  // Handle logout and clear session
  const handleLogout = async () => {
    logAction('Logging out...');
    await supabase.auth.signOut();
    logAction('Logged out successfully');
    setStatus('info');
    setMessage('Logged out. Please login again as admin to continue.');
  };

  // Return status indicator UI
  return (
    <Container className="mt-4">
      <Card>
        <Card.Header as="h5">Admin Authentication Status</Card.Header>
        <Card.Body>
          {status === 'checking' && (
            <div className="text-center">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2">{message}</p>
            </div>
          )}
          
          {status === 'repairing' && (
            <div className="text-center">
              <Spinner animation="border" variant="warning" />
              <p className="mt-2">{message}</p>
            </div>
          )}
          
          {status === 'error' && (
            <Alert variant="danger">
              <Alert.Heading>Authentication Error</Alert.Heading>
              <p>{message}</p>
            </Alert>
          )}
          
          {status === 'warning' && (
            <Alert variant="warning">
              <Alert.Heading>Authentication Warning</Alert.Heading>
              <p>{message}</p>
            </Alert>
          )}
          
          {status === 'success' && (
            <Alert variant="success">
              <Alert.Heading>Authentication Success</Alert.Heading>
              <p>{message}</p>
            </Alert>
          )}
          
          {status === 'info' && (
            <Alert variant="info">
              <Alert.Heading>Authentication Info</Alert.Heading>
              <p>{message}</p>
            </Alert>
          )}
          
          <div className="d-flex justify-content-center mt-3 gap-3">
            <Button 
              variant="primary" 
              onClick={checkAuthStatus}
              disabled={status === 'checking'}
            >
              Check Status
            </Button>
            
            <Button 
              variant="warning" 
              onClick={repairAdminAuth}
              disabled={status === 'repairing' || status === 'success'}
            >
              Repair Admin Auth
            </Button>
            
            <Button 
              variant="danger" 
              onClick={handleLogout}
            >
              Logout
            </Button>
          </div>
          
          <div className="mt-4">
            <h6>Authentication Log:</h6>
            <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.8rem' }}>
              {logDetails.map((log, index) => (
                <div key={index} className="mb-1">
                  <span className="text-muted">{new Date(log.time).toLocaleTimeString()}</span>: {log.action}
                </div>
              ))}
            </div>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default AdminAuthCheck; 