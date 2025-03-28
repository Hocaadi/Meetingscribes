const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { processAudio } = require('./audioProcessor');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const axios = require('axios');

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

// Add new endpoint to handle document questions
app.post('/api/ask-question', async (req, res) => {
  try {
    const { question, documentName, format = 'docx' } = req.body;
    
    if (!question || !documentName) {
      return res.status(400).json({ 
        error: 'Missing required parameters', 
        details: 'Both question and documentName are required'
      });
    }
    
    console.log(`Processing question about document: ${documentName}`);
    console.log(`Question: ${question}`);
    
    // Get the document path
    const filePath = path.join(__dirname, 'uploads', documentName);
    
    if (!fs.existsSync(filePath)) {
      console.error(`Document not found: ${filePath}`);
      return res.status(404).json({ 
        error: 'Document not found',
        details: `The requested document ${documentName} could not be found`
      });
    }
    
    // Extract text content from the document based on format
    let documentContent = '';
    
    try {
      if (format.toLowerCase() === 'pdf') {
        const pdfBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(pdfBuffer);
        documentContent = pdfData.text;
      } else {
        // Default to DOCX
        const result = await mammoth.extractRawText({ path: filePath });
        documentContent = result.value;
      }
      
      // Trim and clean up document content
      documentContent = documentContent.trim();
      console.log(`Successfully extracted ${documentContent.length} characters from document`);
      
      if (!documentContent) {
        throw new Error('Extracted document content is empty');
      }
    } catch (extractError) {
      console.error('Error extracting document content:', extractError);
      return res.status(500).json({ 
        error: 'Failed to extract document content', 
        details: extractError.message 
      });
    }
    
    // Create a context window from the document (limit size if needed)
    const maxContentLength = 15000; // Adjust based on LLM token limits
    let contextContent = documentContent;
    
    if (documentContent.length > maxContentLength) {
      // Simplistic approach - using the first part of the document as context
      // In a more advanced implementation, you would use semantic search or chunking
      contextContent = documentContent.substring(0, maxContentLength) + 
        "\n[Note: The document is larger than what can be processed at once. This is just the beginning part.]";
    }
    
    // Call an LLM API to answer the question based on the document
    try {
      let answer;
      
      // Option 1: Using OpenAI API
      if (process.env.OPENAI_API_KEY) {
        const openaiResponse = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-3.5-turbo', // or gpt-4 for better results
            messages: [
              {
                role: 'system',
                content: 'You are a helpful assistant that answers questions based on document content. ' +
                         'Only answer based on the information in the document. ' +
                         'If the document does not contain information to answer the question, ' +
                         'say "I don\'t see information about that in the document."'
              },
              {
                role: 'user',
                content: `Document content:\n\n${contextContent}\n\nQuestion: ${question}`
              }
            ],
            temperature: 0.3,
            max_tokens: 1000
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        answer = openaiResponse.data.choices[0].message.content;
      } 
      // Option 2: Using a simpler, fallback approach when no API key is available
      else {
        // Without an API key, we'll use a simple keyword based approach
        console.warn('No LLM API key found. Using fallback answer generation.');
        
        // Find paragraphs containing keywords from the question
        const questionWords = question.toLowerCase().split(/\W+/).filter(word => 
          word.length > 3 && !['what', 'when', 'where', 'which', 'about', 'does', 'this'].includes(word)
        );
        
        const paragraphs = contextContent.split('\n\n');
        let relevantParagraphs = [];
        
        for (const paragraph of paragraphs) {
          const paraLower = paragraph.toLowerCase();
          if (questionWords.some(word => paraLower.includes(word))) {
            relevantParagraphs.push(paragraph);
          }
          
          // Limit to 3 paragraphs maximum
          if (relevantParagraphs.length >= 3) break;
        }
        
        if (relevantParagraphs.length > 0) {
          answer = "Based on the document, here's what I found:\n\n" + 
                   relevantParagraphs.join('\n\n') + 
                   "\n\nNote: This is a simple excerpt from the document. For more accurate answers, configure an LLM API key.";
        } else {
          answer = "I couldn't find information related to your question in the document. Please try a different question or check if your document contains relevant information.";
        }
      }
      
      console.log('Generated answer for the question');
      return res.status(200).json({ answer });
      
    } catch (llmError) {
      console.error('Error calling LLM API:', llmError);
      return res.status(500).json({ 
        error: 'Failed to process question with LLM',
        details: llmError.message
      });
    }
  } catch (error) {
    console.error('Unhandled error in question answering endpoint:', error);
    return res.status(500).json({ 
      error: 'Server error processing question', 
      details: error.message
    });
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