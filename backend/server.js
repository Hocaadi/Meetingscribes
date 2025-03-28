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
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Create global emitter function to use throughout the application
global.emitProcessingUpdate = (sessionId, status, data = {}) => {
  if (!sessionId) {
    console.log('No sessionId provided for emitProcessingUpdate, skipping');
    return false;
  }
  
  try {
    io.to(sessionId).emit('processing_update', { status, ...data, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error in emitProcessingUpdate:', error);
    return false;
  }
};

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
    
    // Get session ID for WebSocket updates
    const sessionId = req.body.sessionId;
    
    // If we have a session ID, join that client to a room for updates
    if (sessionId) {
      const sockets = await io.fetchSockets();
      sockets.forEach(socket => {
        if (socket.handshake.query.sessionId === sessionId) {
          socket.join(sessionId);
        }
      });
    }
    
    // Process the audio file
    try {
      const result = await processAudio(req.file.path, userCustomInstructions, meetingTopic, sessionId);
      return res.status(200).json({ 
        message: 'File processed successfully',
        reportPath: result.reportPath,
        fileName: result.fileName,
        reportName: result.fileName,
        reportUrl: `/api/download/${result.fileName}`
      });
    } catch (processingError) {
      console.error('Detailed processing error:', processingError);
      // If we have a session ID, emit error to that client
      if (sessionId) {
        global.emitProcessingUpdate(sessionId, 'error', { message: processingError.message });
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
  
  console.log(`Download requested for file: ${fileName} (Path: ${filePath})`);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    console.error(`File not found: ${filePath}`);
    res.status(404).json({ error: 'File not found' });
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

// Chat API endpoint for transcript questions
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, transcript } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'No message provided' });
    }
    
    // Log the incoming chat request
    console.log(`Chat request from session ${sessionId}: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
    
    // Use OpenAI to generate a response about the transcript
    const openai = new (require('openai').OpenAI)({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Use a truncated version of the transcript if it's too long
    const maxTranscriptLength = 8000; // Characters
    let transcriptContent = transcript || '';
    if (transcriptContent.length > maxTranscriptLength) {
      transcriptContent = transcriptContent.substring(0, maxTranscriptLength) + '... [Transcript truncated due to length]';
    }
    
    const chatCompletion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that can answer questions about meeting transcripts. 
          The user has just had their meeting audio processed and now wants to discuss it.
          Base all your responses on the meeting transcript information.
          Be concise, helpful, and focus only on information that exists in the transcript.
          If asked about something that isn't in the transcript, politely explain that you can only discuss content from this specific meeting.`
        },
        {
          role: 'user',
          content: `This is my meeting transcript: \n\n${transcriptContent}\n\nNow I want to ask you about it: ${message}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    const response = chatCompletion.choices[0].message.content;
    console.log(`Generated chat response for session ${sessionId}`);
    
    return res.status(200).json({ response });
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    return res.status(500).json({ error: 'Error generating response', details: error.message });
  }
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