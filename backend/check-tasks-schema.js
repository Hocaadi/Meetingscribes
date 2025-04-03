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

async function checkTasksSchema() {
  console.log('Checking tasks table schema...');
  
  try {
    // Try to select from the tasks table
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('Error querying tasks table:', error.message);
      console.log('Error code:', error.code);
      console.log('Error details:', error.details);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('Tasks table exists with sample data:');
      console.log(JSON.stringify(data[0], null, 2));
      
      // Print schema based on the fields in the sample record
      console.log('\nTasks table schema (based on sample record):');
      const columns = Object.keys(data[0]);
      columns.forEach(column => {
        const value = data[0][column];
        const type = typeof value;
        console.log(`${column}: ${type} (sample: ${JSON.stringify(value)})`);
      });
    } else {
      console.log('Tasks table exists but has no records. Creating a test record...');
      
      // Create a test record
      const { data: userData } = await supabase.auth.admin.listUsers();
      const userId = userData?.users?.[0]?.id || uuidv4(); // Use real user if available
      
      const { data: insertData, error: insertError } = await supabase
        .from('tasks')
        .insert([{
          title: 'Test Task ' + Date.now(),
          description: 'This is a test task for schema verification',
          status: 'not_started',
          priority: 3,
          user_id: userId
        }])
        .select('*');
      
      if (insertError) {
        console.log('Error creating test task:', insertError.message);
        if (insertError.message.includes('user_id')) {
          console.log('Note: There appears to be a user_id requirement for tasks');
        }
        if (insertError.details) {
          console.log('Error details:', insertError.details);
        }
      } else {
        console.log('Test task created. Schema:');
        console.log(JSON.stringify(insertData[0], null, 2));
        
        // Clean up - delete the test record
        await supabase
          .from('tasks')
          .delete()
          .eq('id', insertData[0].id);
          
        console.log('Test task deleted');
      }
    }
    
    // Check RLS policies
    console.log('\nChecking Row Level Security (RLS) policies...');
    
    // This would actually need direct SQL access to pg_policies which isn't available via REST API
    console.log('Note: Please check RLS policies directly in Supabase dashboard');
    console.log('Policies should ensure that users can only access their own tasks');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the check
checkTasksSchema()
  .then(() => console.log('\nTasks schema check completed'))
  .catch(err => console.error('\nTasks schema check failed:', err)); 