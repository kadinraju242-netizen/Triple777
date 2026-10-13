-- ============================================================
-- Triple 7 Holdings — reviewed_at belongs to the database
-- ------------------------------------------------------------
-- Run after 04_investor_portal.sql. Additive: one function and one
-- trigger. No table, column, policy, grant or row is altered.
--
-- WHY
-- The approvals page sends reviewed_at from the admin's own machine,
-- so a wrong clock writes a wrong review date. This stamps it from
-- the database on any status change and ignores whatever the browser
-- sent, which also means a caller cannot backdate a review.
--
-- It is safe to run before or after the page is deployed. Without it
-- the page still works and the timestamp is simply the browser's.
--
-- HOW TO RUN IT
-- Run STEP 1 on its own, then STEP 2. The Supabase SQL Editor splits
-- a script on semicolons and handles a function body badly when other
-- statements share the submission, so there is no BEGIN/COMMIT here
-- and the body is quoted with $stamp$ rather than $$.
-- ============================================================


-- ============================================================
-- STEP 1 — run from "create or replace" to "$stamp$;"
-- ============================================================

create or replace function public.stamp_investor_review()
returns trigger
language plpgsql
as $stamp$
begin
  if new.status is distinct from old.status then
    new.reviewed_at := now();
  else
    -- An edit that does not change the decision keeps the original date.
    new.reviewed_at := old.reviewed_at;
  end if;
  return new;
end;
$stamp$;


-- ============================================================
-- STEP 2 — run these two lines
-- ============================================================

drop trigger if exists investor_application_reviewed_at on public.investor_applications;
create trigger investor_application_reviewed_at before update on public.investor_applications for each row execute function public.stamp_investor_review();


-- ============================================================
-- CHECK — should return one row
-- ============================================================
--
--   select tgname from pg_trigger
--    where tgrelid = 'public.investor_applications'::regclass
--      and not tgisinternal;
--
-- To undo:
--
--   drop trigger if exists investor_application_reviewed_at on public.investor_applications;
--   drop function if exists public.stamp_investor_review();
