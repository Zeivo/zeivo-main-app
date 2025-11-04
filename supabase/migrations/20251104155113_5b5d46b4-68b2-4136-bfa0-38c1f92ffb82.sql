-- Fix ai_jobs table RLS to restrict to admin-only access
-- Remove the public policy
DROP POLICY IF EXISTS "AI jobs are viewable by everyone" ON ai_jobs;

-- Add admin-only SELECT policy
CREATE POLICY "Admins can view AI jobs"
  ON ai_jobs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add admin-only INSERT policy
CREATE POLICY "Admins can insert AI jobs"
  ON ai_jobs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add admin-only UPDATE policy
CREATE POLICY "Admins can update AI jobs"
  ON ai_jobs FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add admin-only DELETE policy
CREATE POLICY "Admins can delete AI jobs"
  ON ai_jobs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));