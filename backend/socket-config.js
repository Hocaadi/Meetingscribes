// socket-config.js
const { Server } = require('socket.io');
const { allowedOrigins } = require('./cors-config'); // Use the same origin list

function setupSocketIO(server) {
  const io = new Server(server, {
    cors: {
      origin: function(origin, callback) {
        if (!origin || allowedOrigins.includes(origin) || origin.includes('meetingscribe')) {
          callback(null, origin); // Important: Return the exact origin
        } else {
          console.log(`Rejected socket connection from origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-session-id']
    },
    // Socket.io specific options
    transports: ['polling', 'websocket'], // Try polling first (critical for Render)
    pingTimeout: 60000,
    pingInterval: 25000,
    path: '/socket.io/', // Explicit path
    connectTimeout: 45000, // Longer timeout
    // Below settings help with Render's connection limitations
    allowUpgrades: true,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e8 // 100MB for larger payloads
  });

  // Set up connection handlers
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Get session ID from socket handshake
    const sessionId = socket.handshake.query.sessionId;
    if (sessionId) {
      console.log(`Client ${socket.id} joined room: ${sessionId}`);
      socket.join(sessionId);
    }
    
    // Handle ping (keep-alive)
    socket.on('ping', (data) => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Create global emitter function for use elsewhere
  global.emitProcessingUpdate = (sessionId, status, data = {}) => {
    if (!sessionId) {
      console.log('No sessionId provided for emitProcessingUpdate, skipping');
      return false;
    }
    
    try {
      io.to(sessionId).emit('processing_update', { 
        status, 
        ...data, 
        timestamp: new Date().toISOString() 
      });
      return true;
    } catch (error) {
      console.error('Error in emitProcessingUpdate:', error);
      return false;
    }
  };

  return io;
}

module.exports = setupSocketIO; 