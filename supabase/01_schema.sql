-- ============================================================
-- Triple 7 Holdings — Trade Desk database
-- ------------------------------------------------------------
-- Run this ONCE in the Supabase SQL Editor (paste the whole file,
-- press Run). It is safe to run again: it drops and rebuilds its
-- own tables, so only re-run it while you are still on test data.
--
-- What it creates
--   profiles          one row per account; an account can buy, sell or both
--   lots              everything a seller lists (pending -> live)
--   seller_documents  the supporting document for each listing,
--                     reviewed by an admin
--   enquiries         questions buyers send about a lot (to the desk)
--   enquiry_messages  the conversations: buyer <-> desk, desk <-> seller
--   buy_requests      "I can't find it": what a buyer wants sourced
--   lot_alerts        "tell me when new lots list" sign-ups
--
-- Who can do what is enforced HERE, by row-level security and
-- triggers, not by the web pages. A visitor who edits the page in
-- dev tools still cannot read or change anything these rules
-- do not allow.
-- ============================================================

drop table if exists public.lot_alerts        cascade;
drop table if exists public.buy_requests      cascade;
drop table if exists public.enquiry_messages  cascade;
drop table if exists public.enquiries         cascade;
drop table if exists public.seller_documents  cascade;
drop table if exists public.lots              cascade;
drop table if exists public.profiles          cascade;
drop sequence if exists public.lot_number_seq;
drop sequence if exists public.enquiry_number_seq;
drop sequence if exists public.request_number_seq;


-- ------------------------------------------------------------
-- 1. Profiles
-- ------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  -- 'admin' for the people who run the desk, 'member' for everyone else.
  role        text not null default 'member' check (role in ('member', 'admin')),
  -- One account can buy, sell, or both. Both false means "signed up
  -- (e.g. with Google) but has not said which yet".
  is_buyer    boolean not null default false,
  is_seller   boolean not null default false,
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
-- That metadata is typed by the visitor, so it can only switch on
-- buying or selling. Nobody can sign up as admin.
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Accounts that already existed before this file was run.
insert into public.profiles (id, email)
select id, coalesce(email, '') from auth.users
on conflict (id) do nothing;


-- Finishing or editing your own profile. p_role switches on buying
-- or selling for this account (it never switches anything off).
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

-- "Sign in as seller" with an account that so far only buys (or the
-- other way round): the same account simply gains the other side.
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


-- ------------------------------------------------------------
-- 4. Lots (seller listings)
-- ------------------------------------------------------------
-- The lot number prefix for each commodity (D-3001, FE-3002 …). It
-- is also the list of commodities the desk accepts: anything this
-- returns null for is refused by the check constraints below. Keep
-- it in step with js/catalog.js.
create or replace function public.lot_prefix(p_commodity text)
returns text language sql immutable as $$
  select case p_commodity
    when 'diamond'     then 'D'   when 'ruby'        then 'R'   when 'sapphire'  then 'SA'
    when 'emerald'     then 'E'   when 'tanzanite'   then 'T'
    when 'gold'        then 'G'   when 'silver'      then 'S'
    when 'platinum'    then 'P'   when 'palladium'   then 'PD'  when 'rhodium'   then 'RH'
    when 'iridium'     then 'IR'  when 'ruthenium'   then 'RU'
    when 'iron_ore'    then 'FE'  when 'manganese'   then 'MN'  when 'chrome'    then 'CR'
    when 'ferrochrome' then 'FC'  when 'vanadium'    then 'V'
    when 'copper'      then 'CU'  when 'nickel'      then 'NI'  when 'cobalt'    then 'CO'
    when 'zinc'        then 'ZN'  when 'lead'        then 'PB'  when 'aluminium' then 'AL'
    when 'coal'        then 'C'
    when 'titanium'    then 'TI'  when 'zircon'      then 'ZR'  when 'fluorspar' then 'FL'
    when 'phosphate'   then 'PH'  when 'andalusite'  then 'AN'  when 'vermiculite' then 'VM'
  end;
$$;

create sequence public.lot_number_seq start 3001;

