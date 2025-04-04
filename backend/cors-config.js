// cors-config.js
const allowedOrigins = [
  'https://meetingscribe--zeta.vercel.app',
  'https://meetingscribe-zeta.vercel.app',
  'https://meetingscribe.vercel.app',
  'http://localhost:3000',
  // Add additional allowed origins with wildcards
  'https://*.vercel.app'
];

const corsOptions = {
  origin: function(origin, callback) {
    // Don't block requests with no origin 
    // (like mobile apps, curl requests, or same-origin requests)
    if (!origin) {
      callback(null, true);
      return;
    }
    
    // Check if the origin is allowed
    if (allowedOrigins.some(allowed => 
      allowed === origin ||
      (allowed.includes('*') && new RegExp(allowed.replace('*', '.*')).test(origin)) ||
      origin.includes('meetingscribe'))) {
      // Allow the request with the origin as the value
      callback(null, origin);
    } else {
      console.log(`CORS rejected origin: ${origin}`);
      // Block the request with an error
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-session-id'],
  optionsSuccessStatus: 204,
  preflightContinue: false,
  maxAge: 86400 // 24 hours
};

module.exports = { corsOptions, allowedOrigins }; 