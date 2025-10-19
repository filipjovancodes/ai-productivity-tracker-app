-- Add secure functions for editing and deleting activities

-- Function to update an activity (secure RPC) - expanded version for editing
CREATE OR REPLACE FUNCTION public.edit_n8n_activity(
  p_activity_id uuid,
  p_activity_name text DEFAULT NULL,
  p_started_at timestamptz DEFAULT NULL,
  p_ended_at timestamptz DEFAULT NULL,
  p_duration_minutes integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_activity_id uuid;
BEGIN
  -- Update the activity with provided fields
  UPDATE public.activities 
  SET 
    activity_name = COALESCE(p_activity_name, activity_name),
    started_at = COALESCE(p_started_at, started_at),
    ended_at = COALESCE(p_ended_at, ended_at),
    duration_minutes = COALESCE(p_duration_minutes, duration_minutes),
    updated_at = now()
  WHERE id = p_activity_id
  RETURNING id INTO updated_activity_id;
  
  IF updated_activity_id IS NULL THEN
    RAISE EXCEPTION 'Activity not found or access denied';
  END IF;
  
  RETURN updated_activity_id;
END;
$$;

-- Function to delete an activity (secure RPC)
CREATE OR REPLACE FUNCTION public.delete_n8n_activity(
  p_activity_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete the activity
  DELETE FROM public.activities 
  WHERE id = p_activity_id;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  IF deleted_count = 0 THEN
    RAISE EXCEPTION 'Activity not found or access denied';
  END IF;
  
  RETURN true;
END;
$$;

-- Function to get activity details for editing
CREATE OR REPLACE FUNCTION public.get_n8n_activity(
  p_activity_id uuid
)
RETURNS TABLE(
  id uuid,
  activity_name text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_minutes integer,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.activity_name,
    a.started_at,
    a.ended_at,
    a.duration_minutes,
    a.created_at,
    a.updated_at
  FROM public.activities a
  WHERE a.id = p_activity_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activity not found or access denied';
  END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.edit_n8n_activity TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_n8n_activity TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_n8n_activity TO authenticated;
