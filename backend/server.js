const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { processAudio } = require('./audioProcessor');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const { OpenAI } = require('openai');
const supabaseUserService = require('./supabaseUserService');
const paymentRoutes = require('./paymentRoutes');
const { supabase } = require('./supabaseClient');
const imageProcessingRoutes = require('./routes/imageProcessing');
const meetingsRoutes = require('./routes/meetings');
const authRoutes = require('./routes/auth');
const workProgressRoutes = require('./routes/workProgressRoutes');
const { corsOptions } = require('./cors-config');
const setupSocketIO = require('./socket-config');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Log startup information
console.log('Starting MeetingScribe backend server...');

// Configure Socket.io using our abstracted config
const io = setupSocketIO(server);

// Apply CORS middleware globally - using centralized corsOptions
app.use(cors(corsOptions));

// Set longer timeouts for upload requests
app.use((req, res, next) => {
  if (req.path.includes('/api/upload')) {
    req.setTimeout(120000); // 2 minutes for upload requests
  }
  next();
});

// Special handling for Options requests to prevent preflight issues
app.options('*', cors(corsOptions));

// Explicit OPTIONS handler for upload endpoints
app.options('/api/upload/chunk', (req, res) => {
  const origin = req.headers.origin;
  
  // Always accept from approved origins
  if (!origin || origin.includes('meetingscribe') || origin === 'http://localhost:3000') {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-session-id');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    res.status(200).end();
  } else {
    console.log('Rejected preflight from:', origin);
    res.status(200).end(); // Still end with 200 to avoid browser warnings
  }
});

// Explicit OPTIONS handler for socket.io endpoints
app.options('/socket.io/*', (req, res) => {
  const origin = req.headers.origin;
  
  if (!origin || origin.includes('meetingscribe') || origin === 'http://localhost:3000') {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-session-id');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.status(200).end();
  } else {
    console.log('Rejected socket.io preflight from:', origin);
    res.status(200).end();
  }
});

