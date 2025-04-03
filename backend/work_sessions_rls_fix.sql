-- First ensure the work_sessions table exists
CREATE TABLE IF NOT EXISTS public.work_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    status TEXT DEFAULT 'active',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own work sessions" ON public.work_sessions;
DROP POLICY IF EXISTS "Users can insert own work sessions" ON public.work_sessions;
DROP POLICY IF EXISTS "Users can update own work sessions" ON public.work_sessions;
DROP POLICY IF EXISTS "Users can delete own work sessions" ON public.work_sessions;
DROP POLICY IF EXISTS "Service role can do all" ON public.work_sessions;

-- Create RLS policies
-- 1. Allow users to view their own work sessions
CREATE POLICY "Users can view own work sessions" 
ON public.work_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

-- 2. Allow users to create their own work sessions
CREATE POLICY "Users can insert own work sessions" 
ON public.work_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 3. Allow users to update their own work sessions
CREATE POLICY "Users can update own work sessions" 
ON public.work_sessions 
FOR UPDATE 
USING (auth.uid() = user_id);

-- 4. Allow users to delete their own work sessions
CREATE POLICY "Users can delete own work sessions" 
ON public.work_sessions 
FOR DELETE 
USING (auth.uid() = user_id);

-- 5. Allow service role to access all work sessions
CREATE POLICY "Service role can do all"
ON public.work_sessions
USING (auth.role() = 'service_role');

-- Add an updated_at trigger
CREATE OR REPLACE FUNCTION public.update_work_sessions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    
    -- Calculate duration when session ends
    IF NEW.end_time IS NOT NULL AND OLD.end_time IS NULL THEN
        NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
        NEW.is_active = FALSE;
        NEW.status = 'completed';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_work_sessions_updated_at ON public.work_sessions;

CREATE TRIGGER update_work_sessions_updated_at
BEFORE UPDATE ON public.work_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_work_sessions_timestamp(); 