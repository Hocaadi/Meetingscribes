import { createClient } from '@supabase/supabase-js';

// Supabase client configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Initialize Supabase client if credentials exist
let supabase = null;
try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized successfully in EmailService.js');
  } else {
    console.warn('⚠️ Supabase credentials not found in environment variables');
    console.warn('Email verification will use local storage and API fallbacks');
  }
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
}

// API base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// For development: fixed OTP for consistent testing
const FIXED_DEV_OTP = '123456';

// Log configuration status to help debugging
console.log('EmailService Configuration:', {
  apiBaseUrl: API_BASE_URL,
  nodeEnv: process.env.NODE_ENV,
  hasSupabase: !!supabase
});

/**
 * Generates an OTP code
 * In development mode, returns a fixed OTP for easier testing
 * In production, returns a random 6-digit code
 */
const generateOTP = () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[DEV] Using fixed OTP for development:', FIXED_DEV_OTP);
    return FIXED_DEV_OTP;
  }
  
  // Generate a random 6-digit OTP for production
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Stores OTP in localStorage with expiration
 * @param {string} email - User email address
 * @param {string} otp - OTP code to store
 * @param {string} type - Type of OTP (signup, signin, reset)
 */
const storeOTP = async (email, otp, type = 'signup') => {
  const normalizedEmail = email.toLowerCase();
  
  // Store OTP with 10-minute expiration
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).getTime();
  
  // Try to store in Supabase if available
  if (supabase) {
    try {
      // First try to remove any existing OTPs for this email
      await supabase
        .from('otp_verification')
        .delete()
        .eq('email', normalizedEmail);
      
      // Then insert the new OTP
      const { error } = await supabase
        .from('otp_verification')
        .insert([
          { 
            email: normalizedEmail, 
            code: otp,
            type: type,
            expires_at: new Date(expiresAt).toISOString(),
            attempts: 0
          }
        ]);
      
      if (error) {
        console.error('Error storing OTP in Supabase:', error.message);
        // Fall back to localStorage
        storeOTPInLocalStorage(normalizedEmail, otp, expiresAt, type);
      } else {
        console.log(`OTP stored in Supabase for ${normalizedEmail} (expires in 10 minutes)`);
        return true;
      }
    } catch (error) {
      console.error('Failed to store OTP in Supabase:', error);
      // Fall back to localStorage
      storeOTPInLocalStorage(normalizedEmail, otp, expiresAt, type);
    }
  } else {
    // Fall back to localStorage if Supabase is not available
    storeOTPInLocalStorage(normalizedEmail, otp, expiresAt, type);
  }
};

/**
 * Helper function to store OTP in localStorage (fallback)
 */
const storeOTPInLocalStorage = (email, otp, expiresAt, type) => {
  localStorage.setItem(`otp:${email}`, JSON.stringify({
    code: otp,
    expiresAt,
    type
  }));
  
  console.log(`OTP stored locally for ${email} (expires in 10 minutes)`);
};

/**
 * Verifies the OTP stored for a user
 * @param {string} email - User email
 * @param {string} code - OTP code to verify
 * @returns {Promise<Object>} - Result with success status and message
 */
