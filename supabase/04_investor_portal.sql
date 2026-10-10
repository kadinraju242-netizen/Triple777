-- Additive investor migration. Run after the existing Trade schema.
-- Does not drop or replace existing tables.
begin;
create table if not exists public.investor_applications (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null,
 email text not null,
 phone text,
 country text,
 company text,
 application jsonb not null default '{}'::jsonb,
 status text not null default 'pending' check(status in ('pending','approved','rejected','suspended')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz
);
alter table public.investor_applications enable row level security;
create or replace function public.investor_signup_application()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.raw_user_meta_data->>'portal' = 'investor' then
  insert into public.investor_applications(user_id,full_name,email,phone,country,company,application)
  values(new.id,coalesce(nullif(new.raw_user_meta_data->>'full_name',''),new.email),new.email,
   new.raw_user_meta_data->>'phone',new.raw_user_meta_data->>'country',new.raw_user_meta_data->>'company',
   coalesce(new.raw_user_meta_data->'investor_application','{}'::jsonb))
  on conflict(user_id) do nothing;
 end if;
 return new;
end; $$;
drop trigger if exists investor_application_on_signup on auth.users;
create trigger investor_application_on_signup after insert on auth.users for each row execute function public.investor_signup_application();
-- Investors may read their own record; approval is set by an existing admin or SQL Editor.
drop policy if exists investor_application_read on public.investor_applications;
create policy investor_application_read on public.investor_applications for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists investor_application_admin_update on public.investor_applications;
create policy investor_application_admin_update on public.investor_applications for update to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,update on public.investor_applications to authenticated;
create or replace function public.is_approved_investor()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.investor_applications where user_id=auth.uid() and status='approved');
$$;
create table if not exists public.investor_projects (
 id uuid primary key default gen_random_uuid(), name text not null,
 description text not null default '', location text, published boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.investor_projects enable row level security;
drop policy if exists investor_projects_read on public.investor_projects;
create policy investor_projects_read on public.investor_projects for select to authenticated using((published and public.is_approved_investor()) or public.is_admin());
drop policy if exists investor_projects_admin on public.investor_projects;
create policy investor_projects_admin on public.investor_projects for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.investor_projects to authenticated;
create table if not exists public.investor_interests (
 id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users(id),
 project_id uuid not null references public.investor_projects(id),created_at timestamptz not null default now(),
 unique(user_id,project_id)
);
alter table public.investor_interests enable row level security;
drop policy if exists investor_interests_read on public.investor_interests;
create policy investor_interests_read on public.investor_interests for select to authenticated using((user_id=auth.uid() and public.is_approved_investor()) or public.is_admin());
drop policy if exists investor_interests_insert on public.investor_interests;
create policy investor_interests_insert on public.investor_interests for insert to authenticated with check(user_id=auth.uid() and public.is_approved_investor() and exists(select 1 from public.investor_projects where id=project_id and published));
grant select,insert on public.investor_interests to authenticated;
commit;
