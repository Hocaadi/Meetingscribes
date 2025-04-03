# Supabase Setup Guide for MeetingScribe Work Tracker

This guide explains how to set up the necessary database tables and Row Level Security (RLS) policies for the Work Tracker module in MeetingScribe.

## Prerequisites

- Supabase account with a project created
- Supabase project URL and API keys (anon key and service role key)

## Step 1: Create SQL Scripts for Tables and RLS Policies

First, we need to create three key SQL scripts that will establish our tables and security policies:

1. `profiles_rls_fix.sql` - Sets up the profiles table and its RLS policies
2. `work_sessions_rls_fix.sql` - Sets up the work_sessions table and its RLS policies
3. `activity_logs_rls_fix.sql` - Sets up the activity_logs table and its RLS policies
4. `tasks_rls_fix.sql` - Sets up the tasks table and its RLS policies

All these scripts are available in the `backend` directory of the project.

## Step 2: Run the SQL Scripts in the Supabase SQL Editor

1. Log in to your Supabase dashboard
2. Select your project
3. Go to the "SQL Editor" section
4. Create a new query for each script
5. Paste the contents of each script into a separate query
6. Run the queries in the following order:
   - `profiles_rls_fix.sql` (first, as other tables reference it)
   - `tasks_rls_fix.sql`
   - `work_sessions_rls_fix.sql`
   - `activity_logs_rls_fix.sql`

## Step 3: Create RPC Function for Profile Creation

Create a new SQL query and add the following function to help with profile creation:

```sql
-- Create a function to help create profiles (bypassing RLS)
CREATE OR REPLACE FUNCTION create_profile(
  user_id UUID,
  first_name TEXT DEFAULT 'User',
  last_name TEXT DEFAULT '',
  email TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email, updated_at)
  VALUES (
    user_id,
    first_name,
    last_name,
    COALESCE(email, ''),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = COALESCE(EXCLUDED.email, profiles.email),
    updated_at = NOW();
END;
$$;
```

## Step 4: Testing the Setup

You can test if your RLS policies are working correctly by running these commands:

1. Test with the anonymous key (should be restricted by RLS):
```sql
-- This should fail with RLS error when using anon key
INSERT INTO work_sessions (user_id, status)
VALUES ('00000000-0000-0000-0000-000000000000', 'active');
```

2. Test with the service role (should work):
```sql
-- This should work with service role
INSERT INTO work_sessions (user_id, status)
VALUES ('00000000-0000-0000-0000-000000000000', 'active');
```

## Common Issues and Solutions

### RLS Errors

If you're seeing "violates row-level security policy" errors:

1. Ensure you've run all SQL scripts properly
2. Check that the user_id in your requests matches the authenticated user's ID
3. Make sure service role access is configured correctly

### Missing Tables

If tables are missing:
1. Check the Supabase SQL editor for error messages
2. Ensure all scripts ran without errors

### Authentication Issues

If authentication is failing:
1. Make sure the user is properly authenticated
2. Check if the profiles table entry exists for the user

## Troubleshooting the Work Tracker

If the Work Tracker shows "Failed to start work session":

1. Check that the user is authenticated
2. Ensure a profile exists for the user (it should be created automatically)
3. Verify RLS policies allow the user to insert into work_sessions
4. Check the browser console for more detailed error messages

For more help, contact the MeetingScribe development team. 