/**
 * CORS Configuration Test Script
 * 
 * This script tests the server's CORS configuration by making various requests
 * and displaying the results.
 */

const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

// Helper function to log results in a consistent format
const logResult = (testName, origin, success, details) => {
  console.log('\n-----------------------------------');
  console.log(`Test: ${testName}`);
  console.log(`Origin: ${origin}`);
  console.log(`Result: ${success ? '✅ PASSED' : '❌ FAILED'}`);
  if (details) {
    console.log('Details:', details);
  }
  console.log('-----------------------------------\n');
};

// Run all CORS tests
const runCorsTests = async () => {
  const API_URL = process.env.BACKEND_URL || 'http://localhost:5000';
  console.log(`Testing CORS configuration for: ${API_URL}`);
  
  // Test origins
  const origins = [
    'https://meetingscribe--zeta.vercel.app',
    'https://meetingscribe.vercel.app', 
    'http://localhost:3000',
    'https://example.com' // Should be blocked
  ];
  
  // Test endpoints
  const endpoints = [
    '/api/health',
    '/socket.io/?EIO=4&transport=polling',
    '/api/upload/chunk'
  ];
  
  // Test each origin + endpoint combination
  for (const origin of origins) {
    for (const endpoint of endpoints) {
      const testName = `${endpoint} from ${origin}`;
      
      try {
        // Make a preflight OPTIONS request first
        const optionsResponse = await axios({
          method: 'OPTIONS',
          url: `${API_URL}${endpoint}`,
          headers: {
            'Origin': origin,
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'Content-Type,x-user-id'
          }
        });
        
        // Check for CORS headers in the response
        const corsHeaders = optionsResponse.headers;
        const allowOrigin = corsHeaders['access-control-allow-origin'];
        const allowMethods = corsHeaders['access-control-allow-methods'];
        const allowHeaders = corsHeaders['access-control-allow-headers'];
        
        if (allowOrigin && (allowOrigin === '*' || allowOrigin === origin)) {
          logResult(testName + ' (OPTIONS)', origin, true, {
            'Access-Control-Allow-Origin': allowOrigin,
            'Access-Control-Allow-Methods': allowMethods,
            'Access-Control-Allow-Headers': allowHeaders
          });
          
          // Now try an actual GET request
          const getResponse = await axios({
            method: 'GET',
            url: `${API_URL}${endpoint}`,
            headers: {
              'Origin': origin
            }
          });
          
          logResult(testName + ' (GET)', origin, true, {
            'Status': getResponse.status,
            'Access-Control-Allow-Origin': getResponse.headers['access-control-allow-origin']
          });
        } else {
          // CORS headers not correctly set
          logResult(testName + ' (OPTIONS)', origin, false, {
            'Access-Control-Allow-Origin': allowOrigin || 'not set',
            'Access-Control-Allow-Methods': allowMethods || 'not set',
            'Access-Control-Allow-Headers': allowHeaders || 'not set'
          });
        }
      } catch (error) {
        // Check if it's the expected rejection for example.com
        if (origin === 'https://example.com' && 
            error.message.includes('Not allowed by CORS')) {
          logResult(testName, origin, true, {
            message: 'Correctly rejected unauthorized origin'
          });
        } else {
          logResult(testName, origin, false, {
            error: error.message,
            response: error.response?.data
          });
        }
      }
    }
  }
};

// Run tests
console.log('Starting CORS configuration tests...');
runCorsTests()
  .then(() => {
    console.log('\nCORS testing complete.');
  })
  .catch(error => {
    console.error('Error running CORS tests:', error);
  }); 