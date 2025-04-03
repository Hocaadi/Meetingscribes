import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Form, Alert, Card, ListGroup, Badge, Row, Col, InputGroup, Spinner } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import EmailService from '../../contexts/EmailService';
import './AuthForms.css';

/**
 * OTP Authentication Test Component
 * This component provides a user interface for testing the complete authentication flow
 * It enables testing both signup and signin processes with detailed logs
 */
const OTPAuthTester = () => {
  const navigate = useNavigate();
  const { 
    signUpWithOTP, 
    signInWithOTP, 
    verifyOTP, 
    signOut, 
    user, 
    session, 
    isSignedIn,
    isDevelopmentMode
  } = useAuth();
  
  // State for the form
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: 'Test',
    lastName: 'User',
    otp: ''
  });
  
  // Test states
  const [mode, setMode] = useState('signup'); // 'signup' or 'signin'
  const [step, setStep] = useState('initial'); // 'initial', 'otp_sent', 'verified'
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Add a log entry
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prevLogs => [
      { id: Date.now(), message, type, timestamp },
      ...prevLogs
    ]);
  };
  
  // Clear logs
  const clearLogs = () => setLogs([]);
  
  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Initialize component
  useEffect(() => {
    addLog('Test component initialized', 'system');
    addLog(`Development mode: ${isDevelopmentMode ? 'ON' : 'OFF'}`, 'system');
    
    // Check authentication state
    if (isSignedIn) {
      addLog(`Already signed in as ${user?.email}`, 'success');
    } else {
      addLog('Not signed in', 'info');
    }
  }, [isDevelopmentMode, isSignedIn, user]);
  
  // Reset the test
  const resetTest = async () => {
    if (isSignedIn) {
      try {
        addLog('Signing out current user...', 'system');
        await signOut();
        addLog('Signed out successfully', 'success');
      } catch (err) {
        addLog(`Sign out error: ${err.message}`, 'error');
      }
    }
    
    setStep('initial');
    setError('');
    setSuccess('');
    addLog('Test reset', 'system');
  };
  
  // Handle initial action (either signup or signin)
  const handleInitialAction = async () => {
    if (!formData.email) {
      setError('Email is required');
      return;
    }
    
    if (mode === 'signup' && !formData.password) {
      setError('Password is required for signup');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      if (mode === 'signup') {
        addLog(`Starting signup process for ${formData.email}`, 'info');
        
        // Check if user exists
        const userCheck = await EmailService.checkUserExists(formData.email);
        addLog(`User existence check: ${userCheck.exists ? 'User exists' : 'User does not exist'}`, 'info');
        
        // Sign up with OTP
        const result = await signUpWithOTP({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName
        });
        
        if (!result.success) {
          throw new Error(result.error || 'Signup failed');
        }
        
        addLog('OTP sent for signup verification', 'success');
        setSuccess('Verification code sent. Check your email or console in development mode.');
        setStep('otp_sent');
      } else {
        addLog(`Starting signin process for ${formData.email}`, 'info');
        
        // Sign in with OTP
        const result = await signInWithOTP({
          email: formData.email
        });
        
        if (!result.success) {
          throw new Error(result.error || 'Signin request failed');
        }
        
        addLog('OTP sent for signin verification', 'success');
        setSuccess('Verification code sent. Check your email or console in development mode.');
        setStep('otp_sent');
      }
    } catch (err) {
      console.error(`${mode} error:`, err);
      setError(err.message);
      addLog(`Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle OTP verification
  const handleVerifyOTP = async () => {
    if (!formData.otp) {
      setError('Verification code is required');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      addLog(`Verifying OTP for ${formData.email}`, 'info');
      
      // Verify the OTP
      const result = await verifyOTP({
        email: formData.email,
        token: formData.otp,
        type: mode
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Verification failed');
      }
      
      addLog('OTP verified successfully', 'success');
      setSuccess(`${mode === 'signup' ? 'Registration' : 'Sign in'} successful!`);
      setStep('verified');
    } catch (err) {
      console.error('Verification error:', err);
      setError(err.message);
      addLog(`Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle resending OTP
  const handleResendOTP = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      addLog(`Resending OTP to ${formData.email}`, 'info');
      
      // Use the EmailService directly
      const result = await EmailService.sendOTPEmail(formData.email, mode);
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to resend code');
      }
      
      addLog('OTP resent successfully', 'success');
      setSuccess('Verification code resent. Check your email or console in development mode.');
    } catch (err) {
      console.error('Resend error:', err);
      setError(err.message);
      addLog(`Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Navigate to dashboard
  const goToDashboard = () => {
    navigate('/dashboard');
  };
  
  return (
    <div className="otp-auth-tester">
      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0">Authentication Test Suite</h4>
          <Badge bg={isDevelopmentMode ? "success" : "warning"}>
            {isDevelopmentMode ? "Development Mode" : "Production Mode"}
          </Badge>
        </Card.Header>
        <Card.Body>
          {isSignedIn ? (
            <Alert variant="success">
              <Alert.Heading>Signed In</Alert.Heading>
              <p>
                Currently signed in as <strong>{user?.email}</strong>
              </p>
              <p>
                User ID: <code>{user?.id}</code>
              </p>
              <p>
                Name: {user?.firstName} {user?.lastName}
              </p>
              <hr />
              <div className="d-flex justify-content-end">
                <Button variant="outline-success" onClick={goToDashboard}>
                  Go to Dashboard
                </Button>
                <Button variant="outline-danger" className="ms-2" onClick={resetTest}>
                  Sign Out & Reset
                </Button>
              </div>
            </Alert>
          ) : (
            <>
              {error && <Alert variant="danger">{error}</Alert>}
              {success && <Alert variant="success">{success}</Alert>}
              
              <Form>
                {step === 'initial' && (
                  <>
                    <div className="mb-4">
                      <p>Select test mode:</p>
                      <div className="d-flex gap-2">
                        <Button 
                          variant={mode === 'signup' ? 'primary' : 'outline-primary'} 
                          onClick={() => setMode('signup')}
                          disabled={loading}
                        >
                          Test Sign Up
                        </Button>
                        <Button 
                          variant={mode === 'signin' ? 'primary' : 'outline-primary'} 
                          onClick={() => setMode('signin')}
                          disabled={loading}
                        >
                          Test Sign In
                        </Button>
                      </div>
                    </div>
                    
                    <Form.Group className="mb-3">
                      <Form.Label>Email Address</Form.Label>
                      <Form.Control
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        disabled={loading}
                        placeholder="Enter email"
                      />
                    </Form.Group>
                    
                    {mode === 'signup' && (
                      <>
                        <Row>
                          <Col>
                            <Form.Group className="mb-3">
                              <Form.Label>First Name</Form.Label>
                              <Form.Control
                                type="text"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                disabled={loading}
                              />
                            </Form.Group>
                          </Col>
                          <Col>
                            <Form.Group className="mb-3">
                              <Form.Label>Last Name</Form.Label>
                              <Form.Control
                                type="text"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                disabled={loading}
                              />
                            </Form.Group>
                          </Col>
                        </Row>
                        
                        <Form.Group className="mb-3">
                          <Form.Label>Password</Form.Label>
                          <Form.Control
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            disabled={loading}
                            placeholder="Create password"
                          />
                        </Form.Group>
                      </>
                    )}
                    
                    <div className="d-grid">
                      <Button 
                        variant="primary" 
                        onClick={handleInitialAction}
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <Spinner as="span" animation="border" size="sm" className="me-2" />
                            {mode === 'signup' ? 'Signing Up...' : 'Signing In...'}
                          </>
                        ) : (
                          mode === 'signup' ? 'Sign Up with OTP' : 'Sign In with OTP'
                        )}
                      </Button>
                    </div>
                  </>
                )}
                
                {step === 'otp_sent' && (
                  <>
                    <Alert variant="info">
                      <p>
                        A verification code has been sent to <strong>{formData.email}</strong>
                      </p>
                      {isDevelopmentMode && (
                        <p className="mb-0">
                          <strong>Development Mode:</strong> The OTP is <code>123456</code>
                        </p>
                      )}
                    </Alert>
                    
                    <Form.Group className="mb-3">
                      <Form.Label>Verification Code</Form.Label>
                      <InputGroup>
                        <Form.Control
                          type="text"
                          name="otp"
                          value={formData.otp}
                          onChange={handleChange}
                          disabled={loading}
                          placeholder="Enter 6-digit code"
                          maxLength={6}
                        />
                        {isDevelopmentMode && (
                          <Button 
                            variant="outline-secondary" 
                            onClick={() => setFormData(prev => ({ ...prev, otp: '123456' }))}
                          >
                            Auto-fill
                          </Button>
                        )}
                      </InputGroup>
                    </Form.Group>
                    
                    <div className="d-flex gap-2 mb-3">
                      <Button 
                        variant="primary" 
                        onClick={handleVerifyOTP}
                        disabled={loading}
                        className="flex-grow-1"
                      >
                        {loading ? (
                          <>
                            <Spinner as="span" animation="border" size="sm" className="me-2" />
                            Verifying...
                          </>
                        ) : (
                          'Verify Code'
                        )}
                      </Button>
                      <Button 
                        variant="outline-secondary" 
                        onClick={handleResendOTP}
                        disabled={loading}
                      >
                        Resend Code
                      </Button>
                    </div>
                    
                    <div className="d-grid">
                      <Button 
                        variant="outline-secondary" 
                        onClick={() => {
                          setStep('initial');
                          setFormData(prev => ({ ...prev, otp: '' }));
                        }}
                        disabled={loading}
                      >
                        Go Back
                      </Button>
                    </div>
                  </>
                )}
                
                {step === 'verified' && (
                  <div className="text-center">
                    <div className="mb-4">
                      <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '4rem' }}></i>
                      <h4 className="mt-3 mb-3">Authentication Successful!</h4>
                      <p>You have successfully {mode === 'signup' ? 'registered' : 'signed in'} with OTP verification.</p>
                    </div>
                    
                    <div className="d-flex gap-2 justify-content-center">
                      <Button variant="primary" onClick={goToDashboard}>
                        Go to Dashboard
                      </Button>
                      <Button variant="outline-secondary" onClick={resetTest}>
                        Start New Test
                      </Button>
                    </div>
                  </div>
                )}
              </Form>
            </>
          )}
        </Card.Body>
      </Card>
      
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Test Logs</h5>
          <Button variant="outline-secondary" size="sm" onClick={clearLogs}>
            Clear Logs
          </Button>
        </Card.Header>
        <ListGroup variant="flush" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {logs.length === 0 ? (
            <ListGroup.Item className="text-muted">No logs yet. Actions will be recorded here.</ListGroup.Item>
          ) : (
            logs.map(log => (
              <ListGroup.Item key={log.id} variant={
                log.type === 'error' ? 'danger' : 
                log.type === 'success' ? 'success' : 
                log.type === 'system' ? 'dark' : 'info'
              }>
                <small className="text-muted">{log.timestamp}</small>{' '}
                <span>{log.message}</span>
              </ListGroup.Item>
            ))
          )}
        </ListGroup>
      </Card>
      
      <div className="mt-4 text-center small text-muted">
        <p>
          This testing tool helps verify that the OTP authentication system works correctly.
          {isDevelopmentMode && ' In development mode, the fixed OTP code is 123456.'}
        </p>
      </div>
    </div>
  );
};

export default OTPAuthTester; 