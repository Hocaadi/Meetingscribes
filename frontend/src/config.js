/**
 * Configuration for environment-specific settings
 */

const isDev = process.env.NODE_ENV === 'development';

// For local development
const DEV_API_URL = 'http://localhost:5000';

// For production - deployed backend URL
const PROD_API_URL = 'https://meetingscribe-backend.onrender.com';

// Allow override from environment variables
const API_URL = process.env.REACT_APP_API_URL || (isDev ? DEV_API_URL : PROD_API_URL);

// Allow override for local testing with production API
const FORCE_PROD_API = process.env.REACT_APP_FORCE_PROD_API === 'true';

// Final API URL determination
const FINAL_API_URL = FORCE_PROD_API ? PROD_API_URL : API_URL;

// Log the API URL for debugging
console.log('Using API URL:', FINAL_API_URL);

const UPLOAD_ENDPOINT = `${FINAL_API_URL}/api/upload`;
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

// Socket.io configuration with retry mechanisms
const SOCKET_CONFIG = {
  reconnection: true,
  reconnectionAttempts: 10,        // Increased from 5
  reconnectionDelay: 2000,        // Increased from 1000
  reconnectionDelayMax: 10000,    // Cap at 10 seconds
  timeout: 45000,                 // 45 seconds timeout (increased)
  transports: ['polling', 'websocket'],  // Try polling first, fall back to websocket
  forceNew: true,                 // Force new connection
  autoConnect: true,              // Auto connect
  withCredentials: true,          // Use credentials mode
  extraHeaders: {                 // Extra headers for CORS
    'Access-Control-Allow-Origin': '*'
  }
};

// Upload configuration with CORS handling
const UPLOAD_CONFIG = {
  CHUNK_SIZE: 5 * 1024 * 1024, // 5 MB per chunk
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  CREDENTIALS_MODE: true,
  // Progressive fallback for CORS issues
  FALLBACK_STRATEGIES: [
    { withCredentials: true, includeContentType: true },
    { withCredentials: true, includeContentType: false },
    { withCredentials: false, includeContentType: false }
  ]
};

// Common error messages
const ERROR_MESSAGES = {
  SERVICE_UNAVAILABLE: "The server is currently unavailable. Please try again later.",
  NETWORK_ERROR: "Network error detected. Please check your connection and try again.",
  CORS_ERROR: "Cross-origin request blocked. This is a server configuration issue. Please contact support.",
  FILE_TOO_LARGE: "The file is too large. Please try a smaller file or break it into parts.",
  PROCESSING_ERROR: "Error processing the file. Please try a different file or format.",
  SERVER_WAKE: "Our server is waking up from sleep mode (normal for free-tier hosting). Your request will continue automatically in 30-60 seconds.",
  UPLOAD_RETRY: "Upload failed. Automatically retrying...",
  TIMEOUT: "Request timed out. For large files, this can happen on our free-tier service. Try again when the server is less busy or use a smaller file.",
  API_404: "API endpoint not found (404). This could be due to an incorrect API URL configuration or the backend service is not running.",
  CORS_ISSUE: "Cross-origin issues detected. Trying alternative upload strategy...",
  BAD_GATEWAY: "Server is currently overloaded (502 Bad Gateway). Trying again with a different approach..."
};

// CORS check function to detect if an error is CORS-related
const isCorsError = (error) => {
  const errorMsg = error?.message || '';
  const isResponseEmpty = error?.response?.status === 0;
  const isNetworkError = errorMsg.includes('Network Error');
  const hasCorsInMsg = errorMsg.includes('CORS') || errorMsg.includes('cross-origin');
  
  return isResponseEmpty || isNetworkError || hasCorsInMsg;
};

// Export configuration
export default {
  API_URL: FINAL_API_URL,
  BACKUP_API_URL: isDev ? PROD_API_URL : null, // Use production as backup in dev mode
  SOCKET_URL: FINAL_API_URL,
  AUTH_API_URL: `${FINAL_API_URL}/api/auth`,
  MAX_FILE_SIZE,
  UPLOAD_CONFIG,
  SOCKET_CONFIG,
  MAX_MEETING_LENGTH_HOURS: 2,
  UPLOAD_TIMEOUT: 120000, // 2 minutes
  MAX_RETRIES: 3,
  ERROR_MESSAGES,
  isCorsError,
  isDev
}; 