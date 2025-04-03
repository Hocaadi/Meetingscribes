const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function describeSchema() {
  console.log('Querying work_sessions table schema...');
  
  try {
    // Execute raw SQL to get table schema
    const { data, error } = await supabase.rpc('describe_table', { 
      table_name: 'work_sessions'
    });
    
    if (error) {
      console.log('Error:', error.message);
      
      // Try direct schema query
      const { data: columnsData, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_name', 'work_sessions');
        
      if (columnsError) {
        console.log('Second attempt error:', columnsError.message);
        return;
      }
      
      console.log('Columns found:', columnsData);
    } else {
      console.log('Schema found:', data);
    }
  } catch (error) {
    console.error('Exception:', error);
  }
}

// Run the query
describeSchema()
  .then(() => console.log('Schema query completed'))
  .catch(err => console.error('Schema query failed:', err)); 