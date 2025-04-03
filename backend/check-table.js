const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
  console.log('Checking work_sessions table...');
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase Key exists:', !!supabaseKey);
  
  try {
    const { data, error } = await supabase
      .from('work_sessions')
      .select('id')
      .limit(1);
      
    if (error) {
      console.log('Error:', error.message);
      console.log('Error code:', error.code);
      console.log('Error details:', error.details);
      console.log('Error hint:', error.hint);
    } else {
      console.log('Success! Data:', data);
    }
  } catch (error) {
    console.error('Exception:', error);
  }
}

// Run the check
checkTable()
  .then(() => console.log('Check completed'))
  .catch(err => console.error('Check failed:', err)); 