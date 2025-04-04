// cors-config.js
const allowedOrigins = [
  'https://meetingscribe--zeta.vercel.app',
  'https://meetingscribe-zeta.vercel.app',
  'https://meetingscribe.vercel.app',
  'http://localhost:3000',
  // Add additional allowed origins
  'https://*.vercel.app',
  'https://*.onrender.com'
];

const corsOptions = {
  origin: function(origin, callback) {
    // More permissive check: either no origin (same-origin), in the allowed list,
    // or contains 'meetingscribe'
    if (!origin || allowedOrigins.some(allowed => 
      allowed === origin || 
      (allowed.includes('*') && new RegExp(allowed.replace('*', '.*')).test(origin)) ||
      origin.includes('meetingscribe'))) {
      callback(null, origin);
    } else {
      console.log(`Rejected request from origin: ${origin}`);
      // For debugging, allow all origins in development
      if (process.env.NODE_ENV === 'development') {
        callback(null, origin);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-session-id'],
  optionsSuccessStatus: 200,
  preflightContinue: false,
  maxAge: 86400 // 24 hours
};

module.exports = { corsOptions, allowedOrigins }; 