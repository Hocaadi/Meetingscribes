const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');

// Load environment variables
dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking work_sessions table schema...');
  
  try {
    // First get a user ID from the auth.users table
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.log('Error getting users:', userError.message);
      return;
    }
    
    if (!userData || userData.users.length === 0) {
      console.log('No users found in the database');
      // Create a mock user ID
      const mockUserId = uuidv4();
      console.log('Using mock user ID:', mockUserId);
      
      // Check schema by inserting and then selecting a test record
      const testSessionId = uuidv4();
      
      // Insert a test record
      const { data: insertData, error: insertError } = await supabase
        .from('work_sessions')
        .insert([{
          id: testSessionId,
          user_id: mockUserId,
          status: 'active',
          start_time: new Date().toISOString()
        }])
        .select('*');
        
      if (insertError) {
        console.log('Insert error:', insertError.message);
        return;
      }
      
      console.log('Test record inserted. Schema:');
      const record = insertData[0];
      
      // Print all columns and their values
      for (const [key, value] of Object.entries(record)) {
        console.log(`${key}: ${value} (${typeof value})`);
      }
      
      // Delete the test record
      const { error: deleteError } = await supabase
        .from('work_sessions')
        .delete()
        .eq('id', testSessionId);
        
      if (deleteError) {
        console.log('Delete error:', deleteError.message);
      } else {
        console.log('Test record deleted successfully');
      }
    } else {
      // Use the first real user ID
      const userId = userData.users[0].id;
      console.log('Using real user ID:', userId);
      
      // Check schema by inserting and then selecting a test record
      const testSessionId = uuidv4();
      
      // Insert a test record
      const { data: insertData, error: insertError } = await supabase
        .from('work_sessions')
        .insert([{
          id: testSessionId,
          user_id: userId,
          status: 'active',
          start_time: new Date().toISOString()
        }])
        .select('*');
        
      if (insertError) {
        console.log('Insert error:', insertError.message);
        return;
      }
      
      console.log('Test record inserted. Schema:');
      const record = insertData[0];
      
      // Print all columns and their values
      for (const [key, value] of Object.entries(record)) {
        console.log(`${key}: ${value} (${typeof value})`);
      }
      
      // Delete the test record
      const { error: deleteError } = await supabase
        .from('work_sessions')
        .delete()
        .eq('id', testSessionId);
        
      if (deleteError) {
        console.log('Delete error:', deleteError.message);
      } else {
        console.log('Test record deleted successfully');
      }
    }
  } catch (error) {
    console.error('Exception:', error);
  }
}

// Run the check
checkSchema()
  .then(() => console.log('Schema check completed'))
  .catch(err => console.error('Schema check failed:', err)); 