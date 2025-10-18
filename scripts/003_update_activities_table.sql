-- Update activities table to better support n8n workflow actions
-- This script adds any missing columns and ensures proper indexing

-- Add any missing columns (these should already exist from 001_create_activities_table.sql)
-- but adding them here for safety with IF NOT EXISTS logic

-- Ensure the table structure is correct
DO $$ 
BEGIN
    -- Add duration_minutes column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'activities' AND column_name = 'duration_minutes') THEN
        ALTER TABLE public.activities ADD COLUMN duration_minutes integer;
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'activities' AND column_name = 'updated_at') THEN
        ALTER TABLE public.activities ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
    END IF;
END $$;

-- Create additional indexes for better performance with n8n queries
CREATE INDEX IF NOT EXISTS activities_user_id_ended_at_idx ON public.activities(user_id, ended_at);
CREATE INDEX IF NOT EXISTS activities_activity_name_idx ON public.activities(activity_name);
CREATE INDEX IF NOT EXISTS activities_duration_minutes_idx ON public.activities(duration_minutes);

-- Add a function to automatically calculate duration when ending an activity
CREATE OR REPLACE FUNCTION public.calculate_activity_duration()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only calculate duration if ended_at is being set and duration_minutes is null
  IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL AND NEW.duration_minutes IS NULL THEN
    NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at)) / 60;
  END IF;
  
  -- Update the updated_at timestamp
  NEW.updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically calculate duration
DROP TRIGGER IF EXISTS activities_calculate_duration ON public.activities;
CREATE TRIGGER activities_calculate_duration
  BEFORE UPDATE ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_activity_duration();

-- Add a view for easy querying of current activities
CREATE OR REPLACE VIEW public.current_activities AS
SELECT 
  id,
  user_id,
  activity_name,
  started_at,
  EXTRACT(EPOCH FROM (now() - started_at)) / 60 as current_duration_minutes,
  created_at,
  updated_at
FROM public.activities
WHERE ended_at IS NULL;

-- Grant permissions for the view
GRANT SELECT ON public.current_activities TO authenticated;
