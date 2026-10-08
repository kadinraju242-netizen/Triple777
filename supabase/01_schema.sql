-- ============================================================
-- Triple 7 Holdings — Trade Desk database
-- ------------------------------------------------------------
-- Run this ONCE in the Supabase SQL Editor (paste the whole file,
-- press Run). It is safe to run again: it drops and rebuilds its
-- own tables, so only re-run it while you are still on test data.
--
-- What it creates
--   profiles          one row per account: buyer, seller or admin
--   lots              everything a seller lists (pending -> live)
--   seller_documents  the supporting document for each listing,
--                     reviewed by an admin
--   enquiries         messages buyers send about a lot
--   lot_alerts        "tell me when new lots list" sign-ups
--
-- Who can do what is enforced HERE, by row-level security and
-- triggers, not by the web pages. A visitor who edits the page in
-- dev tools still cannot read or change anything these rules
-- do not allow.
-- ============================================================

drop table if exists public.lot_alerts        cascade;
drop table if exists public.enquiries         cascade;
drop table if exists public.seller_documents  cascade;
drop table if exists public.lots              cascade;
drop table if exists public.profiles          cascade;
drop sequence if exists public.lot_number_seq;
drop sequence if exists public.enquiry_number_seq;


-- ------------------------------------------------------------
-- 1. Profiles
-- ------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  -- null means "signed up (e.g. with Google) but has not picked buyer/seller yet"
  role        text check (role in ('buyer', 'seller', 'admin')),
  first_name  text,
  last_name   text,
  phone       text,
  country     text,
  company     text,
  status      text not null default 'active' check (status in ('active', 'suspended')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);


-- ------------------------------------------------------------
-- 2. Helper functions
-- ------------------------------------------------------------
-- "security definer" lets these read profiles without tripping the
-- row-level security on profiles itself.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and status = 'active';
$$;

-- Who is making this request?
--   'user'    a signed-in person coming through the website
--   'anon'    a visitor who is not signed in (can only join the alert list)
--   'system'  the SQL Editor or the service-role key (trusted)
create or replace function public.caller_kind()
returns text language sql stable as $$
  select case coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      nullif(current_setting('request.jwt.claim.role', true), ''),
      '')
    when 'authenticated' then 'user'
    when 'anon'          then 'anon'
    else 'system'
  end;
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();


