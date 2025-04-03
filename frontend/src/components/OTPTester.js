import React, { useState } from 'react';
import EmailService from '../contexts/EmailService';

/**
 * OTP Tester Component
 * This component provides a user interface for testing the OTP system
 * It allows sending OTP emails and verifying OTP codes
 */
const OTPTester = () => {
  const [email, setEmail] = useState('');
  const [otpType, setOtpType] = useState('signin');
  const [otp, setOtp] = useState('');
  const [sendStatus, setSendStatus] = useState(null);
  const [verifyStatus, setVerifyStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  
  // Add log entry
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prevLogs) => [
      { id: Date.now(), message, type, timestamp },
      ...prevLogs.slice(0, 19) // Keep only the last 20 logs
    ]);
  };
  
  // Clear logs
  const clearLogs = () => setLogs([]);
  
  // Send OTP
  const handleSendOTP = async () => {
    if (!email) {
      addLog('Please enter an email address', 'error');
      return;
    }
    
    try {
      setLoading(true);
      addLog(`Sending ${otpType} OTP to ${email}...`, 'info');
      
      const result = await EmailService.sendOTPEmail(email, otpType);
      
      if (result.success) {
        addLog(`OTP sent successfully: ${result.message}`, 'success');
        setSendStatus({ success: true, message: result.message });
      } else {
        addLog(`Failed to send OTP: ${result.message}`, 'error');
        setSendStatus({ success: false, message: result.message });
      }
    } catch (error) {
      addLog(`Error sending OTP: ${error.message}`, 'error');
      setSendStatus({ success: false, message: error.message });
    } finally {
      setLoading(false);
    }
  };
  
  // Verify OTP
  const handleVerifyOTP = async () => {
    if (!email || !otp) {
      addLog('Please enter email and OTP code', 'error');
      return;
    }
    
    try {
      setLoading(true);
      addLog(`Verifying OTP ${otp} for ${email}...`, 'info');
      
      const result = await EmailService.verifyOTP(email, otp);
      
      if (result.success) {
        addLog(`OTP verified successfully: ${result.message}`, 'success');
        setVerifyStatus({ success: true, message: result.message });
      } else {
        addLog(`OTP verification failed: ${result.message}`, 'error');
        setVerifyStatus({ success: false, message: result.message });
      }
    } catch (error) {
      addLog(`Error verifying OTP: ${error.message}`, 'error');
      setVerifyStatus({ success: false, message: error.message });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="otp-tester" style={styles.container}>
      <h2 style={styles.title}>OTP System Tester</h2>
      <p style={styles.description}>
        Use this tool to test the OTP email verification system.
      </p>
      
      {/* Send OTP Section */}
      <div style={styles.section}>
        <h3>Step 1: Send OTP</h3>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email address"
            style={styles.input}
          />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>OTP Type:</label>
          <select
            value={otpType}
            onChange={(e) => setOtpType(e.target.value)}
            style={styles.select}
          >
            <option value="signup">Sign Up</option>
            <option value="signin">Sign In</option>
            <option value="reset">Password Reset</option>
          </select>
        </div>
        <button 
          onClick={handleSendOTP} 
          disabled={loading || !email}
          style={styles.button}
        >
          {loading ? 'Sending...' : 'Send OTP'}
        </button>
        
        {sendStatus && (
          <div style={{
            ...styles.status,
            backgroundColor: sendStatus.success ? '#d4edda' : '#f8d7da',
            color: sendStatus.success ? '#155724' : '#721c24'
          }}>
            {sendStatus.message}
          </div>
        )}
      </div>
      
      {/* Verify OTP Section */}
      <div style={styles.section}>
        <h3>Step 2: Verify OTP</h3>
        <div style={styles.inputGroup}>
          <label style={styles.label}>OTP Code:</label>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Enter OTP code"
            style={styles.input}
          />
        </div>
        <button 
          onClick={handleVerifyOTP} 
          disabled={loading || !email || !otp}
          style={styles.button}
        >
          {loading ? 'Verifying...' : 'Verify OTP'}
        </button>
        
        {verifyStatus && (
          <div style={{
            ...styles.status,
            backgroundColor: verifyStatus.success ? '#d4edda' : '#f8d7da',
            color: verifyStatus.success ? '#155724' : '#721c24'
          }}>
            {verifyStatus.message}
          </div>
        )}
      </div>
      
      {/* Logs Section */}
      <div style={styles.section}>
        <div style={styles.logHeader}>
          <h3>System Logs</h3>
          <button 
            onClick={clearLogs}
            style={styles.clearButton}
          >
            Clear Logs
          </button>
        </div>
        <div style={styles.logs}>
          {logs.length === 0 ? (
            <p style={styles.emptyLogs}>No logs yet. Actions will be recorded here.</p>
          ) : (
            logs.map((log) => (
              <div 
                key={log.id} 
                style={{
                  ...styles.logEntry,
                  color: log.type === 'error' ? '#d9534f' : 
                         log.type === 'success' ? '#5cb85c' : '#0275d8'
                }}
              >
                <span style={styles.logTime}>{log.timestamp}</span>
                <span>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
      
      <div style={styles.footer}>
        <p>
          In development mode, the fixed OTP code is: <strong>{process.env.NODE_ENV === 'development' ? '123456' : 'N/A'}</strong>
        </p>
      </div>
    </div>
  );
};

// Styles
const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    fontFamily: 'Arial, sans-serif'
  },
  title: {
    color: '#0d6efd',
    marginBottom: '10px'
  },
  description: {
    color: '#6c757d',
    marginBottom: '20px'
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: '6px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 1px 5px rgba(0, 0, 0, 0.05)'
  },
  inputGroup: {
    marginBottom: '15px'
  },
  label: {
    display: 'block',
    marginBottom: '5px',
    fontWeight: 'bold',
    color: '#495057'
  },
  input: {
    width: '100%',
    padding: '10px',
    fontSize: '16px',
    border: '1px solid #ced4da',
    borderRadius: '4px'
  },
  select: {
    width: '100%',
    padding: '10px',
    fontSize: '16px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    backgroundColor: 'white'
  },
  button: {
    backgroundColor: '#0d6efd',
    color: 'white',
    border: 'none',
    padding: '10px 15px',
    fontSize: '16px',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    ':hover': {
      backgroundColor: '#0b5ed7'
    },
    ':disabled': {
      backgroundColor: '#6c757d',
      cursor: 'not-allowed'
    }
  },
  status: {
    marginTop: '15px',
    padding: '10px',
    borderRadius: '4px',
    fontWeight: 'bold'
  },
  logHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px'
  },
  clearButton: {
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    padding: '5px 10px',
    fontSize: '14px',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  logs: {
    backgroundColor: '#282c34',
    color: '#f8f9fa',
    borderRadius: '4px',
    padding: '15px',
    maxHeight: '300px',
    overflowY: 'auto',
    fontFamily: 'monospace',
    fontSize: '14px'
  },
  emptyLogs: {
    color: '#6c757d',
    fontStyle: 'italic'
  },
  logEntry: {
    marginBottom: '5px',
    lineHeight: '1.5'
  },
  logTime: {
    color: '#6c757d',
    marginRight: '10px'
  },
  footer: {
    marginTop: '20px',
    textAlign: 'center',
    padding: '10px',
    borderTop: '1px solid #dee2e6',
    color: '#6c757d',
    fontSize: '14px'
  }
};

export default OTPTester; 