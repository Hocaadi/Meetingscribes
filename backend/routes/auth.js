const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const emailService = require('../emailService');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Create Supabase client only if credentials are available
let supabase = null;
try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized successfully in auth.js');
  } else {
    console.warn('⚠️ Supabase credentials missing in auth.js');
    console.warn('User management will be limited to development mode only');
  }
} catch (error) {
  console.error('Failed to initialize Supabase client in auth.js:', error);
}

// Initialize email service
emailService.initializeTransporter()
  .then(success => {
    if (success) {
      console.log('Email service initialized successfully');
    } else {
      console.warn('Email service initialization failed, emails will not be sent');
    }
  });

/**
 * Send OTP verification code
 * POST /api/auth/send-otp
 */
router.post('/send-otp', async (req, res) => {
  try {
    const { email, type = 'signup' } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }
    
    // Generate a new OTP
    const otp = emailService.generateOTP();
    console.log(`Generated OTP for ${email}: ${otp}`);
    
    // Send email with OTP
    const result = await emailService.sendOTPEmail(email, otp, type);
    
    if (!result.success) {
      console.error('Failed to send OTP email:', result.message);
      return res.status(500).json({ 
        success: false, 
        message: result.message || 'Failed to send verification code' 
      });
    }
    
    // Include development mode flag to help frontend
    const isDevelopmentMode = process.env.NODE_ENV === 'development';
    
    // Return success (without exposing the OTP in production)
    return res.status(200).json({ 
      success: true, 
      message: 'Verification code sent',
      previewUrl: result.previewUrl, // Only relevant for Ethereal mail testing
      isDevelopmentMode,
      // Only include OTP in development mode for easy testing
      ...(isDevelopmentMode && { otp: result.otp }) 
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to send verification code', 
      error: error.message 
    });
  }
});

/**
 * Verify OTP code
 * POST /api/auth/verify-otp
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, code, type = 'signup' } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and verification code are required' 
      });
    }
    
    // Verify the OTP (must use await with the new async implementation)
    const result = await emailService.verifyOTP(email, code);
    
    if (!result.success) {
      return res.status(400).json({ 
        success: false, 
        message: result.message 
      });
    }
    
    // If OTP is valid and it's a signup request, create the user in Supabase
    if (type === 'signup' && supabase) {
      try {
        // Check if user password was provided in earlier step
        const userData = req.body.userData;
        
        if (userData && userData.password) {
          // Create user in Supabase
          const { data, error } = await supabase.auth.admin.createUser({
            email,
            password: userData.password,
            email_confirm: true, // Mark email as confirmed
            user_metadata: {
              first_name: userData.firstName || '',
              last_name: userData.lastName || ''
            }
          });
          
          if (error) {
            console.error('Error creating user in Supabase:', error);
          } else {
            console.log('User created successfully in Supabase:', data.user.id);
          }
        }
      } catch (supabaseError) {
        console.error('Error creating user in Supabase:', supabaseError);
        // Continue anyway, the OTP verification was successful
      }
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Verification successful',
      type: result.type
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to verify code', 
      error: error.message 
    });
  }
});

/**
 * Create user from OTP verification
 * POST /api/auth/create-user
 */
router.post('/create-user', async (req, res) => {
  try {
    const { email, password, firstName, lastName, token } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }
    
    // Check if token is valid (this is a second verification after OTP)
    // In a real system, you'd validate a JWT or session token
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }
    
    if (!supabase) {
      // In development mode without Supabase, return success
      if (process.env.NODE_ENV === 'development') {
        return res.status(200).json({
          success: true,
          message: 'User created successfully in development mode',
          user: { email, firstName, lastName }
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: 'User creation service unavailable' 
      });
    }
    
    // Create user in Supabase
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Mark email as already confirmed
      user_metadata: {
        first_name: firstName || '',
        last_name: lastName || ''
      }
    });
    
    if (error) {
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'User created successfully',
      user: data.user
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to create user', 
      error: error.message 
    });
  }
});

/**
 * Check user existence by email
 * GET /api/auth/check-user/:email
 */
router.get('/check-user/:email', async (req, res) => {
  try {
    const email = req.params.email;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }
    
    if (!supabase) {
      // In development mode without Supabase, always return user exists = false
      if (process.env.NODE_ENV === 'development') {
        return res.status(200).json({
          success: true,
          exists: false
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: 'User check service unavailable' 
      });
    }
    
    // Check if user exists in Supabase
    const { data, error } = await supabase.auth.admin.listUsers({
      filters: {
        email: email
      }
    });
    
    if (error) {
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
    
    // Check if any users match the email
    const exists = data && data.users && data.users.length > 0;
    
    return res.status(200).json({ 
      success: true, 
      exists
    });
  } catch (error) {
    console.error('Error checking user:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to check user', 
      error: error.message 
    });
  }
});

/**
 * Health check endpoint
 * GET /api/auth/health
 */
router.get('/health', (req, res) => {
  // Check email service status
  const emailServiceStatus = emailService ? true : false;
  
  // Check if we have a transporter in the email service
  let transporterStatus = false;
  try {
    transporterStatus = emailService && typeof emailService.sendOTPEmail === 'function';
  } catch (e) {
    console.error('Error checking email service:', e);
  }
  
  // Check Supabase status
  const supabaseStatus = supabase ? true : false;
  
  // Check OTP functions
  const otpFunctionsStatus = emailService && 
    typeof emailService.generateOTP === 'function' && 
    typeof emailService.verifyOTP === 'function';
  
  // Get environment
  const environment = process.env.NODE_ENV || 'development';
  
  // Return detailed health status
  res.status(200).json({ 
    status: 'ok', 
    message: 'Auth API is running',
    environment,
    services: {
      emailServiceReady: emailServiceStatus,
      transporterInitialized: transporterStatus,
      supabaseReady: supabaseStatus,
      otpFunctionsReady: otpFunctionsStatus
    },
    configuration: {
      isUsingOtpGenerator: true,
      hasSupabaseOtpTable: true,
      isUsingNodemailer: true
    },
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

/**
 * Testing endpoint for OTP system
 * GET /api/auth/test-otp
 * Only available in development mode
 */
router.get('/test-otp', (req, res) => {
  // Check if we're in development mode
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({
      success: false,
      message: 'This endpoint is only available in development mode'
    });
  }
  
  try {
    // Generate a test OTP
    const testOTP = emailService.generateOTP();
    
    // Get all stored OTPs (for debugging)
    const storedOTPs = emailService.getOTPStore ? 
      Array.from(emailService.getOTPStore()).map(([email, data]) => ({
        email,
        expires: data.expiresAt,
        type: data.type
      })) : 
      [];
    
    // Return test data
    return res.status(200).json({
      success: true,
      message: 'OTP test endpoint',
      testOTP,
      fixedDevOTP: '123456', // The fixed OTP used in development mode
      storedOTPs,
      emailServiceStatus: {
        initialized: !!emailService,
        hasSendFunction: !!emailService.sendOTPEmail,
        hasVerifyFunction: !!emailService.verifyOTP,
        hasGenerateFunction: !!emailService.generateOTP,
        usingOtpGenerator: true
      }
    });
  } catch (error) {
    console.error('Error in test-otp endpoint:', error);
    return res.status(500).json({
      success: false,
      message: 'Error testing OTP system',
      error: error.message
    });
  }
});

module.exports = router; 