const verifyStoredOTP = async (email, code) => {
  const normalizedEmail = email.toLowerCase();
  
  // In development mode, accept the fixed OTP
  if (process.env.NODE_ENV === 'development' && code === FIXED_DEV_OTP) {
    console.log('[DEV] Fixed OTP accepted in development mode');
    return { success: true, message: 'OTP verified successfully' };
  }
  
  // Try to verify from Supabase if available
  if (supabase) {
    try {
      // Get the OTP record from Supabase
      const { data, error } = await supabase
        .from('otp_verification')
        .select('*')
        .eq('email', normalizedEmail)
        .single();
      
      if (error || !data) {
        console.log(`No OTP found in Supabase for ${normalizedEmail}, checking local storage`);
        // Fall back to localStorage verification
        return verifyOTPFromLocalStorage(normalizedEmail, code);
      }
      
      // Check expiration
      if (new Date() > new Date(data.expires_at)) {
        // Delete expired OTP
        await supabase
          .from('otp_verification')
          .delete()
          .eq('email', normalizedEmail);
        
        return { 
          success: false, 
          message: 'Verification code has expired. Please request a new code.'
        };
      }
      
      // Increment attempts
      const newAttempts = (data.attempts || 0) + 1;
      
      // Update attempts count
      await supabase
        .from('otp_verification')
        .update({ attempts: newAttempts })
        .eq('email', normalizedEmail);
      
      // Max 3 attempts
      if (newAttempts > 3) {
        // Delete record after too many attempts
        await supabase
          .from('otp_verification')
          .delete()
          .eq('email', normalizedEmail);
        
        return { 
          success: false, 
          message: 'Too many failed attempts. Please request a new verification code.'
        };
      }
      
      // Check if OTP matches
      if (data.code !== code) {
        return { 
          success: false, 
          message: `Invalid verification code. You have ${3 - newAttempts} attempts remaining.`
        };
      }
      
      // OTP is valid - mark as verified and clean up
      await supabase
        .from('otp_verification')
        .update({ verified: true })
        .eq('email', normalizedEmail);
      
      // Delete the verified OTP record
      await supabase
        .from('otp_verification')
        .delete()
        .eq('email', normalizedEmail);
      
      return { 
        success: true, 
        message: 'Email verified successfully',
        type: data.type || 'signup'
      };
    } catch (error) {
      console.error('Error verifying OTP from Supabase:', error);
      // Fall back to localStorage verification
      return verifyOTPFromLocalStorage(normalizedEmail, code);
    }
  } else {
    // Fall back to localStorage verification
    return verifyOTPFromLocalStorage(normalizedEmail, code);
  }
};

/**
 * Helper function to verify OTP from localStorage (fallback)
 */
const verifyOTPFromLocalStorage = (email, code) => {
  const storedOTPData = localStorage.getItem(`otp:${email}`);
  
  if (!storedOTPData) {
    return { 
      success: false, 
      message: 'No OTP found for this email. Please request a new verification code.'
    };
  }
  
  try {
    const { code: storedCode, expiresAt, type } = JSON.parse(storedOTPData);
    
    if (Date.now() > expiresAt) {
      // Clean up expired OTP
      localStorage.removeItem(`otp:${email}`);
      return { 
        success: false, 
        message: 'Verification code has expired. Please request a new code.'
      };
    }
    
    if (storedCode !== code) {
      return { 
        success: false, 
        message: 'Invalid verification code. Please check and try again.'
      };
    }
    
    // OTP is valid - clean up after successful verification
    localStorage.removeItem(`otp:${email}`);
    
    return { 
      success: true, 
      message: 'Email verified successfully',
      type
    };
  } catch (error) {
    console.error('Error verifying OTP from localStorage:', error);
    return { 
      success: false, 
      message: 'Error verifying code. Please try again.'
    };
  }
};

/**
 * Simulates email sending in development mode by logging to console
 * @param {string} email - Recipient email
 * @param {string} type - Email type (signup, signin, reset)
 * @param {string} otp - OTP code to simulate
 * @returns {Object} - Result with success status and message
 */
const simulateEmailSending = (email, type, otp) => {
  console.log(`[DEV MODE] Simulating email sending for ${type}:`);
  console.log(`To: ${email}`);
  console.log(`OTP: ${otp}`);
  console.log('-------------------------------------------');
  return { success: true, message: 'Email simulated in development mode' };
};

/**
 * Sends OTP email to user
 * In development: Simulates email and stores OTP locally
 * In production: Uses backend API to send real emails
 * @param {string} email - User's email address
 * @param {string} type - Email type (signup, signin, reset)
 * @returns {Promise<{success: boolean, message: string}>}
 */
