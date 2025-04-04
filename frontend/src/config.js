/**
 * Configuration for environment-specific settings
 */

const isDev = process.env.NODE_ENV === 'development';

// For local development
const DEV_API_URL = 'http://localhost:5000';

// For production - deployed backend URLs with fallbacks
const PROD_API_URL = 'https://meetingscribe-backend.onrender.com';
const PROD_FALLBACK_URLS = [
  'https://meetingscribe-backend.onrender.com',
  'https://meetingscribe-api.vercel.app',
  'https://meetingscribe-backend.herokuapp.com'
];

// CORS proxies that can be used as a last resort
const CORS_PROXIES = [
  'https://cors-anywhere.herokuapp.com/',
  'https://api.allorigins.win/raw?url='
];

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

// Socket.io configuration with retry mechanisms - modified for production
const SOCKET_CONFIG = {
  reconnection: true,
  reconnectionAttempts: 10,        
  reconnectionDelay: 2000,        
  reconnectionDelayMax: 10000,    
  timeout: 45000,                 
  transports: ['polling', 'websocket'],  // Try polling first, fall back to websocket
  forceNew: true,                 
  autoConnect: true,              
  withCredentials: false,         // Start without credentials for better CORS compatibility
  // Don't set CORS headers from client side - servers control this
  extraHeaders: {                 
    'Origin': window.location.origin
  }
};

// Socket.io fallback configs to try if the main one fails
const SOCKET_FALLBACK_CONFIGS = [
  // Try with credentials
  { withCredentials: true, transports: ['polling', 'websocket'] },
  // Try without credentials
  { withCredentials: false, transports: ['polling', 'websocket'] },
  // Try polling only
  { withCredentials: false, transports: ['polling'] },
  // Try websocket only
  { withCredentials: false, transports: ['websocket'] },
  // Try with explicit origin header only
  { 
    withCredentials: false, 
    transports: ['polling', 'websocket'],
    extraHeaders: { 
      'Origin': window.location.origin 
    }
  }
];

// Upload configuration with enhanced CORS handling
const UPLOAD_CONFIG = {
  CHUNK_SIZE: 5 * 1024 * 1024, // 5 MB per chunk
  MAX_RETRIES: 5,              
  RETRY_DELAY: 2000,
  CREDENTIALS_MODE: false,     // Start without credentials
  // Progressive fallback for CORS issues
  FALLBACK_STRATEGIES: [
    // Start without credentials, include content type
    { withCredentials: false, includeContentType: true },
    // With credentials, include content type
    { withCredentials: true, includeContentType: true },
    // With credentials, no content type (helps with some CORS configs)
    { withCredentials: true, includeContentType: false },
    // No credentials, no content type (maximum compatibility)
    { withCredentials: false, includeContentType: false },
    // Try direct fetch with no special headers
    { useFetch: true, includeContentType: false, withCredentials: false },
    // Last resort: try a CORS proxy
    { withCredentials: false, includeContentType: false, useProxy: true }
  ]
};

// Common error messages
const ERROR_MESSAGES = {
  SERVICE_UNAVAILABLE: "The server is currently unavailable. Please try again later.",
  NETWORK_ERROR: "Network error detected. Please check your connection and try again.",
  CORS_ERROR: "Cross-origin request blocked. The system will try alternative methods automatically.",
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
  if (!error) return false;
  
  const errorMsg = error.message || '';
  const isResponseEmpty = error?.response?.status === 0;
  const isNetworkError = errorMsg.includes('Network Error');
  const hasCorsInMsg = errorMsg.includes('CORS') || 
                       errorMsg.includes('cross-origin') || 
                       errorMsg.includes('Access-Control');
  const is502Error = error?.response?.status === 502;
  const is429Error = error?.response?.status === 429;
  
  return isResponseEmpty || isNetworkError || hasCorsInMsg || is502Error || is429Error;
};

// Function to get a proxy URL if needed
const getProxyUrl = (url) => {
  // Only use proxy in production and when explicitly requested
  const useProxy = localStorage.getItem('use_proxy') === 'true';
  
  if (useProxy) {
    // Choose a CORS proxy
    const proxyIndex = Math.floor(Math.random() * CORS_PROXIES.length);
    return `${CORS_PROXIES[proxyIndex]}${url}`;
  }
  
  return url;
};

// Function to get a fallback API URL
const getFallbackApiUrl = (index = 0) => {
  // In development, return the development URL
  if (isDev) return DEV_API_URL;
  
  // In production, get the fallback URL based on the index
  if (index >= 0 && index < PROD_FALLBACK_URLS.length) {
    return PROD_FALLBACK_URLS[index];
  }
  
  // Default to the main production URL
  return PROD_API_URL;
};

// Export configuration
export default {
  API_URL: FINAL_API_URL,
  BACKUP_API_URLS: PROD_FALLBACK_URLS,
  BACKUP_API_URL: getFallbackApiUrl(0), 
  SOCKET_URL: FINAL_API_URL,
  SOCKET_CONFIG,
  SOCKET_FALLBACK_CONFIGS,
  AUTH_API_URL: `${FINAL_API_URL}/api/auth`,
  MAX_FILE_SIZE,
  UPLOAD_CONFIG,
  CORS_PROXIES,
  MAX_MEETING_LENGTH_HOURS: 2,
  UPLOAD_TIMEOUT: 120000, // 2 minutes
  MAX_RETRIES: 5,
  ERROR_MESSAGES,
  isCorsError,
  getProxyUrl,
  getFallbackApiUrl,
  isDev
}; 