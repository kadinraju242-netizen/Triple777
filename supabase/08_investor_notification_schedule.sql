-- Only run after deploying the worker and setting up Vault secrets as documented.
-- The URL and worker token are stored in Vault, never in frontend files.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $$ begin
 if not exists(select 1 from vault.decrypted_secrets where name='investor_project_url')
 or not exists(select 1 from vault.decrypted_secrets where name='investor_worker_token')
 then raise exception 'Set the two investor worker Vault secrets first';end if;
end; $$;
select cron.unschedule(jobid) from cron.job where jobname='investor-interest-notifications';
select cron.schedule('investor-interest-notifications','* * * * *', $job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='investor_project_url') || '/functions/v1/investor-notifications',
  headers:=jsonb_build_object('Content-Type','application/json','x-investor-worker-token',(select decrypted_secret from vault.decrypted_secrets where name='investor_worker_token')),
  body:='{}'::jsonb,
  timeout_milliseconds:=300000
 );
$job$);
