import React, { useState, useEffect } from 'react';
import { Form, Button, Alert, InputGroup } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import EmailService from '../../contexts/EmailService';
import './AuthForms.css';

const EmailOTP = ({ email, onVerificationComplete, onCancel }) => {
  const { verifyOTP, resendOTP } = useAuth();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  // Initialize by sending OTP
  useEffect(() => {
    const sendInitialOTP = async () => {
      try {
        // Reset any previous errors
        setError('');
        setMessage('Sending verification code...');
        
        // Send OTP using our service
        const result = await EmailService.sendOTPEmail(email, 'signup');
        
        if (!result.success) {
          throw new Error(result.message || 'Failed to send verification code');
        }
        
        setMessage('Verification code sent to your email');
        
        // If we're in development mode with the fixed OTP, show a helpful message
        if (process.env.NODE_ENV === 'development' && result.isDev) {
          setMessage('Check the browser console for your verification code (development mode)');
        }
      } catch (err) {
        console.error('Error sending initial OTP:', err);
        setError(err.message || 'Failed to send verification code. Please try again.');
      }
    };
    
    // Send OTP when component mounts
    sendInitialOTP();
  }, [email]);

  const handleVerify = async (e) => {
    e.preventDefault();
    
    if (!otp.trim()) {
      setError('Please enter the verification code');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Use our EmailService to verify OTP
      const result = await EmailService.verifyOTP(email, otp);
      
      if (!result.success) {
        throw new Error(result.message || 'Invalid verification code');
      }
      
      // If verification was successful, try to sign in using Supabase
      const { error } = await verifyOTP({
        email,
        token: otp,
        type: 'signup'
      });
      
      if (error) {
        console.warn('Supabase verification unsuccessful, but custom verification passed');
        // Continue anyway since our verification passed
      }
      
      // Notify parent component
      setMessage('Email verified successfully! Redirecting...');
      onVerificationComplete();
      
      // Force redirect to dashboard after verification
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    } catch (err) {
      console.error('OTP verification error:', err);
      setError(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleResend = async () => {
    setError('');
    setMessage('');
    setResendDisabled(true);
    
    try {
      // Send OTP using our service
      const result = await EmailService.sendOTPEmail(email, 'signup');
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to resend verification code');
      }
      
      setMessage('Verification code resent. Please check your email.');
      
      // If we're in development mode with the fixed OTP, show a helpful message
      if (process.env.NODE_ENV === 'development' && result.isDev) {
        setMessage('Check the browser console for your verification code (development mode)');
      }
      
      // Start countdown
      let timer = 60;
      setCountdown(timer);
      
      const interval = setInterval(() => {
        timer--;
        setCountdown(timer);
        
        if (timer <= 0) {
          clearInterval(interval);
          setResendDisabled(false);
        }
      }, 1000);
    } catch (err) {
      console.error('Error resending OTP:', err);
      setError(err.message || 'Failed to resend verification code. Please try again.');
      setResendDisabled(false);
    }
  };
  
  return (
    <div className="otp-verification">
      <h4 className="text-center mb-4">Email Verification</h4>
      <p className="text-center text-muted mb-4">
        We've sent a verification code to <strong>{email}</strong>
      </p>
      
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}
      
      {message && (
        <Alert variant="info" className="mb-4">
          {message}
        </Alert>
      )}
      
      <Form onSubmit={handleVerify}>
        <Form.Group className="mb-4" controlId="otpCode">
          <Form.Label>Verification Code</Form.Label>
          <InputGroup>
            <Form.Control
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter the 6-digit code"
              disabled={loading}
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              className="otp-input"
            />
          </InputGroup>
        </Form.Group>
        
        <div className="d-grid gap-2 mb-3">
          <Button 
            variant="primary" 
            type="submit"
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </Button>
        </div>
      </Form>
      
      <div className="d-flex justify-content-between align-items-center">
        <Button 
          variant="link" 
          className="p-0"
          onClick={handleResend}
          disabled={resendDisabled}
        >
          {resendDisabled 
            ? `Resend code (${countdown}s)` 
            : 'Resend verification code'}
        </Button>
        
        <Button 
          variant="link" 
          className="p-0"
          onClick={onCancel}
        >
          Go back
        </Button>
      </div>
    </div>
  );
};

export default EmailOTP; 