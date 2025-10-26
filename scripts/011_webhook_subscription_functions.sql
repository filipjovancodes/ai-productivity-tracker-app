-- Add unique constraint on user_id if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_subscriptions_user_id_key'
    ) THEN
        ALTER TABLE public.user_subscriptions 
        ADD CONSTRAINT user_subscriptions_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- Create function to create subscription from webhook (bypasses RLS)
CREATE OR REPLACE FUNCTION public.create_subscription_from_webhook(
  p_user_id uuid,
  p_plan_type text,
  p_status text,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  -- Insert or update subscription
  -- First try to update existing subscription
  UPDATE public.user_subscriptions SET
    plan_type = p_plan_type,
    status = p_status,
    stripe_customer_id = p_stripe_customer_id,
    stripe_subscription_id = p_stripe_subscription_id,
    current_period_start = p_current_period_start,
    current_period_end = p_current_period_end,
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING to_json(user_subscriptions.*) INTO result;
  
  -- If no rows were updated, insert new subscription
  IF NOT FOUND THEN
    INSERT INTO public.user_subscriptions (
      user_id,
      plan_type,
      status,
      stripe_customer_id,
      stripe_subscription_id,
      current_period_start,
      current_period_end
    ) VALUES (
      p_user_id,
      p_plan_type,
      p_status,
      p_stripe_customer_id,
      p_stripe_subscription_id,
      p_current_period_start,
      p_current_period_end
    )
    RETURNING to_json(user_subscriptions.*) INTO result;
  END IF;
  
  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_subscription_from_webhook TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_subscription_from_webhook TO anon;
