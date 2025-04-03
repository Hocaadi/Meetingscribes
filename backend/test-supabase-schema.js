const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log('Starting Supabase schema test...');
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Supabase Key: ${supabaseKey ? 'Key found (hidden for security)' : 'Key not found!'}`);

  try {
    // Check if the tables exist
    console.log('\nChecking if required tables exist...');
    
    // Check for profiles table
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
      
    if (profilesError) {
      console.log('❌ profiles table does not exist or cannot be accessed');
      console.log(`Error: ${profilesError.message}`);
    } else {
      console.log('✅ profiles table exists and can be accessed');
    }
    
    // Check for tasks table
    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select('id')
      .limit(1);
      
    if (tasksError) {
      console.log('❌ tasks table does not exist or cannot be accessed');
      console.log(`Error: ${tasksError.message}`);
    } else {
      console.log('✅ tasks table exists and can be accessed');
    }
    
    // Check for work_sessions table
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('work_sessions')
      .select('id')
      .limit(1);
      
    if (sessionsError) {
      console.log('❌ work_sessions table does not exist or cannot be accessed');
      console.log(`Error: ${sessionsError.message}`);
    } else {
      console.log('✅ work_sessions table exists and can be accessed');
    }
    
    // Check for accomplishments table
    const { data: accomplishmentsData, error: accomplishmentsError } = await supabase
      .from('accomplishments')
      .select('id')
      .limit(1);
      
    if (accomplishmentsError) {
      console.log('❌ accomplishments table does not exist or cannot be accessed');
      console.log(`Error: ${accomplishmentsError.message}`);
    } else {
      console.log('✅ accomplishments table exists and can be accessed');
    }
    
    // Check for status_reports table
    const { data: reportsData, error: reportsError } = await supabase
      .from('status_reports')
      .select('id')
      .limit(1);
      
    if (reportsError) {
      console.log('❌ status_reports table does not exist or cannot be accessed');
      console.log(`Error: ${reportsError.message}`);
    } else {
      console.log('✅ status_reports table exists and can be accessed');
    }
    
    // If tables don't exist, suggest running the SQL script
    if (profilesError || tasksError || sessionsError || accomplishmentsError || reportsError) {
      console.log('\n⚠️ Some required tables are missing. You need to run the SQL scripts to create them.');
      console.log('Instructions:');
      console.log('1. Go to https://app.supabase.io/ and sign in');
      console.log(`2. Open your project: ${supabaseUrl}`);
      console.log('3. Go to the SQL Editor');
      console.log('4. First run the script: supabase_schema_setup.sql');
      console.log('5. Then run the script: work_progress_schema.sql');
      
      // Option to create a temporary user for testing
      console.log('\nCreating a temporary dev profile for testing purposes...');
      try {
        const { data: devProfile, error: devProfileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: '00000000-0000-0000-0000-000000000000',
              first_name: 'Development',
              last_name: 'User',
              email: 'dev@example.com',
              is_premium: true
            }
          ])
          .select();
          
        if (devProfileError) {
          console.log(`❌ Failed to create dev profile: ${devProfileError.message}`);
        } else {
          console.log('✅ Created temporary dev profile for testing');
        }
      } catch (devError) {
        console.log(`❌ Exception creating dev profile: ${devError.message}`);
      }
    } else {
      console.log('\n✅ All required tables exist!');
      
      // Get count of tasks for the current user
      console.log('\nGetting task count...');
      const { data: taskCountData, error: taskCountError } = await supabase
        .from('tasks')
        .select('id', { count: 'exact' });
        
      if (taskCountError) {
        console.log(`❌ Error fetching task count: ${taskCountError.message}`);
      } else {
        console.log(`✅ Found ${taskCountData.length} tasks in the database`);
      }
    }
    
  } catch (error) {
    console.error('Error testing Supabase schema:', error);
  }
}

// Run the test
runTest()
  .then(() => console.log('\nTest completed'))
  .catch(err => console.error('\nTest failed:', err)); 