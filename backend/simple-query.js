const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkIsActiveField() {
  console.log('Checking if work_sessions table has is_active field...');
  
  try {
    // Try to use SQL to query for the is_active column
    const { data, error } = await supabase
      .from('work_sessions')
      .select('id, status')
      .limit(1);
    
    if (error) {
      console.log('Error querying work_sessions:', error.message);
      return;
    }
    
    console.log('Available fields in result:', Object.keys(data[0] || {}));
    
    // Try another query with the Status field
    console.log('\nChecking work_sessions with Status="active" filter...');
    const { data: activeData, error: activeError } = await supabase
      .from('work_sessions')
      .select('id, status')
      .eq('status', 'active')
      .limit(1);
      
    if (activeError) {
      console.log('Error querying active sessions:', activeError.message);
    } else {
      console.log('Sessions with status=active:', activeData);
    }
    
    // Check with is_active field if it exists
    console.log('\nChecking work_sessions with is_active filter...');
    const { data: isActiveData, error: isActiveError } = await supabase
      .from('work_sessions')
      .select('id, status')
      .eq('is_active', true)
      .limit(1);
      
    if (isActiveError) {
      console.log('Error querying is_active sessions:', isActiveError.message);
    } else {
      console.log('Sessions with is_active=true:', isActiveData);
    }
  } catch (error) {
    console.error('Exception:', error);
  }
}

// Run the check
checkIsActiveField()
  .then(() => console.log('\nCheck completed'))
  .catch(err => console.error('\nCheck failed:', err)); 