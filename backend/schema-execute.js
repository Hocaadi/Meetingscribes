const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Validate configuration
if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or key is missing. Check your .env file.');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Function to execute the SQL script
async function executeSchema() {
  try {
    console.log('Reading SQL schema files...');
    
    // Read the work_progress_schema.sql file
    const workProgressSchemaPath = path.join(__dirname, '..', 'work_progress_schema.sql');
    
    if (!fs.existsSync(workProgressSchemaPath)) {
      console.error(`File not found: ${workProgressSchemaPath}`);
      process.exit(1);
    }
    
    const workProgressSchema = fs.readFileSync(workProgressSchemaPath, 'utf8');
    
    console.log(`\nExecuting work progress schema (${workProgressSchemaPath})...`);
    
    // Execute SQL script in Supabase
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_string: workProgressSchema
    });
    
    if (error) {
      console.error('Error executing SQL schema:', error);
      
      // Try direct REST API approach - Supabase SQL endpoint
      console.log('\nFalling back to direct SQL API call...');
      
      // Split the SQL into smaller chunks (some APIs have limits)
      const statements = workProgressSchema.split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
        
      console.log(`Found ${statements.length} SQL statements to execute.`);
      
      // Execute statements one by one
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        console.log(`\nExecuting statement ${i+1}/${statements.length}...`);
        console.log(`SQL: ${statement.substring(0, 100)}...`);
        
        try {
          // Use built-in Supabase REST API directly
          const response = await fetch(`${supabaseUrl}/rest/v1/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({ query: statement + ';' })
          });
          
          if (!response.ok) {
            console.error(`Failed to execute statement ${i+1}: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error(`Error details: ${text}`);
          } else {
            console.log(`Statement ${i+1} executed successfully`);
          }
        } catch (stmtError) {
          console.error(`Error executing statement ${i+1}:`, stmtError);
        }
      }
    } else {
      console.log('SQL schema executed successfully!');
    }
    
    // Verify table creation
    console.log('\nVerifying table creation...');
    
    const tables = [
      'work_sessions',
      'tasks',
      'activity_logs',
      'accomplishments',
      'status_reports'
    ];
    
    let allTablesCreated = true;
    
    for (const table of tables) {
      const { data: tableData, error: tableError } = await supabase
        .from(table)
        .select('id')
        .limit(1);
        
      if (tableError) {
        console.log(`❌ ${table} table does not exist or cannot be accessed`);
        console.log(`Error: ${tableError.message}`);
        allTablesCreated = false;
      } else {
        console.log(`✅ ${table} table exists and can be accessed`);
      }
    }
    
    if (!allTablesCreated) {
      console.log('\n⚠️ Some tables were not created successfully.');
      console.log('You may need to manually execute the SQL script in the Supabase SQL Editor.');
    } else {
      console.log('\n🎉 All tables created successfully!');
    }
    
    console.log('\nSchema execution completed!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Execute the schema
executeSchema(); 