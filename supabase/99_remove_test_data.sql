-- ============================================================
-- Triple 7 Holdings — remove the test data
-- ------------------------------------------------------------
-- Run this in the Supabase SQL Editor BEFORE the site goes live.
--
-- It deletes every account on the @triple7.test domain. Their
-- lots, documents and enquiries go with them automatically, and so
-- does the test admin (desk+admin@triple7.test), whose password is
-- written in 02_test_data.sql for anyone to read.
--
-- It also removes the investor test accounts and the two seeded
-- opportunities from 06_investor_test_data.sql. Those accounts come
-- out with the domain delete below; the opportunities have no owner,
-- so they are named explicitly.
--
-- Real accounts and anything they created are not touched.
--
-- READ THIS FIRST
-- desk+admin@triple7.test is currently the ONLY admin, and the delete
-- below removes it. After that is_admin() is false for everybody: the
-- Admin Dashboard, Review Investor Interests and Investor Approvals
-- all become unreachable and no investor can be approved from the
-- site. Recovering means going back to the SQL Editor.
--
-- So: sign up a real address on the site, confirm it, promote it with
-- 03_make_admin.sql, and only then run this. STEP 0 stops you if you
-- forget. Run STEP 0 on its own — the Supabase SQL Editor handles a
-- dollar-quoted block badly when other statements share the
-- submission.
-- ============================================================


-- ============================================================
-- STEP 0 — run this alone. It changes nothing; it only refuses.
-- ============================================================

do $guard$
begin
  if not exists (
    select 1 from public.profiles
     where role = 'admin'
       and status = 'active'
       and email not like '%@triple7.test'
  ) then
    raise exception
      'Stop: every admin is a @triple7.test account, which the next step deletes. Create a real admin with 03_make_admin.sql first, or nobody will be able to approve investors afterwards.';
  end if;
end
$guard$;


-- ============================================================
-- STEP 1 — the cleanup itself
-- ============================================================

delete from public.lot_alerts where email like '%@triple7.test';
delete from auth.users        where email like '%@triple7.test';

-- Seeded investor opportunities (06_investor_test_data.sql). Any
-- registered interest in them goes first, since that is a plain
-- reference rather than a cascade.
delete from public.investor_interests
 where project_id in ('22222222-0000-4000-8000-000000000001',
                      '22222222-0000-4000-8000-000000000002');
delete from public.investor_projects
 where id in ('22222222-0000-4000-8000-000000000001',
              '22222222-0000-4000-8000-000000000002');

-- ============================================================
-- STEP 2 — check. Should show 0 test accounts, a real admin still
-- in place, and only real rows elsewhere.
-- ============================================================

select 'test accounts left' as what, count(*) from public.profiles where email like '%@triple7.test'
union all select 'admins remaining', count(*) from public.profiles where role = 'admin' and status = 'active'
union all select 'investor test applications left', count(*) from public.investor_applications where email like '%@triple7.test'
union all select 'seeded opportunities left', count(*) from public.investor_projects where id in ('22222222-0000-4000-8000-000000000001','22222222-0000-4000-8000-000000000002')
union all select 'accounts', count(*) from public.profiles
union all select 'lots', count(*) from public.lots
union all select 'enquiries', count(*) from public.enquiries;
