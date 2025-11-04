-- Update insert_n8n_message function to support role, source, and confirmation_state parameters

-- Drop the existing function
DROP FUNCTION IF EXISTS public.insert_n8n_message(uuid, text, uuid, jsonb);
DROP FUNCTION IF EXISTS public.insert_n8n_message(uuid, text, uuid, text, text, jsonb);
DROP FUNCTION IF EXISTS public.insert_n8n_message(uuid, text, uuid, text, text, jsonb, text);

-- Create updated function with role, source, and confirmation_state parameters
CREATE OR REPLACE FUNCTION public.insert_n8n_message(
  p_user_id uuid,
  p_content text,
  p_activity_id uuid DEFAULT NULL,
  p_role text DEFAULT 'assistant',
  p_source text DEFAULT 'n8n',
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_confirmation_state text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  message_id uuid;
BEGIN
  INSERT INTO public.messages (
    user_id,
    activity_id,
    role,
    content,
    source,
    metadata,
    confirmation_state
  ) VALUES (
    p_user_id,
    p_activity_id,
    p_role,
    p_content,
    p_source,
    p_metadata,
    p_confirmation_state
  ) RETURNING id INTO message_id;
  
  RETURN message_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.insert_n8n_message TO authenticated;
