import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Button, Alert, InputGroup, Row, Col, Modal } from 'react-bootstrap';
import { FaEye, FaEyeSlash, FaEnvelope, FaLock, FaUser, FaUserShield } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import EmailOTP from './EmailOTP';
import './AuthForms.css';

const SignUp = ({ redirectUrl = '/dashboard' }) => {
  const { signUpWithOTP, adminBypass, isSignedIn, isDevelopmentMode } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Admin bypass state
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [adminError, setAdminError] = useState('');
  
  // Add effect to redirect when authentication state changes
  useEffect(() => {
    if (isSignedIn) {
      console.log('User is signed in, redirecting to', redirectUrl);
      navigate(redirectUrl);
    }
  }, [isSignedIn, navigate, redirectUrl]);
  
  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    
    try {
      console.log('Starting sign up with OTP for:', formData.email);
      
      // First register the user with Supabase
      const { data, error } = await signUpWithOTP({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName
      });
      
      if (error) {
        throw error;
      }
      
      // Show success message
      setSuccessMessage('Account created! Please verify your email to continue.');
      
      // Show OTP verification screen
      setShowOTPVerification(true);
    } catch (error) {
      console.error('Sign up error:', error);
      
      if (error.message && error.message.includes('already registered')) {
        setErrorMessage('This email is already registered. Please sign in instead.');
      } else {
        setErrorMessage(error.message || 'Failed to sign up. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleOTPVerificationComplete = () => {
    // OTP verified successfully, auth state should update automatically
    console.log('OTP verified successfully');
    // Add a success message before redirecting
    setSuccessMessage('Email verified successfully! Redirecting to dashboard...');
  };
  
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
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
  
  if (showOTPVerification) {
    return (
      <div className="auth-form">
        {successMessage && (
          <Alert variant="success" className="mb-4">
            {successMessage}
          </Alert>
        )}
        <EmailOTP 
          email={formData.email}
          onVerificationComplete={handleOTPVerificationComplete}
          onCancel={() => setShowOTPVerification(false)}
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
      
      <Form onSubmit={handleSubmit}>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="formFirstName">
              <Form.Label>First Name</Form.Label>
              <InputGroup>
                <InputGroup.Text>
                  <FaUser />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  name="firstName"
                  placeholder="First name"
                  value={formData.firstName}
                  onChange={handleChange}
                  isInvalid={!!errors.firstName}
                  disabled={loading}
                />
              </InputGroup>
              {errors.firstName && (
                <Form.Text className="text-danger">{errors.firstName}</Form.Text>
              )}
            </Form.Group>
          </Col>
          
          <Col md={6}>
            <Form.Group className="mb-3" controlId="formLastName">
              <Form.Label>Last Name</Form.Label>
              <InputGroup>
                <InputGroup.Text>
                  <FaUser />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  name="lastName"
                  placeholder="Last name"
                  value={formData.lastName}
                  onChange={handleChange}
                  isInvalid={!!errors.lastName}
                  disabled={loading}
                />
              </InputGroup>
              {errors.lastName && (
                <Form.Text className="text-danger">{errors.lastName}</Form.Text>
              )}
            </Form.Group>
          </Col>
        </Row>
        
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
        
        <Form.Group className="mb-3" controlId="formPassword">
          <Form.Label>Password</Form.Label>
          <InputGroup>
            <InputGroup.Text>
              <FaLock />
            </InputGroup.Text>
            <Form.Control
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Create a password"
              value={formData.password}
              onChange={handleChange}
              isInvalid={!!errors.password}
              autoComplete="new-password"
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
          {!errors.password && (
            <Form.Text className="text-muted">
              Password must be at least 8 characters long
            </Form.Text>
          )}
        </Form.Group>
        
        <Form.Group className="mb-4" controlId="formConfirmPassword">
          <Form.Label>Confirm Password</Form.Label>
          <InputGroup>
            <InputGroup.Text>
              <FaLock />
            </InputGroup.Text>
            <Form.Control
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              isInvalid={!!errors.confirmPassword}
              autoComplete="new-password"
              disabled={loading}
            />
            <Button
              variant="outline-secondary"
              onClick={toggleConfirmPasswordVisibility}
              tabIndex="-1"
            >
              {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
            </Button>
          </InputGroup>
          {errors.confirmPassword && (
            <Form.Text className="text-danger">{errors.confirmPassword}</Form.Text>
          )}
        </Form.Group>
        
        <div className="d-grid gap-2">
          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>
        </div>
        
        <div className="mt-3 text-center">
          <p className="text-muted small">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </Form>
      
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

export default SignUp; 