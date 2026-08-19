-- Dispatch pending lifecycle work every minute. The shared token is generated
-- outside source control and stored in both Supabase Vault and Edge secrets.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid from cron.job where jobname = 'tradenet-lifecycle-dispatch'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;

  perform cron.schedule(
    'tradenet-lifecycle-dispatch',
    '* * * * *',
    $dispatch$
      select net.http_post(
        url := 'https://edslmmldgknvyxujrbtx.supabase.co/functions/v1/lifecycle-dispatch',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-lifecycle-dispatch-secret', (
            select decrypted_secret
              from vault.decrypted_secrets
             where name = 'tradenet_lifecycle_dispatch_secret'
             limit 1
          )
        ),
        body := jsonb_build_object('source', 'cron'),
        timeout_milliseconds := 15000
      );
    $dispatch$
  );
end;
$$;

