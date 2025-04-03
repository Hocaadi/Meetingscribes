// Import the Supabase client
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

let supabase;

// Initialize Supabase client if credentials are available
if (supabaseUrl && supabaseKey) {
  console.log('Initializing Supabase client with provided credentials');
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.error('❌ Supabase credentials missing. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
  throw new Error('Supabase credentials missing. Cannot initialize client without proper credentials.');
}

// Export the Supabase client
module.exports = {
  supabase
}; 