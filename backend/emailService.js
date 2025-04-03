const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const otpGenerator = require('otp-generator');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Create Supabase client only if credentials are available
let supabase = null;
try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized successfully in emailService.js');
  } else {
    console.warn('⚠️ Supabase credentials missing in emailService.js');
    console.warn('OTP verification will fall back to in-memory storage');
  }
} catch (error) {
  console.error('Failed to initialize Supabase client in emailService.js:', error);
}

// Create a map to store OTPs with expiration times for development or fallback
// In production, Supabase otp_verification table is used
const otpStore = new Map();

// Default configuration for testing (ethereal.email)
let transportConfig = {
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};

// Log configuration
console.log(`Email Service Configuration: ${process.env.SMTP_HOST ? 'Using configured SMTP' : 'Using fallback SMTP'}`);

// Create reusable transporter object using the default SMTP transport
let transporter;

// Initialize transporter
async function initializeTransporter() {
  try {
    console.log('Initializing email transporter...');
    
    // If SMTP credentials not provided, create a test account
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('SMTP credentials not found in environment variables');
      console.log('Creating test account with Ethereal Email (https://ethereal.email)');
      
      try {
        const testAccount = await nodemailer.createTestAccount();
        
        transportConfig = {
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        };
        
        console.log('Ethereal Email test account created successfully');
        console.log('Test account email:', testAccount.user);
        // Don't log the password, but indicate it's available
        console.log('Test account password available for SMTP authentication');
      } catch (etherealError) {
        console.error('Failed to create Ethereal test account:', etherealError.message);
        console.error('Email sending will not work correctly');
        return false;
      }
    } else {
      console.log('Using configured SMTP server:', transportConfig.host);
      console.log('SMTP Port:', transportConfig.port);
      console.log('SMTP Secure:', transportConfig.secure ? 'Yes' : 'No');
      // Log partial user to avoid exposing credentials
      if (transportConfig.auth.user) {
        const partialUser = transportConfig.auth.user.substring(0, 3) + '...';
        console.log('SMTP User:', partialUser);
      }
    }
    
    // Create the transporter with the config
    transporter = nodemailer.createTransport(transportConfig);
    
    // Verify connection configuration
    console.log('Verifying SMTP connection...');
    try {
      await transporter.verify();
      console.log('✅ SMTP server connection verified successfully');
      return true;
    } catch (verifyError) {
      console.error('❌ SMTP connection verification failed:', verifyError.message);
      if (verifyError.code === 'ECONNREFUSED') {
        console.error('Could not connect to SMTP server. Check if the host and port are correct.');
      } else if (verifyError.code === 'EAUTH') {
        console.error('Authentication failed. Check your username and password.');
      } else if (verifyError.code === 'ETIMEDOUT') {
        console.error('Connection to SMTP server timed out. Check your network or firewall settings.');
      }
      return false;
    }
  } catch (error) {
    console.error('Failed to initialize email transporter:', error);
    console.error('Email functionality will not work correctly');
    return false;
  }
}

/**
 * Generate a random OTP using otp-generator package
 * @returns {string} 6-digit OTP
 */
function generateOTP() {
  // In development mode, always use a fixed OTP for testing
  if (process.env.NODE_ENV === 'development') {
    console.log('Development mode: Using fixed OTP 123456');
    return '123456';
  }
  
  // Generate OTP with otp-generator for production
  return otpGenerator.generate(6, { 
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
    digits: true
  });
}

/**
 * Store OTP in Supabase otp_verification table or local memory
 * @param {string} email - User email
 * @param {string} otp - Generated OTP
 * @param {string} type - OTP type (signup, signin, reset)
 * @returns {Promise<boolean>} Success status
 */
async function storeOTP(email, otp, type = 'signup') {
  const normalizedEmail = email.toLowerCase();
  
  // Set expiration to 10 minutes from now
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  
  // Try to store in Supabase if available
  if (supabase) {
    try {
      // First, delete any existing OTPs for this email
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
            expires_at: expiresAt.toISOString(),
            attempts: 0
          }
        ]);
      
      if (error) {
        console.error('Error storing OTP in Supabase:', error.message);
        // Fall back to in-memory storage
        storeOTPInMemory(normalizedEmail, otp, type, expiresAt);
        return true;
      }
      
      console.log(`OTP stored in Supabase for ${normalizedEmail} (expires in 10 minutes)`);
      return true;
    } catch (error) {
      console.error('Failed to store OTP in Supabase:', error);
      // Fall back to in-memory storage
      storeOTPInMemory(normalizedEmail, otp, type, expiresAt);
      return true;
    }
  } else {
    // Fall back to in-memory storage
    storeOTPInMemory(normalizedEmail, otp, type, expiresAt);
    return true;
  }
}

/**
 * Helper function to store OTP in memory (fallback)
 */
function storeOTPInMemory(email, otp, type, expiresAt) {
  otpStore.set(email, {
    code: otp,
    expiresAt,
    type,
    attempts: 0
  });
  
  console.log(`OTP stored in memory for ${email} (expires in 10 minutes)`);
  
  // Set up automatic cleanup after expiration
  setTimeout(() => {
    const otpData = otpStore.get(email);
    if (otpData && otpData.code === otp) {
      otpStore.delete(email);
      console.log(`Expired OTP removed from memory for ${email}`);
    }
  }, 10 * 60 * 1000);
}

/**
 * Verify OTP for a given email
 * @param {string} email - User email
 * @param {string} otp - OTP to verify
 * @returns {Promise<Object>} Result with success status and message
 */
