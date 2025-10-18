-- Fix RLS policy for messages table to allow n8n system inserts

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
DROP POLICY IF EXISTS "System can insert messages for users" ON public.messages;

-- Recreate policies with better system support
CREATE POLICY "Users can view their own messages"
  ON public.messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow system to insert messages (for n8n responses)
-- This policy allows inserts when there's no authenticated user (system calls)
CREATE POLICY "System can insert messages for users"
  ON public.messages FOR INSERT
  WITH CHECK (
    -- Allow if user is authenticated and matches user_id
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
    -- Allow if no user is authenticated (system calls like n8n)
    (auth.uid() IS NULL)
  );

-- Alternative approach: Create a service role function for n8n
-- This is more secure for production use
CREATE OR REPLACE FUNCTION public.insert_n8n_message(
  p_user_id uuid,
  p_content text,
  p_activity_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
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
    metadata
  ) VALUES (
    p_user_id,
    p_activity_id,
    'assistant',
    p_content,
    'n8n',
    p_metadata
  ) RETURNING id INTO message_id;
  
  RETURN message_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.insert_n8n_message TO authenticated;
