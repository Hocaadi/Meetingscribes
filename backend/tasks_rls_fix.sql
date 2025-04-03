-- First ensure the tasks table exists
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'not_started',
    priority INTEGER DEFAULT 3,
    estimated_minutes INTEGER,
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    parent_task_id UUID REFERENCES public.tasks(id),
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;

-- Create RLS policies
-- 1. Allow users to view their own tasks
CREATE POLICY "Users can view own tasks" 
ON public.tasks 
FOR SELECT 
USING (auth.uid() = user_id);

-- 2. Allow users to create their own tasks
CREATE POLICY "Users can insert own tasks" 
ON public.tasks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 3. Allow users to update their own tasks
CREATE POLICY "Users can update own tasks" 
ON public.tasks 
FOR UPDATE 
USING (auth.uid() = user_id);

-- 4. Allow users to delete their own tasks
CREATE POLICY "Users can delete own tasks" 
ON public.tasks 
FOR DELETE 
USING (auth.uid() = user_id);

-- 5. Allow service role to access all tasks
CREATE POLICY "Service role can do all"
ON public.tasks
USING (auth.role() = 'service_role');

-- Add an updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;

CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column(); 