// Parse JSON bodies
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Check if frontend/build exists, if not, create a simple index.html
const frontendBuildPath = path.join(__dirname, '../frontend/build');
const indexHtmlPath = path.join(frontendBuildPath, 'index.html');
if (!fs.existsSync(frontendBuildPath)) {
  console.log('Frontend build directory not found, creating it...');
  fs.mkdirSync(frontendBuildPath, { recursive: true });
}
if (!fs.existsSync(indexHtmlPath)) {
  console.log('Creating a simple index.html file for API server...');
  const simpleHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>MeetingScribe API Server</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .container { border: 1px solid #ddd; padding: 20px; border-radius: 5px; }
        h1 { color: #333; }
        p { line-height: 1.6; }
        .endpoint { background: #f5f5f5; padding: 10px; border-radius: 4px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>MeetingScribe API Server</h1>
        <p>The API server is running successfully. This is the backend for the MeetingScribe application.</p>
        <p>For frontend access, please use the deployed frontend URL.</p>
        <h2>API Health Status</h2>
        <div class="endpoint">GET /api/health</div>
        <p><a href="/api/health">Check API Health</a></p>
      </div>
    </body>
    </html>
  `;
  fs.writeFileSync(indexHtmlPath, simpleHtml);
  console.log('Simple index.html created successfully');
}

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
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100000000 } // 100MB default
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create uploads/images directory for image processing
const imageUploadsDir = path.join(__dirname, 'uploads/images');
if (!fs.existsSync(imageUploadsDir)) {
  console.log('Creating uploads/images directory...');
  fs.mkdirSync(imageUploadsDir, { recursive: true });
}

// Add payment routes
app.use('/api/payment', paymentRoutes);

// Add routes with error handling - Validate that imported routes are proper Express routers
let usingFallbackAuth = false;
let usingFallbackMeetings = false;

try {
  // Check if auth routes are loaded properly
  if (!authRoutes || !authRoutes.get) {
    console.warn('Auth routes object is not a valid router');
    throw new Error('Invalid router');
  }
  console.log('Auth routes loaded successfully');
} catch (error) {
  console.warn('Auth routes not found or invalid, using empty router', error);
  usingFallbackAuth = true;
}

try {
  // Check if meetings routes are loaded properly
  if (!meetingsRoutes || !meetingsRoutes.get) {
    console.warn('Meetings routes object is not a valid router');
    throw new Error('Invalid router');
  }
  console.log('Meetings routes loaded successfully');
} catch (error) {
  console.warn('Meetings routes not found or invalid, using empty router', error);
  usingFallbackMeetings = true;
}

// Register routes - with fallbacks if needed
if (usingFallbackAuth) {
  // Create fallback auth router
  const fallbackAuthRouter = express.Router();
  fallbackAuthRouter.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Auth API fallback is running' });
  });
  app.use('/api/auth', fallbackAuthRouter);
} else {
  app.use('/api/auth', authRoutes);
}

if (usingFallbackMeetings) {
  // Create fallback meetings router
  const fallbackMeetingsRouter = express.Router();
  fallbackMeetingsRouter.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Meetings API fallback is running' });
  });
  app.use('/api/meetings', fallbackMeetingsRouter);
} else {
  app.use('/api/meetings', meetingsRoutes);
}

// Image processing routes
app.use('/api/image', imageProcessingRoutes);

// Work Progress routes
app.use('/api/work-progress', workProgressRoutes);

// AI routes with fallback
try {
  const aiRoutes = require('./routes/aiRoutes');
  console.log('AI routes loaded successfully');
  app.use('/api/ai', aiRoutes);
} catch (error) {
  console.warn('AI routes not found or invalid, creating fallback:', error);
  const fallbackAIRouter = express.Router();
  fallbackAIRouter.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'AI API fallback is running' });
  });
  
  // Fallback handlers for AI endpoints
  fallbackAIRouter.post('/ask', (req, res) => {
    res.status(200).json({ 
      answer: "AI service is currently unavailable. Please check server logs or try again later.",
      source: "fallback"
    });
  });
  
  fallbackAIRouter.post('/answer-from-context', (req, res) => {
    res.status(200).json({ 
      answer: "AI service is currently unavailable. Please check server logs or try again later.",
      source: "fallback"
    });
  });
  
  app.use('/api/ai', fallbackAIRouter);
}

// Supabase auth middleware
/**
 * Authentication middleware that verifies JWT tokens from Supabase
 * Extracts user ID and adds it to req.userId
 */
const authMiddleware = async (req, res, next) => {
  // Get JWT token from Authorization header
  const authHeader = req.headers.authorization;
  
  // If there is no token, check for x-user-id header (existing implementation)
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Support legacy x-user-id header for backward compatibility
    req.userId = req.headers['x-user-id'];
    return next();
  }
  
  try {
    // Extract the token
    const token = authHeader.split(' ')[1];
    
    // Verify the JWT with Supabase
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error('Auth error:', error.message);
      // Don't reject the request, just don't set userId
      return next();
    }
    
    // Set the userId on the request object
    if (data && data.user) {
      req.userId = data.user.id;
      // Store the full user object for potential future use
      req.user = data.user;
      console.log(`Request authenticated for user: ${req.userId}`);
    }
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    // Don't reject the request, just don't set userId
    next();
  }
};

// Apply auth middleware to all routes
app.use(authMiddleware);

// API routes
app.post('/api/upload', upload.single('audioFile'), async (req, res) => {
  // Set a longer timeout for this specific route
  req.setTimeout(600000); // 10 minutes
  
  try {
    if (!req.file) {
      console.error('Error: No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get user ID from request headers (sent by frontend after Clerk authentication)
    const userId = req.headers['x-user-id'];
    
    console.log(`Processing request for user: ${userId || 'anonymous'}`);
    
    // Check if user has exceeded free tier limit (skip for users without ID - should be handled by auth middleware ideally)
    if (userId && await supabaseUserService.hasExceededLimit(userId)) {
      return res.status(403).json({ 
        error: 'Free tier limit exceeded', 
        details: 'You have used all your free processing requests',
        upgradeRequired: true,
        limit: supabaseUserService.FREE_TIER_LIMIT,
        used: await supabaseUserService.getRequestCount(userId)
      });
    }

    console.log(`Processing audio file: ${req.file.originalname}`);
    console.log(`File path: ${req.file.path}`);
    console.log(`File size: ${req.file.size} bytes`);
    
    // Check OpenAI API key validity before proceeding
    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      // Quick test to validate API key
      await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "system", content: "Test" }],
        max_tokens: 5
      });
      
      console.log('OpenAI API key validated successfully');
    } catch (apiKeyError) {
      console.error('OpenAI API key validation failed:', apiKeyError);
      
      // If we have a session ID, emit error to that client
      if (req.body.sessionId) {
        global.emitProcessingUpdate(req.body.sessionId, 'error', { 
          message: 'OpenAI API key error: ' + apiKeyError.message,
          details: process.env.NODE_ENV === 'development' ? apiKeyError.stack : undefined
        });
      }
      
      // Handle specific API error types
      let errorMessage = 'OpenAI API key error';
      let errorDetails = apiKeyError.message;
      let solution = 'Please update the OPENAI_API_KEY in the backend .env file';
      let apiKeyStatus = 'invalid';
      
      // Check for quota exceeded error (429)
      if (apiKeyError.status === 429) {
        errorMessage = 'OpenAI API quota exceeded';
        errorDetails = 'You have exceeded your current API quota limit';
        solution = 'Please check your OpenAI account billing details or use a different API key';
        apiKeyStatus = 'quota_exceeded';
      }
      
      return res.status(500).json({ 
        error: errorMessage, 
        details: errorDetails,
        apiKeyStatus: apiKeyStatus,
        solution: solution,
        stack: process.env.NODE_ENV === 'development' ? apiKeyError.stack : undefined
      });
    }
    
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
    console.log(`Session ID for WebSocket updates: ${sessionId || 'none provided'}`);
    
    // If we have a session ID, join that client to a room for updates
    if (sessionId) {
      try {
        const sockets = await io.fetchSockets();
        let joinedSocketCount = 0;
        
        sockets.forEach(socket => {
          if (socket.handshake.query.sessionId === sessionId) {
            socket.join(sessionId);
            joinedSocketCount++;
          }
        });
        
        console.log(`Found ${joinedSocketCount} socket(s) for session ${sessionId} and added them to room`);
      } catch (socketError) {
        console.error('Error managing socket rooms:', socketError);
        // Continue processing even if socket management fails
      }
    }
    
    // Process the audio file
    try {
      console.log('Starting audio processing...');
      const result = await processAudio(req.file.path, userCustomInstructions, meetingTopic, sessionId);
      console.log('Audio processing completed successfully');
      
      // Increment user's request count if user ID is provided
      if (userId) {
        const newCount = await supabaseUserService.incrementRequestCount(userId);
        const remaining = await supabaseUserService.getRemainingRequests(userId);
        console.log(`User ${userId} has used ${newCount} requests, ${remaining} remaining`);
      }
      
      // Return response with transcript data for chat functionality
      return res.status(200).json({ 
        message: 'File processed successfully',
        reportPath: result.reportPath,
        fileName: result.reportFileName,
        reportName: result.reportFileName,
        docxFileName: result.reportFileName,
        docxUrl: `/api/download/${result.reportFileName}`,
        format: 'docx',
        reportUrl: `/api/download/${result.reportFileName}`,
        // Include transcript for chat functionality
        transcript: result.transcript || result.rawTranscript || '',
        // Add user request information
        requestInfo: userId ? {
          used: await supabaseUserService.getRequestCount(userId),
          remaining: await supabaseUserService.getRemainingRequests(userId),
          limit: supabaseUserService.FREE_TIER_LIMIT,
          isPremium: await supabaseUserService.isPremiumUser(userId)
        } : null
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
  
  console.log(`Download requested for file: ${fileName} (Path: ${filePath})`);
  console.log(`Request origin: ${req.headers.origin || 'unknown'}`);
  console.log(`Request headers: ${JSON.stringify(req.headers)}`);
  
  // Add extra CORS headers to ensure cross-origin downloads work
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');
  
  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (fs.existsSync(filePath)) {
    try {
      // Get file stats for logging
      const stats = fs.statSync(filePath);
      console.log(`File exists. Size: ${stats.size} bytes, Created: ${stats.birthtime}`);
      
      // Set the appropriate headers for DOCX download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', stats.size);
      
      // Send the file as a download
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error(`Error sending file: ${err}`);
          console.error(err.stack);
          return res.status(500).json({ error: 'Error downloading file', details: err.message });
        }
        console.log(`File ${fileName} sent successfully`);
      });
    } catch (error) {
      console.error(`Error processing download request: ${error}`);
      console.error(error.stack);
      return res.status(500).json({ error: 'Error processing download request', details: error.message });
    }
  } else {
    console.error(`File not found: ${filePath}`);
    // List directory contents for debugging
    try {
      const uploadsDir = path.join(__dirname, 'uploads');
      const files = fs.readdirSync(uploadsDir);
      console.log(`Files in uploads directory (${files.length}): ${files.join(', ')}`);
    } catch (error) {
      console.error(`Error listing uploads directory: ${error}`);
    }
    return res.status(404).json({ error: 'File not found' });
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

// Add a new endpoint to check user request status
app.get('/api/user/request-status', async (req, res) => {
  // Add explicit CORS headers for this endpoint
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-session-id');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const userId = req.headers['x-user-id'];
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  try {
    // Get request count for this user
    const used = await supabaseUserService.getRequestCount(userId);
    const remaining = await supabaseUserService.getRemainingRequests(userId);
    const limit = supabaseUserService.FREE_TIER_LIMIT;
    const upgradeRequired = await supabaseUserService.hasExceededLimit(userId);
    
    return res.status(200).json({
      used,
      remaining,
      limit,
      upgradeRequired
    });
  } catch (error) {
    console.error('Error checking user request status:', error);
    return res.status(500).json({
      error: 'Error checking user request status',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Add a user profile endpoint
app.get('/api/user/profile', async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    // Get user data from Supabase
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.userId)
      .single();
    
    if (error) {
      throw error;
    }
    
    // If no profile exists, return basic user data
    if (!data) {
      // Try to get user from Supabase Auth
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(req.userId);
      
      if (userError) {
        throw userError;
      }
      
      return res.status(200).json({
        id: userData.user.id,
        email: userData.user.email,
        firstName: userData.user.user_metadata?.first_name || '',
        lastName: userData.user.user_metadata?.last_name || '',
        createdAt: userData.user.created_at
      });
    }
    
    // Return the profile data
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Test endpoint to verify auth status
app.get('/api/auth-status', (req, res) => {
  // Add explicit CORS headers for this endpoint
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-session-id');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  res.json({
    authenticated: !!req.userId,
    userId: req.userId || null
  });
});

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

// Chunked file upload handling
const chunksDir = path.join(__dirname, 'uploads', 'chunks');
if (!fs.existsSync(chunksDir)) {
  fs.mkdirSync(chunksDir, { recursive: true });
  console.log('Created directory for file chunks:', chunksDir);
}

// Store ongoing uploads
const ongoingUploads = new Map();

// Configure multer for chunk uploads
const chunkStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fileId = req.body.fileId;
    const chunkDir = path.join(chunksDir, fileId);
    
    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir, { recursive: true });
    }
    
    cb(null, chunkDir);
  },
  filename: (req, file, cb) => {
    const chunkIndex = req.body.chunkIndex || 0;
    cb(null, `chunk-${chunkIndex}`);
  }
});

const uploadChunk = multer({ 
  storage: chunkStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max per chunk
});

// Endpoint to receive individual chunks
app.post('/api/upload/chunk', uploadChunk.single('chunk'), (req, res) => {
  // Get the request origin
  const origin = req.headers.origin;
  
  // Add CORS headers explicitly to this endpoint to ensure they're set
  // When using credentials, we must specify the exact origin, not a wildcard
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-session-id');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { fileId, fileName, fileType, totalChunks, chunkIndex } = req.body;
    
    if (!fileId || !fileName || !chunkIndex) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required chunk information'
      });
    }
    
    // Get/create upload tracking info
    if (!ongoingUploads.has(fileId)) {
      ongoingUploads.set(fileId, {
        fileName,
        fileType,
        totalChunks: parseInt(totalChunks),
        uploadedChunks: new Array(parseInt(totalChunks)).fill(false),
        chunkCount: 0,
        createdAt: new Date(),
        sessionId: req.body.sessionId,
        meetingTopic: req.body.meetingTopic,
        customInstructions: req.body.customInstructions,
        userId: req.headers['x-user-id'] || 'anonymous'
      });
    }
    
    // Update upload status with this chunk
    const uploadInfo = ongoingUploads.get(fileId);
    uploadInfo.uploadedChunks[parseInt(chunkIndex)] = true;
    uploadInfo.chunkCount++;
    
    console.log(`Received chunk ${parseInt(chunkIndex) + 1}/${totalChunks} for file ${fileName} (ID: ${fileId})`);
    
    return res.status(200).json({
      success: true,
      message: `Chunk ${parseInt(chunkIndex) + 1}/${totalChunks} received`,
      chunksReceived: uploadInfo.chunkCount,
      remainingChunks: parseInt(totalChunks) - uploadInfo.chunkCount
    });
  } catch (error) {
    console.error('Error handling chunk upload:', error);
    // Return a more descriptive error response
    return res.status(500).json({
      success: false,
      message: 'Error processing chunk',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      errorType: error.name,
      errorCode: error.code
    });
  }
});

// Endpoint to complete the upload and start processing
app.post('/api/upload/complete', async (req, res) => {
  // Get the request origin
  const origin = req.headers.origin;
  
  // Add CORS headers explicitly to this endpoint
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-session-id');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { fileId, fileName, totalChunks, sessionId, meetingTopic, customInstructions } = req.body;
    const userId = req.headers['x-user-id'] || req.body.userId || 'anonymous';
    
    if (!fileId || !fileName) {
      return res.status(400).json({
        success: false,
        message: 'Missing file information'
      });
    }
    
    // Verify this upload exists and all chunks were received
    if (!ongoingUploads.has(fileId)) {
      return res.status(404).json({
        success: false,
        message: 'Upload not found'
      });
    }
    
    const uploadInfo = ongoingUploads.get(fileId);
    const receivedChunks = uploadInfo.uploadedChunks.filter(Boolean).length;
    
    if (receivedChunks !== parseInt(totalChunks)) {
      return res.status(400).json({
        success: false,
        message: `Not all chunks received. Got ${receivedChunks}/${totalChunks} chunks.`
      });
    }
    
    console.log(`All ${totalChunks} chunks received for ${fileName}. Assembling file...`);
    
    // Create the final file by combining chunks
    const chunkDir = path.join(chunksDir, fileId);
    const outputFilePath = path.join(__dirname, 'uploads', `${Date.now()}_${fileName}`);
    const outputStream = fs.createWriteStream(outputFilePath);
    
    for (let i = 0; i < parseInt(totalChunks); i++) {
      const chunkPath = path.join(chunkDir, `chunk-${i}`);
      const chunkBuffer = fs.readFileSync(chunkPath);
      outputStream.write(chunkBuffer);
    }
    
    outputStream.end();
    
    // Wait for the stream to finish
    await new Promise((resolve, reject) => {
      outputStream.on('finish', resolve);
      outputStream.on('error', reject);
    });
    
    console.log(`File assembled at ${outputFilePath}`);
    
    // Send initial response that we've received all chunks
    res.status(200).json({
      success: true,
      message: 'All chunks received, starting audio processing',
      fileName
    });
    
    // Begin processing the audio file in the background
    processAudioInBackground(outputFilePath, userId, sessionId, customInstructions, meetingTopic);
    
    // Clean up chunks
    try {
      // Keep track of the assembled file, but remove the chunks
      ongoingUploads.set(fileId, { 
        ...uploadInfo,
        status: 'processing',
        assembledFilePath: outputFilePath 
      });
      
      // Asynchronously clean up chunks to not block the response
      setTimeout(() => {
        try {
          fs.rmdirSync(chunkDir, { recursive: true });
          console.log(`Cleaned up chunks for ${fileId}`);
        } catch (cleanupError) {
          console.error(`Error cleaning up chunks: ${cleanupError.message}`);
        }
      }, 5000);
    } catch (cleanupError) {
      console.error(`Error preparing cleanup: ${cleanupError.message}`);
    }
  } catch (error) {
    console.error('Error completing upload:', error);
    return res.status(500).json({
      success: false,
      message: 'Error completing file upload',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      errorType: error.name,
      errorCode: error.code
    });
  }
});

// Function to process audio file in background
async function processAudioInBackground(filePath, userId, sessionId, customInstructions, meetingTopic) {
  try {
    console.log(`Starting background processing for ${filePath}`);
    
    // Emit initial status
    if (sessionId) {
      global.emitProcessingUpdate(sessionId, 'started', {
        message: 'Audio processing started',
        timestamp: new Date().toISOString()
      });
    }
    
    // Process the file
    const result = await processAudio(filePath, customInstructions, meetingTopic, sessionId);
    
    console.log('Audio processing completed');
    
    // Emit completion status via socket if possible
    if (sessionId) {
      global.emitProcessingUpdate(sessionId, 'completed', {
        message: 'Processing completed successfully',
        reportPath: result.reportPath,
        reportFileName: result.reportFileName,
        transcript: result.transcript || result.rawTranscript || '',
        requestInfo: userId ? {
          used: await supabaseUserService.getRequestCount(userId),
          remaining: await supabaseUserService.getRemainingRequests(userId),
          limit: supabaseUserService.FREE_TIER_LIMIT,
          isPremium: await supabaseUserService.isPremiumUser(userId)
        } : null
      });
    }
  } catch (error) {
    console.error('Error in background processing:', error);
    
    // Emit error message via socket if possible
    if (sessionId) {
      global.emitProcessingUpdate(sessionId, 'error', {
        message: 'Error processing audio file',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Enhanced status endpoint for HTTP polling as WebSocket fallback
app.get('/api/status', async (req, res) => {
  const sessionId = req.query.sessionId;
  
  // Apply CORS headers explicitly
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-session-id');
  }
  
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }
  
  try {
    // Try to fetch the latest processing status for this session
    const userId = req.headers['x-user-id'];
    
    // Check if there's an ongoing upload with this sessionId
    let processingStatus = null;
    
    // If we have ongoingUploads object available, check it
    if (typeof ongoingUploads !== 'undefined' && ongoingUploads.size > 0) {
      for (const [fileId, uploadInfo] of ongoingUploads.entries()) {
        if (uploadInfo.sessionId === sessionId) {
          processingStatus = {
            status: uploadInfo.status || 'processing',
            message: `File ${uploadInfo.fileName} is ${uploadInfo.status || 'being processed'}`,
            fileName: uploadInfo.fileName,
            percentComplete: uploadInfo.status === 'completed' ? 100 : 75, // Approximate
            timestamp: new Date().toISOString()
          };
          break;
        }
      }
    }
    
    // If we don't have status info, return a generic response
    if (!processingStatus) {
      processingStatus = {
        status: 'info',
        message: 'File processing status is being tracked via HTTP polling',
        sessionId,
        percentComplete: 60, // Default progress value
        timestamp: new Date().toISOString()
      };
    }
    
    res.json(processingStatus);
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({ error: 'Error fetching status' });
  }
});

// Enhanced health check endpoint for monitoring and debugging
app.get('/api/health/cors', (req, res) => {
  // Always add all possible CORS headers to this endpoint
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-session-id');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Send back a comprehensive health check
  res.status(200).json({
    status: 'ok',
    message: 'MeetingScribe API is running',
    cors: {
      origin: req.headers.origin || 'No origin header provided',
      allowedOrigins: corsOptions.origin,
      headers: {
        sent: {
          'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
          'Access-Control-Allow-Methods': res.getHeader('Access-Control-Allow-Methods'),
          'Access-Control-Allow-Headers': res.getHeader('Access-Control-Allow-Headers'),
          'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials')
        }
      }
    },
    socketConfig: {
      transports: ['polling', 'websocket'],
      pingTimeout: '60 seconds',
      pingInterval: '25 seconds'
    },
    environment: process.env.NODE_ENV || 'development',
    time: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())} seconds`,
    memory: process.memoryUsage(),
    apiUrl: process.env.API_URL || `http://localhost:${PORT}`,
    frontendUrl: process.env.FRONTEND_URL || 'https://meetingscribe.vercel.app'
  });
});