create table public.lots (
  id           uuid primary key default gen_random_uuid(),
  lot_id       text not null unique,          -- D-3001, G-3002 … made automatically
  seller_id    uuid references public.profiles(id) on delete cascade,
  commodity    text not null check (public.lot_prefix(commodity) is not null),
  name         text not null check (length(trim(name)) >= 3),
  type         text,                          -- polished, rough, bar, coin …
  description  text,
  price_zar    numeric(14, 2) not null check (price_zar > 0),
  weight       numeric(12, 3) check (weight is null or weight > 0),
  weight_unit  text check (weight_unit in ('ct', 'g', 't')),   -- carats, grams, tonnes
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
    new.lot_id := public.lot_prefix(new.commodity) || '-' || nextval('public.lot_number_seq');
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
  -- Copied from the buyer's profile when the enquiry is sent, for the
  -- desk. Sellers never see these: they cannot read this table.
  buyer_name   text,
  buyer_email  text,
  buyer_phone  text,
  message      text not null check (length(trim(message)) >= 2),
  -- new             waiting for the desk
  -- with_seller     the desk asked the seller
  -- seller_replied  the seller answered the desk
  -- answered        the desk answered the buyer
  -- closed
  status       text not null default 'new'
                 check (status in ('new', 'with_seller', 'seller_replied', 'answered', 'closed')),
  forwarded_at    timestamptz,                -- when the desk first brought the seller in
  last_message_at timestamptz,
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

  elsif kind = 'user' and not public.is_admin()
        and coalesce(current_setting('t7.internal', true), '') <> '1' then
    -- Only the desk moves an enquiry along (messages do it for
    -- everyone else, through enquiry_messages_after).
    raise exception 'Only the desk can change an enquiry.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger enquiries_guard before insert or update on public.enquiries
  for each row execute function public.enquiries_guard();


-- ------------------------------------------------------------
-- 6b. Enquiry messages: every conversation goes through the desk
-- ------------------------------------------------------------
-- A buyer's enquiry goes to the desk, never straight to the
-- seller. The desk answers it, or asks the seller (without the
-- buyer's name or contact details); the seller answers the desk;
-- the desk answers the buyer. Two separate conversations per
-- enquiry, so neither side ever sees the other:
--   channel 'buyer'   buyer  <-> desk
--   channel 'seller'  seller <-> desk
create table public.enquiry_messages (
  id          uuid primary key default gen_random_uuid(),
  enquiry_id  uuid not null references public.enquiries(id) on delete cascade,
  channel     text not null check (channel in ('buyer', 'seller')),
  sender      text not null check (sender in ('buyer', 'seller', 'desk')),
  author_id   uuid references public.profiles(id) on delete set null,
  body        text not null check (length(trim(body)) >= 1 and length(body) <= 3000),
  created_at  timestamptz not null default now()
);

create index enquiry_messages_enquiry_idx on public.enquiry_messages (enquiry_id, created_at);

-- Which side of an enquiry the signed-in person is on: 'buyer',
-- 'seller' (only once the desk has brought them in), or null.
create or replace function public.enquiry_party(p_enquiry uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when e.buyer_id = auth.uid() then 'buyer'
    when e.seller_id = auth.uid() and e.forwarded_at is not null then 'seller'
  end
  from public.enquiries e where e.id = p_enquiry;
$$;

create or replace function public.enquiry_messages_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  kind  text := public.caller_kind();
  e     public.enquiries;
  me    public.profiles;
begin
  if kind = 'anon' then
    raise exception 'Sign in first.';
  end if;
  select * into e from public.enquiries where id = new.enquiry_id;
  if e.id is null then
    raise exception 'That enquiry does not exist.';
  end if;

  if kind = 'user' then
    select * into me from public.profiles where id = auth.uid();
    if me.status <> 'active' then
      raise exception 'This account is on hold.';
    end if;
    new.author_id  := auth.uid();
    new.created_at := now();
    if public.is_admin() then
      new.sender := 'desk';            -- the desk writes to either side
    elsif e.buyer_id = auth.uid() then
      new.sender  := 'buyer';
      new.channel := 'buyer';
    elsif e.seller_id = auth.uid() and e.forwarded_at is not null then
      new.sender  := 'seller';
      new.channel := 'seller';
    else
      raise exception 'This is not your enquiry.';
    end if;
    if e.status = 'closed' and new.sender <> 'desk' then
      raise exception 'This enquiry is closed. Send a new one from the lot page.';
    end if;
  end if;
  return new;
end;
$$;

create trigger enquiry_messages_guard before insert on public.enquiry_messages
  for each row execute function public.enquiry_messages_guard();

-- Moves the enquiry along after each message, so everyone can see
-- whose turn it is.
create or replace function public.enquiry_messages_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('t7.internal', '1', true);
  update public.enquiries set
    status = case
      when new.sender = 'buyer'                          then 'new'
      when new.sender = 'seller'                         then 'seller_replied'
      when new.sender = 'desk' and new.channel = 'seller' then 'with_seller'
      else 'answered'
    end,
    forwarded_at    = case when new.channel = 'seller' then coalesce(forwarded_at, now()) else forwarded_at end,
    last_message_at = now()
  where id = new.enquiry_id;
  perform set_config('t7.internal', '', true);
  return new;
end;
$$;

create trigger enquiry_messages_after after insert on public.enquiry_messages
  for each row execute function public.enquiry_messages_after();

-- What a seller sees of the enquiries the desk has brought them
-- into: the lot and where it stands. Never the buyer.
create or replace function public.seller_enquiries()
returns table (
  id uuid, ref text, lot_id uuid, lot_code text, lot_name text, commodity text,
  price_zar numeric, status text, forwarded_at timestamptz, last_message_at timestamptz, created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select e.id, e.ref, l.id, l.lot_id, l.name, l.commodity, l.price_zar,
         e.status, e.forwarded_at, e.last_message_at, e.created_at
  from public.enquiries e join public.lots l on l.id = e.lot_id
  where e.seller_id = auth.uid() and e.forwarded_at is not null
  order by coalesce(e.last_message_at, e.created_at) desc;
$$;


-- ------------------------------------------------------------
-- 6c. Buyer requests ("I can't find what I need")
-- ------------------------------------------------------------
-- A buyer describes what they want; the desk sources it. Only the
-- buyer and the desk ever see a request.
create sequence public.request_number_seq start 7001;

create table public.buy_requests (
  id               uuid primary key default gen_random_uuid(),
  ref              text not null unique,               -- REQ-7001
  buyer_id         uuid references public.profiles(id) on delete cascade,
  commodity        text not null check (public.lot_prefix(commodity) is not null),
  product_type     text,                               -- cut, bar, lump, cathode …
  specs            jsonb not null default '{}'::jsonb, -- the same detail keys as a lot
  quantity         numeric(14, 3) check (quantity is null or quantity > 0),
  quantity_unit    text check (quantity_unit in ('ct', 'g', 't')),
  budget_min       numeric(14, 2) check (budget_min is null or budget_min >= 0),
  budget_max       numeric(14, 2) check (budget_max is null or budget_max >= 0),
  delivery_country text,
  timeframe        text,
  notes            text check (notes is null or length(notes) <= 2000),
  status           text not null default 'new' check (status in ('new', 'sourcing', 'matched', 'closed')),
  desk_reply       text,                               -- what the desk tells the buyer
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index buy_requests_buyer_idx  on public.buy_requests (buyer_id);
create index buy_requests_status_idx on public.buy_requests (status);

create or replace function public.buy_requests_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  kind text := public.caller_kind();
  me   public.profiles;
begin
  if kind = 'anon' then
    raise exception 'Sign in first.';
  end if;

  if tg_op = 'INSERT' then
    if kind = 'user' then
      select * into me from public.profiles where id = auth.uid();
      if not coalesce(me.is_buyer, false) or me.status <> 'active' then
        raise exception 'Only an active buyer account can send a request.';
      end if;
      new.buyer_id   := auth.uid();
      new.status     := 'new';
      new.desk_reply := null;
      new.ref        := null;
      new.created_at := now();
    end if;
    if new.budget_min is not null and new.budget_max is not null and new.budget_max < new.budget_min then
      raise exception 'The highest budget is lower than the lowest.';
    end if;
    if new.ref is null or new.ref = '' then
      new.ref := 'REQ-' || nextval('public.request_number_seq');
    end if;

  elsif kind = 'user' and not public.is_admin() then
    -- A buyer may only withdraw their own request.
    if old.buyer_id is distinct from auth.uid() then
      raise exception 'This is not your request.';
    end if;
    if (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at')
       or new.status <> 'closed' then
      raise exception 'You can only withdraw a request. Send a new one to change it.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger buy_requests_guard before insert or update on public.buy_requests
  for each row execute function public.buy_requests_guard();


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


-- ------------------------------------------------------------
-- 9. Permissions
-- ------------------------------------------------------------
-- Start from nothing, then hand back only what each kind of
-- visitor needs. Row-level security then narrows it to the rows
-- they are allowed to touch.
revoke all on public.profiles, public.lots, public.seller_documents,
              public.enquiries, public.enquiry_messages, public.buy_requests,
              public.lot_alerts from anon, authenticated;
revoke all on sequence public.lot_number_seq, public.enquiry_number_seq, public.request_number_seq from anon, authenticated;

revoke all on function public.is_admin()                          from public, anon, authenticated;
revoke all on function public.my_role()                           from public, anon, authenticated;
revoke all on function public.caller_kind()                       from public, anon, authenticated;
revoke all on function public.complete_profile(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.enable_role(text)                   from public, anon, authenticated;
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
revoke all on function public.enquiry_party(uuid)                 from public, anon, authenticated;
revoke all on function public.enquiry_messages_guard()            from public, anon, authenticated;
revoke all on function public.enquiry_messages_after()            from public, anon, authenticated;
revoke all on function public.seller_enquiries()                  from public, anon, authenticated;
revoke all on function public.buy_requests_guard()                from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select                 on public.profiles         to authenticated;
grant select, insert, update, delete on public.lots     to authenticated;
grant select, update         on public.seller_documents to authenticated;
grant select, insert, update on public.enquiries        to authenticated;
grant select, insert         on public.enquiry_messages to authenticated;
grant select, insert, update on public.buy_requests     to authenticated;
grant select, delete         on public.lot_alerts       to authenticated;

grant execute on function public.is_admin()    to anon, authenticated;
grant execute on function public.my_role()     to anon, authenticated;
grant execute on function public.caller_kind() to anon, authenticated;
grant execute on function public.subscribe_lot_alerts(text, text[]) to anon, authenticated;
grant execute on function public.complete_profile(text, text, text, text, text, text) to authenticated;
grant execute on function public.enable_role(text) to authenticated;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
grant execute on function public.enquiry_party(uuid) to authenticated;
grant execute on function public.seller_enquiries() to authenticated;
grant execute on function public.lot_prefix(text) to anon, authenticated;
-- make_admin / remove_admin are deliberately granted to nobody.

alter table public.profiles         enable row level security;
alter table public.lots             enable row level security;
alter table public.seller_documents enable row level security;
alter table public.enquiries        enable row level security;
alter table public.enquiry_messages enable row level security;
alter table public.buy_requests     enable row level security;
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

-- enquiries: the buyer who sent it and the desk. NOT the seller:
-- sellers see only what public.seller_enquiries() gives them, which
-- leaves out who the buyer is.
create policy "buyer or admin read enquiries" on public.enquiries
  for select to authenticated
  using (buyer_id = auth.uid() or public.is_admin());

create policy "buyers send enquiries" on public.enquiries
  for insert to authenticated
  with check (buyer_id = auth.uid() or public.is_admin());

create policy "admins update enquiries" on public.enquiries
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- enquiry_messages: the desk reads both conversations; the buyer
-- reads only theirs with the desk; the seller only theirs with the
-- desk, and only once the desk has brought them in.
create policy "own side of the conversation" on public.enquiry_messages
  for select to authenticated
  using (public.is_admin() or public.enquiry_party(enquiry_id) = channel);

create policy "write to your side" on public.enquiry_messages
  for insert to authenticated
  with check (author_id = auth.uid() and (public.is_admin() or public.enquiry_party(enquiry_id) = channel));

-- buy_requests: the buyer who sent it and the desk.
create policy "own requests or admin" on public.buy_requests
  for select to authenticated
  using (buyer_id = auth.uid() or public.is_admin());

create policy "buyers send requests" on public.buy_requests
  for insert to authenticated
  with check (buyer_id = auth.uid() or public.is_admin());

create policy "buyer withdraws, admin manages" on public.buy_requests
  for update to authenticated
  using (buyer_id = auth.uid() or public.is_admin())
  with check (buyer_id = auth.uid() or public.is_admin());

-- lot_alerts: admins only.
create policy "admins read alerts" on public.lot_alerts
  for select to authenticated
  using (public.is_admin());

create policy "admins delete alerts" on public.lot_alerts
  for delete to authenticated
  using (public.is_admin());

-- Tell the API layer the tables changed.
notify pgrst, 'reload schema';