const sendOTPEmail = async (email, type = 'signin') => {
  try {
    // Normalize email to lowercase
    email = email.toLowerCase();
    
    // Generate a one-time password (OTP)
    const otp = generateOTP();
    
    // Store OTP locally or in Supabase
    await storeOTP(email, otp, type);
    
    // In development mode, just simulate email sending
    if (process.env.NODE_ENV === 'development') {
      return simulateEmailSending(email, type, otp);
    }
    
    // Use the backend API to send the actual email
    console.log(`Calling backend API to send OTP to ${email} (type: ${type})`);
    const response = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, type })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Backend API error:', {
        status: response.status,
        statusText: response.statusText,
        errorMessage: errorData.message,
        errorDetails: errorData
      });
      throw new Error(errorData.message || `Server returned ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Backend API response:', result);
    
    if (result.previewUrl) {
      console.log('Email preview available at:', result.previewUrl);
    }
    
    return { 
      success: true, 
      message: 'Verification code sent successfully'
    };
  } catch (error) {
    console.error('Failed to send OTP email:', error);
    
    // In development mode, return success anyway to make testing easier
    if (process.env.NODE_ENV === 'development') {
      return { success: true, message: 'Email simulated in development mode (error handled)' };
    }
    
    return { success: false, message: error.message };
  }
};

/**
 * Verifies OTP code
 * @param {string} email - User's email
 * @param {string} code - OTP code to verify
 * @returns {Promise<{success: boolean, message: string}>}
 */
const verifyOTP = async (email, code) => {
  if (!email || !code) {
    return { 
      success: false, 
      message: 'Email and verification code are required'
    };
  }
  
  const normalizedEmail = email.toLowerCase();
  
  // In development mode, first check local storage or Supabase
  const localVerification = await verifyStoredOTP(normalizedEmail, code);
  if (localVerification.success) {
    return localVerification;
  }
  
  // For production, use our backend API
  try {
    console.log('Verifying OTP with backend API');
    const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail, code })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      return { 
        success: false, 
        message: result.message || `Server returned ${response.status}: ${response.statusText}`
      };
    }
    
    return { 
      success: true, 
      message: result.message || 'Email verified successfully'
    };
  } catch (error) {
    console.error('Error verifying OTP with backend:', error);
    return { 
      success: false, 
      message: `Verification failed: ${error.message || 'Unknown error'}`
    };
  }
};

/**
 * Check if user exists by email
 * @param {string} email - User email
 * @returns {Promise<{exists: boolean}>}
 */
const checkUserExists = async (email) => {
  try {
    // Try to check directly with Supabase if available
    if (supabase) {
      try {
        // Alternative implementation using Supabase data API
        const { data, error } = await supabase
          .from('profiles')
          .select('email')
          .eq('email', email.toLowerCase())
          .maybeSingle();
        
        if (error) {
          throw new Error(error.message);
        }
        
        return { exists: !!data };
      } catch (supabaseError) {
        console.error('Error checking user with Supabase:', supabaseError);
        // Fall back to API
      }
    }
    
    // In development mode without backend or Supabase, simulate no user exists
    if (process.env.NODE_ENV === 'development' && !supabase) {
      return { exists: false };
    }
    
    // Fall back to REST API
    const response = await fetch(`${API_BASE_URL}/api/auth/check-user/${encodeURIComponent(email)}`);
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Failed to check user existence');
    }
    
    return { exists: result.exists };
  } catch (error) {
    console.error('Error checking if user exists:', error);
    // Default to false if there's an error
    return { exists: false };
  }
};

// Export the email service methods
const EmailService = {
  sendOTPEmail,
  verifyOTP,
  verifyStoredOTP, // Expose for direct verification
  generateOTP,     // Expose for testing
  checkUserExists  // Add user existence check
};

export default EmailService; 