// Add CORS testing endpoint
app.get('/api/check-cors', (req, res) => {
  const origin = req.headers.origin || 'No origin';
  res.json({ 
    message: 'CORS is working!', 
    origin,
    headers: {
      sent: {
        'access-control-allow-origin': res.getHeader('Access-Control-Allow-Origin'),
        'access-control-allow-credentials': res.getHeader('Access-Control-Allow-Credentials')
      }
    }
  });
});

// Add special test endpoints for CORS and connection debugging

// Simple CORS test endpoint that responds to any method
app.all('/api/test/cors', (req, res) => {
  const origin = req.headers.origin;
  
  // Add explicit CORS headers for this test endpoint
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-session-id');
    res.header('Access-Control-Allow-Credentials', 'true');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Send detailed information about the request
  res.json({
    success: true,
    message: 'CORS test endpoint working correctly',
    request: {
      method: req.method,
      path: req.path,
      origin: origin || 'No origin header',
      headers: req.headers,
      cookies: req.cookies || {},
      timestamp: new Date().toISOString()
    },
    response: {
      headers: {
        'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
        'Access-Control-Allow-Methods': res.getHeader('Access-Control-Allow-Methods'),
        'Access-Control-Allow-Headers': res.getHeader('Access-Control-Allow-Headers'),
        'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials')
      }
    },
    server: {
      environment: process.env.NODE_ENV || 'development',
      allowedOrigins: corsOptions.origin
    }
  });
});

// Test endpoint for mock chunk upload - simulates the real endpoint without saving files
app.post('/api/test/upload-chunk', (req, res) => {
  const origin = req.headers.origin;
  
  // Add explicit CORS headers
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-session-id');
    res.header('Access-Control-Allow-Credentials', 'true');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Simulate a successful chunk upload response
  res.json({
    success: true,
    message: 'Test chunk upload successful',
    received: {
      headers: req.headers,
      body: req.body || {},
      query: req.query || {},
      cookies: req.cookies || {}
    }
  });
});

// Start the server with socket.io
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Base URL: ${process.env.API_URL || `http://localhost:${PORT}`}`);
}); 