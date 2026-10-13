-- ============================================================
-- Triple 7 Holdings — investor applications for accounts that
-- already exist
-- ------------------------------------------------------------
-- Run after 04_investor_portal.sql. Additive: it creates one
-- function and sets who may call it. No table, policy, trigger,
-- row or existing grant is altered.
--
-- WHY
-- Supabase Auth is a single identity directory, so a Trade account
-- and an investor account for the same person are one auth.users
-- row. Investor registration calls auth.signUp(), which for an
-- address that is already registered returns success without
-- inserting anything and without sending mail — deliberately, so it
-- cannot be used to discover who has an account. The application
-- row is created by a trigger on insert, so for those people no
-- application is ever filed and the portal has nothing to let them
-- into.
--
-- The fix is not to convert accounts silently. It is to let someone
-- who has signed in — and therefore proved the account is theirs —
-- file their own investor application.
--
-- HOW TO RUN IT
-- Run STEP 1 on its own, then STEP 2 on its own. The Supabase SQL
-- Editor splits a script on semicolons before sending it, which it
-- does badly when a function body and transaction control are in the
-- same submission, so there is deliberately no BEGIN/COMMIT here and
-- the body is quoted with $func$ rather than $$. Each step is safe to
-- run twice.
-- ============================================================


-- ============================================================
-- STEP 1 — select from "create or replace" down to "$func$;" and run it
-- ============================================================

create or replace function public.submit_investor_application(
  p_full_name   text,
  p_phone       text,
  p_country     text,
  p_company     text,
  p_application jsonb
) returns public.investor_applications
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_id    uuid := auth.uid();
  v_email text;
  v_row   public.investor_applications;
begin
  -- Refuses anyone who is not signed in, whatever the grants say.
  if v_id is null then
    raise exception 'Sign in before submitting an investor application.'
      using errcode = '28000';
  end if;

  select email into v_email from auth.users where id = v_id;

  -- Already applied: hand back what is on file rather than letting a
  -- resubmission overwrite a reviewed application.
  select * into v_row from public.investor_applications where user_id = v_id;
  if found then
    return v_row;
  end if;

  -- user_id and email come from the signed-in account, never from the
  -- browser, so nobody can file under someone else's address. status is
  -- set here, so a caller cannot arrive already approved.
  insert into public.investor_applications
    (user_id, full_name, email, phone, country, company, application, status)
  values
    (v_id,
     coalesce(nullif(trim(p_full_name), ''), v_email),
     v_email,
     nullif(trim(p_phone), ''),
     nullif(trim(p_country), ''),
     nullif(trim(p_company), ''),
     coalesce(p_application, '{}'::jsonb),
     'pending')
  returning * into v_row;

  return v_row;
end;
$func$;


-- ============================================================
-- STEP 2 — select these three lines and run them
-- Postgres grants EXECUTE to PUBLIC by default on a new function, so
-- this narrows it to signed-in callers. The function guards itself as
-- well, so an anonymous call is refused either way.
-- ============================================================

revoke all on function public.submit_investor_application(text, text, text, text, jsonb) from public;
revoke all on function public.submit_investor_application(text, text, text, text, jsonb) from anon;
grant execute on function public.submit_investor_application(text, text, text, text, jsonb) to authenticated;


-- ============================================================
-- CHECK — run this last; it should return one row
-- ============================================================
--
--   select p.proname, pg_get_function_identity_arguments(p.oid) as args
--     from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname = 'submit_investor_application';
--
--
-- Who has an account but no investor application:
--
--   select u.email, a.status as investor_application
--     from auth.users u
--     left join public.investor_applications a on a.user_id = u.id
--    where a.user_id is null
--    order by u.email;
--
-- To undo everything this file did:
--
--   drop function if exists public.submit_investor_application(text, text, text, text, jsonb);