async function verifyOTP(email, otp) {
  const normalizedEmail = email.toLowerCase();
  
  // In development mode, accept the fixed OTP
  if (process.env.NODE_ENV === 'development' && otp === '123456') {
    console.log(`Development mode: Fixed OTP verified for ${normalizedEmail}`);
    return { 
      success: true, 
      message: 'Email verified successfully',
      type: 'signup' // Default to signup in dev mode
    };
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
        console.log(`No OTP found in Supabase for ${normalizedEmail}, checking in-memory store`);
        // Fall back to in-memory verification
        return verifyOTPInMemory(normalizedEmail, otp);
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
      if (data.code !== otp) {
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
      
      // Optionally delete the verified OTP record
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
      // Fall back to in-memory verification
      return verifyOTPInMemory(normalizedEmail, otp);
    }
  } else {
    // Fall back to in-memory verification
    return verifyOTPInMemory(normalizedEmail, otp);
  }
}

/**
 * Helper function to verify OTP from in-memory store (fallback)
 */
function verifyOTPInMemory(email, otp) {
  const otpData = otpStore.get(email);
  
  if (!otpData) {
    return { 
      success: false, 
      message: 'No verification code found for this email. Please request a new code.'
    };
  }
  
  // Check expiration
  if (Date.now() > otpData.expiresAt) {
    otpStore.delete(email);
    return { 
      success: false, 
      message: 'Verification code has expired. Please request a new code.'
    };
  }
  
  // Increment attempts
  otpData.attempts += 1;
  
  // Max 3 attempts
  if (otpData.attempts > 3) {
    otpStore.delete(email);
    return { 
      success: false, 
      message: 'Too many failed attempts. Please request a new verification code.'
    };
  }
  
  // Check if OTP matches
  if (otpData.code !== otp) {
    return { 
      success: false, 
      message: `Invalid verification code. You have ${3 - otpData.attempts} attempts remaining.`
    };
  }
  
  // OTP is valid - clean up
  otpStore.delete(email);
  
  return { 
    success: true, 
    message: 'Email verified successfully',
    type: otpData.type
  };
}

/**
 * Send an OTP email to the user
 * @param {string} email - Recipient email
 * @param {string} otp - OTP to send
 * @param {string} type - Email type (signup, signin, reset)
 * @returns {Promise<Object>} Result with success status and message
 */
async function sendOTPEmail(email, otp, type = 'signup') {
  try {
    console.log(`Attempting to send OTP email to ${email} (type: ${type})`);
    
    if (!email) {
      console.error('Missing required parameter: email');
      return {
        success: false,
        message: 'Email is required'
      };
    }
    
    if (!otp) {
      console.error('Missing OTP parameter, this should be generated by the backend');
      return {
        success: false,
        message: 'OTP generation failed'
      };
    }
    
    if (!transporter) {
      console.log('Email transporter not initialized, initializing now...');
      await initializeTransporter();
      if (!transporter) {
        throw new Error('Failed to initialize email transporter');
      }
    }
    
    const normalizedEmail = email.toLowerCase();
    
    // Store OTP for verification
    await storeOTP(normalizedEmail, otp, type);
    
    // Create email content based on type
    let subject, text, html;
    
    if (type === 'signup') {
      subject = 'Welcome to MeetingScribe - Confirm Your Email';
      text = `Welcome to MeetingScribe!\n\nYour verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #0d6efd;">Welcome to MeetingScribe</h2>
          <p>Thank you for signing up! Please use the code below to verify your email address:</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <h1 style="font-size: 32px; margin: 0; color: #0d6efd;">${otp}</h1>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="font-size: 12px; color: #6c757d; text-align: center;">© ${new Date().getFullYear()} MeetingScribe. All rights reserved.</p>
        </div>
      `;
    } else if (type === 'signin') {
      subject = 'MeetingScribe - Sign In Verification Code';
      text = `Hello!\n\nYour sign in verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #0d6efd;">MeetingScribe Sign In</h2>
          <p>Please use the code below to sign in to your account:</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <h1 style="font-size: 32px; margin: 0; color: #0d6efd;">${otp}</h1>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="font-size: 12px; color: #6c757d; text-align: center;">© ${new Date().getFullYear()} MeetingScribe. All rights reserved.</p>
        </div>
      `;
    } else {
      subject = 'MeetingScribe - Password Reset Code';
      text = `Hello!\n\nYour password reset code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #0d6efd;">MeetingScribe Password Reset</h2>
          <p>Please use the code below to reset your password:</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <h1 style="font-size: 32px; margin: 0; color: #0d6efd;">${otp}</h1>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="font-size: 12px; color: #6c757d; text-align: center;">© ${new Date().getFullYear()} MeetingScribe. All rights reserved.</p>
        </div>
      `;
    }
    
    // In development mode, just log the OTP and return success
    if (process.env.NODE_ENV === 'development') {
      console.log('==========================================================');
      console.log(`DEVELOPMENT MODE: OTP for ${normalizedEmail} is ${otp}`);
      console.log('==========================================================');
      
      // Return success as if email was sent
      return {
        success: true,
        message: 'Verification code sent (development mode - check server logs)',
        otp, // Only in development mode
        previewUrl: null
      };
    }
    
    // Send email
    const mailOptions = {
      from: process.env.SMTP_FROM || transportConfig.auth.user,
      to: normalizedEmail,
      subject: subject,
      text: text,
      html: html
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`Email sent to ${normalizedEmail}: ${info.messageId}`);
    
    // If using Ethereal, provide preview URL
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`Preview URL: ${previewUrl}`);
    }
    
    return {
      success: true,
      message: 'Verification code sent',
      previewUrl
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      message: `Failed to send verification code: ${error.message}`
    };
  }
}

// Export the OTP store for testing purposes
function getOTPStore() {
  return otpStore;
}

module.exports = {
  initializeTransporter,
  generateOTP,
  storeOTP,
  verifyOTP,
  sendOTPEmail,
  getOTPStore
}; 