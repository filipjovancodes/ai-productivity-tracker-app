-- Fix RLS policy for activities table to allow n8n system inserts

-- Create a service role function for n8n to insert activities
CREATE OR REPLACE FUNCTION public.insert_n8n_activity(
  p_user_id uuid,
  p_activity_name text,
  p_started_at timestamptz DEFAULT now(),
  p_ended_at timestamptz DEFAULT NULL,
  p_duration_minutes integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  activity_id uuid;
BEGIN
  INSERT INTO public.activities (
    user_id,
    activity_name,
    started_at,
    ended_at,
    duration_minutes
  ) VALUES (
    p_user_id,
    p_activity_name,
    p_started_at,
    p_ended_at,
    p_duration_minutes
  ) RETURNING id INTO activity_id;
  
  RETURN activity_id;
END;
$$;

-- Create function to update activity (for stopping)
CREATE OR REPLACE FUNCTION public.update_n8n_activity(
  p_activity_id uuid,
  p_ended_at timestamptz,
  p_duration_minutes integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.activities 
  SET 
    ended_at = p_ended_at,
    duration_minutes = p_duration_minutes,
    updated_at = now()
  WHERE id = p_activity_id;
  
  RETURN FOUND;
END;
$$;

-- Create function to stop current activity for user
CREATE OR REPLACE FUNCTION public.stop_current_n8n_activity(
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  activity_id uuid;
  started_at_time timestamptz;
  duration_mins integer;
BEGIN
  -- Get current activity
  SELECT id, started_at INTO activity_id, started_at_time
  FROM public.activities
  WHERE user_id = p_user_id AND ended_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;
  
  -- If no current activity, return NULL
  IF activity_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Calculate duration
  duration_mins := EXTRACT(EPOCH FROM (now() - started_at_time)) / 60;
  
  -- Update the activity
  UPDATE public.activities 
  SET 
    ended_at = now(),
    duration_minutes = duration_mins,
    updated_at = now()
  WHERE id = activity_id;
  
  RETURN activity_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.insert_n8n_activity TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_n8n_activity TO authenticated;
GRANT EXECUTE ON FUNCTION public.stop_current_n8n_activity TO authenticated;
