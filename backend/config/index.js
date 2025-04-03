const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configuration values with defaults
const config = {
  // Server configuration
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // OpenAI API key (no default value for security)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  
  // Supabase configuration
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://pdrvzkrynsobxwpuvazt.supabase.co',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
  
  // Frontend URL (for CORS)
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // Upload settings
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 100000000, // 100MB default
  
  // Socket.io Configuration
  SOCKET_CORS_ORIGIN: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000',
};

module.exports = config; 