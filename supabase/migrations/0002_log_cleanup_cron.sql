-- Enable the pg_cron extension
create extension if not exists pg_cron;

-- Schedule a daily job to clean up logs older than 7 days
-- Runs at midnight (00:00) every day
select cron.schedule(
  'cleanup-old-logs',
  '0 0 * * *',
  $$
  delete from public.logs
  where created_at < now() - interval '7 days';
  $$
);

-- Grant permissions to the cron schema if necessary
grant usage on schema cron to postgres;
