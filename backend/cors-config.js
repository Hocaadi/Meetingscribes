// cors-config.js
const allowedOrigins = [
  'https://meetingscribe--zeta.vercel.app',
  'https://meetingscribe-zeta.vercel.app',
  'https://meetingscribe.vercel.app',
  'http://localhost:3000'
];

const corsOptions = {
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.includes('meetingscribe')) {
      callback(null, origin);
    } else {
      console.log(`Rejected request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
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