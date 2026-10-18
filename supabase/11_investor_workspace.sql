-- Investor workspace: matching, confirmed holdings and dated project updates.
-- Run after 10_investor_review_timestamp.sql. No sample financial records are inserted.
begin;
alter table public.investor_projects
 add column if not exists country text,
 add column if not exists region text,
 add column if not exists commodity text,
 add column if not exists stage text,
 add column if not exists minimum_investment_zar numeric(18,2) check(minimum_investment_zar >= 100000),
 add column if not exists eligible_countries text[] not null default '{}';
create table if not exists public.investor_holdings (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.investor_applications(user_id),
 project_id uuid not null references public.investor_projects(id),
 amount numeric(18,2) not null check(amount > 0),
 currency text not null default 'ZAR' check(currency in ('ZAR','USD')),
 invested_on date not null,
 status text not null default 'active' check(status in ('active','completed','closed')),
 reference text,
 created_at timestamptz not null default now()
);
create table if not exists public.investor_project_updates (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.investor_projects(id),
 title text not null,
 body text not null,
 milestone text,
 progress_percent integer check(progress_percent between 0 and 100),
 published boolean not null default false,
 report_date date not null default current_date,
 created_at timestamptz not null default now()
);
alter table public.investor_holdings enable row level security;
alter table public.investor_project_updates enable row level security;
drop policy if exists investor_holdings_read on public.investor_holdings;
create policy investor_holdings_read on public.investor_holdings for select to authenticated
 using ((user_id=auth.uid() and public.is_approved_investor()) or public.is_admin());
drop policy if exists investor_holdings_admin on public.investor_holdings;
create policy investor_holdings_admin on public.investor_holdings for all to authenticated
 using(public.is_admin()) with check(public.is_admin());
drop policy if exists investor_updates_read on public.investor_project_updates;
create policy investor_updates_read on public.investor_project_updates for select to authenticated
 using(public.is_admin() or (published and public.is_approved_investor() and exists(select 1 from public.investor_holdings h where h.project_id=investor_project_updates.project_id and h.user_id=auth.uid())));
drop policy if exists investor_updates_admin on public.investor_project_updates;
create policy investor_updates_admin on public.investor_project_updates for all to authenticated
 using(public.is_admin()) with check(public.is_admin());
-- A holder can still read their own project's overview after it is unpublished.
drop policy if exists investor_owned_projects_read on public.investor_projects;
create policy investor_owned_projects_read on public.investor_projects for select to authenticated
 using(public.is_approved_investor() and exists(select 1 from public.investor_holdings h where h.project_id=investor_projects.id and h.user_id=auth.uid()));
grant select,insert,update,delete on public.investor_holdings,public.investor_project_updates to authenticated;
create or replace function public.update_investor_preferences(p_country text,p_capacity text,p_budget numeric,p_countries text,p_regions text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.is_approved_investor() then raise exception 'Approved investor access required'; end if;
 if nullif(trim(p_country),'') is null or p_budget < 100000 or p_budget is null then raise exception 'Country and a budget of at least R100,000 are required'; end if;
 if length(p_country)>80 or length(p_countries)>500 or length(p_regions)>500 then raise exception 'Preference value too long'; end if;
 update public.investor_applications set country=trim(p_country),application=application||jsonb_build_object('capacity',p_capacity,'investment_budget_zar',p_budget,'preferred_countries',trim(coalesce(p_countries,'')),'preferred_regions',trim(coalesce(p_regions,''))) where user_id=auth.uid();
end; $$;
revoke all on function public.update_investor_preferences(text,text,numeric,text,text) from public;
grant execute on function public.update_investor_preferences(text,text,numeric,text,text) to authenticated;
commit;
