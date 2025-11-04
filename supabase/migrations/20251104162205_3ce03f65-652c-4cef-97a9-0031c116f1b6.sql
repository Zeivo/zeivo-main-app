-- Enable required extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create cron job to process AI jobs every 5 minutes
SELECT cron.schedule(
  'process-ai-jobs-every-5-minutes',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://yfutdebllhsawqzihysx.supabase.co/functions/v1/ai-worker',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmdXRkZWJsbGhzYXdxemloeXN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwNjQ1NzAsImV4cCI6MjA3NzY0MDU3MH0.A_opATJ892wHMlN0eZPkH9DwYnzjpkPf5aL-HcGRv94"}'::jsonb,
        body:='{"time": "' || now()::text || '"}'::jsonb
    ) as request_id;
  $$
);