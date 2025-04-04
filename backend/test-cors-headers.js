/**
 * CORS Headers Test Script
 * 
 * This script simulates an HTTP request with a specific origin
 * to check if our CORS configuration is correct
 */

const http = require('http');
const { allowedOrigins, corsOptions } = require('./cors-config');

// Test origins (one allowed, one not allowed)
const testOrigins = [
  'https://meetingscribe--zeta.vercel.app', // Should be allowed
  'https://random-site.com', // Should be blocked
  null // No origin (like same-origin requests)
];

// Function to test if our CORS function works correctly
function testCorsFunction() {
  console.log('\n--- Testing CORS Origin Function ---');
  
  testOrigins.forEach(origin => {
    if (typeof corsOptions.origin === 'function') {
      corsOptions.origin(origin, (err, allowed) => {
        if (err) {
          console.log(`✘ Origin: ${origin || 'null'} - REJECTED`);
        } else {
          console.log(`✓ Origin: ${origin || 'null'} - ALLOWED (${allowed === true ? 'any origin' : allowed})`);
        }
      });
    } else {
      console.log('CORS origin is not a function!');
    }
  });
}

// Function to simulate HTTP requests with specific origins
function simulateHttpRequest() {
  console.log('\n--- Simulating HTTP Requests with Different Origins ---');
  
  const simulateResponse = () => {
    const headers = {};
    let statusCode = 200;
    
    return {
      header: (name, value) => {
        headers[name] = value;
        return this;
      },
      status: (code) => {
        statusCode = code;
        return this;
      },
      end: () => {
        console.log(`Response status: ${statusCode}`);
        console.log('Response headers:', headers);
      },
      headers,
      vary: (field) => {
        headers['Vary'] = field;
        return this;
      }
    };
  };
  
  testOrigins.forEach(origin => {
    console.log(`\nSimulating request from: ${origin || 'Same-origin (no origin header)'}`);
    
    const req = { 
      headers: origin ? { origin } : {},
      method: 'GET'
    };
    
    const res = simulateResponse();
    
    // Create a simple next function
    const next = () => {
      console.log('next() called - moving to next middleware');
    };
    
    // Test our CORS middleware
    if (typeof corsOptions.origin === 'function') {
      corsOptions.origin(origin, (err, allowed) => {
        if (err) {
          console.log('CORS rejected the request');
          next();
        } else {
          res.header('Access-Control-Allow-Origin', allowed === true ? origin : allowed);
          res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.header('Access-Control-Allow-Credentials', 'true');
          
          console.log('Response headers that would be sent:');
          console.log(res.headers);
          next();
        }
      });
    }
  });
}

// Main function to run all tests
function runTests() {
  console.log('CORS Configuration Test');
  console.log('======================');
  
  console.log('\nAllowed Origins:', allowedOrigins);
  
  // Test CORS function
  testCorsFunction();
  
  // Simulate HTTP requests
  simulateHttpRequest();
  
  console.log('\n======================');
  console.log('CORS Tests Complete');
}

// Run the tests
runTests(); 