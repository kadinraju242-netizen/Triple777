-- ============================================================
-- Mine projects: project owners submit a full project profile,
-- the admin team reviews it, scores it and matches it to investors.
--
-- Additive and rerunnable. Run after 11_investor_workspace.sql.
-- Does not touch Trade or investor data.
--
-- Who can do what (enforced here, not in the browser):
--   any signed-in account   create projects and edit its own drafts
--                           (Trade, investor and project-only accounts
--                           all sign in with the same email/password)
--   the owner               read its own projects; edit only while the
--                           project is a draft or the team asked for
--                           changes; cannot set review fields
--   admin                   read and review everything, set status,
--                           review note and score, publish to investors
-- ============================================================
begin;

create table if not exists public.mine_projects (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status                text not null default 'draft'
                        check (status in ('draft','submitted','under_review','changes_requested','approved','rejected')),

  -- Project basics
  name                  text,
  commodity             text,
  commodity_other       text,
  summary               text,

  -- Location
  country               text not null default 'South Africa',
  province              text,
  district              text,
  municipality          text,
  latitude              numeric(9,6) check (latitude between -90 and 90),
  longitude             numeric(9,6) check (longitude between -180 and 180),
  geological_area       text,

  -- Ownership
  company               text,
  owner_role            text,
  shareholding          text,
  right_holder          text,
  jv_structure          text,

  -- Rights & regulatory
  right_status          text,
  right_reference       text,
  environmental_status  text,
  water_status          text,
  water_requirements    text,
  other_authorisations  text,

  -- Stage & technical
  project_stage         text,
  technical_status      text,
  estimated_resource    text,
  grade                 text,
  technical_notes       text,

  -- Production & infrastructure
  current_production    text,
  production_potential  text,
  infrastructure        text[] not null default '{}',
  infrastructure_notes  text,

  -- Commercial
  offtake_status        text,
  offtake_notes         text,
  capex_notes           text,
  opex_notes            text,

  -- Capital & investment
  capital_band          text,
  capital_required_zar  numeric(18,2) check (capital_required_zar is null or capital_required_zar > 0),
  funding_structure     text,
  capital_use           text[] not null default '{}',
  investor_requirements text[] not null default '{}',
  investment_requirement text,

  -- Management & risks
  management_status     text,
  management_notes      text,
  risks                 text,

  -- Uploaded files: [{path, name, kind, size}] in the project-documents bucket
  documents             jsonb not null default '[]'::jsonb,
  declaration           boolean not null default false,

  -- Set by the admin team only (the guard below keeps owners out)
  review_note           text,
  score                 integer check (score between 0 and 100),
  score_breakdown       jsonb,
  investor_project_id   uuid references public.investor_projects(id) on delete set null,

  submitted_at          timestamptz,
  reviewed_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists mine_projects_owner_idx  on public.mine_projects (owner_id);
create index if not exists mine_projects_status_idx on public.mine_projects (status);

-- ------------------------------------------------------------
-- Guard: what an owner may change, and the checks on submission
-- ------------------------------------------------------------
create or replace function public.mine_projects_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  admin boolean := public.is_admin();
begin
  if auth.uid() is null then
    raise exception 'Sign in to save a project.';
  end if;

  if not admin then
    if tg_op = 'INSERT' then
      new.owner_id := auth.uid();
      if new.status not in ('draft','submitted') then new.status := 'draft'; end if;
      new.review_note := null; new.score := null; new.score_breakdown := null;
      new.investor_project_id := null; new.reviewed_at := null; new.submitted_at := null;
      new.created_at := now();
    else
      if old.owner_id <> auth.uid() then
        raise exception 'This project belongs to another account.';
      end if;
      if old.status not in ('draft','changes_requested') then
        raise exception 'This project is with the team for review and can no longer be edited.';
      end if;
      if new.status not in ('draft','submitted', old.status) then
        raise exception 'Only the Triple 7 team can change a project''s review status.';
      end if;
      new.owner_id := old.owner_id;
      new.review_note := old.review_note;
      new.score := old.score;
      new.score_breakdown := old.score_breakdown;
      new.investor_project_id := old.investor_project_id;
      new.reviewed_at := old.reviewed_at;
      new.submitted_at := old.submitted_at;
      new.created_at := old.created_at;
    end if;

    -- Moving to "submitted": everything the team needs must be there.
    if new.status = 'submitted' and (tg_op = 'INSERT' or old.status <> 'submitted') then
      if nullif(trim(coalesce(new.name,'')),'') is null then raise exception 'Add the project name before submitting.'; end if;
      if nullif(trim(coalesce(new.commodity,'')),'') is null then raise exception 'Choose the commodity before submitting.'; end if;
      if nullif(trim(coalesce(new.province,'')),'') is null then raise exception 'Add the province or region before submitting.'; end if;
      if nullif(trim(coalesce(new.project_stage,'')),'') is null then raise exception 'Choose the project status before submitting.'; end if;
      if nullif(trim(coalesce(new.right_status,'')),'') is null then raise exception 'Give the licence or right status before submitting.'; end if;
      if nullif(trim(coalesce(new.capital_band,'')),'') is null then raise exception 'Choose the capital requirement before submitting.'; end if;
      if coalesce(array_length(new.investor_requirements,1),0) = 0 then raise exception 'Choose at least one type of investor support before submitting.'; end if;
      if not new.declaration then raise exception 'Confirm the declaration before submitting.'; end if;
      new.submitted_at := now();
    end if;
  else
    -- Admin: stamp the review time whenever the review status moves.
    if tg_op = 'UPDATE' and new.status is distinct from old.status
       and new.status in ('under_review','changes_requested','approved','rejected') then
      new.reviewed_at := now();
    end if;
    if tg_op = 'INSERT' and new.owner_id is null then new.owner_id := auth.uid(); end if;
  end if;

  -- Size limits on free text and file lists.
  if length(coalesce(new.summary,'')) > 4000 or length(coalesce(new.investment_requirement,'')) > 4000
     or length(coalesce(new.risks,'')) > 4000 or length(coalesce(new.technical_notes,'')) > 4000
     or length(coalesce(new.management_notes,'')) > 4000 or length(coalesce(new.review_note,'')) > 4000 then
    raise exception 'One of the text answers is too long (4,000 characters at most).';
  end if;
  if jsonb_typeof(new.documents) <> 'array' or jsonb_array_length(new.documents) > 30 then
    raise exception 'A project can carry at most 30 documents.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists mine_projects_guard on public.mine_projects;
create trigger mine_projects_guard before insert or update on public.mine_projects
  for each row execute function public.mine_projects_guard();

-- ------------------------------------------------------------
-- Row-level security
-- ------------------------------------------------------------
alter table public.mine_projects enable row level security;

drop policy if exists mine_projects_read on public.mine_projects;
create policy mine_projects_read on public.mine_projects for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());

