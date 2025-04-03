import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with public anon key (safe to use in browser)
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://pdrvzkrynsobxwpuvazt.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcnZ6a3J5bnNvYnh3cHV2YXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA3NjY0MTIsImV4cCI6MjA1NjM0MjQxMn0.d9pdoQbfCCrCccG4CwLJEnDnGo-gGwfVzyrgwHbc8dE';

if (!process.env.REACT_APP_SUPABASE_URL || !process.env.REACT_APP_SUPABASE_ANON_KEY) {
  console.log('Using hardcoded Supabase credentials as fallback');
}

// Create Supabase client with proper authentication headers
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    autoRefreshToken: true
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`
    }
  },
  db: {
    schema: 'public'
  }
});

// Add request debugging to help diagnose API issues
const originalFrom = supabase.from.bind(supabase);
supabase.from = (table) => {
  console.log(`Supabase: Accessing table '${table}'`);
  
  const query = originalFrom(table);
  const originalSelect = query.select.bind(query);
  
  query.select = (...args) => {
    console.log(`Supabase: SELECT from '${table}', columns:`, args);
    return originalSelect(...args);
  };
  
  return query;
};

// Log Supabase initialization
console.log('Supabase client initialized with URL:', supabaseUrl);
console.log('Auth state:', supabase.auth.session ? 'Authenticated' : 'Not authenticated');

export default supabase; 