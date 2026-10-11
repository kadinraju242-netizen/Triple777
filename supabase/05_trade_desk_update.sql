-- ============================================================
-- Triple 7 Holdings — Trade Desk update (October 2026)
-- ------------------------------------------------------------
-- Run this ONCE in the Supabase SQL Editor on a project that
-- already has the Trade Desk (01_schema.sql, and
-- 04_buyers_can_sell.sql). Nothing is deleted: every account,
-- lot and enquiry stays.
--
-- What it changes
--   1. Commodities: South Africa's 26 leading mineral commodities
--      plus ruby, sapphire, emerald and tanzanite (30 in all), and
--      tonnes as a unit for bulk commodities.
--   2. Enquiries go through the desk. Sellers no longer see
--      enquiries or buyers' contact details. The desk answers the
--      buyer, or asks the seller and relays the answer.
--      (new table: enquiry_messages)
--   3. Buyer requests: a buyer can describe what they want and the
--      desk sources it. (new table: buy_requests)
--
-- New projects do not need it: 01_schema.sql already includes it.
-- ============================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_buyer') then
    raise exception 'Run 04_buyers_can_sell.sql first, then this file.';
  end if;
end $$;

-- ---------- 1. Commodities ----------
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


alter table public.lots drop constraint if exists lots_commodity_check;
alter table public.lots add constraint lots_commodity_check check (public.lot_prefix(commodity) is not null);
alter table public.lots drop constraint if exists lots_weight_unit_check;
alter table public.lots add constraint lots_weight_unit_check check (weight_unit in ('ct', 'g', 't'));

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

-- ---------- 2. Enquiries go through the desk ----------
alter table public.enquiries add column if not exists forwarded_at timestamptz;
alter table public.enquiries add column if not exists last_message_at timestamptz;
update public.enquiries set last_message_at = coalesce(last_message_at, updated_at, created_at);
alter table public.enquiries drop constraint if exists enquiries_status_check;
alter table public.enquiries add constraint enquiries_status_check
  check (status in ('new', 'with_seller', 'seller_replied', 'answered', 'closed'));

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
create table if not exists public.enquiry_messages (
  id          uuid primary key default gen_random_uuid(),
  enquiry_id  uuid not null references public.enquiries(id) on delete cascade,
  channel     text not null check (channel in ('buyer', 'seller')),
  sender      text not null check (sender in ('buyer', 'seller', 'desk')),
  author_id   uuid references public.profiles(id) on delete set null,
  body        text not null check (length(trim(body)) >= 1 and length(body) <= 3000),
  created_at  timestamptz not null default now()
);

create index if not exists enquiry_messages_enquiry_idx on public.enquiry_messages (enquiry_id, created_at);

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

drop trigger if exists enquiry_messages_guard on public.enquiry_messages;
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

drop trigger if exists enquiry_messages_after on public.enquiry_messages;
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
create sequence if not exists public.request_number_seq start 7001;

create table if not exists public.buy_requests (
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

create index if not exists buy_requests_buyer_idx  on public.buy_requests (buyer_id);
create index if not exists buy_requests_status_idx on public.buy_requests (status);

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

drop trigger if exists buy_requests_guard on public.buy_requests;
create trigger buy_requests_guard before insert or update on public.buy_requests
  for each row execute function public.buy_requests_guard();


-- ---------- Permissions ----------
revoke all on public.enquiry_messages, public.buy_requests from anon, authenticated;
revoke all on sequence public.request_number_seq from anon, authenticated;
revoke all on function public.enquiry_party(uuid)       from public, anon, authenticated;
revoke all on function public.enquiry_messages_guard()  from public, anon, authenticated;
revoke all on function public.enquiry_messages_after()  from public, anon, authenticated;
revoke all on function public.seller_enquiries()        from public, anon, authenticated;
revoke all on function public.buy_requests_guard()      from public, anon, authenticated;

grant select, insert         on public.enquiry_messages to authenticated;
grant select, insert, update on public.buy_requests     to authenticated;
grant execute on function public.enquiry_party(uuid) to authenticated;
grant execute on function public.seller_enquiries() to authenticated;
grant execute on function public.lot_prefix(text) to anon, authenticated;

alter table public.enquiry_messages enable row level security;
alter table public.buy_requests     enable row level security;

drop policy if exists "buyer, seller or admin read enquiries" on public.enquiries;
drop policy if exists "seller or admin update enquiries" on public.enquiries;
drop policy if exists "buyer or admin read enquiries" on public.enquiries;
drop policy if exists "buyers send enquiries" on public.enquiries;
drop policy if exists "admins update enquiries" on public.enquiries;
drop policy if exists "own side of the conversation" on public.enquiry_messages;
drop policy if exists "write to your side" on public.enquiry_messages;
drop policy if exists "own requests or admin" on public.buy_requests;
drop policy if exists "buyers send requests" on public.buy_requests;
drop policy if exists "buyer withdraws, admin manages" on public.buy_requests;

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

notify pgrst, 'reload schema';

-- Check: this should list the new tables with 0 or more rows.
select 'enquiry messages' as what, count(*) from public.enquiry_messages
union all select 'buyer requests', count(*) from public.buy_requests
union all select 'enquiries', count(*) from public.enquiries;
