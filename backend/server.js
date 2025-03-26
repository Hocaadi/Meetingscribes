const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { processAudio } = require('./audioProcessor');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Configure Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? [
          process.env.FRONTEND_URL || 'https://meetingscribe.vercel.app',
          'https://meetingscribe--zeta.vercel.app',
          'https://meetingscribe-zeta.vercel.app'
        ]
      : ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 5e6, // 5MB
  transports: ['websocket', 'polling']
});

// Track active sessions and their sockets
const activeSessions = new Map();
// Message queue for disconnected clients
const messageQueues = new Map();

// Socket.io connection handling
io.on('connection', (socket) => {
  const sessionId = socket.handshake.query.sessionId;
  console.log(`Client connected: ${socket.id} with session: ${sessionId}`);
  
  // Store session to socket mapping
  if (sessionId) {
    // Add to active sessions
    if (!activeSessions.has(sessionId)) {
      activeSessions.set(sessionId, new Set());
    }
    activeSessions.get(sessionId).add(socket.id);
    
    // Join the room for this session
    socket.join(sessionId);
    
    // If we have queued messages, send them now
    if (messageQueues.has(sessionId)) {
      console.log(`Delivering queued messages for reconnected session ${sessionId}`);
      const queuedMessages = messageQueues.get(sessionId);
      
      queuedMessages.forEach(message => {
        socket.emit('processing_update', message);
      });
      
      // Clear the queue
      messageQueues.delete(sessionId);
    }
  }
  
  // Handle ping requests from client
  socket.on('ping', (data) => {
    socket.emit('pong', { 
      serverTime: new Date().toISOString(),
      clientTime: data.timestamp 
    });
  });
  
  socket.on('disconnect', (reason) => {
    console.log(`Client disconnected: ${socket.id} from session: ${sessionId}, reason: ${reason}`);
    
    // Clean up session tracking
    if (sessionId && activeSessions.has(sessionId)) {
      const socketSet = activeSessions.get(sessionId);
      socketSet.delete(socket.id);
      
      // If no more sockets for this session, don't remove it yet
      // We'll keep the session ID in case the client reconnects
      if (socketSet.size === 0) {
        console.log(`All sockets for session ${sessionId} disconnected`);
      }
    }
  });
});

// Enhanced global emitter function with retry logic and queuing
global.emitProcessingUpdate = (sessionId, status, data = {}) => {
  if (!sessionId) {
    console.log('No sessionId provided for emitProcessingUpdate, skipping');
    return false;
  }
  
  try {
    // Check if the session room exists and has connections
    const room = io.sockets.adapter.rooms.get(sessionId);
    const hasConnections = room && room.size > 0;
    
    console.log(`Emitting to session ${sessionId}, has connections: ${hasConnections}`);
    
    // Create message with timestamp
    const message = { 
      status, 
      ...data, 
      timestamp: new Date().toISOString() 
    };
    
    if (hasConnections) {
      // Emit to the room
      io.to(sessionId).emit('processing_update', message);
      return true;
    } else {
      // If no active connections for this session, store message for later delivery
      console.log(`No active connections for session ${sessionId}, storing update for later delivery`);
      storeMessageForLaterDelivery(sessionId, message);
      return false;
    }
  } catch (error) {
    console.error(`Error emitting update to session ${sessionId}:`, error);
    return false;
  }
};

// Store messages for later delivery when client reconnects
function storeMessageForLaterDelivery(sessionId, message) {
  if (!messageQueues.has(sessionId)) {
    messageQueues.set(sessionId, []);
  }
  messageQueues.get(sessionId).push({
    ...message,
    queuedAt: new Date().toISOString()
  });
  
  // Limit queue size
  const queue = messageQueues.get(sessionId);
  if (queue.length > 100) {
    queue.shift(); // Remove oldest messages if queue gets too large
  }
}

// Clean up old message queues every 30 minutes
setInterval(() => {
  const now = new Date();
  for (const [sessionId, messages] of messageQueues.entries()) {
    if (messages.length > 0) {
      const oldestMessage = messages[0];
      const queuedAt = new Date(oldestMessage.queuedAt);
      
      // If oldest message is more than 2 hours old, clean up the queue
      if ((now - queuedAt) > (2 * 60 * 60 * 1000)) {
        console.log(`Cleaning up stale message queue for session ${sessionId}`);
        messageQueues.delete(sessionId);
      }
    }
  }
}, 30 * 60 * 1000); // 30 minutes

