-- Ensure the SELECT policy on price_alerts properly restricts access
-- Drop existing policy if it exists (in case it's misconfigured)
DROP POLICY IF EXISTS "Users can view own alerts" ON public.price_alerts;

-- Create proper SELECT policy to prevent email harvesting
CREATE POLICY "Users can view own alerts" 
ON public.price_alerts 
FOR SELECT 
USING (auth.uid() = user_id);