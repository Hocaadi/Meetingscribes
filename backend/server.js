const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { processAudio } = require('./audioProcessor');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

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
    
    // Process the audio file
    try {
      const result = await processAudio(req.file.path, userCustomInstructions, meetingTopic);
      return res.status(200).json({ 
        message: 'File processed successfully',
        reportPath: result.reportPath,
        fileName: result.fileName
      });
    } catch (processingError) {
      console.error('Detailed processing error:', processingError);
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
app.get('/api/download/:fileName', (req, res) => {
  const fileName = req.params.fileName;
  const filePath = path.join(__dirname, 'uploads', fileName);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
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

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 