-- Create subscription system for monetization
-- This script adds user subscriptions, usage tracking, and billing

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type text NOT NULL CHECK (plan_type IN ('free', 'pro', 'premium')),
  status text NOT NULL CHECK (status IN ('active', 'cancelled', 'expired', 'trial')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create usage_tracking table
CREATE TABLE IF NOT EXISTS public.usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_type text NOT NULL CHECK (usage_type IN ('ai_message', 'api_call', 'export')),
  usage_count integer NOT NULL DEFAULT 1,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON public.user_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON public.user_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for usage_tracking
CREATE POLICY "Users can view their own usage"
  ON public.usage_tracking FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage"
  ON public.usage_tracking FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS user_subscriptions_user_id_idx ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS user_subscriptions_status_idx ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS usage_tracking_user_id_date_idx ON public.usage_tracking(user_id, usage_date);
CREATE INDEX IF NOT EXISTS usage_tracking_type_date_idx ON public.usage_tracking(usage_type, usage_date);

-- Create function to get user's current subscription
CREATE OR REPLACE FUNCTION public.get_user_subscription(p_user_id uuid)
RETURNS TABLE (
  plan_type text,
  status text,
  current_period_end timestamptz,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.plan_type,
    us.status,
    us.current_period_end,
    (us.status = 'active' AND (us.current_period_end IS NULL OR us.current_period_end > now()))
  FROM public.user_subscriptions us
  WHERE us.user_id = p_user_id
  ORDER BY us.created_at DESC
  LIMIT 1;
END;
$$;

-- Create function to get user's monthly usage
CREATE OR REPLACE FUNCTION public.get_user_monthly_usage(p_user_id uuid, p_usage_type text DEFAULT 'ai_message')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  usage_count integer;
BEGIN
  SELECT COALESCE(SUM(ut.usage_count), 0) INTO usage_count
  FROM public.usage_tracking ut
  WHERE ut.user_id = p_user_id
    AND ut.usage_type = p_usage_type
    AND ut.usage_date >= date_trunc('month', CURRENT_DATE)
    AND ut.usage_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';
  
  RETURN usage_count;
END;
$$;

-- Create function to track usage
CREATE OR REPLACE FUNCTION public.track_usage(
  p_user_id uuid,
  p_usage_type text,
  p_count integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.usage_tracking (user_id, usage_type, usage_count, usage_date)
  VALUES (p_user_id, p_usage_type, p_count, CURRENT_DATE)
  ON CONFLICT (user_id, usage_type, usage_date) 
  DO UPDATE SET 
    usage_count = usage_tracking.usage_count + p_count,
    created_at = now();
  
  RETURN TRUE;
END;
$$;

-- Create function to check if user can make AI request
CREATE OR REPLACE FUNCTION public.can_make_ai_request(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_plan text;
  user_status text;
  is_active boolean;
  monthly_usage integer;
  usage_limit integer;
BEGIN
  -- Get user's subscription
  SELECT plan_type, status, (status = 'active' AND (current_period_end IS NULL OR current_period_end > now()))
  INTO user_plan, user_status, is_active
  FROM public.user_subscriptions
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If no subscription found, treat as free tier
  IF user_plan IS NULL THEN
    user_plan := 'free';
    is_active := true;
  END IF;
  
  -- Check if subscription is active
  IF NOT is_active THEN
    RETURN FALSE;
  END IF;
  
  -- Get usage limits based on plan
  usage_limit := CASE 
    WHEN user_plan = 'free' THEN 30
    WHEN user_plan = 'pro' THEN 1000
    WHEN user_plan = 'premium' THEN 10000
    ELSE 0
  END;
  
  -- Get current monthly usage
  monthly_usage := public.get_user_monthly_usage(p_user_id, 'ai_message');
  
  -- Check if user has exceeded limit
  RETURN monthly_usage < usage_limit;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_user_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_monthly_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_make_ai_request TO authenticated;

-- Create unique constraint for usage tracking per day
CREATE UNIQUE INDEX IF NOT EXISTS usage_tracking_user_type_date_unique 
ON public.usage_tracking(user_id, usage_type, usage_date);