-- ------------------------------------------------------------
-- 3. A profile is created automatically for every new account
-- ------------------------------------------------------------
-- The sign-up form sends name, phone, etc. as "user metadata".
-- That metadata is typed by the visitor, so the role is only
-- accepted if it is buyer or seller. Nobody can sign up as admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta  jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text := nullif(trim(coalesce(meta->>'full_name', meta->>'name', '')), '');
begin
  insert into public.profiles (id, email, role, first_name, last_name, phone, country, company)
  values (
    new.id,
    coalesce(new.email, ''),
    case when meta->>'role' in ('buyer', 'seller') then meta->>'role' end,
    coalesce(nullif(trim(meta->>'first_name'), ''), nullif(trim(meta->>'given_name'), ''), split_part(full_name, ' ', 1)),
    coalesce(nullif(trim(meta->>'last_name'), ''),  nullif(trim(meta->>'family_name'), ''),
             nullif(trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)), '')),
    nullif(trim(meta->>'phone'), ''),
    nullif(trim(meta->>'country'), ''),
    nullif(trim(meta->>'company'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Accounts that already existed before this file was run.
insert into public.profiles (id, email)
select id, coalesce(email, '') from auth.users
on conflict (id) do nothing;


-- Finishing or editing your own profile. The role can be chosen
-- once (buyer or seller) and never changed from the website.
create or replace function public.complete_profile(
  p_role text, p_first_name text, p_last_name text,
  p_phone text default null, p_country text default null, p_company text default null
) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;

  update public.profiles set
    role       = case when role is null and p_role in ('buyer', 'seller') then p_role else role end,
    first_name = coalesce(nullif(trim(p_first_name), ''), first_name),
    last_name  = coalesce(nullif(trim(p_last_name), ''),  last_name),
    phone      = coalesce(nullif(trim(p_phone), ''),      phone),
    country    = coalesce(nullif(trim(p_country), ''),    country),
    company    = coalesce(nullif(trim(p_company), ''),    company)
  where id = auth.uid()
  returning * into result;

  return result;
end;
$$;


-- ------------------------------------------------------------
-- 4. Lots (seller listings)
-- ------------------------------------------------------------
create sequence public.lot_number_seq start 3001;

create table public.lots (
  id           uuid primary key default gen_random_uuid(),
  lot_id       text not null unique,          -- D-3001, G-3002 … made automatically
  seller_id    uuid references public.profiles(id) on delete cascade,
  commodity    text not null check (commodity in
                 ('diamond', 'gold', 'platinum', 'silver', 'ruby', 'sapphire', 'emerald', 'tanzanite')),
  name         text not null check (length(trim(name)) >= 3),
  type         text,                          -- polished, rough, bar, coin …
  description  text,
  price_zar    numeric(14, 2) not null check (price_zar > 0),
  weight       numeric(12, 3) check (weight is null or weight > 0),
  weight_unit  text check (weight_unit in ('ct', 'g')),
  quantity     integer not null default 1 check (quantity > 0),
  origin       text,
  -- The details that differ per commodity (cut, colour, clarity, karat …).
  -- The field list lives in js/catalog.js.
  specs        jsonb not null default '{}'::jsonb,
  status       text not null default 'pending'
                 check (status in ('pending', 'live', 'rejected', 'sold', 'withdrawn')),
  review_note  text,                          -- what the admin told the seller
  reviewed_by  uuid references public.profiles(id) on delete set null,
  reviewed_at  timestamptz,
  image        text,
  image_card   text,
  image_alt    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index lots_status_idx    on public.lots (status);
create index lots_seller_idx    on public.lots (seller_id);
create index lots_commodity_idx on public.lots (commodity);

create or replace function public.lots_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  kind text := public.caller_kind();
  me   public.profiles;
begin
  if kind = 'anon' then
    raise exception 'Sign in first.';
  end if;

  if kind = 'user' and not public.is_admin() then
    select * into me from public.profiles where id = auth.uid();

    if tg_op = 'INSERT' then
      if me.role is distinct from 'seller' or me.status <> 'active' then
        raise exception 'Only an active seller account can list a lot.';
      end if;
      -- A seller cannot choose these. Every new listing waits for an admin.
      new.seller_id   := auth.uid();
      new.status      := 'pending';
      new.lot_id      := null;
      new.review_note := null;
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.created_at  := now();
    else
      if old.seller_id is distinct from auth.uid() then
        raise exception 'This is not your listing.';
      end if;
      -- The only thing a seller may change afterwards is to take a
      -- listing down or mark it sold.
      if (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
        raise exception 'A listing cannot be edited after it is submitted. Withdraw it and list it again.';
      end if;
      if not (
        (new.status = 'withdrawn' and old.status in ('pending', 'live', 'rejected')) or
        (new.status = 'sold'      and old.status = 'live') or
        new.status = old.status
      ) then
        raise exception 'That status change is not allowed.';
      end if;
    end if;
  end if;

  -- Record which admin approved or rejected, and when.
  if tg_op = 'UPDATE' and kind = 'user' and new.status is distinct from old.status and public.is_admin() then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;

  if tg_op = 'INSERT' and (new.lot_id is null or new.lot_id = '') then
    new.lot_id := case new.commodity
        when 'diamond'   then 'D'
        when 'gold'      then 'G'
        when 'platinum'  then 'P'
        when 'silver'    then 'S'
        when 'ruby'      then 'R'
        when 'sapphire'  then 'SA'
        when 'emerald'   then 'E'
        when 'tanzanite' then 'T'
      end || '-' || nextval('public.lot_number_seq');
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger lots_guard before insert or update on public.lots
  for each row execute function public.lots_guard();


-- ------------------------------------------------------------
-- 5. Seller documents
-- ------------------------------------------------------------
-- One supporting document per listing. For now sellers attach
-- nothing: an empty document record is created with each listing
-- so the admin review step already exists. When uploads are added
-- later, file_name / file_path are where they go.
create table public.seller_documents (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references public.profiles(id) on delete cascade,
  lot_id       uuid references public.lots(id) on delete cascade,
  doc_type     text not null default 'Seller verification',
  file_name    text,
  file_path    text,
  note         text,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note  text,
  reviewed_by  uuid references public.profiles(id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index seller_documents_seller_idx on public.seller_documents (seller_id);
create index seller_documents_status_idx on public.seller_documents (status);

create or replace function public.lots_create_document()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.seller_id is not null then
    insert into public.seller_documents (seller_id, lot_id, created_at)
    values (new.seller_id, new.id, new.created_at);
  end if;
  return new;
end;
$$;

create trigger lots_create_document after insert on public.lots
  for each row execute function public.lots_create_document();

create or replace function public.documents_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.caller_kind() = 'system' then
    return new;
  end if;
  if not public.is_admin() then
    raise exception 'Only an admin can review documents.';
  end if;
  if new.status is distinct from old.status then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

create trigger documents_guard before update on public.seller_documents
  for each row execute function public.documents_guard();


-- ------------------------------------------------------------
-- 6. Enquiries
-- ------------------------------------------------------------
create sequence public.enquiry_number_seq start 5001;

create table public.enquiries (
  id           uuid primary key default gen_random_uuid(),
  ref          text not null unique,          -- ENQ-5001
  lot_id       uuid not null references public.lots(id) on delete cascade,
  buyer_id     uuid references public.profiles(id) on delete cascade,
  seller_id    uuid references public.profiles(id) on delete cascade,
  -- Copied from the buyer's profile when the enquiry is sent, so the
  -- seller can reply without being able to read the profiles table.
  buyer_name   text,
  buyer_email  text,
  buyer_phone  text,
  message      text not null check (length(trim(message)) >= 2),
  status       text not null default 'new' check (status in ('new', 'answered', 'closed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index enquiries_lot_idx    on public.enquiries (lot_id);
create index enquiries_buyer_idx  on public.enquiries (buyer_id);
create index enquiries_seller_idx on public.enquiries (seller_id);

create or replace function public.enquiries_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  kind text := public.caller_kind();
  me   public.profiles;
  lot  public.lots;
begin
  if kind = 'anon' then
    raise exception 'Sign in first.';
  end if;

  if tg_op = 'INSERT' then
    select * into lot from public.lots where id = new.lot_id;
    if lot.id is null then
      raise exception 'That lot does not exist.';
    end if;

    if kind = 'user' then
      select * into me from public.profiles where id = auth.uid();
      if me.role is distinct from 'buyer' or me.status <> 'active' then
        raise exception 'Only an active buyer account can send an enquiry.';
      end if;
      if lot.status <> 'live' then
        raise exception 'This lot is no longer open for enquiries.';
      end if;
      new.buyer_id    := auth.uid();
      new.buyer_name  := trim(coalesce(me.first_name, '') || ' ' || coalesce(me.last_name, ''));
      new.buyer_email := me.email;
      new.buyer_phone := me.phone;
      new.status      := 'new';
      new.ref         := null;
      new.created_at  := now();
    end if;

    new.seller_id := lot.seller_id;
    if new.ref is null or new.ref = '' then
      new.ref := 'ENQ-' || nextval('public.enquiry_number_seq');
    end if;

  elsif kind = 'user' and not public.is_admin() then
    -- The seller who received it may only move its status along.
    if old.seller_id is distinct from auth.uid() then
      raise exception 'This is not your enquiry.';
    end if;
    if (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
      raise exception 'Only the status of an enquiry can be changed.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger enquiries_guard before insert or update on public.enquiries
  for each row execute function public.enquiries_guard();


-- ------------------------------------------------------------
-- 7. Lot alerts ("tell me when new lots list")
-- ------------------------------------------------------------
create table public.lot_alerts (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  interests   text[] not null default array['diamond', 'gold'],
  created_at  timestamptz not null default now()
);

-- Visitors add themselves through this function and can never read
-- the list. It answers the same way whether or not the address was
-- already there, so it cannot be used to test who has signed up.
create or replace function public.subscribe_lot_alerts(p_email text, p_interests text[] default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then
    raise exception 'That email address does not look right.';
  end if;
  insert into public.lot_alerts (email, interests)
  values (lower(trim(p_email)), coalesce(p_interests, array['diamond', 'gold']))
  on conflict (email) do update set interests = excluded.interests;
  return true;
end;
$$;


-- ------------------------------------------------------------
-- 8. Admin-only actions
-- ------------------------------------------------------------
create or replace function public.admin_set_user_status(p_user uuid, p_status text)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  result public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'Status must be active or suspended.';
  end if;
  if p_user = auth.uid() then
    raise exception 'You cannot suspend your own account.';
  end if;
  update public.profiles set status = p_status
  where id = p_user and role is distinct from 'admin'
  returning * into result;
  if result.id is null then
    raise exception 'Account not found, or it is an admin account.';
  end if;
  return result;
end;
$$;

-- Removes an account for good. Its profile, lots, documents and
-- enquiries go with it. Admin accounts cannot be removed this way.
create or replace function public.admin_delete_user(p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;
  if p_user = auth.uid() then
    raise exception 'You cannot delete your own account.';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and role is distinct from 'admin') then
    raise exception 'Account not found, or it is an admin account.';
  end if;
  delete from auth.users where id = p_user;
  return true;
end;
$$;

-- Admins are made HERE, in the database, and nowhere else. The
-- website has no button for it and cannot call these functions.
--
--   select public.make_admin('yourname+admin@gmail.com');
--   select public.remove_admin('yourname+admin@gmail.com');
--
-- The account must already exist (sign up on the site first).
create or replace function public.make_admin(p_email text)
returns text language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  update public.profiles set role = 'admin', status = 'active'
  where lower(email) = lower(trim(p_email));
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'No account with the email %. Sign up on the site with it first.', p_email;
  end if;
  return p_email || ' is now an admin.';
end;
$$;

create or replace function public.remove_admin(p_email text, p_new_role text default 'buyer')
returns text language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if p_new_role not in ('buyer', 'seller') then
    raise exception 'New role must be buyer or seller.';
  end if;
  update public.profiles set role = p_new_role
  where lower(email) = lower(trim(p_email)) and role = 'admin';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'No admin account with the email %.', p_email;
  end if;
  return p_email || ' is no longer an admin.';
end;
$$;


-- ------------------------------------------------------------
-- 9. Permissions
-- ------------------------------------------------------------
-- Start from nothing, then hand back only what each kind of
-- visitor needs. Row-level security then narrows it to the rows
-- they are allowed to touch.
revoke all on public.profiles, public.lots, public.seller_documents,
              public.enquiries, public.lot_alerts from anon, authenticated;
revoke all on sequence public.lot_number_seq, public.enquiry_number_seq from anon, authenticated;

revoke all on function public.is_admin()                          from public, anon, authenticated;
revoke all on function public.my_role()                           from public, anon, authenticated;
revoke all on function public.caller_kind()                       from public, anon, authenticated;
revoke all on function public.complete_profile(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.subscribe_lot_alerts(text, text[])  from public, anon, authenticated;
revoke all on function public.admin_set_user_status(uuid, text)   from public, anon, authenticated;
revoke all on function public.admin_delete_user(uuid)             from public, anon, authenticated;
revoke all on function public.make_admin(text)                    from public, anon, authenticated;
revoke all on function public.remove_admin(text, text)            from public, anon, authenticated;
revoke all on function public.handle_new_user()                   from public, anon, authenticated;
revoke all on function public.lots_guard()                        from public, anon, authenticated;
revoke all on function public.lots_create_document()              from public, anon, authenticated;
revoke all on function public.documents_guard()                   from public, anon, authenticated;
revoke all on function public.enquiries_guard()                   from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select                 on public.profiles         to authenticated;
grant select, insert, update, delete on public.lots     to authenticated;
grant select, update         on public.seller_documents to authenticated;
grant select, insert, update on public.enquiries        to authenticated;
grant select, delete         on public.lot_alerts       to authenticated;

grant execute on function public.is_admin()    to anon, authenticated;
grant execute on function public.my_role()     to anon, authenticated;
grant execute on function public.caller_kind() to anon, authenticated;
grant execute on function public.subscribe_lot_alerts(text, text[]) to anon, authenticated;
grant execute on function public.complete_profile(text, text, text, text, text, text) to authenticated;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
-- make_admin / remove_admin are deliberately granted to nobody.

alter table public.profiles         enable row level security;
alter table public.lots             enable row level security;
alter table public.seller_documents enable row level security;
alter table public.enquiries        enable row level security;
alter table public.lot_alerts       enable row level security;

-- profiles: you see your own row. Admins see everyone.
create policy "own profile or admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- lots: nothing for visitors who are not signed in (the Trade Desk is
-- members-only). Members see approved lots; sellers also see their
-- own, whatever the status; admins see everything.
create policy "members see live lots, own lots, or all if admin" on public.lots
  for select to authenticated
  using (status = 'live' or seller_id = auth.uid() or public.is_admin());

create policy "sellers list lots" on public.lots
  for insert to authenticated
  with check (seller_id = auth.uid() or public.is_admin());

create policy "sellers and admins update lots" on public.lots
  for update to authenticated
  using (seller_id = auth.uid() or public.is_admin())
  with check (seller_id = auth.uid() or public.is_admin());

create policy "admins delete lots" on public.lots
  for delete to authenticated
  using (public.is_admin());

-- seller_documents: the seller sees their own, admins see and review all.
create policy "own documents or admin" on public.seller_documents
  for select to authenticated
  using (seller_id = auth.uid() or public.is_admin());

create policy "admins review documents" on public.seller_documents
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- enquiries: visible to the buyer who sent it, the seller who
-- received it, and admins.
create policy "buyer, seller or admin read enquiries" on public.enquiries
  for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

create policy "buyers send enquiries" on public.enquiries
  for insert to authenticated
  with check (buyer_id = auth.uid() or public.is_admin());

create policy "seller or admin update enquiries" on public.enquiries
  for update to authenticated
  using (seller_id = auth.uid() or public.is_admin())
  with check (seller_id = auth.uid() or public.is_admin());

-- lot_alerts: admins only.
create policy "admins read alerts" on public.lot_alerts
  for select to authenticated
  using (public.is_admin());

create policy "admins delete alerts" on public.lot_alerts
  for delete to authenticated
  using (public.is_admin());

-- Tell the API layer the tables changed.
notify pgrst, 'reload schema';
