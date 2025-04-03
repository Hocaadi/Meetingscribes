const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { supabase } = require('./supabaseClient');

// This script will verify Supabase connection and display the SQL to set up tables
async function setupSupabase() {
  try {
    console.log('Verifying Supabase connection...');
    
    // Test connection by retrieving service status
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error connecting to Supabase:', error);
        console.log('Please check your credentials and try again.');
        return;
      }
      
      console.log('Successfully connected to Supabase!');
    } catch (connError) {
      console.error('Connection test failed:', connError);
      console.log('Please check your credentials and try again.');
      return;
    }
    
    // Read the SQL schema file
    const schemaPath = path.join(__dirname, 'supabase_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = schemaSql
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);
    
    console.log(`\n===== SQL SCHEMA FOR SUPABASE =====`);
    console.log(`Found ${statements.length} SQL statements to execute.`);
    console.log(`\nTo set up your Supabase database, please follow these steps:`);
    console.log(`1. Log in to your Supabase dashboard at https://app.supabase.com/`);
    console.log(`2. Navigate to your project: https://app.supabase.com/project/pdrvzkrynsobxwpuvazt`);
    console.log(`3. Go to the SQL Editor`);
    console.log(`4. Create a new query and paste the following SQL:`);
    console.log(`\n${schemaSql}`);
    console.log(`\n5. Click "Run" to execute the SQL and set up your database`);
    
    // Attempt to verify if tables exist already
    console.log('\nChecking if tables already exist in your Supabase project...');
    
    try {
      // Try to query the subscriptions table
      const { data: subscriptions, error: subsError } = await supabase
        .from('subscriptions')
        .select('count')
        .limit(1);
        
      if (!subsError) {
        console.log('✅ Subscriptions table already exists!');
      } else {
        console.log('❌ Subscriptions table does not exist yet (this is expected if you haven\'t run the SQL)');
      }
      
      // Try to query the usage_logs table
      const { data: usageLogs, error: usageError } = await supabase
        .from('usage_logs')
        .select('count')
        .limit(1);
        
      if (!usageError) {
        console.log('✅ Usage logs table already exists!');
      } else {
        console.log('❌ Usage logs table does not exist yet (this is expected if you haven\'t run the SQL)');
      }
      
      // Try to query the transactions table
      const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select('count')
        .limit(1);
        
      if (!transError) {
        console.log('✅ Transactions table already exists!');
      } else {
        console.log('❌ Transactions table does not exist yet (this is expected if you haven\'t run the SQL)');
      }
      
    } catch (verifyError) {
      console.error('Error verifying tables:', verifyError);
    }
    
  } catch (error) {
    console.error('Error in setup process:', error);
  }
}

// Run the setup
setupSupabase()
  .then(() => {
    console.log('\nSetup process completed. Please run the SQL in your Supabase dashboard to complete the setup.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Setup process failed:', err);
    process.exit(1);
  }); 