-- Add RLS policy for ai_cache
CREATE POLICY "AI cache viewable by everyone" ON public.ai_cache FOR SELECT USING (true);