drop policy if exists mine_projects_insert on public.mine_projects;
create policy mine_projects_insert on public.mine_projects for insert to authenticated
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists mine_projects_update on public.mine_projects;
create policy mine_projects_update on public.mine_projects for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Owners may throw away a draft they never sent; admins may remove any.
drop policy if exists mine_projects_delete on public.mine_projects;
create policy mine_projects_delete on public.mine_projects for delete to authenticated
  using ((owner_id = auth.uid() and status = 'draft') or public.is_admin());

grant select, insert, update, delete on public.mine_projects to authenticated;

-- ------------------------------------------------------------
-- Admin: approve a project and list it as an investor opportunity.
-- Creates (or updates) the matching investor_projects row so the
-- existing investor dashboard and matching pick it up.
-- ------------------------------------------------------------
create or replace function public.publish_mine_project(p_id uuid, p_minimum numeric, p_publish boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  p public.mine_projects;
  opp uuid;
  place text;
  commodity_label text;
  stage_label text;
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  select * into p from public.mine_projects where id = p_id for update;
  if not found then raise exception 'Project not found.'; end if;
  if p_minimum is null or p_minimum < 100000 then raise exception 'Minimum participation must be at least R100,000.'; end if;

  -- Investors see readable names, not the form's stored codes.
  commodity_label := case p.commodity
    when 'diamond' then 'Diamond' when 'gold' then 'Gold' when 'coal' then 'Coal' when 'chrome' then 'Chrome'
    when 'manganese' then 'Manganese' when 'titanium' then 'Titanium minerals' when 'pgm' then 'Platinum group metals'
    when 'iron_ore' then 'Iron ore' when 'copper' then 'Copper' when 'other' then nullif(trim(coalesce(p.commodity_other,'')),'')
    else p.commodity end;
  stage_label := case p.project_stage
    when 'greenfield' then 'Greenfield' when 'exploration' then 'Exploration' when 'prospecting' then 'Prospecting'
    when 'mining_right' then 'Mining right' when 'operational' then 'Operational' when 'care_maintenance' then 'Care & maintenance'
    when 'brownfield' then 'Brownfield' when 'expansion' then 'Expansion' when 'rehabilitation' then 'Rehabilitation / redevelopment'
    else p.project_stage end;

  place := concat_ws(', ', nullif(trim(coalesce(p.municipality,'')),''), nullif(trim(coalesce(p.district,'')),''),
                     nullif(trim(coalesce(p.province,'')),''), nullif(trim(coalesce(p.country,'')),''));

  if p.investor_project_id is not null and exists (select 1 from public.investor_projects where id = p.investor_project_id) then
    update public.investor_projects set
      name = coalesce(p.name, name), description = coalesce(p.summary, ''), location = place,
      country = p.country, region = p.province,
      commodity = commodity_label, stage = stage_label,
      minimum_investment_zar = p_minimum, published = p_publish
    where id = p.investor_project_id;
    opp := p.investor_project_id;
  else
    insert into public.investor_projects (name, description, location, published, country, region, commodity, stage, minimum_investment_zar)
    values (coalesce(p.name,'Mine project'), coalesce(p.summary,''), place, p_publish, p.country, p.province,
            commodity_label, stage_label, p_minimum)
    returning id into opp;
  end if;

  update public.mine_projects set investor_project_id = opp, status = 'approved' where id = p_id;
  return opp;
end;
$$;
revoke all on function public.publish_mine_project(uuid, numeric, boolean) from public;
grant execute on function public.publish_mine_project(uuid, numeric, boolean) to authenticated;

-- ------------------------------------------------------------
-- Private storage for project documents.
-- Files live at <owner user id>/<project id>/<file>; owners reach only
-- their own folder, admins can read everything.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-documents', 'project-documents', false, 26214400, array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists project_documents_insert on storage.objects;
create policy project_documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'project-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists project_documents_read on storage.objects;
create policy project_documents_read on storage.objects for select to authenticated
  using (bucket_id = 'project-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

drop policy if exists project_documents_delete on storage.objects;
create policy project_documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'project-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

commit;
