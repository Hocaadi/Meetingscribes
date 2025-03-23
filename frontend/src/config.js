/**
 * Configuration for environment-specific settings
 */

// API base URL - uses environment variable in production or localhost in development
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Export configuration
export default {
  API_URL,
  UPLOAD_ENDPOINT: `${API_URL}/api/upload`,
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
}; 