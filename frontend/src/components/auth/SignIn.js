import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Button, Alert, InputGroup, Tabs, Tab, Modal } from 'react-bootstrap';
import { FaEye, FaEyeSlash, FaEnvelope, FaLock, FaUserShield } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import EmailService from '../../contexts/EmailService';
import EmailOTP from './EmailOTP';
import './AuthForms.css';

const SignIn = ({ redirectUrl = '/dashboard' }) => {
  const { signIn, signInWithOTP, verifyOTP, adminBypass, isSignedIn, user, session, isDevelopmentMode } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showOTP, setShowOTP] = useState(false);
  const [activeTab, setActiveTab] = useState('password');
  
  // Admin bypass state
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [adminError, setAdminError] = useState('');
  
  console.log('SignIn component render state:', { 
    isSignedIn, 
    hasUser: !!user, 
    hasSession: !!session, 
    loading, 
    redirectUrl,
    isDevelopmentMode
  });

  // Add effect to redirect when authentication state changes
  useEffect(() => {
    // Force debug logging to track state changes
    console.log('SignIn useEffect triggered:', { 
      isSignedIn, 
      hasUser: !!user, 
      hasSession: !!session,
      loadingState: loading
    });
    
    if (isSignedIn) {
      console.log('User is signed in, redirecting to', redirectUrl);
      
      // Using window.location.href for direct navigation to ensure redirect happens
      window.location.href = redirectUrl;
    }
  }, [isSignedIn, redirectUrl, user, session]);
  
  const validateEmailOnly = () => {
    const newErrors = {};
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (activeTab === 'password') {
      if (!formData.password) {
        newErrors.password = 'Password is required';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    
    // Clear any existing error/success messages
    setErrorMessage('');
    setSuccessMessage('');
  };
  
  const handlePasswordSignIn = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    
    try {
      console.log('Attempting sign in with password...');
      const { data, error, devMode, success } = await signIn({
        email: formData.email,
        password: formData.password
      });
      
      // If we're in development mode with dev credentials, show success message
      if (devMode) {
        console.log('Development mode sign-in successful');
        setSuccessMessage('Sign-in successful in development mode! Redirecting...');
        // Force redirect to dashboard
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 500);
        return;
      }
      
      if (error) {
        // Handle authentication errors
        if (error.message && error.message.includes('Invalid login credentials')) {
          setErrorMessage('Invalid email or password. Please try again.');
        } else if (error.message && error.message.includes('Authentication service unavailable')) {
          // Replace the technical error with a user-friendly one
          setErrorMessage('The authentication service is currently being set up. You can still access the application in development mode.');
        } else {
          setErrorMessage(error.message || 'Failed to sign in. Please try again.');
        }
        setLoading(false);
      } else if (success) {
        console.log('Sign-in successful, data:', data);
        setSuccessMessage('Sign-in successful! Redirecting...');
        
        // Force redirect immediately
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 500);
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setErrorMessage('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };
  
  const handleOTPSignIn = async (e) => {
    e.preventDefault();
    
    if (!validateEmailOnly()) {
      return;
    }
    
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    
    try {
      console.log('Sending OTP to email:', formData.email);
      
      // Use our EmailService directly
      const result = await EmailService.sendOTPEmail(formData.email, 'signin');
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to send verification code');
      }
      
      // Also notify Supabase (fallback)
      await signInWithOTP({
        email: formData.email
      });
      
      setSuccessMessage('Verification code sent to your email');
      
      // Show OTP verification screen
      setShowOTP(true);
    } catch (error) {
      console.error('OTP request error:', error);
      setErrorMessage(
        error.message || 'Failed to send verification code. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };
  
  const handleOTPVerified = () => {
    // OTP verified successfully, the auth state should have been updated automatically
    console.log('OTP verified successfully');
    setSuccessMessage('Verification successful! Signing you in...');
  };
  
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  const handleTabChange = (key) => {
    setActiveTab(key);
    setErrorMessage('');
    setSuccessMessage('');
  };
  
  // Admin bypass modal handlers
  const openAdminModal = () => {
    setShowAdminModal(true);
    setAdminKey('');
    setAdminError('');
  };
  
  const closeAdminModal = () => {
    setShowAdminModal(false);
    setAdminKey('');
    setAdminError('');
  };
  
  const handleAdminKeyChange = (e) => {
    setAdminKey(e.target.value);
    setAdminError('');
  };
  
  const handleAdminBypass = async () => {
    try {
      setLoading(true);
      setAdminError('');
      
      const result = await adminBypass(adminKey);
      
      if (result.success) {
        setSuccessMessage('Admin mode activated! Redirecting...');
        closeAdminModal();
        
        // Force redirect to dashboard after admin login
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 500);
      } else {
        setAdminError(result.error || 'Invalid admin key');
      }
    } catch (error) {
      console.error('Admin bypass error:', error);
      setAdminError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  // If showing OTP verification screen
  if (showOTP) {
    return (
      <div className="auth-form">
        {successMessage && (
          <Alert variant="success" className="mb-4">
            {successMessage}
          </Alert>
        )}
        <EmailOTP 
          email={formData.email}
          onVerificationComplete={handleOTPVerified}
          onCancel={() => setShowOTP(false)}
        />
      </div>
    );
  }
  
  return (
    <div className="auth-form">
      {errorMessage && (
        <Alert variant="danger" className="mb-4">
          {errorMessage}
        </Alert>
      )}
      
      {successMessage && (
        <Alert variant="success" className="mb-4">
          {successMessage}
        </Alert>
      )}
      
      <Tabs
        activeKey={activeTab}
        onSelect={handleTabChange}
        className="mb-4"
        justify
      >
        <Tab eventKey="password" title="Password">
          <Form onSubmit={handlePasswordSignIn}>
            <Form.Group className="mb-3" controlId="formEmail">
              <Form.Label>Email address</Form.Label>
              <InputGroup>
                <InputGroup.Text>
                  <FaEnvelope />
                </InputGroup.Text>
                <Form.Control
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                  isInvalid={!!errors.email}
                  autoComplete="email"
                  disabled={loading}
                />
              </InputGroup>
              {errors.email && (
                <Form.Text className="text-danger">{errors.email}</Form.Text>
              )}
            </Form.Group>
            
            <Form.Group className="mb-4" controlId="formPassword">
              <Form.Label>Password</Form.Label>
              <InputGroup>
                <InputGroup.Text>
                  <FaLock />
                </InputGroup.Text>
                <Form.Control
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  isInvalid={!!errors.password}
                  autoComplete="current-password"
                  disabled={loading}
                />
                <Button
                  variant="outline-secondary"
                  onClick={togglePasswordVisibility}
                  tabIndex="-1"
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </Button>
              </InputGroup>
              {errors.password && (
                <Form.Text className="text-danger">{errors.password}</Form.Text>
              )}
            </Form.Group>
            
            <div className="d-grid gap-2">
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </div>
            
            <div className="mt-3 text-center">
              <a href="/forgot-password" className="auth-link">
                Forgot your password?
              </a>
            </div>
          </Form>
        </Tab>
        
        <Tab eventKey="otp" title="Email OTP">
          <Form onSubmit={handleOTPSignIn}>
            <Form.Group className="mb-4" controlId="formEmailOTP">
              <Form.Label>Email address</Form.Label>
              <InputGroup>
                <InputGroup.Text>
                  <FaEnvelope />
                </InputGroup.Text>
                <Form.Control
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                  isInvalid={!!errors.email}
                  autoComplete="email"
                  disabled={loading}
                />
              </InputGroup>
              {errors.email && (
                <Form.Text className="text-danger">{errors.email}</Form.Text>
              )}
            </Form.Group>
            
            <div className="d-grid gap-2">
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Sending Code...' : 'Send Verification Code'}
              </Button>
            </div>
            
            <div className="mt-3 text-center">
              <p className="text-muted small">
                We'll send a verification code to your email that you can use to sign in
              </p>
            </div>
          </Form>
        </Tab>
      </Tabs>
      
      {/* Admin bypass button - now visible in all environments */}
      <div className="mt-4 text-center">
        <Button 
          variant="outline-secondary" 
          size="sm"
          onClick={openAdminModal}
          className="admin-bypass-button"
        >
          <FaUserShield className="me-2" />
          Admin Access
        </Button>
      </div>
      
      {/* Admin Bypass Modal */}
      <Modal show={showAdminModal} onHide={closeAdminModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Admin Bypass</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted mb-3">
            Enter your admin key to bypass authentication.
          </p>
          
          <Form.Group className="mb-3">
            <Form.Label>Admin Key</Form.Label>
            <Form.Control
              type="password"
              placeholder="Enter admin key"
              value={adminKey}
              onChange={handleAdminKeyChange}
              isInvalid={!!adminError}
            />
            {adminError && (
              <Form.Text className="text-danger">{adminError}</Form.Text>
            )}
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeAdminModal}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleAdminBypass}
            disabled={!adminKey || loading}
          >
            {loading ? 'Activating...' : 'Activate Admin Mode'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default SignIn; 