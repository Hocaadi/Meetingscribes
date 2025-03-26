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
  io.to(sessionId).emit('processing_update', { status, ...data, timestamp: new Date().toISOString() });
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
    
    // Get output format preference (docx or pdf)
    const format = req.body.format || 'docx';
    console.log(`Output format selected: ${format}`);
    
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
        pdfError
      });
      
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