-- Secure the current_activities view by replacing it with a secure function
-- This prevents exposing user IDs and activity IDs directly

-- Drop the existing view
DROP VIEW IF EXISTS public.current_activities;

-- Create a secure function to get current activities
-- This function automatically filters by the authenticated user
CREATE OR REPLACE FUNCTION public.get_current_activities()
RETURNS TABLE (
  id uuid,
  activity_name text,
  started_at timestamptz,
  current_duration_minutes numeric,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only return activities for the authenticated user
  RETURN QUERY
  SELECT 
    a.id,
    a.activity_name,
    a.started_at,
    EXTRACT(EPOCH FROM (now() - a.started_at)) / 60 as current_duration_minutes,
    a.created_at,
    a.updated_at
  FROM public.activities a
  WHERE a.user_id = auth.uid() 
    AND a.ended_at IS NULL
  ORDER BY a.started_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_current_activities() TO authenticated;

-- Create a function to get a single current activity (for the display component)
CREATE OR REPLACE FUNCTION public.get_current_activity()
RETURNS TABLE (
  id uuid,
  activity_name text,
  started_at timestamptz,
  current_duration_minutes numeric,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only return the most recent activity for the authenticated user
  RETURN QUERY
  SELECT 
    a.id,
    a.activity_name,
    a.started_at,
    EXTRACT(EPOCH FROM (now() - a.started_at)) / 60 as current_duration_minutes,
    a.created_at,
    a.updated_at
  FROM public.activities a
  WHERE a.user_id = auth.uid() 
    AND a.ended_at IS NULL
  ORDER BY a.started_at DESC
  LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_current_activity() TO authenticated;
