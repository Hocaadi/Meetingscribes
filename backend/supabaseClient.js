const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Get URL and key from environment variables or use hardcoded values for development
const supabaseUrl = process.env.SUPABASE_URL || 'https://pdrvzkrynsobxwpuvazt.supabase.co';
let supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

// Check if URL is configured
if (supabaseUrl) {
  console.log('Supabase URL configured:', supabaseUrl);
} else {
  console.error('Error: SUPABASE_URL environment variable is not set');
}

// Check if key is configured
if (supabaseKey) {
  console.log('Supabase API key found (key hidden for security)');
} else {
  // For development, provide a fallback key if not in production
  if (process.env.NODE_ENV !== 'production') {
    console.warn('Using development fallback for Supabase key - NOT FOR PRODUCTION');
    // Fallback key for development only (anon key, public)
    supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcnZ6a3J5bnNvYnh3cHV2YXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA3NjY0MTIsImV4cCI6MjA1NjM0MjQxMn0.d9pdoQbfCCrCccG4CwLJEnDnGo-gGwfVzyrgwHbc8dE';
  } else {
    console.error('Error: SUPABASE_SERVICE_KEY environment variable is not set');
    throw new Error('SUPABASE_KEY environment variable is not set');
  }
}

// Create Supabase client (use service role for server-side access)
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('Supabase client initialized successfully in supabaseClient.js');

// Test connection
const testConnection = async () => {
  try {
    // Test with a simple query instead of auth.getUser() since we're using service role
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)
      .single();
    
    if (error) {
      console.error('Supabase connection test failed:', error.message);
    } else {
      console.log('✅ Supabase connection test successful');
    }
  } catch (err) {
    console.error('Supabase connection test failed with exception:', err);
  }
};

testConnection();

// Export instance for other modules to use
module.exports = { supabase }; 