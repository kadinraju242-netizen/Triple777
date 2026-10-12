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

-- Should now show 0 test accounts, and only real rows elsewhere.
select 'test accounts left' as what, count(*) from public.profiles where email like '%@triple7.test'
union all select 'investor test applications left', count(*) from public.investor_applications where email like '%@triple7.test'
union all select 'seeded opportunities left', count(*) from public.investor_projects where id in ('22222222-0000-4000-8000-000000000001','22222222-0000-4000-8000-000000000002')
union all select 'accounts', count(*) from public.profiles
union all select 'lots', count(*) from public.lots
union all select 'enquiries', count(*) from public.enquiries;