// Configure CORS for production/development environments
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [
      process.env.FRONTEND_URL || 'https://meetingscribe.vercel.app',
      'https://meetingscribe--zeta.vercel.app',
      'https://meetingscribe-zeta.vercel.app'
    ]  // Update with your actual frontend URL when deployed
  : ['http://localhost:3000'];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // For development/testing - log attempted origins
    console.log('Request from origin:', origin);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      // Instead of blocking, let's allow all origins in production for now
      if (process.env.NODE_ENV === 'production') {
        return callback(null, true);
      }
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Parse JSON bodies
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50000000 } // 50MB default
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// API routes
app.post('/api/upload', upload.single('audioFile'), async (req, res) => {
  try {
    if (!req.file) {
      console.error('Error: No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`Processing audio file: ${req.file.originalname}`);
    console.log(`File path: ${req.file.path}`);
    console.log(`File size: ${req.file.size} bytes`);
    
    // Get custom instructions from request body if available
    const userCustomInstructions = req.body.customInstructions || '';
    if (userCustomInstructions) {
      console.log('Custom instructions received from user');
    }
    
    // Get meeting topic from request body if available
    const meetingTopic = req.body.meetingTopic || '';
    if (meetingTopic) {
      console.log(`Meeting topic selected: ${meetingTopic}`);
    }
    
    // Get output format preference (docx or pdf)
    const format = req.body.format || 'docx';
    console.log(`Output format selected: ${format}`);
    
    // Get session ID for WebSocket updates
    const sessionId = req.body.sessionId;
    console.log(`Session ID for WebSocket updates: ${sessionId || 'none provided'}`);
    
    // If we have a session ID, ensure all sockets with this ID are in the right room
    if (sessionId) {
      try {
        // First, check all connected sockets
        const sockets = await io.fetchSockets();
        let joinedSocketCount = 0;
        
        sockets.forEach(socket => {
          // Check both socket ID and handshake query
          if (socket.handshake.query.sessionId === sessionId) {
            socket.join(sessionId);
            joinedSocketCount++;
          }
        });
        
        console.log(`Found ${joinedSocketCount} socket(s) for session ${sessionId} and added them to room`);
        
        // Send a notification to all sockets in this session
        global.emitProcessingUpdate(sessionId, 'started', { 
          message: 'Starting audio processing',
          fileSize: req.file.size,
          fileName: req.file.originalname
        });
      } catch (socketError) {
        console.error('Error managing socket rooms:', socketError);
        // Continue processing even if socket management fails
      }
    }
    
    // Process the audio file
    try {
      const result = await processAudio(req.file.path, userCustomInstructions, meetingTopic, sessionId, format);
      
      // Determine which file to return as primary based on format
      const isPdf = format === 'pdf';
      const fileName = isPdf ? result.pdfFileName : result.reportFileName;
      const filePath = isPdf ? result.pdfPath : result.reportPath;
      
      // Make sure both PDF and DOCX are available in the response
      const docxUrl = `/api/download/${result.docxFileName}`;
      
      // For PDF, only include URL if PDF was actually created
      let pdfUrl = null;
      if (result.pdfPath && result.pdfFileName) {
        pdfUrl = `/api/download/${result.pdfFileName}`;
      }
      
      // Include error message if PDF generation failed
      const pdfError = result.pdfError || null;
      
      // Improve logging for debugging
      console.log('Processing complete, returning result:', {
        format,
        fileName,
        docxFileName: result.docxFileName,
        pdfFileName: result.pdfFileName,
        pdfSuccess: !!pdfUrl,
        pdfError,
        sessionId
      });
      
      // Send final success update via WebSocket
      if (sessionId) {
        global.emitProcessingUpdate(sessionId, 'completed', {
          message: 'Processing completed successfully',
          reportPath: filePath,
          fileName: fileName,
          reportFileName: result.reportFileName,
          docxFileName: result.docxFileName,
          docxUrl: docxUrl,
          pdfFileName: result.pdfFileName,
          pdfUrl: pdfUrl,
          pdfError: pdfError,
          format: isPdf && pdfUrl ? 'pdf' : 'docx',
          percentComplete: 100
        });
      }
      
      return res.status(200).json({ 
        message: 'File processed successfully',
        reportPath: filePath,
        fileName: fileName,
        reportName: fileName,
        reportUrl: `/api/download/${fileName}`,
        format: isPdf && pdfUrl ? 'pdf' : 'docx',
        // Include both formats if available for client-side options
        docxFileName: result.docxFileName,
        docxUrl: docxUrl,
        pdfFileName: result.pdfFileName,
        pdfUrl: pdfUrl,
        pdfError: pdfError
      });
    } catch (processingError) {
      console.error('Detailed processing error:', processingError);
      // If we have a session ID, emit error to that client
      if (sessionId) {
        global.emitProcessingUpdate(sessionId, 'error', { 
          message: processingError.message,
          details: process.env.NODE_ENV === 'development' ? processingError.stack : undefined
        });
      }
      
      // If there's an error in processing, still return a 500 but with more details
      return res.status(500).json({ 
        error: 'Error processing file', 
        details: processingError.message,
        stack: process.env.NODE_ENV === 'development' ? processingError.stack : undefined
      });
    }
  } catch (error) {
    console.error('Unhandled error in upload endpoint:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Route to download the processed document
app.get(['/api/download/:fileName', '/download/:fileName'], (req, res) => {
  const fileName = req.params.fileName;
  const filePath = path.join(__dirname, 'uploads', fileName);
  
  console.log(`Download requested for file: ${fileName}`);
  console.log(`Looking for file at path: ${filePath}`);
  
  // List available files in uploads directory to debug
  try {
    const uploadDir = path.join(__dirname, 'uploads');
    if (fs.existsSync(uploadDir)) {
      console.log('Available files in uploads directory:');
      const files = fs.readdirSync(uploadDir);
      files.forEach(file => {
        console.log(`- ${file} (${fs.statSync(path.join(uploadDir, file)).size} bytes)`);
      });
    } else {
      console.log('Uploads directory does not exist!');
    }
  } catch (dirError) {
    console.error('Error reading uploads directory:', dirError);
  }
  
  // Check if the file exists
  if (fs.existsSync(filePath)) {
    console.log(`File found, sending: ${filePath}`);
    
    // Get file extension and set appropriate Content-Type
    const ext = path.extname(fileName).toLowerCase();
    if (ext === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
    } else if (ext === '.docx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }
    
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Stream the file instead of using res.download for larger files
    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (error) => {
      console.error(`Error streaming file: ${error.message}`);
      res.status(500).json({ error: 'Error streaming file', details: error.message });
    });
    
    fileStream.pipe(res);
  } else {
    console.error(`File not found: ${filePath}`);
    res.status(404).json({ 
      error: 'File not found',
      requestedFile: fileName,
      path: filePath
    });
  }
});

// Serve the test upload page
app.get('/test-upload', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-upload.html'));
});

// Health check endpoint for monitoring
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'MeetingScribe API is running' });
});

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

// Start the server with socket.io
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 