/**
 * Test script for Work Progress AI Endpoints
 * Run with: node test-ai-routes.js
 */

const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configuration
const API_BASE_URL = 'http://localhost:5000'; // Update if testing against production
const TEST_USER_ID = '00000000-0000-0000-0000-000000000000'; // Test user ID

/**
 * Test all AI endpoints
 */
async function testAllEndpoints() {
  console.log('=== TESTING WORK PROGRESS AI ENDPOINTS ===');
  console.log(`Base URL: ${API_BASE_URL}`);
  console.log('');
  
  // Create axios instance with authentication headers to simulate an authenticated user
  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer test_token`, // This won't work for real auth but helps with route testing
      'x-user-id': TEST_USER_ID,
    }
  });
  
  try {
    // Test 1: Test the /api/work-progress/ai/ask endpoint
    console.log('TEST 1: Testing /api/work-progress/ai/ask endpoint');
    try {
      const askResponse = await api.post('/api/work-progress/ai/ask', {
        query: 'What tasks did I work on yesterday?',
        date_range: {
          start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days ago
          end_date: new Date().toISOString().split('T')[0], // Today
        }
      });
      
      console.log('✅ /api/work-progress/ai/ask endpoint is functioning');
      console.log('Response status:', askResponse.status);
    } catch (error) {
      console.error('❌ /api/work-progress/ai/ask endpoint failed:');
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
      console.error('Message:', error.message);
    }
    console.log('');
    
    // Test 2: Test the /api/work-progress/ai/answer-from-context endpoint
    console.log('TEST 2: Testing /api/work-progress/ai/answer-from-context endpoint');
    try {
      const contextResponse = await api.post('/api/work-progress/ai/answer-from-context', {
        query: 'What tasks did I work on yesterday?',
        daily_info: [
          { 
            date: new Date().toISOString().split('T')[0],
            summary: 'Worked on documentation and fixed bugs in the MeetingScribe application.' 
          }
        ],
        date_range: {
          start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days ago
          end_date: new Date().toISOString().split('T')[0], // Today
        }
      });
      
      console.log('✅ /api/work-progress/ai/answer-from-context endpoint is functioning');
      console.log('Response status:', contextResponse.status);
    } catch (error) {
      console.error('❌ /api/work-progress/ai/answer-from-context endpoint failed:');
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
      console.error('Message:', error.message);
    }
    console.log('');
    
    // Test 3: Test the /api/work-progress/ai/generate-report endpoint
    console.log('TEST 3: Testing /api/work-progress/ai/generate-report endpoint');
    try {
      const reportResponse = await api.post('/api/work-progress/ai/generate-report', {
        report_type: 'daily',
        tasks: [
          {
            title: 'Fix WorkProgress module',
            description: 'Fix issues with the work progress module in MeetingScribe',
            status: 'in_progress',
            priority: 1
          }
        ],
        accomplishments: [],
        date_range: {
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
        }
      });
      
      console.log('✅ /api/work-progress/ai/generate-report endpoint is functioning');
      console.log('Response status:', reportResponse.status);
    } catch (error) {
      console.error('❌ /api/work-progress/ai/generate-report endpoint failed:');
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
      console.error('Message:', error.message);
    }
    console.log('');
    
    console.log('=== TESTING COMPLETE ===');
  } catch (error) {
    console.error('ERROR during testing:', error.message);
  }
}

// Run the tests
testAllEndpoints().catch(console.error); 