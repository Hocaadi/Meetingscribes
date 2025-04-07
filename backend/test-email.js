/**
 * Test email functionality
 * Run with: node test-email.js
 */

const dotenv = require('dotenv');
const emailService = require('./emailService');

// Load environment variables
dotenv.config();

// Test email address - change this to your own test email
const TEST_EMAIL = 'test@example.com';

// Test different OTP types (signup, signin, reset)
const TEST_TYPE = 'signup';

async function testEmailService() {
  console.log('==========================================================');
  console.log('Email Service Test');
  console.log('==========================================================');
  
  // Initialize email transporter
  console.log('1. Testing email transporter initialization...');
  const initResult = await emailService.initializeTransporter();
  
  // Check transporter status
  if (!initResult) {
    console.error('❌ Email transporter initialization failed');
    console.log('\nConfiguration used:');
    console.log(`- SMTP_HOST: ${process.env.SMTP_HOST || 'Not set (will use Ethereal)'}`);
    console.log(`- SMTP_PORT: ${process.env.SMTP_PORT || 'Not set (will use Ethereal)'}`);
    console.log(`- SMTP_USER: ${process.env.SMTP_USER ? '****** (set)' : 'Not set (will use Ethereal)'}`);
    console.log(`- SMTP_SECURE: ${process.env.SMTP_SECURE || 'Not set (defaulting to false)'}`);
    console.log('\nEthereal test account will be used as a fallback');
  } else {
    console.log('✅ Email transporter initialized successfully');
  }
  
  // Generate OTP
  console.log('\n2. Generating OTP...');
  const otp = emailService.generateOTP();
  console.log(`✅ Generated OTP: ${otp}`);
  
  // Send test email
  console.log(`\n3. Sending test ${TEST_TYPE} email to ${TEST_EMAIL}...`);
  const result = await emailService.sendOTPEmail(TEST_EMAIL, otp, TEST_TYPE);
  
  if (result.success) {
    console.log('✅ Email sent successfully!');
    
    if (result.previewUrl) {
      console.log(`\n🔗 Preview URL: ${result.previewUrl}`);
      console.log('(This is an Ethereal test email - check the link to view it)');
    } else {
      console.log(`\nCheck ${TEST_EMAIL} inbox for the email`);
    }
  } else {
    console.error(`❌ Email send failed: ${result.message}`);
  }
  
  // Try verifying OTP
  console.log('\n4. Testing OTP verification...');
  const verifyResult = await emailService.verifyOTP(TEST_EMAIL, otp);
  
  if (verifyResult.success) {
    console.log('✅ OTP verified successfully!');
  } else {
    console.error(`❌ OTP verification failed: ${verifyResult.message}`);
  }
  
  console.log('\n==========================================================');
  console.log('Email Testing Completed');
  console.log('==========================================================');
  
  // Provide guidance based on results
  if (!result.success) {
    console.log('\n⚠️ To fix email sending issues:');
    console.log('1. Check your SMTP settings in .env file');
    console.log('2. If using Gmail, ensure you created an App Password');
    console.log('3. For testing, you can leave SMTP settings empty to use Ethereal');
  }
}

// Run the test
testEmailService().catch(error => {
  console.error('Test failed with error:', error);
}); 