-- Create a function to help create profiles (bypassing RLS)
-- This is a SECURITY DEFINER function which means it runs with the privileges
-- of the function creator (typically postgres) and can bypass RLS policies

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
  -- Make sure the profiles table exists
  CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );

  -- Insert or update the profile
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

-- Test the function with a sample user (replace with a real user ID from auth.users)
-- SELECT create_profile('00000000-0000-0000-0000-000000000000', 'Test', 'User', 'test@example.com'); 