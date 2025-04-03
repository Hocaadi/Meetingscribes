/**
 * Simple CORS and Socket.io testing utility
 * Run this script to check for CORS configuration issues.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const PORT = 5001; // Different port to not conflict with main server

// Set up Socket.io with proper CORS for use with credentials
const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      // Important: when withCredentials is true, the origin must be specified
      // and cannot be '*'
      if (!origin) return callback(null, true); // Allow calls with no origin
      
      // Allow any meetingscribe domain or localhost
      if (origin.includes('meetingscribe') || origin === 'http://localhost:3000') {
        callback(null, origin); // Important: echo back the requesting origin
      } else {
        console.log(`Rejected connection from origin: ${origin}`);
        callback(null, false);
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id']
  },
  transports: ['polling', 'websocket']
});

// Store the latest test results
let testResults = {
  connections: [],
  origins: {},
  status: 'No tests yet'
};

// Handle Socket.io connections
io.on('connection', (socket) => {
  const socketId = socket.id;
  const origin = socket.handshake.headers.origin || 'Unknown';
  const transport = socket.conn.transport.name;
  
  console.log(`New connection from ${origin} [${socketId}] using ${transport}`);
  
  // Store connection details
  const connectionInfo = {
    id: socketId,
    origin: origin,
    transport: transport,
    time: new Date().toISOString(),
    headers: socket.handshake.headers
  };
  
  testResults.connections.push(connectionInfo);
  
  // Track origins
  if (!testResults.origins[origin]) {
    testResults.origins[origin] = 0;
  }
  testResults.origins[origin]++;
  
  testResults.status = 'Connected';
  
  // Echo test
  socket.on('test', (data) => {
    console.log(`Received test message from ${socketId}:`, data);
    socket.emit('test-response', {
      received: data,
      time: new Date().toISOString(),
      server: 'CORS Test Server'
    });
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socketId}`);
    testResults.status = 'Disconnected';
  });
});

// Apply CORS middleware with specific origins
app.use(cors({
  origin: function(origin, callback) {
    // For API endpoints
    if (!origin) return callback(null, true);
    
    if (origin.includes('meetingscribe') || origin === 'http://localhost:3000') {
      callback(null, origin);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id']
}));

// Test endpoint for basic CORS
app.get('/api/ping', (req, res) => {
  const origin = req.headers.origin || 'Unknown';
  console.log(`Received ping from ${origin}`);
  
  // Send CORS headers explicitly
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  res.json({
    status: 'ok',
    message: 'CORS test server is working',
    origin: origin,
    time: new Date().toISOString()
  });
});

// Endpoint to view test results
app.get('/api/test-results', (req, res) => {
  res.json(testResults);
});

// Simple HTML test page
app.get('/', (req, res) => {
  const testPage = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Socket.io CORS Test</title>
      <style>
        body { font-family: Arial; margin: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .result { border: 1px solid #ddd; padding: 10px; margin: 10px 0; }
        .success { background-color: #d4edda; }
        .error { background-color: #f8d7da; }
        button { padding: 5px 10px; margin: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Socket.io CORS Testing</h1>
        <p>This page helps test Socket.io connections with CORS.</p>
        
        <div>
          <button id="testBtn">Test Connection</button>
          <button id="getResultsBtn">Get Results</button>
          <button id="testHttpBtn">Test HTTP Endpoint</button>
        </div>
        
        <div id="status" class="result">Status: Not connected</div>
        <div id="output"></div>
      </div>
      
      <script src="/socket.io/socket.io.js"></script>
      <script>
        const statusDiv = document.getElementById('status');
        const outputDiv = document.getElementById('output');
        const testBtn = document.getElementById('testBtn');
        const getResultsBtn = document.getElementById('getResultsBtn');
        const testHttpBtn = document.getElementById('testHttpBtn');
        
        // Try to connect to Socket.io
        let socket;
        try {
          socket = io({
            withCredentials: true,
            transports: ['polling', 'websocket']
          });
          
          socket.on('connect', () => {
            statusDiv.textContent = 'Status: Connected!';
            statusDiv.className = 'result success';
            addOutput('Connected to server with ID: ' + socket.id);
          });
          
          socket.on('connect_error', (err) => {
            statusDiv.textContent = 'Status: Connection Error! ' + err.message;
            statusDiv.className = 'result error';
            addOutput('Connection error: ' + err.message);
          });
          
          socket.on('test-response', (data) => {
            addOutput('Received response: ' + JSON.stringify(data));
          });
          
          socket.on('disconnect', () => {
            statusDiv.textContent = 'Status: Disconnected';
            statusDiv.className = 'result';
            addOutput('Disconnected from server');
          });
        } catch (err) {
          statusDiv.textContent = 'Status: Error! ' + err.message;
          statusDiv.className = 'result error';
          addOutput('Error creating socket: ' + err.message);
        }
        
        // Test button
        testBtn.addEventListener('click', () => {
          if (socket && socket.connected) {
            const testData = {
              message: 'Test message',
              time: new Date().toISOString()
            };
            socket.emit('test', testData);
            addOutput('Sent test message: ' + JSON.stringify(testData));
          } else {
            addOutput('Cannot send test: Not connected');
          }
        });
        
        // Get results button
        getResultsBtn.addEventListener('click', () => {
          fetch('/api/test-results', {
            credentials: 'include'
          })
          .then(response => response.json())
          .then(data => {
            addOutput('Server test results: ' + JSON.stringify(data, null, 2));
          })
          .catch(err => {
            addOutput('Error fetching results: ' + err.message);
          });
        });
        
        // Test HTTP endpoint button
        testHttpBtn.addEventListener('click', () => {
          fetch('/api/ping', {
            credentials: 'include'
          })
          .then(response => response.json())
          .then(data => {
            addOutput('HTTP endpoint response: ' + JSON.stringify(data));
          })
          .catch(err => {
            addOutput('Error with HTTP endpoint: ' + err.message);
          });
        });
        
        function addOutput(message) {
          const div = document.createElement('div');
          div.className = 'result';
          div.textContent = message;
          outputDiv.prepend(div);
        }
      </script>
    </body>
    </html>
  `;
  
  res.send(testPage);
});

// Start server
server.listen(PORT, () => {
  console.log(`CORS test server running on port ${PORT}`);
  console.log(`Access test page at http://localhost:${PORT}`);
}); 