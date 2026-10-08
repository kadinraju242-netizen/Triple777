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
-- Real accounts and anything they created are not touched.
-- ============================================================

delete from public.lot_alerts where email like '%@triple7.test';
delete from auth.users        where email like '%@triple7.test';

-- Should now show 0 test accounts, and only real rows elsewhere.
select 'test accounts left' as what, count(*) from public.profiles where email like '%@triple7.test'
union all select 'accounts', count(*) from public.profiles
union all select 'lots', count(*) from public.lots
union all select 'enquiries', count(*) from public.enquiries;
