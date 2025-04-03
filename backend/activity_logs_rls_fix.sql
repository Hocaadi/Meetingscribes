-- First ensure the activity_logs table exists
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    session_id UUID REFERENCES public.work_sessions(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    activity_type TEXT DEFAULT 'work',
    description TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can insert own activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can update own activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can delete own activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Service role can do all" ON public.activity_logs;

-- Create RLS policies
-- 1. Allow users to view their own activity logs
CREATE POLICY "Users can view own activity logs" 
ON public.activity_logs 
FOR SELECT 
USING (auth.uid() = user_id);

-- 2. Allow users to create their own activity logs
CREATE POLICY "Users can insert own activity logs" 
ON public.activity_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 3. Allow users to update their own activity logs
CREATE POLICY "Users can update own activity logs" 
ON public.activity_logs 
FOR UPDATE 
USING (auth.uid() = user_id);

-- 4. Allow users to delete their own activity logs
CREATE POLICY "Users can delete own activity logs" 
ON public.activity_logs 
FOR DELETE 
USING (auth.uid() = user_id);

-- 5. Allow service role to access all activity logs
CREATE POLICY "Service role can do all"
ON public.activity_logs
USING (auth.role() = 'service_role');

-- Create function to calculate duration when activity ends
CREATE OR REPLACE FUNCTION public.calculate_activity_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.end_time IS NOT NULL AND OLD.end_time IS NULL THEN
        NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calc_activity_duration ON public.activity_logs;

CREATE TRIGGER calc_activity_duration
BEFORE UPDATE ON public.activity_logs
FOR EACH ROW
EXECUTE FUNCTION public.calculate_activity_duration(); 