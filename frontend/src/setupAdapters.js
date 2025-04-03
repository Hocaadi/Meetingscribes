/**
 * setupAdapters.js
 * 
 * This file initializes all adapters that should be available throughout the application.
 * Mocks have been disabled as per user request.
 */

// Import our ClerkAdapter
import './contexts/ClerkAdapter';

console.log('Setup complete: Auth adapters initialized');

// Export a function that can be called to verify adapters are loaded
export const verifyAdaptersLoaded = () => {
  console.log('Verifying adapters are loaded...');
  
  try {
    // Try to access the ClerkAdapter
    const clerkModule = require('./contexts/ClerkAdapter');
    console.log('ClerkAdapter loaded successfully:', !!clerkModule);
    
    return true;
  } catch (error) {
    console.error('Error verifying adapters:', error);
    return false;
  }
}; 