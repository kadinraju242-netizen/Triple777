-- ============================================================
-- Triple 7 Holdings — one account can buy AND sell
-- ------------------------------------------------------------
-- Run this ONCE in the Supabase SQL Editor on a project that
-- already has the Trade Desk tables (you ran 01_schema.sql before
-- 9 October 2026). It changes the tables in place: no accounts,
-- lots or enquiries are lost.
--
-- New projects do not need it: 01_schema.sql already includes it.
--
-- Before:  profiles.role was 'buyer', 'seller' or 'admin'.
-- After:   profiles.is_buyer and profiles.is_seller say what an
--          account may do, and role is just 'member' or 'admin'.
-- ============================================================

alter table public.profiles add column if not exists is_buyer  boolean not null default false;
alter table public.profiles add column if not exists is_seller boolean not null default false;

update public.profiles set is_buyer  = true where role = 'buyer';
update public.profiles set is_seller = true where role = 'seller';

alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'member' where role is null or role in ('buyer', 'seller');
alter table public.profiles alter column role set default 'member';
alter table public.profiles alter column role set not null;
alter table public.profiles add constraint profiles_role_check check (role in ('member', 'admin'));

-- The functions that read the old role column, rewritten.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta  jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text := nullif(trim(coalesce(meta->>'full_name', meta->>'name', '')), '');
begin
  insert into public.profiles (id, email, is_buyer, is_seller, first_name, last_name, phone, country, company)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(meta->>'role', '') = 'buyer',
    coalesce(meta->>'role', '') = 'seller',
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
    is_buyer   = is_buyer  or p_role = 'buyer',
    is_seller  = is_seller or p_role = 'seller',
    first_name = coalesce(nullif(trim(p_first_name), ''), first_name),
    last_name  = coalesce(nullif(trim(p_last_name), ''),  last_name),
    phone      = coalesce(nullif(trim(p_phone), ''),      phone),
    country    = coalesce(nullif(trim(p_country), ''),    country),
    company    = coalesce(nullif(trim(p_company), ''),    company)
  where id = auth.uid()
  returning * into result;

  -- Sellers are known by name and phone number (buyers need only an email).
  if p_role = 'seller' and (coalesce(trim(result.first_name), '') = '' or coalesce(trim(result.last_name), '') = ''
                            or coalesce(trim(result.phone), '') = '') then
    raise exception 'Please add your name and phone number to sell.';
  end if;

  return result;
end;
$$;

create or replace function public.enable_role(p_role text)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  if p_role not in ('buyer', 'seller') then
    raise exception 'Choose buyer or seller.';
  end if;
  update public.profiles set
    is_buyer  = is_buyer  or p_role = 'buyer',
    is_seller = is_seller or p_role = 'seller'
  where id = auth.uid() and status = 'active'
  returning * into result;
  if result.id is null then
    raise exception 'This account is on hold.';
  end if;

  -- Sellers are known by name and phone number (buyers need only an email).
  if p_role = 'seller' and (coalesce(trim(result.first_name), '') = '' or coalesce(trim(result.last_name), '') = ''
                            or coalesce(trim(result.phone), '') = '') then
    raise exception 'Please add your name and phone number to sell.';
  end if;
  return result;
end;
$$;

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
      if not coalesce(me.is_seller, false) or me.status <> 'active' then
        raise exception 'Only an active seller account can list a lot.';
      end if;
      if coalesce(trim(me.first_name), '') = '' or coalesce(trim(me.phone), '') = '' then
        raise exception 'Please add your name and phone number before listing.';
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
      if not coalesce(me.is_buyer, false) or me.status <> 'active' then
        raise exception 'Only an active buyer account can send an enquiry.';
      end if;
      if lot.seller_id = auth.uid() then
        raise exception 'This is your own lot.';
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

create or replace function public.remove_admin(p_email text, p_new_role text default 'buyer')
returns text language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if p_new_role not in ('buyer', 'seller') then
    raise exception 'New role must be buyer or seller.';
  end if;
  update public.profiles set
    role = 'member',
    is_buyer  = is_buyer  or p_new_role = 'buyer',
    is_seller = is_seller or p_new_role = 'seller'
  where lower(email) = lower(trim(p_email)) and role = 'admin';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'No admin account with the email %.', p_email;
  end if;
  return p_email || ' is no longer an admin.';
end;
$$;

revoke all on function public.enable_role(text) from public, anon, authenticated;
grant execute on function public.enable_role(text) to authenticated;

-- The test seller who also buys (only if the test data is loaded).
update public.profiles set is_buyer = true where email = 'seller1@triple7.test';

notify pgrst, 'reload schema';

-- Check: how many accounts can buy, sell, or both.
select
  count(*) filter (where is_buyer and not is_seller) as buyers_only,
  count(*) filter (where is_seller and not is_buyer) as sellers_only,
  count(*) filter (where is_buyer and is_seller)     as both,
  count(*) filter (where role = 'admin')             as admins
from public.profiles;
