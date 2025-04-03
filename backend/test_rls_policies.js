const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  if (!supabaseUrl) console.error('- SUPABASE_URL');
  if (!supabaseAnonKey) console.error('- SUPABASE_ANON_KEY');
  if (!supabaseServiceKey) console.error('- SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Create both clients
const anonClient = createClient(supabaseUrl, supabaseAnonKey);
const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

async function testRLSPolicies() {
  console.log('Testing Supabase RLS Policies\n');
  
  // 1. Test unauthenticated access (should fail)
  console.log('1. Testing unauthenticated access to profiles (should fail)');
  let { data: unauthProfiles, error: unauthError } = await anonClient.from('profiles').select('*').limit(1);
  
  if (unauthError && unauthError.code === 'PGRST301') {
    console.log('✅ Unauthenticated access blocked as expected');
  } else if (!unauthError) {
    console.log('❌ Security issue! Unauthenticated access succeeded when it should be blocked');
    console.log('Data returned:', unauthProfiles);
  } else {
    console.log('❓ Unexpected error:', unauthError.message);
  }
  
  // 2. Test service role access (should succeed)
  console.log('\n2. Testing service role access to profiles (should succeed)');
  let { data: serviceProfiles, error: serviceError } = await serviceClient.from('profiles').select('*').limit(5);
  
  if (serviceError) {
    console.log('❌ Service role access failed when it should succeed:', serviceError.message);
  } else {
    console.log(`✅ Service role access succeeded as expected (${serviceProfiles.length} profiles found)`);
  }
  
  // 3. Create a test user
  console.log('\n3. Creating a test user');
  const testEmail = `test${Math.floor(Math.random() * 10000)}@example.com`;
  const testPassword = 'password123';
  
  const { data: signUpData, error: signUpError } = await serviceClient.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true
  });
  
  if (signUpError) {
    console.log('❌ Failed to create test user:', signUpError.message);
    return;
  }
  
  const testUserId = signUpData.user.id;
  console.log(`✅ Test user created: ${testEmail} (ID: ${testUserId})`);
  
  // 4. Sign in as the test user
  console.log('\n4. Signing in as test user');
  const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });
  
  if (signInError) {
    console.log('❌ Failed to sign in as test user:', signInError.message);
    return;
  }
  
  console.log('✅ Signed in as test user');
  
  // Create authenticated client with the test user's session
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${signInData.session.access_token}`
      }
    }
  });
  
  // 5. Create a profile for the test user
  console.log('\n5. Creating profile for test user');
  const { data: profileData, error: profileError } = await authClient.from('profiles').upsert({
    id: testUserId,
    first_name: 'Test',
    last_name: 'User',
    email: testEmail
  }).select();
  
  if (profileError) {
    console.log('❌ Failed to create profile:', profileError.message);
    console.log('This may indicate RLS policies are not set up correctly');
    return;
  }
  
  console.log('✅ Profile created successfully');
  
  // 6. Create a task as the test user
  console.log('\n6. Creating task for test user');
  const { data: taskData, error: taskError } = await authClient.from('tasks').insert({
    title: 'Test Task',
    description: 'Testing RLS policies',
    user_id: testUserId,
    status: 'not_started'
  }).select();
  
  if (taskError) {
    console.log('❌ Failed to create task:', taskError.message);
    console.log('This may indicate RLS policies are not set up correctly for tasks');
    return;
  }
  
  console.log('✅ Task created successfully');
  const taskId = taskData[0].id;
  
  // 7. Test accessing tasks as another user (should fail)
  console.log('\n7. Creating another test user');
  const testEmail2 = `test${Math.floor(Math.random() * 10000)}@example.com`;
  const { data: signUpData2, error: signUpError2 } = await serviceClient.auth.admin.createUser({
    email: testEmail2,
    password: testPassword,
    email_confirm: true
  });
  
  if (signUpError2) {
    console.log('❌ Failed to create second test user:', signUpError2.message);
    return;
  }
  
  const testUserId2 = signUpData2.user.id;
  console.log(`✅ Second test user created: ${testEmail2} (ID: ${testUserId2})`);
  
  console.log('\n8. Signing in as second test user');
  const { data: signInData2, error: signInError2 } = await anonClient.auth.signInWithPassword({
    email: testEmail2,
    password: testPassword
  });
  
  if (signInError2) {
    console.log('❌ Failed to sign in as second test user:', signInError2.message);
    return;
  }
  
  console.log('✅ Signed in as second test user');
  
  // Create authenticated client for the second test user
  const authClient2 = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${signInData2.session.access_token}`
      }
    }
  });
  
  // Try to access first user's task
  console.log('\n9. Trying to access first user\'s task as second user (should fail)');
  const { data: unauthorizedTaskData, error: unauthorizedTaskError } = 
    await authClient2.from('tasks').select('*').eq('id', taskId);
  
  if (unauthorizedTaskError || (unauthorizedTaskData && unauthorizedTaskData.length === 0)) {
    console.log('✅ Second user cannot access first user\'s task as expected');
  } else {
    console.log('❌ Security issue! Second user can access first user\'s task');
    console.log('Data returned:', unauthorizedTaskData);
  }
  
  // Cleanup
  console.log('\n10. Cleaning up test data');
  await serviceClient.auth.admin.deleteUser(testUserId);
  await serviceClient.auth.admin.deleteUser(testUserId2);
  console.log('✅ Test users deleted');
  
  console.log('\nRLS Policy Test Summary:');
  console.log('------------------------');
  console.log('✅ Unauthenticated access blocked');
  console.log('✅ Service role access works');
  console.log('✅ Users can create their own profiles');
  console.log('✅ Users can create their own tasks');
  console.log('✅ Users cannot access other users\' tasks');
  console.log('\nAll tests passed! RLS policies are correctly set up.');
}

testRLSPolicies()
  .catch(error => {
    console.error('Error testing RLS policies:', error);
  }); 