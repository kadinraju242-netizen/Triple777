-- Run AFTER 04_investor_portal.sql. Additive; never resets Trade data.
begin;
alter table public.investor_interests
 add column if not exists status text not null default 'received',
 add column if not exists review_note text not null default '',
 add column if not exists updated_at timestamptz not null default now();
alter table public.investor_interests drop constraint if exists investor_interest_status;
alter table public.investor_interests add constraint investor_interest_status
 check(status in ('received','in_discussion','closed'));
alter table public.investor_interests add constraint investor_review_note_length check(length(review_note)<=2000);
create table public.investor_interest_history (
 id uuid primary key default gen_random_uuid(),
 interest_id uuid not null references public.investor_interests(id) on delete cascade,
 status text not null, review_note text not null default '',
 changed_by uuid references auth.users(id), created_at timestamptz not null default now()
);
alter table public.investor_interest_history enable row level security;
create policy investor_history_read on public.investor_interest_history for select to authenticated
 using(public.is_admin() or exists(select 1 from public.investor_interests i where i.id=interest_id and i.user_id=auth.uid() and public.is_approved_investor()));
grant select on public.investor_interest_history to authenticated;
create table public.investor_email_queue (
 id uuid primary key default gen_random_uuid(),
 interest_id uuid not null references public.investor_interests(id) on delete cascade,
 recipient_kind text not null check(recipient_kind in ('investor','team')),
 state text not null default 'pending' check(state in ('pending','processing','sent','failed')),
 attempts integer not null default 0,
 created_at timestamptz not null default now(), next_attempt_at timestamptz not null default now(),
 locked_at timestamptz, sent_at timestamptz, provider_id text, last_error text,
 unique(interest_id,recipient_kind)
);
alter table public.investor_email_queue enable row level security;
create policy investor_queue_admin_read on public.investor_email_queue for select to authenticated using(public.is_admin());
grant select on public.investor_email_queue to authenticated;
create index investor_queue_due on public.investor_email_queue(state,next_attempt_at);
create or replace function public.guard_investor_interest()
returns trigger language plpgsql set search_path=public as $$
begin
 if TG_OP='INSERT' then
  new.status:='received'; new.review_note:='';new.created_at:=now();new.updated_at:=now();
 else
  if not public.is_admin() and current_user <> 'service_role' then raise exception 'Only the team can review interests';end if;
  if new.id<>old.id or new.user_id<>old.user_id or new.project_id<>old.project_id or new.created_at<>old.created_at then raise exception 'Interest identity cannot change';end if;
  new.updated_at:=now();
 end if;
 return new;
end;$$;
create trigger investor_interest_guard before insert or update on public.investor_interests
 for each row execute function public.guard_investor_interest();
create policy investor_interests_admin_update on public.investor_interests for update to authenticated using(public.is_admin()) with check(public.is_admin());
grant update(status,review_note) on public.investor_interests to authenticated;
create or replace function public.record_investor_interest()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if TG_OP='INSERT' or new.status is distinct from old.status or new.review_note is distinct from old.review_note then
  insert into public.investor_interest_history(interest_id,status,review_note,changed_by) values(new.id,new.status,new.review_note,auth.uid());
 end if;
 if TG_OP='INSERT' then
  insert into public.investor_email_queue(interest_id,recipient_kind) values(new.id,'investor'),(new.id,'team');
 end if;
 return new;
end;$$;
create trigger investor_interest_record after insert or update on public.investor_interests
 for each row execute function public.record_investor_interest();
-- Existing interests get history, but are not emailed retroactively.
insert into public.investor_interest_history(interest_id,status,created_at)
 select id,status,created_at from public.investor_interests;
create or replace function public.claim_investor_emails()
returns setof public.investor_email_queue language plpgsql security definer set search_path=public as $$
begin
 update public.investor_email_queue set state='failed',last_error='Retry window expired; inspect manually'
 where state in ('pending','processing') and (attempts>=6 or created_at<now()-interval '23 hours');
 return query
 with jobs as (
  select id from public.investor_email_queue
  where (state='pending' and next_attempt_at<=now()) or (state='processing' and locked_at<now()-interval '10 minutes')
  order by created_at limit 10 for update skip locked
 ) update public.investor_email_queue q set state='processing',locked_at=now(),attempts=attempts+1
 from jobs where q.id=jobs.id returning q.*;
end;$$;
revoke all on function public.claim_investor_emails() from public,anon,authenticated;
grant execute on function public.claim_investor_emails() to service_role;
grant all on public.investor_email_queue to service_role;
commit;
