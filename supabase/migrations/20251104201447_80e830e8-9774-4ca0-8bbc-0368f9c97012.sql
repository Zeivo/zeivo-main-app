
-- Unschedule existing job if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'update-prices-every-30-minutes') THEN
    PERFORM cron.unschedule('update-prices-every-30-minutes');
  END IF;
END $$;

-- Schedule price updates every 30 minutes
SELECT cron.schedule(
  'update-prices-every-30-minutes',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yfutdebllhsawqzihysx.supabase.co/functions/v1/update-prices',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmdXRkZWJsbGhzYXdxemloeXN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwNjQ1NzAsImV4cCI6MjA3NzY0MDU3MH0.A_opATJ892wHMlN0eZPkH9DwYnzjpkPf5aL-HcGRv94"}'::jsonb,
    body := concat('{"triggered_at": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);
