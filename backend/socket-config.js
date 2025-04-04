// socket-config.js
const { Server } = require('socket.io');
const { allowedOrigins } = require('./cors-config'); // Use the same origin list

function setupSocketIO(server) {
  const io = new Server(server, {
    cors: {
      origin: function(origin, callback) {
        // Use the same permissive logic as in cors-config.js
        if (!origin || allowedOrigins.some(allowed => 
          allowed === origin || 
          (allowed.includes('*') && new RegExp(allowed.replace('*', '.*')).test(origin)) ||
          origin.includes('meetingscribe'))) {
          callback(null, origin); // Important: Return the exact origin
        } else {
          console.log(`Rejected socket connection from origin: ${origin}`);
          // For debugging, allow all origins in development
          if (process.env.NODE_ENV === 'development') {
            callback(null, origin);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
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

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`Socket error for client ${socket.id}:`, error);
      // Try to notify the client about the error
      try {
        socket.emit('server_error', { 
          message: 'Server socket error',
          details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
      } catch (emitError) {
        console.error('Error emitting error event:', emitError);
      }
    });
  });

  // Handle server-level errors
  io.engine.on('connection_error', (err) => {
    console.error('Socket.io connection error:', err);
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